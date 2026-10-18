"use client";
import { CommunityHighlights } from "./community-highlights";
import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Search,
  MapPin,
  ShieldCheck,
  LockKeyhole,
  UserPlus,
  UserCheck,
  Check,
  Heart,
  MessageCircle,
  Send,
  ImagePlus,
  SlidersHorizontal,
  MoreHorizontal,
  Building2,
  Users,
  Grid2X2,
  Droplets,
  Zap,
  Paintbrush,
  Hammer,
  Sparkles,
  Umbrella,
  Wind,
  Clock3,
  ChevronRight,
  Camera,
  Globe2,
  Eye,
  EyeOff,
  CalendarDays,
  Wrench,
  LoaderCircle,
  Settings,
  Phone,
  Briefcase,
  Flag,
  UserX,
  Package,
  CarFront,
  ShoppingBasket,
  Leaf,
} from "lucide-react";
type R = Record<string, any>;
type Props = {
  data: R;
  act: (fn: () => Promise<any>, message?: string) => Promise<any>;
  busy: boolean;
  go?: (tab: string) => void;
  openProfile?: (id: string) => void;
};
const request = async (path: string, method = "GET", body?: unknown) => {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete this request.");
  return d;
};
const time = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const shortName = (s: string) => s.replace("My Dream ", "");
const icons: R = {
  plumbing: Droplets,
  electrical: Zap,
  tiles: Grid2X2,
  painting: Paintbrush,
  carpentry: Hammer,
  cleaning: Sparkles,
  waterproofing: Umbrella,
  ac: Wind,
};
function Avatar({
  p,
  size = "",
  onClick,
}: {
  p: R;
  size?: string;
  onClick?: () => void;
}) {
  const className = `social-avatar ${size} avatar-${String(p.id || p.user_id || "a").charCodeAt(0) % 5}`;
  const content = p.avatar ? (
    <img src={p.avatar} alt={p.name || "Your profile"} />
  ) : (
    <span>
      {(p.name || "A")
        .split(" ")
        .map((s: string) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={`View ${p.name || "your"} profile`}
    >
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );
}
function Pill({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`exp-pill ${tone}`}>{children}</span>;
}
function Title({
  kicker,
  title,
  action,
  onClick,
}: {
  kicker?: string;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="exp-section-title">
      <div>
        {kicker && <span className="exp-kicker">{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
function Sheet({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", cb);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", cb);
    };
  }, [close]);
  return (
    <div className="exp-backdrop" onClick={close}>
      <section
        className="exp-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="exp-sheet-head">
          <h2>{title}</h2>
          <button aria-label="Close" onClick={close}>
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Label({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="exp-label">
      <span>{title}</span>
      {children}
    </label>
  );
}
function Nothing({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="exp-nothing">
      <Globe2 size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
async function photo(file: File) {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPG or PNG up to 8 MB.");
  return await new Promise<string>((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not prepare image."));
        return;
      }
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      let result = canvas.toDataURL("image/jpeg", 0.8);
      if (result.length > 500000) result = canvas.toDataURL("image/jpeg", 0.45);
      URL.revokeObjectURL(url);
      if (result.length > 530000) reject(new Error("Choose a smaller image."));
      else resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image cannot be read."));
    };
    img.src = url;
  });
}
export function HomeExperience({ data, act, busy, go, openProfile }: Props) {
  const s = data.social;
  return (
    <div className="experience home-experience">
      <div className="exp-welcome">
        <div>
          <span className="exp-kicker">
            <span className="live-dot" />
            YOUR WORLD. A LITTLE CLOSER.
          </span>
          <h1>
            Good to have you home, {data.user.name.split(" ")[0]}
            <span>.</span>
          </h1>
        </div>
        <div className="exp-date">
          {new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          <span>AMEENPUR · HYDERABAD</span>
        </div>
      </div>
      <div className="exp-home-grid">
        <section className="exp-hero">
          <img
            src="/projects/my-dream-skylark.webp"
            alt="My Dream Skylark — official night elevation"
          />
          <div className="exp-hero-shade" />
          <span className="exp-hero-edition">
            THE MD ONE JOURNAL <i>01 / 19</i>
          </span>
          <div className="exp-hero-copy">
            <Pill>
              <ShieldCheck size={12} />
              EXCLUSIVELY FOR MDP RESIDENTS
            </Pill>
            <h2>
              Your people.
              <br />
              Your place.
              <br />
              <em>Your everyday.</em>
            </h2>
            <p>A neighbourhood that goes beyond your front door.</p>
            <button className="exp-primary" onClick={() => go?.("projects")}>
              Step into your community <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="exp-hero-bottom">
            <span>
              MY DREAM SKYLARK{" "}
              <small>THE PLACE. THE PEOPLE. THE POSSIBILITIES.</small>
            </span>
            <button
              aria-label="Explore My Dream Skylark"
              onClick={() => go?.("projects")}
            >
              <ArrowUpRight size={24} />
            </button>
          </div>
          <div className="exp-photo-credit">OFFICIAL MDP NIGHT ELEVATION</div>
        </section>
        <div className="exp-right-stack">
          <section className="exp-connect-card">
            <div className="exp-card-top">
              <span className="exp-kicker">THE PEOPLE MAKE THE PLACE</span>
              <Users size={18} />
            </div>
            <div className="exp-avatar-stack">
              {s?.people
                .filter((p: R) => p.id !== data.user.id)
                .slice(0, 4)
                .map((p: R) => (
                  <Avatar
                    key={p.id}
                    p={p}
                    onClick={() => openProfile?.(p.id)}
                  />
                ))}
              <span>19 PROJECTS</span>
            </div>
            <h2>
              Neighbours today.
              <br />
              Friends tomorrow.
            </h2>
            <p>Find your people, across every MDP address.</p>
            <button className="exp-text-button" onClick={() => go?.("circle")}>
              Meet your neighbours <ArrowRight size={17} />
            </button>
          </section>
          <section className="exp-service-teaser">
            <span className="exp-kicker">INTRODUCING MDP INSTA SERVICES</span>
            <div className="exp-service-mini-icons">
              <Droplets />
              <Zap />
              <Grid2X2 />
            </div>
            <h2>
              A little help.
              <br />
              <em>From your own team.</em>
            </h2>
            <p>
              Plumbing, electrical, tiles & more.
              <br />
              Request. We coordinate. You relax.
            </p>
            <button onClick={() => go?.("services")}>
              Find your specialist <ArrowUpRight size={17} />
            </button>
            <small>DEMO DISPATCH · AVAILABILITY CONFIRMED BY MDP</small>
          </section>
        </div>
      </div>
      <div className="exp-utility-row">
        {[
          [
            "essentials",
            ShoppingBasket,
            "Your daily basket",
            "Fresh essentials, delivered home.",
            "01",
          ],
          [
            "carpool",
            CarFront,
            "Same way? Go together.",
            "Private rides with your neighbours.",
            "02",
          ],
          [
            "myhome",
            LockKeyhole,
            "Your private corner",
            "Documents, details & peace of mind.",
            "03",
          ],
        ].map(([k, Icon, title, sub, num]: any) => (
          <button key={k} onClick={() => go?.(k)}>
            <span className="exp-utility-icon">
              <Icon size={21} />
            </span>
            <div>
              <b>{title}</b>
              <small>{sub}</small>
            </div>
            <ArrowUpRight size={17} />
            <span className="exp-utility-num">{num}</span>
          </button>
        ))}
      </div>
      <div className="exp-lower-grid">
        <section>
          <Title
            kicker="LIFE, AS IT HAPPENS"
            title="From the neighbourhood."
            action="Open your circle"
            onClick={() => go?.("circle")}
          />
          {s?.feed
            .filter((p: R) => p.post_kind !== "update" || p.id === "social1")
            .slice(0, 1)
            .map((p: R) => (
              <FeedPost
                key={p.id}
                p={p}
                self={data.user.id}
                act={act}
                busy={busy}
                openProfile={openProfile}
              />
            ))}
          {!s?.feed.length && (
            <Nothing
              title="Your community story starts here"
              description="Share a small moment or connect with your neighbours."
            />
          )}
        </section>
        <section className="exp-project-pick">
          <Title
            kicker="19 ADDRESSES. ONE MDP."
            title="A place to belong."
            action="All projects"
            onClick={() => go?.("projects")}
          />
          <div
            className="exp-featured-project"
            onClick={() => go?.("projects")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") go?.("projects");
            }}
          >
            <img
              src="/projects/my-dream-glenmore.webp"
              alt="My Dream Glenmore night elevation"
            />
            <span>EXPLORE OUR COMMUNITIES</span>
            <div>
              <h3>
                Distinct homes.
                <br />
                One shared feeling.
              </h3>
              <span className="exp-round-arrow">
                <ArrowUpRight size={23} />
              </span>
            </div>
          </div>
          <div className="exp-community-stats">
            <span>
              <strong>19</strong>PROJECTS
            </span>
            <span>
              <strong>13</strong>COMPLETED
            </span>
            <span>
              <strong>06</strong>TAKING SHAPE
            </span>
          </div>
        </section>
      </div>
      <div className="exp-signoff">
        <Leaf size={20} />
        <span>Built with care. Lived with connection.</span>
        <small>YOU DREAM. WE BUILD.</small>
      </div>
    </div>
  );
}
export function ProjectExplorer({ data, openProfile }: Props) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<R | null>(null),
    [flat, setFlat] = useState<R | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const all = data.social?.projects || [];
  async function open(pid: string) {
    setLoading(true);
    setError("");
    try {
      setSelected(await request("projects/" + pid));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="experience">
      <div className="exp-page-head">
        <div>
          <span className="exp-kicker">THE MDP COLLECTION</span>
          <h1>
            Every address.
            <br />
            <em>A world of its own.</em>
          </h1>
          <p>
            Explore the places we build. Connect with the people who call them
            home.
          </p>
        </div>
        <div className="exp-counter">
          <strong>19</strong>
          <span>
            PROJECTS
            <br />
            ONE COMMUNITY
          </span>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {selected ? (
        <>
          <button
            className="exp-back"
            onClick={() => {
              setSelected(null);
              setFlat(null);
            }}
          >
            <ArrowLeft size={16} />
            All MDP projects
          </button>
          <section className="exp-project-detail">
            <div className={selected.status === "ongoing" ? "plan-image" : ""}>
              <img
                src={selected.image}
                alt={`${selected.name} — ${selected.imageKind}`}
              />
              <span>{selected.imageKind}</span>
            </div>
            <div>
              <Pill tone={selected.status === "ongoing" ? "orange" : ""}>
                <span className="live-dot" />
                {selected.status === "ongoing"
                  ? "Ongoing development"
                  : "Completed project"}
              </Pill>
              <h2>{selected.name}</h2>
              <p>
                <MapPin size={14} />
                Ameenpur, Hyderabad
              </p>
              <div className="exp-project-specs">
                <span>
                  <b>{selected.floors}</b>FLOORS
                </span>
                <span>
                  <b>{selected.totalFlats ?? "—"}</b>RESIDENCES
                </span>
                <span>
                  <b>
                    {selected.status === "ongoing" ? "Expected " : ""}
                    {selected.year}
                  </b>
                  {selected.status === "ongoing" ? "TARGET YEAR" : "COMPLETED"}
                </span>
              </div>
              <p className="exp-project-mix">
                {selected.flatMix} homes · {selected.liftBrand?.toUpperCase()}{" "}
                lifts
              </p>
              <div className="exp-link-row">
                <a href={selected.source} target="_blank" rel="noreferrer">
                  Official project details <ArrowUpRight size={14} />
                </a>
                <a href={selected.floorPlan} target="_blank" rel="noreferrer">
                  Floor plan <ArrowUpRight size={14} />
                </a>
              </div>
              <small>
                Official catalog verified {selected.verifiedAt}. Expected dates
                are the builder’s published targets.
              </small>
            </div>
          </section>
          <Title
            kicker="MEET THE PEOPLE, DOOR BY DOOR"
            title="Your neighbours, a tap away."
          />
          <div className="exp-private-note">
            <ShieldCheck size={18} />
            <p>
              Only residents who opt into discovery appear. Flat numbers below
              are a <b>synthetic demo register</b>; the website publishes
              counts, not actual flat-to-person records.
            </p>
          </div>
          {selected.flats.length ? (
            <div className="exp-flat-grid">
              {selected.flats.map((f: R) => (
                <button
                  className={`exp-flat-card ${flat?.id === f.id ? "selected" : ""}`}
                  key={f.id}
                  onClick={() => setFlat(f)}
                >
                  <div>
                    <Building2 size={20} />
                    <span>FLAT</span>
                  </div>
                  <h3>{f.label.replace("DEMO ", "")}</h3>
                  <span>
                    {f.residents.length
                      ? `${f.residents.length} discoverable resident${f.residents.length > 1 ? "s" : ""}`
                      : "No public resident profile"}
                  </span>
                  <div className="exp-flat-people">
                    {f.residents.map((p: R) => (
                      <span key={p.id} className="exp-flat-initial">
                        {p.name[0]}
                      </span>
                    ))}
                    <ArrowUpRight size={19} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Nothing
              title="The resident register is private"
              description="No verified flat register has been imported for this project. MDP must provide authorized flat data; numbering is never generated from the total flat count."
            />
          )}
          {flat && (
            <section className="exp-flat-residents">
              <Title
                kicker={selected.name.toUpperCase()}
                title={`At ${flat.label}`}
              />
              {flat.residents.length ? (
                <div className="exp-people-grid">
                  {flat.residents.map((p: R) => (
                    <PersonCard key={p.id} p={p} openProfile={openProfile} />
                  ))}
                </div>
              ) : (
                <Nothing
                  title="A little privacy behind this door"
                  description="No resident here has opted into the directory. Contact MDP through your service request for official assistance."
                />
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="exp-filterbar">
            <div className="exp-filter-tabs">
              {[
                ["all", "All projects", "19"],
                ["completed", "Completed", "13"],
                ["ongoing", "Taking shape", "06"],
              ].map(([k, l, c]) => (
                <button
                  className={filter === k ? "selected" : ""}
                  key={k}
                  onClick={() => setFilter(k)}
                >
                  {l}
                  <span>{c}</span>
                </button>
              ))}
            </div>
            <div className="exp-search">
              <Search size={17} />
              <input
                value={search}
                aria-label="Find an MDP project"
                placeholder="Find your address"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {loading && (
            <div className="exp-loading">
              <LoaderCircle className="spin" />
              Opening your community…
            </div>
          )}
          <div className="exp-project-grid">
            {all
              .filter(
                (p: R) =>
                  (filter === "all" || p.status === filter) &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p: R, i: number) => (
                <button
                  className={`exp-project-card ${p.status === "ongoing" ? "ongoing-project" : ""}`}
                  key={p.id}
                  onClick={() => open(p.id)}
                >
                  <div className="exp-project-photo">
                    <img src={p.image} alt={`${p.name} — ${p.imageKind}`} />
                    <span className="exp-project-index">
                      {p.id.slice(1).padStart(2, "0")} / MDP
                    </span>
                    <Pill tone={p.status === "ongoing" ? "orange" : ""}>
                      {p.status === "ongoing" ? "TAKING SHAPE" : "COMPLETED"}
                    </Pill>
                    <span className="exp-project-image-type">
                      {p.imageKind}
                    </span>
                  </div>
                  <div className="exp-project-info">
                    <div>
                      <h3>{p.name}</h3>
                      <ArrowUpRight size={21} />
                    </div>
                    <span>
                      {p.floors} · {p.totalFlats} residences · {p.flatMix}
                    </span>
                    <div className="exp-project-meta">
                      <span>
                        <MapPin size={12} />
                        Ameenpur
                      </span>
                      <span>
                        {p.status === "ongoing" ? "Expected " : ""}
                        {p.year}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
function PersonCard({
  p,
  openProfile,
}: {
  p: R;
  openProfile?: Props["openProfile"];
}) {
  return (
    <button className="exp-person-card" onClick={() => openProfile?.(p.id)}>
      <div className="exp-person-cover">
        <span className={`profile-orb orb-${p.id.length % 4}`} />
        <span className="exp-person-status">
          {p.locked ? (
            <>
              <LockKeyhole size={11} />
              PROFILE LOCKED
            </>
          ) : (
            <>
              <ShieldCheck size={11} />
              VERIFIED DEMO
            </>
          )}
        </span>
      </div>
      <div className="exp-person-body">
        <Avatar p={p} size="large" />
        <h3>{p.name}</h3>
        <p>{p.occupation || "Your MDP neighbour"}</p>
        <small>
          {shortName(p.project)} · {p.flat}
        </small>
        <span className="exp-person-action">
          {p.relationship === "friends" ? (
            <>
              <UserCheck size={15} />
              Connected
            </>
          ) : p.relationship === "outgoing" ? (
            "Request sent"
          ) : p.relationship === "self" ? (
            "Your profile"
          ) : (
            <>
              <UserPlus size={15} />
              View profile
            </>
          )}
          <ArrowUpRight size={15} />
        </span>
      </div>
    </button>
  );
}
export function SocialCircle({
  data,
  act,
  busy,
  openProfile,
  go,
}: Props & { go: (tab: string) => void }) {
  const [view, setView] = useState("feed"),
    [composer, setComposer] = useState(false),
    [search, setSearch] = useState("");
  const s = data.social,
    incoming =
      s?.connections.filter(
        (q: R) => q.status === "pending" && q.recipient_id === data.user.id,
      ) || [];
  return (
    <div className="experience">
      <div className="exp-page-head compact">
        <div>
          <span className="exp-kicker">LIFE IS BETTER WHEN IT’S SHARED</span>
          <h1>
            Your community<span>.</span>
          </h1>
          <p>
            Trade something useful. Share a journey. Get to know your
            neighbours.
          </p>
        </div>
        <button className="exp-secondary" disabled={data.hosted && !data.eligible} onClick={() => setComposer(true)}>
          <Plus size={17} />
          Share a moment
        </button>
      </div>
      <CommunityHighlights go={go} />
      <div className="exp-circle-layout">
        <section>
          <div className="exp-filter-tabs circle-tabs">
            {[
              ["feed", "The neighbourhood"],
              ["people", "Discover people"],
              [
                "connections",
                `My connections${incoming.length ? " · " + incoming.length : ""}`,
              ],
            ].map(([k, l]) => (
              <button
                className={view === k ? "selected" : ""}
                key={k}
                onClick={() => setView(k)}
              >
                {l}
              </button>
            ))}
          </div>
          {view === "feed" ? (
            <>
              <button
                className="exp-compose-trigger"
                disabled={data.hosted && !data.eligible} onClick={() => setComposer(true)}
              >
                <Avatar p={s.profile} />
                <span>What’s happening in your little world?</span>
                <ImagePlus size={20} />
              </button>
              {data.hosted && !s.feed.length && <Nothing title="Your neighbourhood starts here" description="Posts shared with you will appear here. Your profile stays locked until you choose otherwise."/>}
              {s.feed.map((p: R) => (
                <FeedPost
                  key={p.id}
                  p={p}
                  self={data.user.id}
                  act={act}
                  busy={busy}
                  openProfile={openProfile}
                />
              ))}
            </>
          ) : view === "people" ? (
            <>
              <div className="exp-search standalone">
                <Search size={18} />
                <input
                  placeholder="Find a neighbour or occupation"
                  aria-label="Search neighbours"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="exp-people-grid">
                {s.people
                  .filter(
                    (p: R) =>
                      p.id !== data.user.id &&
                      `${p.name} ${p.occupation} ${p.project}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((p: R) => (
                    <PersonCard key={p.id} p={p} openProfile={openProfile} />
                  ))}
              </div>
            </>
          ) : (
            <>
              <Title title="Friend requests & connections" />
              {s.connections.length ? (
                s.connections.map((q: R) => (
                  <div className="exp-connection-row" key={q.id}>
                    <Avatar
                      p={q.other}
                      onClick={() => openProfile?.(q.other.id)}
                    />
                    <div>
                      <b>{q.other.name}</b>
                      <small>
                        {q.status === "accepted"
                          ? "You’re connected"
                          : q.recipient_id === data.user.id
                            ? "Wants to connect with you"
                            : "You sent a friend request"}
                      </small>
                    </div>
                    {q.status === "pending" &&
                    q.recipient_id === data.user.id ? (
                      <div className="exp-action-pair">
                        <button
                          className="exp-primary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                request("friends/" + q.other.id, "POST", {
                                  action: "accept",
                                }),
                              "You’re now connected",
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          className="exp-secondary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                request("friends/" + q.other.id, "POST", {
                                  action: "decline",
                                }),
                              "Request declined",
                            )
                          }
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <button
                        className="exp-secondary"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              request("friends/" + q.other.id, "POST", {
                                action:
                                  q.status === "accepted" ? "remove" : "cancel",
                              }),
                            "Connection updated",
                          )
                        }
                      >
                        {q.status === "accepted" ? "Remove" : "Cancel request"}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <Nothing
                  title="Good connections take a first hello"
                  description="Discover neighbours and send a friend request. Accepted friends can see each other’s locked profile details according to contact preferences."
                />
              )}
            </>
          )}
        </section>
        <aside className="exp-circle-aside">
          <section className="exp-side-panel">
            <span className="exp-kicker">YOUR PRIVATE CORNER</span>
            <Avatar
              p={s.profile}
              size="large"
              onClick={() => openProfile?.(data.user.id)}
            />
            <h3>{data.user.name}</h3>
            <p>{s.profile.occupation || "Your story belongs here."}</p>
            <Pill>
              <MapPin size={11} />
              {shortName(s.profile.project)} · {s.profile.flat}
            </Pill>
            <button
              className="exp-text-button"
              onClick={() => openProfile?.(data.user.id)}
            >
              Your profile & privacy <ArrowUpRight size={15} />
            </button>
          </section>
          <section className="exp-side-panel">
            <div className="exp-card-top">
              <span className="exp-kicker">A FRIENDLY FIRST HELLO</span>
              <UserPlus size={17} />
            </div>
            {s.people
              .filter(
                (p: R) => p.id !== data.user.id && p.relationship === "none",
              )
              .slice(0, 3)
              .map((p: R) => (
                <button
                  className="exp-suggestion"
                  key={p.id}
                  onClick={() => openProfile?.(p.id)}
                >
                  <Avatar p={p} />
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {shortName(p.project)}
                      {p.locked ? " · Locked" : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
          </section>
          <div className="exp-privacy-aside">
            <LockKeyhole size={19} />
            <p>Be social on your terms.</p>
            <small>
              Lock your profile. Choose who sees your contact. Every connection
              starts with your consent.
            </small>
          </div>
        </aside>
      </div>
      {composer && (
        <Composer
          data={data}
          act={act}
          busy={busy}
          close={() => setComposer(false)}
        />
      )}
    </div>
  );
}
function FeedPost({
  p,
  self,
  act,
  busy,
  openProfile,
}: {
  p: R;
  self: string;
  act: Props["act"];
  busy: boolean;
  openProfile?: Props["openProfile"];
}) {
  const [comment, setComment] = useState(""),
    [comments, setComments] = useState(false),
    [menu, setMenu] = useState(false);
  const visual =
    p.image || p.post_kind === "architecture"
      ? p.image || "/projects/my-dream-skylark.webp"
      : "";
  return (
    <article className="exp-feed-post">
      <div className="exp-post-head">
        <Avatar
          p={{ id: p.user_id, name: p.name, avatar: p.avatar }}
          onClick={() => openProfile?.(p.user_id)}
        />
        <button
          className="exp-post-author"
          onClick={() => openProfile?.(p.user_id)}
        >
          <b>{p.name}</b>
          <small>
            {shortName(p.project || "MDP")} · {time(p.created)}
          </small>
        </button>
        <Pill>
          {p.visibility === "friends" ? (
            <LockKeyhole size={10} />
          ) : p.visibility === "network" ? (
            <Globe2 size={10} />
          ) : (
            <Building2 size={10} />
          )}{" "}
          {p.visibility === "network"
            ? "MDP CIRCLE"
            : p.visibility === "friends"
              ? "FRIENDS"
              : "MY PROJECT"}
        </Pill>
        <button
          className="exp-more"
          aria-label="Post options"
          onClick={() => setMenu(!menu)}
        >
          <MoreHorizontal size={19} />
        </button>
        {menu && (
          <div className="exp-post-menu">
            {p.user_id === self ? (
              <button
                onClick={() =>
                  act(
                    () =>
                      request("social-posts/" + p.id, "POST", {
                        action: "delete",
                      }),
                    "Post removed",
                  )
                }
              >
                Remove my post
              </button>
            ) : (
              <button
                onClick={() => {
                  const reason = prompt(
                    "Why would you like to report this post?",
                  );
                  if (reason)
                    act(
                      () =>
                        request("social-reports", "POST", {
                          kind: "post",
                          targetId: p.id,
                          reason,
                        }),
                      "Report sent for review",
                    );
                  setMenu(false);
                }}
              >
                Report post
              </button>
            )}
          </div>
        )}
      </div>
      <p className="exp-post-body">{p.body}</p>
      {visual && (
        <div className="exp-post-image">
          <img
            src={visual}
            alt={
              p.image
                ? "Photo shared by resident"
                : "Official Skylark image used in a synthetic demo post"
            }
          />
          {!p.image && (
            <small>OFFICIAL PROJECT IMAGE · SYNTHETIC DEMO POST</small>
          )}
        </div>
      )}
      {p.post_kind === "garden" && !p.image && (
        <div className="exp-garden-art">
          <Leaf size={70} />
          <span>Little things, growing.</span>
          <small>ILLUSTRATED DEMO MOMENT</small>
        </div>
      )}
      <div className="exp-post-actions">
        <button
          className={p.liked ? "liked" : ""}
          disabled={busy}
          onClick={() =>
            act(
              () => request("social-posts/" + p.id, "POST", { action: "like" }),
              p.liked ? "Like removed" : "A little love, shared",
            )
          }
        >
          <Heart size={18} fill={p.liked ? "currentColor" : "none"} />
          {p.likes || "Like"}
        </button>
        <button onClick={() => setComments(!comments)}>
          <MessageCircle size={18} />
          {p.comments.length || "Comment"}
        </button>
        <span>
          {p.visibility === "friends"
            ? "Shared with friends"
            : "A moment from your community"}
        </span>
      </div>
      {comments && (
        <div className="exp-comments">
          {p.comments.map((c: R) => (
            <div key={c.id}>
              <b>{c.name}</b>
              <p>{c.body}</p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act(
                () =>
                  request("social-posts/" + p.id, "POST", {
                    action: "comment",
                    body: comment,
                  }),
                "Comment added",
              );
              if (r) setComment("");
            }}
          >
            <input
              aria-label="Write a comment"
              required
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a little note…"
            />
            <button
              disabled={busy || !comment.trim()}
              aria-label="Send comment"
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
function Composer({ data, act, busy, close }: Props & { close: () => void }) {
  const [body, setBody] = useState(""),
    [audience, setAudience] = useState("project"),
    [img, setImg] = useState(""),
    [error, setError] = useState("");
  return (
    <Sheet title="A moment from your world." close={close}>
      <div className="exp-compose-person">
        <Avatar p={data.social.profile} />
        <span>
          <b>{data.user.name}</b>
          <small>Your community, your voice.</small>
        </span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await act(
            () =>
              request("social-posts", "POST", {
                body,
                visibility: audience,
                image: img,
              }),
            "Your moment is shared",
          );
          if (r) close();
        }}
      >
        <textarea
          className="exp-post-textarea"
          required
          maxLength={1500}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="A little win, a weekend plan, or just a hello…"
        />
        {img && (
          <div className="exp-upload-preview">
            <img src={img} alt="Your post preview" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setImg("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {error && <p className="exp-error">{error}</p>}
        <div className="exp-composer-controls">
          <label className="exp-photo-button">
            <ImagePlus size={18} />
            Add a photo
            <input
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file)
                  try {
                    setImg(await photo(file));
                    setError("");
                  } catch (er) {
                    setError((er as Error).message);
                  }
                e.target.value = "";
              }}
            />
          </label>
          <select
            aria-label="Post audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="project">My project</option>
            <option value="friends">Friends only</option>
            <option value="network">All MDP (opt-in required)</option>
          </select>
        </div>
        <div className="exp-private-note">
          <ShieldCheck size={16} />
          <p>
            Only share photos you have permission to post. Locked profiles
            restrict posts to accepted friends, regardless of audience.
          </p>
        </div>
        <button className="exp-primary full" disabled={busy || !body.trim()}>
          Share your moment <ArrowUpRight size={17} />
        </button>
      </form>
    </Sheet>
  );
}
export function ResidentProfile({
  data,
  act,
  busy,
  openProfile,
  go,
  uid,
}: { uid?: string } & Props) {
  const [profile, setProfile] = useState<R | null>(null),
    [error, setError] = useState(""),
    [edit, setEdit] = useState(false),
    [composer, setComposer] = useState(false);
  const target = uid || data.user.id,
    own = target === data.user.id;
  useEffect(() => {
    setProfile(null);
    setError("");
    request("profiles/" + target)
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [target, data]);
  return (
    <div className="experience">
      {error ? (
        <Nothing title="A little privacy here" description={error} />
      ) : !profile ? (
        <div className="exp-loading">
          <LoaderCircle className="spin" />
          Opening profile…
        </div>
      ) : (
        <>
          <div className="exp-profile-cover">
            <div className="exp-profile-cover-lines" />
            <span>THE PEOPLE MAKE THE PLACE.</span>
            {own ? (
              <button className="exp-secondary" onClick={() => setEdit(true)}>
                <Settings size={15} />
                Edit profile & privacy
              </button>
            ) : (
              <Pill>
                {profile.locked ? (
                  <>
                    <LockKeyhole size={12} />
                    PROFILE LOCKED
                  </>
                ) : (
                  <>
                    <ShieldCheck size={12} />
                    {data.hosted ? (data.eligible ? 'VERIFIED RESIDENT' : data.owner ? 'PLATFORM OWNER' : 'MD ONE MEMBER') : 'VERIFIED DEMO RESIDENT'}
                  </>
                )}
              </Pill>
            )}
          </div>
          <div className="exp-profile-main">
            <div className="exp-profile-identity">
              <Avatar p={profile} size="huge" />
              <div>
                <span className="exp-kicker">
                  {profile.project?.toUpperCase()} · {profile.flat}
                </span>
                <h1>
                  {profile.name}
                  <span>.</span>
                </h1>
                {profile.canSeeDetails && (
                  <p>{profile.bio || "Every neighbour has a story."}</p>
                )}
              </div>
              <div className="exp-profile-actions">
                {own ? (
                  <button
                    className="exp-primary"
                    disabled={data.hosted && !data.eligible} onClick={() => setComposer(true)}
                  >
                    <Plus size={16} />
                    Share a moment
                  </button>
                ) : (
                  <>
                    <FriendButton p={profile} act={act} busy={busy} />
                    <button
                      className="exp-square-button"
                      aria-label="Report profile"
                      onClick={() => {
                        const reason = prompt(
                          "Why are you reporting this profile?",
                        );
                        if (reason)
                          act(
                            () =>
                              request("social-reports", "POST", {
                                kind: "profile",
                                targetId: profile.id,
                                reason,
                              }),
                            "Profile report submitted",
                          );
                      }}
                    >
                      <Flag size={17} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="exp-profile-content">
              <aside>
                <section className="exp-side-panel">
                  <span className="exp-kicker">
                    A LITTLE ABOUT{" "}
                    {own ? "YOU" : profile.name.split(" ")[0].toUpperCase()}
                  </span>
                  {profile.canSeeDetails ? (
                    <>
                      <div className="exp-profile-fact">
                        <Briefcase size={17} />
                        <span>
                          {profile.occupation || "Occupation not added"}
                        </span>
                      </div>
                      <div className="exp-profile-fact">
                        <Building2 size={17} />
                        <span>
                          {profile.project}
                          <small>
                            {profile.flat} · {profile.kind}
                          </small>
                        </span>
                      </div>
                      <div className="exp-profile-fact">
                        <Phone size={17} />
                        <span>
                          {profile.contact || "Contact details are private"}
                          {!profile.contact && (
                            <small>
                              Shared according to resident preferences
                            </small>
                          )}
                        </span>
                      </div>
                      <div className="exp-profile-fact">
                        <Users size={17} />
                        <span>{profile.friendCount || 0} connections</span>
                      </div>
                    </>
                  ) : (
                    <div className="exp-locked-card">
                      <LockKeyhole size={30} />
                      <h3>This profile is locked.</h3>
                      <p>
                        Connect as friends to see their photo, occupation,
                        contact preferences and moments.
                      </p>
                    </div>
                  )}
                  {own && (
                    <button
                      className="exp-text-button"
                      onClick={() => go?.("account")}
                    >
                      Account, membership & data <ArrowUpRight size={15} />
                    </button>
                  )}
                  {!own && (
                    <button
                      className="exp-text-button muted"
                      onClick={() => {
                        if (
                          confirm(
                            "Block this resident? You will stop seeing each other’s profiles and posts.",
                          )
                        )
                          act(
                            () => request("blocks/" + profile.id, "POST", {}),
                            "Resident blocked",
                          );
                      }}
                    >
                      <UserX size={14} />
                      Block resident
                    </button>
                  )}
                </section>
                <div className="exp-privacy-aside">
                  <ShieldCheck size={19} />
                  <p>Your privacy belongs to you.</p>
                  <small>
                    Phone and email are never shown just because someone shares
                    your project.
                  </small>
                </div>
              </aside>
              <section>
                <Title
                  title={own ? "Your moments." : "Moments from their world."}
                  kicker={
                    profile.locked
                      ? "PROFILE PRIVACY IS ENFORCED"
                      : "LIFE, AS IT HAPPENS"
                  }
                />
                {profile.canSeeDetails ? (
                  profile.posts.length ? (
                    profile.posts.map((p: R) => (
                      <FeedPost
                        key={p.id}
                        p={p}
                        self={data.user.id}
                        act={act}
                        busy={busy}
                        openProfile={openProfile}
                      />
                    ))
                  ) : (
                    <Nothing
                      title={
                        own
                          ? "A small moment is a lovely place to start."
                          : "A story still taking shape."
                      }
                      description={
                        own
                          ? "Share a daily update, photo, or hello with your project, your friends, or the MDP circle."
                          : "This neighbour hasn’t shared a moment with this audience yet."
                      }
                    />
                  )
                ) : (
                  <div className="exp-profile-locked-feed">
                    <LockKeyhole size={44} />
                    <h2>A little hello opens the door.</h2>
                    <p>
                      Send a friend request. Their moments are shared after they
                      accept.
                    </p>
                    <FriendButton p={profile} act={act} busy={busy} />
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
      {edit && profile && (
        <EditProfile
          p={profile}
          data={data}
          act={act}
          busy={busy}
          close={() => setEdit(false)}
        />
      )}
      {composer && (
        <Composer
          data={data}
          act={act}
          busy={busy}
          close={() => setComposer(false)}
        />
      )}
    </div>
  );
}
function FriendButton({
  p,
  act,
  busy,
}: {
  p: R;
  act: Props["act"];
  busy: boolean;
}) {
  const action =
    p.relationship === "incoming"
      ? "accept"
      : p.relationship === "outgoing"
        ? "cancel"
        : p.relationship === "friends"
          ? "remove"
          : "request";
  return (
    <button
      className={p.relationship === "friends" ? "exp-secondary" : "exp-primary"}
      disabled={busy || p.relationship === "blocked"}
      onClick={() =>
        act(
          () => request("friends/" + p.id, "POST", { action }),
          action === "request"
            ? "Friend request sent"
            : action === "accept"
              ? "You’re connected"
              : "Connection updated",
        )
      }
    >
      {p.relationship === "friends" ? (
        <UserCheck size={16} />
      ) : p.relationship === "outgoing" ? (
        <Clock3 size={16} />
      ) : (
        <UserPlus size={16} />
      )}{" "}
      {p.relationship === "incoming"
        ? "Accept friend request"
        : p.relationship === "outgoing"
          ? "Request sent · cancel"
          : p.relationship === "friends"
            ? "Friends · remove"
            : "Add friend"}
    </button>
  );
}
function EditProfile({
  p,
  data,
  act,
  busy,
  close,
}: Props & { p: R; close: () => void }) {
  const [avatar, setAvatar] = useState(p.avatar || ""),
    [error, setError] = useState("");
  return (
    <Sheet title="Your story. Your boundaries." close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const r = await act(
            () =>
              request("my-profile", "POST", {
                ...(data.hosted ? {name:f.get("name")} : {}),
                bio: f.get("bio"),
                occupation: f.get("occupation"),
                contact: f.get("contact"),
                contactVisibility: f.get("contactVisibility"),
                locked: f.get("locked") === "on",
                discoverable: f.get("discoverable") === "on",
                networkVisible: f.get("networkVisible") === "on",
                avatar,
              }),
            "Profile and privacy updated",
          );
          if (r) close();
        }}
      >
        {data.hosted && <label>Your name<input name="name" required maxLength={80} defaultValue={p.name}/></label>}
        <div className="exp-avatar-upload">
          <Avatar p={{ ...p, avatar }} size="large" />
          <label className="exp-photo-button">
            <Camera size={17} />
            Upload your picture
            <input
              type="file"
              accept="image/jpeg,image/png"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f)
                  try {
                    setAvatar(await photo(f));
                    setError("");
                  } catch (er) {
                    setError((er as Error).message);
                  }
              }}
            />
          </label>
          {avatar && (
            <button
              type="button"
              className="exp-text-button"
              onClick={() => setAvatar("")}
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="exp-error">{error}</p>}
        <Label title="A little about you">
          <textarea
            name="bio"
            maxLength={300}
            defaultValue={p.bio}
            placeholder="What makes your everyday, yours?"
          />
        </Label>
        <Label title="Occupation">
          <input
            name="occupation"
            maxLength={80}
            defaultValue={p.occupation}
            placeholder="e.g. Architect, teacher, entrepreneur"
          />
        </Label>
        <Label title="Contact detail (optional)">
          <input
            name="contact"
            maxLength={100}
            defaultValue={p.contact}
            placeholder="Phone number or email you choose to share"
          />
        </Label>
        <Label title="Who can see your contact?">
          <select name="contactVisibility" defaultValue={p.contactVisibility}>
            <option value="private">Only me</option>
            <option value="friends">Accepted friends</option>
            <option value="community">
              Visible profile visitors (MDP residents only)
            </option>
          </select>
        </Label>
        <label className="exp-switch-row">
          <input name="locked" type="checkbox" defaultChecked={p.locked} />
          <span>
            <b>Lock my profile</b>
            <small>
              Only accepted friends can see photos, occupation, contact
              preferences and posts.
            </small>
          </span>
          <LockKeyhole size={18} />
        </label>
        <label className="exp-switch-row">
          <input
            name="discoverable"
            type="checkbox"
            defaultChecked={p.discoverable}
          />
          <span>
            <b>Let neighbours discover me</b>
            <small>Show my name and flat in my project’s directory.</small>
          </span>
          <Eye size={18} />
        </label>
        <label className="exp-switch-row">
          <input
            name="networkVisible"
            type="checkbox"
            defaultChecked={p.networkVisible}
          />
          <span>
            <b>Connect across MDP</b>
            <small>
              Allow discovery across all 19 projects, when directory visibility
              is on.
            </small>
          </span>
          <Globe2 size={18} />
        </label>
        <div className="exp-private-note">
          <ShieldCheck size={17} />
          <p>
            All profile fields are optional. Locking overrides broader contact
            and post visibility. Images are resized and stripped of metadata in
            your browser.
          </p>
        </div>
        <button className="exp-primary full" disabled={busy}>
          Save my profile <Check size={17} />
        </button>
      </form>
    </Sheet>
  );
}
export function InstaServices({ data, act, busy }: Props) {
  const [booking, setBooking] = useState<R | null>(null),
    [view, setView] = useState("explore");
  const s = data.social;
  const [bookingKey,setBookingKey]=useState("");
  return (
    <div className="experience">
      <div className="exp-service-hero">
        <div>
          <span className="exp-kicker">
            <span className="live-dot" />
            YOUR BUILDER. STILL BY YOUR SIDE.
          </span>
          <h1>
            Consider it
            <br />
            <em>taken care of.</em>
          </h1>
          <p>
            From a dripping tap to the finishing touches.
            <br />
            Request a specialist, coordinated by My Dream Projects.
          </p>
          <div className="exp-service-promise">
            <span>
              <ShieldCheck size={15} />
              MDP-coordinated
            </span>
            <span>
              <Building2 size={15} />
              For MDP homes
            </span>
            <span>
              <Clock3 size={15} />
              Tracked from request to done
            </span>
          </div>
        </div>
        <div className="exp-service-graphic">
          <div className="service-orbit so1" />
          <div className="service-orbit so2" />
          <span className="service-center">
            <Wrench size={51} strokeWidth={1.3} />
          </span>
          <span className="service-floating sf1">
            <Droplets size={25} />
          </span>
          <span className="service-floating sf2">
            <Zap size={25} />
          </span>
          <span className="service-floating sf3">
            <Grid2X2 size={25} />
          </span>
          <span className="service-floating sf4">
            <Paintbrush size={25} />
          </span>
          <span className="service-graphic-label">MDP / INSTA SERVICES</span>
        </div>
      </div>
      <div className="exp-filter-tabs circle-tabs">
        <button
          className={view === "explore" ? "selected" : ""}
          onClick={() => setView("explore")}
        >
          Find your specialist
        </button>
        <button
          className={view === "requests" ? "selected" : ""}
          onClick={() => setView("requests")}
        >
          My service requests <span>{s.requests.length}</span>
        </button>
      </div>
      {view === "explore" ? (
        <>
          <Title
            kicker="ONE TRUSTED TEAM. EVERY LITTLE FIX."
            title="What does your home need?"
          />
          <div className="exp-service-grid">
            {s.services.map((c: R, i: number) => {
              const Icon = icons[c.id] || Wrench;
              return (
                <button
                  className={`exp-service-card service-tone-${i % 4}`}
                  key={c.id}
                  onClick={() => {setBooking(c);setBookingKey(crypto.randomUUID());}}
                >
                  <span className="exp-service-number">0{i + 1}</span>
                  <span className="exp-service-icon">
                    <Icon size={31} strokeWidth={1.4} />
                  </span>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <span className="exp-service-card-bottom">
                    {data.hosted && !c.available ? "View service details" : "Request a specialist"}
                    <ArrowUpRight size={17} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="exp-service-how">
            <div>
              <span>01</span>
              <h3>Tell us what’s needed.</h3>
              <p>Choose a service and your MDP flat.</p>
            </div>
            <div>
              <span>02</span>
              <h3>We find the right hands.</h3>
              <p>MDP confirms the scope and assigns a specialist.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Follow it through.</h3>
              <p>Track assignment, arrival and completion.</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {s.requests.length ? (
            s.requests.map((r: R) => (
              <ServiceRequest key={r.id} r={r}>
                {["requested", "assigned"].includes(r.status) && (
                  <button
                    className="exp-secondary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          request("insta-services/" + r.id, "PATCH", {
                            status: "cancelled",
                          }),
                        "Service request cancelled",
                      )
                    }
                  >
                    Cancel request
                  </button>
                )}
              </ServiceRequest>
            ))
          ) : (
            <Nothing
              title="A well-looked-after home starts here."
              description="Choose plumbing, electrical, tiles, or another specialist. Your requests and updates will live here."
            />
          )}
        </>
      )}
      <div className="exp-private-note">
        <ShieldCheck size={18} />
        <p>
          {data.hosted ? "Requests reach the MDP service desk. Coverage, availability, scope, visit and any charges must be confirmed before work." : "Local demo: no real technician is dispatched. MDP must confirm service coverage, availability, scope and any charges before real work."}
          “Insta” means a quick request; arrival time is never guaranteed.
        </p>
      </div>
      {booking && (
        <Sheet
          title={`${booking.name}, taken care of.`}
          close={() => setBooking(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await act(
                () =>
                  request("insta-services", "POST", {
                    ...(data.hosted ? {key:bookingKey} : {}),
                    flatId: f.get("flat"),
                    categoryId: booking.id,
                    description: f.get("description"),
                    preferred: f.get("preferred"),
                    urgency: f.get("urgency"),
                  }),
                "Your request is with the MDP service desk",
              );
              if (r) {
                setBooking(null);
                setView("requests");
              }
            }}
          >
            <p className="exp-form-note">{booking.description}{data.hosted&&!booking.available ? " Requests are not open for a verified home on your account. MDP must enable project coverage before a booking can be submitted." : ""}</p>
            <Label title="Your MDP home">
              <select name="flat">
                {data.memberships
                  .filter((m: R) => m.status === "approved" && (!data.hosted || booking.projectIds?.includes(m.project_id)))
                  .map((m: R) => (
                    <option key={m.id} value={m.flat_id}>
                      {m.project} · {m.label}
                    </option>
                  ))}
              </select>
            </Label>
            <Label title="Tell us a little about the work">
              <textarea
                name="description"
                required
                maxLength={1500}
                placeholder={
                  booking.id === "tiles"
                    ? "e.g. Replace cracked tiles in the balcony. Approximately 20 sq ft."
                    : "e.g. Kitchen tap is leaking and needs a fitting replaced."
                }
              />
            </Label>
            <Label title="When would you prefer a visit?">
              <input
                name="preferred"
                required
                maxLength={100}
                placeholder="e.g. Tomorrow after 4 pm"
              />
            </Label>
            <Label title="Priority">
              <select name="urgency">
                <option value="routine">
                  Routine · schedule a convenient visit
                </option>
                <option value="priority">
                  Priority · please contact me soon
                </option>
              </select>
            </Label>
            <p className="exp-form-note">
              For emergencies, contact local emergency services directly. This
              request is not an emergency dispatch.
            </p>
            <button className="exp-primary full" disabled={busy || (data.hosted && !booking.available)}>
              Request an MDP specialist <ArrowUpRight size={17} />
            </button>
          </form>
        </Sheet>
      )}
    </div>
  );
}
function ServiceRequest({ r, children }: { r: R; children?: ReactNode }) {
  const Icon = icons[r.category_id] || Wrench;
  const steps = [
    "requested",
    "assigned",
    "en_route",
    "in_progress",
    "completed",
  ];
  return (
    <article className="exp-job-card">
      <div className="exp-job-head">
        <span className="exp-service-icon">
          <Icon size={24} />
        </span>
        <div>
          <small>REQUEST #{r.id.slice(0, 8).toUpperCase()}</small>
          <h3>{r.category}</h3>
        </div>
        <Pill tone={r.status === "cancelled" ? "orange" : ""}>
          {r.status.replaceAll("_", " ")}
        </Pill>
      </div>
      <p>{r.description}</p>
      <div className="exp-job-meta">
        <span>
          <Building2 size={14} />
          {r.project} · {r.label}
        </span>
        <span>
          <Clock3 size={14} />
          {r.preferred}
        </span>
      </div>
      <div className="exp-job-progress">
        {steps.map((v, i) => (
          <div
            className={steps.indexOf(r.status) >= i ? "complete" : ""}
            key={v}
          >
            <span>
              {steps.indexOf(r.status) > i ? <Check size={12} /> : i + 1}
            </span>
            <small>{v.replaceAll("_", " ")}</small>
          </div>
        ))}
      </div>
      {r.technician && (
        <div className="exp-assigned-tech">
          <ShieldCheck size={16} />
          <span>
            {r.technician}
            <small>{r.hosted ? "Assigned by the MDP service desk" : "Assigned by the demo MDP service desk"}</small>
          </span>
        </div>
      )}
      {children}
      <details>
        <summary>Request timeline</summary>
        {r.history.map((h: R, i: number) => (
          <div className="exp-timeline-row" key={i}>
            <b>{h.status.replaceAll("_", " ")}</b>
            <span>{h.note || "Status updated"}</span>
            <small>{time(h.created)} IST</small>
          </div>
        ))}
      </details>
    </article>
  );
}
export function ServiceDesk({ data, act, busy }: Props) {
  const [ops, setOps] = useState<R | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    request("service-ops")
      .then(setOps)
      .catch((e) => setError(e.message));
  }, [data]);
  const tech = data.user.role === "technician";
  return (
    <div className="experience">
      <div className="exp-page-head compact">
        <div>
          <span className="exp-kicker">MDP INSTA SERVICES / OPERATIONS</span>
          <h1>
            {tech ? "Good work. Great homes." : "The right hands. Every time."}
          </h1>
          <p>
            {tech
              ? "Your assigned jobs, with a clear next step."
              : "Coordinate specialist requests across completed and ongoing MDP projects."}
          </p>
        </div>
        <Pill>{data.hosted ? "SERVICE OPERATIONS" : "DEMO DISPATCH"}</Pill>
      </div>
      {error && <div className="alert error">{error}</div>}
      {ops ? (
        ops.requests.length ? (
          ops.requests.map((r: R) => (
            <ServiceRequest key={r.id} r={r}>
              {!tech&&data.hosted&&["requested","assigned"].includes(r.status)&&<button className="exp-secondary" disabled={busy} onClick={()=>act(()=>request("insta-services/"+r.id,"PATCH",{status:"cancelled"}),"Service request cancelled")}>Cancel request</button>}
              {!tech && r.status === "requested" && (
                <form
                  className="exp-assign-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    act(
                      () =>
                        request("insta-services/" + r.id, "PATCH", {
                          status: "assigned",
                          technicianId: f.get("technician"),
                        }),
                      "Specialist assigned",
                    );
                  }}
                >
                  <select
                    name="technician"
                    aria-label="Assign MDP specialist"
                    required
                  >
                    <option value="">
                      Choose a {r.category.toLowerCase()} specialist
                    </option>
                    {ops.technicians
                      .filter((t: R) => t.trade === r.category_id && (!data.hosted || (t.on_shift && !ops.requests.some((job:R)=>job.technician_id===t.id && ["assigned","en_route","in_progress"].includes(job.status)))))
                      .map((t: R) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                  <button className="exp-primary" disabled={busy}>
                    Assign specialist <UserCheck size={16} />
                  </button>
                </form>
              )}
              {tech &&
                ["assigned", "en_route", "in_progress"].includes(r.status) && (
                  <button
                    className="exp-primary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          request("insta-services/" + r.id, "PATCH", {
                            status: (
                              {
                                assigned: "en_route",
                                en_route: "in_progress",
                                in_progress: "completed",
                              } as R
                            )[r.status],
                          }),
                        "Job status updated",
                      )
                    }
                  >
                    {r.status === "assigned"
                      ? "Start journey"
                      : r.status === "en_route"
                        ? "Arrived · start work"
                        : "Mark work completed"}
                    <ArrowRight size={16} />
                  </button>
                )}
            </ServiceRequest>
          ))
        ) : (
          <Nothing
            title={
              tech ? "Your workday is clear." : "Ready to take care of a home."
            }
            description={
              tech
                ? "Only jobs assigned to you appear here."
                : "Resident service requests will appear here for trade-matched assignment."
            }
          />
        )
      ) : (
        <div className="exp-loading">
          <LoaderCircle className="spin" />
          Opening service desk…
        </div>
      )}
    </div>
  );
}

export function ModerationDesk({ data, act, busy }: Props) {
  const [reports, setReports] = useState<R[]>([]);
  useEffect(() => {
    request("social-moderation")
      .then(setReports)
      .catch(() => {});
  }, [data]);
  return (
    <div className="experience">
      <div className="exp-page-head compact">
        <div>
          <span className="exp-kicker">A COMMUNITY BUILT ON RESPECT</span>
          <h1>Keep your circle welcoming.</h1>
          <p>
            Review reports within your scope. Private contacts and locked
            profile content are never exposed here.
          </p>
        </div>
      </div>
      {reports.length ? (
        reports.map((r) => (
          <section className="exp-job-card" key={r.id}>
            <Pill>
              {r.target_kind} · {r.status}
            </Pill>
            <h3 style={{ marginTop: 15 }}>Resident report</h3>
            <p>{r.reason}</p>
            <small className="muted">
              Target {r.target_id.slice(0, 12)} · {time(r.created)}
            </small>
            <div className="exp-action-pair" style={{ marginTop: 20 }}>
              {r.status === "open" && (
                <>
                  <button
                    className="exp-primary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          request("social-moderation", "POST", {
                            reportId: r.id,
                            action:
                              r.target_kind === "post" ? "hide" : "restrict",
                          }),
                        "Report reviewed; visibility restricted",
                      )
                    }
                  >
                    {r.target_kind === "post"
                      ? "Hide post"
                      : "Restrict profile discovery"}
                  </button>
                  <button
                    className="exp-secondary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          request("social-moderation", "POST", {
                            reportId: r.id,
                            action: "dismiss",
                          }),
                        "Report dismissed",
                      )
                    }
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </section>
        ))
      ) : (
        <Nothing
          title="A quiet, respectful corner."
          description="No social reports are waiting in your scope."
        />
      )}
    </div>
  );
}
