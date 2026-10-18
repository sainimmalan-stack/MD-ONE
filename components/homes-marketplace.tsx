"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  ArrowUpRight,
  Plus,
  LockKeyhole,
  X,
  RefreshCw,
  KeyRound,
  Home,
} from "lucide-react";
import "./homes-marketplace.css";
type R = Record<string, any>;
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
async function api(path: string, body?: R) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete this request.");
  return d;
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => before?.focus();
  }, []);
  return (
    <dialog
      className="homes-dialog"
      aria-label={title}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close home dialog" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function HomesMarketplace({ data }: { data: R }) {
  const [result, setResult] = useState<R | null>(null),
    [purpose, setPurpose] = useState(""),
    [project, setProject] = useState(""),
    [bhk, setBhk] = useState(""),
    [search, setSearch] = useState(""),
    [mine, setMine] = useState(false),
    [selected, setSelected] = useState<R | null>(null),
    [create, setCreate] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [photos, setPhotos] = useState<string[]>([]),
    [photoBusy, setPhotoBusy] = useState(false),
    [intent, setIntent] = useState("rent"),
    [phone, setPhone] = useState(""),
    [consent, setConsent] = useState(false),
    [formKey, setFormKey] = useState("");
  const seq = useRef(0);
  async function load() {
    const n = ++seq.current;
    try {
      const r = await api(
        "homes?" + new URLSearchParams({ purpose, project, bhk, search }),
      );
      if (n === seq.current) setResult(r);
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      seq.current++;
    };
  }, [purpose, project, bhk, search, data.user.id]);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      await load();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function detail(id: string) {
    const r = await run(() => api("homes/" + id));
    if (r) {
      setSelected(r);
      setPhone(r.ownContact || "");
      setConsent(false);
    }
  }
  async function action(body: R) {
    if (!selected) return;
    const r = await run(() => api(`homes/${selected.id}/action`, body));
    if (r) {
      const d = await run(() => api("homes/" + selected.id));
      if (d) {
        setSelected(d);
        setPhone(d.ownContact || "");
        setConsent(false);
      } else setSelected(null);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await run(() =>
      api("homes", {
        key: formKey,
        flatId: f.get("flatId"),
        purpose: intent,
        title: f.get("title"),
        description: f.get("description"),
        bhk: Number(f.get("bhk")),
        area: Number(f.get("area")),
        floor: Number(f.get("floor")),
        furnishing: f.get("furnishing"),
        parking: Number(f.get("parking")),
        available: f.get("available"),
        price: Math.round(Number(f.get("price")) * 100),
        deposit:
          intent === "rent" ? Math.round(Number(f.get("deposit")) * 100) : 0,
        photos,
      }),
    );
    if (r) {
      setCreate(false);
      setMine(true);
    }
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setPhotoBusy(true);
    setError("");
    try {
      if (files.length + photos.length > 8)
        throw new Error("Choose up to eight photos.");
      const images: string[] = [];
      for (const file of Array.from(files)) {
        if (
          !["image/jpeg", "image/png"].includes(file.type) ||
          file.size > 10000000
        )
          throw new Error("Choose PNG/JPEG photos smaller than 10 MB.");
        const image = await createImageBitmap(file);
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close();
        const value = canvas.toDataURL("image/jpeg", 0.75);
        if (value.length > 530000)
          throw new Error(
            "This photo is too detailed. Choose a smaller image.",
          );
        images.push(value);
      }
      setPhotos([...photos, ...images]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }
  const cards = mine ? result?.mine || [] : result?.listings || [];
  return (
    <section className="homes-marketplace">
      <div className="homes-intro">
        <div>
          <span className="homes-overline">
            Owner-listed. Community-connected.
          </span>
          <h2>A home, closer to your people.</h2>
          <p>Discover homes for rent or sale across My Dream Projects.</p>
        </div>
        {!!result?.ownedFlats.length && (
          <button
            className="homes-primary"
            onClick={() => {
              setIntent("rent");
              setPhotos([]);
              setFormKey(crypto.randomUUID());
              setCreate(true);
              setError("");
            }}
          >
            <Plus size={16} />
            List your home
          </button>
        )}
      </div>
      <div className="homes-tools">
        <div
          className="homes-intents"
          role="group"
          aria-label="Home listing type"
        >
          {[
            ["", "All homes"],
            ["rent", "For rent"],
            ["sale", "For sale"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={purpose === id && !mine}
              onClick={() => {
                setPurpose(id);
                setMine(false);
              }}
            >
              {label}
            </button>
          ))}
          <button aria-pressed={mine} onClick={() => setMine(!mine)}>
            My listings {result?.mine.length ? `(${result.mine.length})` : ""}
          </button>
        </div>
        <button
          className="homes-refresh"
          aria-label="Refresh homes"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {!mine && (
        <div className="homes-filters">
          <input
            aria-label="Search homes"
            placeholder="Search project or home…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Home project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">All MDP projects</option>
            {data.projects.map((p: R) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Bedrooms"
            value={bhk}
            onChange={(e) => setBhk(e.target.value)}
          >
            <option value="">Any BHK</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p className="homes-error" role="alert">
          {error}
        </p>
      )}
      {!result ? (
        <p className="homes-note" role="status">
          Loading community homes…
        </p>
      ) : !cards.length ? (
        <div className="homes-empty">
          <span className="homes-empty-icon">
            <Building2 size={48} strokeWidth={1} />
          </span>
          <span className="homes-overline">The next chapter starts here</span>
          <h3>
            {mine
              ? "Your home listings will appear here."
              : "A place for your next place."}
          </h3>
          <p>
            No homes match this view yet. Verified owners can list a flat for
            rent or sale; residents can connect directly with the owner.
          </p>
          {result.ownedFlats.length ? (
            <button
              onClick={() => {
                setIntent("rent");
                setPhotos([]);
                setFormKey(crypto.randomUUID());
                setCreate(true);
              }}
            >
              List your home <ArrowUpRight size={16} />
            </button>
          ) : (
            <span className="homes-note">
              Only verified flat owners can publish home listings.
            </span>
          )}
        </div>
      ) : (
        <div className="homes-grid">
          {cards.map((l: R) => (
            <button
              className="home-listing-card"
              key={l.id}
              onClick={() => void detail(l.id)}
            >
              <div className="home-listing-photo">
                {l.photos[0] ? (
                  <img src={l.photos[0]} alt={l.title} />
                ) : (
                  <div className="home-no-photo">
                    <Building2 size={58} strokeWidth={0.8} />
                    <span>Owner photos not added</span>
                  </div>
                )}
                <span className="home-purpose">
                  {l.purpose === "rent" ? "For rent" : "For sale"}
                </span>
                {l.status !== "available" && (
                  <span className="home-status">{l.status}</span>
                )}
              </div>
              <div className="home-listing-copy">
                <span>
                  {l.project} · {l.project_status}
                </span>
                <h3>{l.title}</h3>
                <div className="home-facts">
                  <span>{l.bhk} BHK</span>
                  <span>{l.area.toLocaleString("en-IN")} sq ft</span>
                  <span>{l.furnishing}</span>
                </div>
                <div className="home-price">
                  <b>
                    {money(l.price)}
                    {l.purpose === "rent" && <small> / month</small>}
                  </b>
                  <ArrowUpRight size={19} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {!mine && result?.next !== null && result?.next !== undefined && (
        <button
          className="homes-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await api(
                "homes?" +
                  new URLSearchParams({
                    purpose,
                    project,
                    bhk,
                    search,
                    offset: String(result.next),
                  }),
              );
              setResult({
                ...r,
                listings: [...result.listings, ...r.listings],
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more homes
        </button>
      )}
      <div className="homes-privacy">
        <LockKeyhole size={17} />
        <p>
          Private to verified MDP members. Exact flat numbers and documents stay
          private. Owners approve interest requests; phone sharing is optional.
          Visits, agreements and payments are arranged directly.
        </p>
      </div>
      {create && (
        <Dialog title="List your home" close={() => setCreate(false)}>
          <form onSubmit={submit} className="homes-form">
            <div className="homes-form-choice">
              {["rent", "sale"].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={intent === v}
                  onClick={() => setIntent(v)}
                >
                  {v === "rent" ? <KeyRound size={17} /> : <Home size={17} />}
                  For {v === "rent" ? "rent" : "sale"}
                </button>
              ))}
            </div>
            <label>
              Your verified flat
              <select name="flatId" required>
                {result?.ownedFlats.map((f: R) => (
                  <option key={f.id} value={f.id}>
                    {f.project} · {f.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="homes-note">
              Your exact flat number is used to verify ownership and is not
              displayed to viewers.
            </p>
            <label>
              Listing title
              <input
                name="title"
                required
                maxLength={100}
                placeholder="e.g. Bright 2 BHK with a balcony"
              />
            </label>
            <div className="homes-form-grid">
              <label>
                BHK
                <input
                  name="bhk"
                  type="number"
                  min={1}
                  max={6}
                  defaultValue={2}
                  required
                />
              </label>
              <label>
                Area · sq ft
                <input
                  name="area"
                  type="number"
                  min={100}
                  max={20000}
                  required
                />
              </label>
              <label>
                Floor
                <input
                  name="floor"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={0}
                  required
                />
              </label>
              <label>
                Parking spaces
                <input
                  name="parking"
                  type="number"
                  min={0}
                  max={5}
                  defaultValue={1}
                  required
                />
              </label>
              <label>
                Furnishing
                <select name="furnishing">
                  <option>Unfurnished</option>
                  <option>Semi-furnished</option>
                  <option>Furnished</option>
                </select>
              </label>
              <label>
                Available from
                <input name="available" type="date" required />
              </label>
              <label>
                {intent === "rent" ? "Monthly rent · ₹" : "Asking price · ₹"}
                <input
                  name="price"
                  type="number"
                  min={1}
                  max={1000000000}
                  step="1"
                  required
                />
              </label>
              {intent === "rent" && (
                <label>
                  Security deposit · ₹
                  <input
                    name="deposit"
                    type="number"
                    min={0}
                    defaultValue={0}
                    required
                  />
                </label>
              )}
            </div>
            <label>
              About the home
              <textarea
                name="description"
                required
                maxLength={1500}
                placeholder="Describe the space, terms and availability. Leave out phone numbers, flat number and personal documents."
              />
            </label>
            <label>
              Home photos · up to 8
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
            {photos.length > 0 && (
              <div className="homes-photo-strip">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, n) => n !== i))}
                    aria-label={`Remove home photo ${i + 1}`}
                  >
                    <img src={p} alt={`Home photo ${i + 1}`} />
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}
            <p className="homes-note">
              Available for 30 days. Renew from My listings; mark it rented or
              sold when complete. Prices are owner-provided. Listing here does
              not imply MDP has verified the property’s condition or price.
            </p>
            <label className="homes-consent">
              <input type="checkbox" required />I am authorised to list this
              flat and agree to share these listing details with verified MDP
              members.
            </label>
            {error && (
              <p className="homes-error" role="alert">
                {error}
              </p>
            )}
            <button className="homes-primary" disabled={busy || photoBusy}>
              {photoBusy
                ? "Preparing photos…"
                : busy
                  ? "Publishing…"
                  : "Publish home listing"}
            </button>
          </form>
        </Dialog>
      )}
      {selected && (
        <Dialog title={selected.title} close={() => setSelected(null)}>
          <div className="home-detail">
            {selected.photos.length > 0 && (
              <div className="home-detail-photos">
                {selected.photos.map((p: string, i: number) => (
                  <img key={i} src={p} alt={`Home photo ${i + 1}`} />
                ))}
              </div>
            )}
            <div className="home-detail-heading">
              <span>
                {selected.project} ·{" "}
                {selected.purpose === "rent" ? "For rent" : "For sale"}
              </span>
              <strong>
                {money(selected.price)}
                {selected.purpose === "rent" && <small> / month</small>}
              </strong>
              <span>
                {selected.status} · Available {selected.available}
              </span>
            </div>
            <div className="home-detail-facts">
              {[
                `${selected.bhk} BHK`,
                `${selected.area} sq ft`,
                `Floor ${selected.floor}`,
                selected.furnishing,
                `${selected.parking} parking space(s)`,
              ].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            {selected.purpose === "rent" && (
              <p>Security deposit: {money(selected.deposit)}</p>
            )}
            <p className="home-description">{selected.description}</p>
            <p className="homes-note">
              Listed by {selected.owner} · Ownership checked against {data.hosted ? 'your verified MDP ownership record' : 'the local demo register'}. Exact flat number stays private.
            </p>
            {selected.own ? (
              <>
                <div className="homes-owner-actions">
                  {selected.status === "available" ||
                  selected.status === "expired" ? (
                    <>
                      <button
                        onClick={() => void action({ action: "renew" })}
                        disabled={busy}
                      >
                        Renew for 30 days
                      </button>
                      <button
                        onClick={() =>
                          void action({
                            action: "status",
                            status:
                              selected.purpose === "rent" ? "rented" : "sold",
                          })
                        }
                        disabled={busy}
                      >
                        Mark {selected.purpose === "rent" ? "rented" : "sold"}
                      </button>
                      <button
                        onClick={() =>
                          void action({ action: "status", status: "withdrawn" })
                        }
                        disabled={busy}
                      >
                        Withdraw listing
                      </button>
                    </>
                  ) : (
                    <p className="homes-note">
                      This listing is closed. Contact sharing has stopped.
                    </p>
                  )}
                </div>
                <h3>Resident interest</h3>
                {!selected.interests.length && (
                  <p className="homes-note">
                    New requests will appear here. Use Refresh while this view
                    is open.
                  </p>
                )}
                {selected.interests.map((q: R) => (
                  <div className="home-interest" key={q.id}>
                    <b>{q.name}</b>
                    <span>{q.status}</span>
                    {q.status === "pending" &&
                      selected.status === "available" && (
                        <div>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action({ action: "accept", requestId: q.id })
                            }
                          >
                            Accept interest
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action({
                                action: "decline",
                                requestId: q.id,
                              })
                            }
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    {q.contact && (
                      <a href={`tel:${q.contact}`}>Call {q.contact}</a>
                    )}
                  </div>
                ))}
              </>
            ) : selected.status === "available" ? (
              <>
                {!selected.interests.length ? (
                  <button
                    className="homes-primary"
                    disabled={busy}
                    onClick={() => void action({ action: "interest" })}
                  >
                    I'm interested <ArrowUpRight size={16} />
                  </button>
                ) : (
                  selected.interests.map((q: R) => (
                    <div className="home-interest" key={q.id}>
                      <b>
                        {q.status === "accepted"
                          ? "The owner accepted your interest"
                          : `Interest ${q.status}`}
                      </b>
                      {q.status === "accepted" &&
                        (selected.contact ? (
                          <a href={`tel:${selected.contact}`}>
                            Call owner · {selected.contact}
                          </a>
                        ) : (
                          <p className="homes-note">
                            The owner has not shared a phone number yet.
                          </p>
                        ))}
                      {["pending", "accepted"].includes(q.status) && (
                        <button
                          disabled={busy}
                          onClick={() => void action({ action: "withdraw" })}
                        >
                          Withdraw interest
                        </button>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : (
              <p className="homes-note">This listing is no longer available.</p>
            )}
            {selected.status === "available" &&
              (selected.own ||
                selected.interests.some((q: R) => q.status === "accepted")) && (
                <form
                  className="homes-contact"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action({ action: "contact", contact: phone, consent });
                  }}
                >
                  <h3>Share your phone, by choice</h3>
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
                  <label className="homes-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      required
                    />
                    Share this number with{" "}
                    {selected.own
                      ? "accepted residents on this listing"
                      : "this owner"}
                    .
                  </label>
                  <p className="homes-note">
                    Your profile stays locked. Removing a number cannot erase
                    copies someone has saved.
                  </p>
                  <button disabled={busy} type="submit">
                    Share phone
                  </button>
                  {selected.ownContact && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void action({ action: "contact", contact: "" })
                      }
                    >
                      Stop sharing
                    </button>
                  )}
                </form>
              )}
            <button
              className="homes-secondary"
              disabled={busy}
              onClick={() => void detail(selected.id)}
            >
              <RefreshCw size={14} />
              Refresh details
            </button>
            {error && (
              <p className="homes-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
