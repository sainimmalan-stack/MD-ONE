"use client";
import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  CarFront,
  MapPin,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  LockKeyhole,
} from "lucide-react";
import "./carpool.css";
type Row = Record<string, any>;
export function Carpool({ data, act, busy, api }: any) {
  const [offer, setOffer] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [date, setDate] = useState(""),
    [view, setView] = useState("discover");
  const [contactRide, setContactRide] = useState<Row | null>(null),
    [phone, setPhone] = useState(""),
    [report, setReport] = useState<Row | null>(null),
    [reason, setReason] = useState("");
  const mine = (r: Row) => r.user_id === data.user.id;
  const rides = data.rides.filter(
    (r: Row) =>
      r.pickup.toLowerCase().includes(from.toLowerCase().trim()) &&
      r.destination.toLowerCase().includes(to.toLowerCase().trim()) &&
      (!date ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(r.departure)) === date) &&
      (view === "offers"
        ? mine(r)
        : view === "connections"
          ? r.requests.some((q: Row) =>
              ["pending", "accepted"].includes(q.status),
            )
          : !mine(r)),
  );
  async function action(r: Row, body: Row, message: string) {
    return act(() => api(`rides/${r.id}`, "PATCH", body), message);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await act(
      () =>
        api("rides", "POST", {
          pickup: f.get("pickup"),
          destination: f.get("destination"),
          departure: new Date(String(f.get("departure"))).toISOString(),
          seats: Number(f.get("seats")),
          recurrence: "once",
        }),
      "Your journey is open for connections",
    );
    if (ok) {
      setOffer(false);
      setView("offers");
    }
  }
  const contactButton = (r: Row) => (
    <button
      className="button outline"
      disabled={busy}
      onClick={() => {
        setContactRide(r);
        setPhone(r.ownContact || "");
      }}
    >
      {r.ownContact ? "Manage shared phone" : "Choose to share phone"}
    </button>
  );
  return (
    <div className="connect-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MD One CONNECT / NEIGHBOURHOOD RIDES</span>
          <h1>
            A familiar face.
            <br />A shared direction<span className="gold-dot">.</span>
          </h1>
          <p>
            Find neighbours going your way. Connect, then make your own
            arrangements.
          </p>
        </div>
        <button
          className="button"
          disabled={!data.services?.carpool}
          onClick={() => setOffer(true)}
        >
          <Plus size={17} />
          Offer a journey
        </button>
      </div>
      <div className="connect-hero">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={15} /> YOUR COMMUNITY. YOUR CONNECTIONS.
          </span>
          <h2>
            Good company
            <br />
            starts close to home.
          </h2>
          <p>
            Discover a commute. Send a request. Connect when you both say yes.
          </p>
          <div className="connect-steps">
            <span>01 · Discover</span>
            <span>02 · Connect</span>
            <span>03 · Go together</span>
          </div>
        </div>
        <CarFront className="connect-car" size={180} strokeWidth={0.8} />
      </div>
      <div className="connect-search panel">
        <label>
          Leaving from
          <input
            placeholder="Pickup area"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Going to
          <input
            placeholder="Destination"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Journey date · IST
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          className="text-link"
          onClick={() => {
            setFrom("");
            setTo("");
            setDate("");
          }}
        >
          Clear filters
        </button>
      </div>
      <div className="connect-tabs" role="tablist" aria-label="Journey views">
        {[
          ["discover", "Discover"],
          ["connections", "My connections"],
          ["offers", "My offers"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
        <span>{rides.length} journeys</span>
      </div>
      {!data.services?.carpool ? (
        <div className="panel connect-empty">
          Connections are not enabled for your project yet.
        </div>
      ) : !rides.length ? (
        <div className="panel connect-empty">
          <CarFront size={36} />
          <h3>No journeys here yet</h3>
          <p>Try another area or date, or offer your own journey.</p>
        </div>
      ) : (
        <div className="ride-grid">
          {rides.map((r: Row) => (
            <article className="panel ride-card connect-card" key={r.id}>
              <div className="card-row">
                <span className="avatar pale">{r.driver[0]}</span>
                <div className="grow">
                  <b>{r.driver}</b>
                  <small>{r.project} · demo resident</small>
                </div>
                <span className="badge">{r.seats} seats</span>
              </div>
              <div className="ride-route">
                <div>
                  <i />
                  <span>{r.pickup}</span>
                </div>
                <div>
                  <MapPin size={16} />
                  <b>{r.destination}</b>
                </div>
              </div>
              <p className="connect-date">
                {new Date(r.departure).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                IST
              </p>
              <div className="connect-privacy">
                <LockKeyhole size={14} /> Contact shared only by choice, after
                acceptance
              </div>
              {mine(r) ? (
                <>
                  <div className="connect-actions">
                    {contactButton(r)}
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        action(r, { action: "cancel" }, "Journey cancelled")
                      }
                    >
                      Cancel journey
                    </button>
                  </div>
                  {r.requests.map((q: Row) => (
                    <div className="connect-request" key={q.id}>
                      <b>{q.name}</b>
                      <span>
                        {q.status === "accepted" ? "Connected" : q.status}
                      </span>
                      {q.status === "pending" && (
                        <div className="connect-actions">
                          <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              action(
                                r,
                                { action: "accept", requestId: q.id },
                                "Connection accepted",
                              )
                            }
                          >
                            Accept connection
                          </button>
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() =>
                              action(
                                r,
                                { action: "reject", requestId: q.id },
                                "Request declined",
                              )
                            }
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {q.status === "accepted" && (
                        <>
                          <Contact phone={q.contact} />
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() =>
                              action(
                                r,
                                { action: "block", targetId: q.user_id },
                                "Resident blocked",
                              )
                            }
                          >
                            Block resident
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {!r.requests.length ? (
                    <button
                      className="button outline full"
                      disabled={busy || !r.seats}
                      onClick={() =>
                        action(
                          r,
                          { action: "request" },
                          "Connection request sent",
                        )
                      }
                    >
                      Connect with {r.driver.split(" ")[0]}{" "}
                      <ArrowUpRight size={17} />
                    </button>
                  ) : (
                    r.requests.map((q: Row) => (
                      <div className="connect-request" key={q.id}>
                        <b>
                          {q.status === "accepted"
                            ? "You're connected"
                            : q.status === "pending"
                              ? "Waiting for acceptance"
                              : `Request ${q.status}`}
                        </b>
                        {q.status === "accepted" && (
                          <>
                            <Contact phone={r.contact} />
                            {contactButton(r)}
                          </>
                        )}
                        {["pending", "accepted"].includes(q.status) && (
                          <button
                            className="text-link"
                            disabled={busy}
                            onClick={() =>
                              action(
                                r,
                                { action: "withdraw" },
                                "Connection withdrawn; contact access removed",
                              )
                            }
                          >
                            Withdraw connection
                          </button>
                        )}
                      </div>
                    ))
                  )}
                  <div className="connect-actions">
                    <button
                      className="text-link"
                      onClick={() => {
                        setReport(r);
                        setReason("");
                      }}
                    >
                      Report journey
                    </button>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        action(
                          r,
                          { action: "block", targetId: r.user_id },
                          "Resident blocked",
                        )
                      }
                    >
                      Block resident
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="inline-note">
        <ShieldCheck size={20} />
        <p>
          MDP helps residents connect. Ride arrangements and any payments are
          agreed directly between participants. MDP does not collect ride
          payments or provide carpool tracking. Search currently matches area
          names; road-route matching is not connected.
        </p>
      </div>
      {offer && (
        <ConnectDialog onClose={() => setOffer(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Offer a journey"
          >
            <button className="text-link" onClick={() => setOffer(false)}>
              Close
            </button>
            <h2>Where are you heading?</h2>
            <form onSubmit={submit}>
              <label>
                Public pickup area
                <input
                  name="pickup"
                  required
                  maxLength={100}
                  placeholder="Project entrance or public landmark"
                />
              </label>
              <label>
                Destination area
                <input
                  name="destination"
                  required
                  maxLength={100}
                  placeholder="e.g. Financial District"
                />
              </label>
              <label>
                Departure · your device’s local time
                <input name="departure" type="datetime-local" required />
              </label>
              <label>
                Available seats
                <input
                  name="seats"
                  type="number"
                  min={1}
                  max={6}
                  defaultValue={2}
                  required
                />
              </label>
              <p className="muted">
                Use public meeting areas. Keep your flat address private. You
                can choose to share a phone number after publishing.
              </p>
              <button className="button full" disabled={busy}>
                Publish journey
              </button>
            </form>
          </section>
        </ConnectDialog>
      )}
      {contactRide && (
        <ConnectDialog onClose={() => setContactRide(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Contact sharing"
          >
            <button className="text-link" onClick={() => setContactRide(null)}>
              Close
            </button>
            <h2>Your phone. Your choice.</h2>
            <p>
              This number is visible only to accepted connections on this
              journey. It does not unlock your resident profile. Removing it
              cannot erase a number someone has already saved.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await action(
                    contactRide,
                    { action: "share_contact", contact: phone },
                    "Contact sharing updated",
                  )
                )
                  setContactRide(null);
              }}
            >
              <label>
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="\+?[0-9]{10,15}"
                  required
                  placeholder="+919876543210"
                />
              </label>
              <label className="connect-consent">
                <input type="checkbox" required />I consent to sharing this
                number with accepted connections on this journey.
              </label>
              <button className="button" disabled={busy}>
                Share with connections
              </button>
            </form>
            {contactRide.ownContact && (
              <button
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  if (
                    await action(
                      contactRide,
                      { action: "share_contact", contact: "" },
                      "Phone sharing stopped",
                    )
                  )
                    setContactRide(null);
                }}
              >
                Stop sharing my number
              </button>
            )}
          </section>
        </ConnectDialog>
      )}
      {report && (
        <ConnectDialog onClose={() => setReport(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Report journey"
          >
            <button className="text-link" onClick={() => setReport(null)}>
              Close
            </button>
            <h2>Report this journey</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await action(
                    report,
                    { action: "report", reason },
                    "Report submitted for review",
                  )
                )
                  setReport(null);
              }}
            >
              <label>
                What happened?
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button className="button" disabled={busy}>
                Submit report
              </button>
            </form>
          </section>
        </ConnectDialog>
      )}
    </div>
  );
}
function Contact({ phone }: { phone: string | null }) {
  return phone ? (
    <a className="button outline" href={`tel:${phone}`}>
      Call {phone}
    </a>
  ) : (
    <p className="muted">Your neighbour has not shared a phone number yet.</p>
  );
}

function ConnectDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="connect-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
