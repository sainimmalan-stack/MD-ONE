"use client";
import { formOptions, optionValue } from "@/lib/form-options";
import { HomesMarketplace } from "./homes-marketplace";
import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  ArrowUpRight,
  Plus,
  X,
  MessageCircle,
  Bookmark,
  RefreshCw,
  Check,
  ShieldCheck,
  Building2,
  FileText,
  Wallet,
  ArrowRight,
  Search,
  Armchair,
  BookOpen,
  Package,
  Download,
  Printer,
} from "lucide-react";
type R = Record<string, any>;
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const month = () => today().slice(0, 7);
const key = () => crypto.randomUUID();
async function api(path: string, body?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Unable to complete this request.");
  return d;
}
function download(name: string, value: string, type = "text/csv") {
  const u = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
function csv(rows: unknown[][]) {
  return rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current
      ?.querySelector<HTMLElement>("button,input,select,textarea")
      ?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="cm-backdrop">
      <section
        className="cm-modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="cm-eyebrow">MD ONE</span>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close dialog" onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="cm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="cm-empty">
      <Building2 size={24} />
      <p>{children}</p>
    </div>
  );
}
function Banner({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <header className="cm-banner">
      <div>
        <span className="cm-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
      {children}
    </header>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return <span className="cm-badge">{children}</span>;
}
const categories = [
  "Furniture",
  "Appliances",
  "Electronics",
  "Books",
  "Children’s items",
  "Cycles",
  "Fitness",
  "Home and garden",
  "Other",
];
const expenses = [
  "Security",
  "Electricity",
  "Water",
  "Lift AMC",
  "Generator diesel",
  "Generator service",
  "Plumbing",
  "Electrical",
  "Tiles",
  "Cleaning",
  "Pumps",
  "Gardening",
  "Pest control",
  "Insurance",
  "Repairs",
  "Miscellaneous",
];
async function imageFile(f: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(f.type) || f.size > 10000000)
    throw new Error("Choose a JPEG or PNG under 10 MB.");
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    const ratio = Math.min(1, 1000 / Math.max(img.width, img.height));
    c.width = img.width * ratio;
    c.height = img.height * ratio;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.72);
    if (data.length > 550000) throw new Error("Choose a smaller photo.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function attachment(pid: string, f: File, redacted = false) {
  if (f.size > 2000000) throw new Error("Keep attachments below 2 MB.");
  const data = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result).split(",")[1]);
    reader.onerror = rej;
    reader.readAsDataURL(f);
  });
  return api(`my-project/${pid}/attachments`, {
    name: f.name,
    mime: f.type,
    data,
    redacted,
  });
}
export function Exchange(props: {
  data: R;
  openProfile?: (id: string) => void;
}) {
  const [section, setSection] = useState("items");
  return (
    <div className="marketplace-shell">
      <header className="marketplace-heading">
        <h1>
          Marketplace<span className="gold-dot">.</span>
        </h1>
        <span>
          <ShieldCheck size={15} />
          Within your MDP community
        </span>
      </header>
      <nav className="marketplace-mode" aria-label="Marketplace sections">
        <button
          aria-pressed={section === "items"}
          onClick={() => setSection("items")}
        >
          <Package size={16} />
          Items
        </button>
        <button
          aria-pressed={section === "homes"}
          onClick={() => setSection("homes")}
        >
          <Building2 size={16} />
          Homes
        </button>
      </nav>
      {section === "items" ? (
        <ItemExchange {...props} />
      ) : (
        <HomesMarketplace data={props.data} />
      )}
    </div>
  );
}
function ItemExchange({
  data,
  openProfile,
}: {
  data: R;
  openProfile?: (id: string) => void;
}) {
  const [result, setResult] = useState<R>({ listings: [] }),
    [members, setMembers] = useState<R[]>([]),
    [query, setQuery] = useState<R>({}),
    [selected, setSelected] = useState<R | null>(null),
    [draft, setDraft] = useState<R | null>(null),
    [preview, setPreview] = useState(false),
    [inbox, setInbox] = useState<R[]>([]),
    [conversation, setConversation] = useState<R | null>(null),
    [messages, setMessages] = useState<R[]>([]),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [inboxOpen, setInboxOpen] = useState(false);
  async function load(append = false, offset = 0) {
    const r = await api(
      `exchange?${new URLSearchParams({ ...query, offset: String(offset) })}`,
    );
    setResult((old) => ({
      ...r,
      listings: append ? [...old.listings, ...r.listings] : r.listings,
    }));
    setInbox(await api("exchange/conversations"));
  }
  useEffect(() => {
    api("my-project")
      .then((r) => setMembers(r.projects))
      .catch((e) => setError(e.message));
  }, [data.user.id]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [JSON.stringify(query), data.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!conversation) return;
    let live = true;
    const refresh = () =>
      api(`exchange/conversations/${conversation.id}`)
        .then((r) => {
          if (live) setMessages(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    refresh();
    const timer = setInterval(refresh, 6000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [conversation]);
  async function act(fn: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setError("");
    try {
      await fn();
      if (refresh) await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function create() {
    setDraft({
      key: key(),
      projectId: members[0]?.project_id,
      title: "",
      description: "",
      category: "Furniture",
      condition: "Good",
      type: "sale",
      price: 0,
      audience: "project",
      status: "draft",
      photos: [],
      exchangePreference: "",
    });
    setPreview(false);
  }
  const patch = (field: string, value: unknown) =>
    setDraft((d) => ({ ...d!, [field]: value }));
  return (
    <div className="cm-page">
      <Banner
        eyebrow="LESS WASTE. MORE NEIGHBOURHOOD."
        title="Good things. New homes."
        body="Buy, sell, swap or give a little joy to someone nearby."
      >
        <button
          className="cm-primary"
          onClick={create}
          disabled={!members.length}
        >
          <Plus size={17} /> List an item
        </button>
      </Banner>
      <div className="cm-exchange-intro">
        <div>
          <span className="cm-dot" /> YOUR PRIVATE RESIDENT EXCHANGE
        </div>
        <button onClick={() => setInboxOpen(!inboxOpen)}>
          <MessageCircle size={17} /> Enquiries <Badge>{inbox.length}</Badge>
        </button>
      </div>
      {error && (
        <p role="alert" className="cm-error">
          {error}
        </p>
      )}
      <div className="cm-filters">
        <label className="cm-search">
          <Search size={17} />
          <input
            aria-label="Search Exchange"
            placeholder="A chair, a cycle, your next favourite find…"
            value={query.search || ""}
            onChange={(e) => setQuery({ ...query, search: e.target.value })}
          />
        </label>
        <select
          aria-label="Listing category"
          value={query.category || ""}
          onChange={(e) => setQuery({ ...query, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Listing type"
          value={query.type || ""}
          onChange={(e) => setQuery({ ...query, type: e.target.value })}
        >
          <option value="">Every kind of find</option>
          <option value="sale">For sale</option>
          <option value="free">Give away</option>
          <option value="wanted">Wanted</option>
          <option value="exchange">Exchange</option>
        </select>
        <select
          aria-label="Condition filter"
          value={query.condition || ""}
          onChange={(e) => setQuery({ ...query, condition: e.target.value })}
        >
          <option value="">Any condition</option>
          {["New", "Like new", "Good", "Fair"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          aria-label="Maximum price in rupees"
          type="number"
          placeholder="Max ₹"
          onChange={(e) =>
            setQuery({
              ...query,
              maxPrice: e.target.value
                ? String(Number(e.target.value) * 100)
                : "",
            })
          }
        />
        <select
          aria-label="Project filter"
          value={query.project || ""}
          onChange={(e) => setQuery({ ...query, project: e.target.value })}
        >
          <option value="">My project + opted-in MDP</option>
          {data.projects?.map((p: R) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className={query.saved ? "selected" : ""}
          onClick={() => setQuery({ ...query, saved: query.saved ? "" : "1" })}
        >
          <Bookmark size={16} /> Saved
        </button>
      </div>
      {inboxOpen && (
        <section className="cm-panel">
          <h2>Your enquiries</h2>
          {!inbox.length && <p>Start a conversation from an item you like.</p>}
          {inbox.map((c) => (
            <button
              className="cm-list-row"
              key={c.id}
              onClick={() => {
                setMessages([]);
                setConversation(c);
              }}
            >
              <MessageCircle size={18} />
              <span>
                {c.title}
                <small>Private listing conversation</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </section>
      )}
      <div className="cm-market-grid">
        {result.listings.map((l: R) => (
          <article className="cm-item" key={l.id}>
            <button
              className={`cm-item-art art-${l.category.toLowerCase().replaceAll(" ", "-")}`}
              onClick={() => setSelected(l)}
            >
              {l.photos[0] ? (
                <img src={l.photos[0]} alt={l.title} />
              ) : (
                <>
                  <span className="cm-art-ring" />
                  {l.category === "Books" ? (
                    <BookOpen />
                  ) : l.category === "Furniture" ? (
                    <Armchair />
                  ) : (
                    <Package />
                  )}
                  <span className="cm-art-caption">
                    A LITTLE LESS NEW.
                    <br />A LOT MORE MEANING.
                  </span>
                </>
              )}
              <span className="cm-item-type">
                {l.type === "free"
                  ? "GIVE A LITTLE JOY"
                  : l.type === "sale"
                    ? "NEIGHBOUR’S FIND"
                    : l.type.toUpperCase()}
              </span>
            </button>
            <div className="cm-item-content">
              <div className="cm-between">
                <small>
                  {l.category} · {l.condition}
                </small>
                <button
                  aria-label={l.saved ? "Unsave listing" : "Save listing"}
                  onClick={() =>
                    act(() =>
                      api(`exchange/${l.id}/action`, {
                        action: l.saved ? "unsave" : "save",
                      }),
                    )
                  }
                >
                  <Bookmark
                    size={18}
                    fill={l.saved ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <button className="cm-item-title" onClick={() => setSelected(l)}>
                {l.title}
              </button>
              <div className="cm-between">
                <strong>
                  {l.type === "free"
                    ? "With love, free"
                    : l.type === "exchange"
                      ? "Let’s swap"
                      : l.type === "wanted"
                        ? "Looking for"
                        : money(l.price)}
                </strong>
                <Badge>{l.status}</Badge>
              </div>
              <p>
                {data.projects?.find((p: R) => p.id === l.project_id)?.name ||
                  "MDP community"}{" "}
                <span>
                  · {l.audience === "network" ? "Across MDP" : "Project only"}
                </span>
              </p>
            </div>
          </article>
        ))}
      </div>
      {!result.listings.length && (
        <Empty>
          No finds here yet. Your spare could be a neighbour’s favourite.
        </Empty>
      )}
      {result.nextOffset !== null && result.nextOffset !== undefined && (
        <button onClick={() => act(() => load(true, result.nextOffset), false)}>
          Explore more finds
        </button>
      )}
      <p className="cm-footnote">
        <ShieldCheck size={15} /> Verified neighbours. Private conversations.
        Agree on collection and payment directly.
      </p>
      {selected && (
        <Modal title={selected.title} close={() => setSelected(null)}>
          <div className="cm-photo-strip">
            {selected.photos.map((p: string, i: number) => (
              <img key={i} src={p} alt={`Item photo ${i + 1}`} />
            ))}
          </div>
          <div className="cm-between">
            <h2>
              {selected.type === "free"
                ? "Free to a good home"
                : money(selected.price)}
            </h2>
            <Badge>{selected.status}</Badge>
          </div>
          <p>{selected.description}</p>
          {selected.exchange_preference && (
            <p>Swap preference: {selected.exchange_preference}</p>
          )}
          <div className="cm-panel">
            <small>LISTED BY</small>
            <h3>{selected.seller.name}</h3>
            <p>
              Contact and profile details follow this neighbour’s privacy
              choices.
            </p>
            <button onClick={() => openProfile?.(selected.user_id)}>
              View permitted profile <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="cm-actions">
            {selected.user_id === data.user.id ? (
              <button
                className="cm-primary"
                onClick={() => {
                  setDraft({
                    ...selected,
                    projectId: selected.project_id,
                    key: selected.request_key,
                    exchangePreference: selected.exchange_preference,
                  });
                  setPreview(false);
                  setSelected(null);
                }}
              >
                Manage listing
              </button>
            ) : (
              <button
                className="cm-primary"
                disabled={busy || selected.status !== "active"}
                onClick={() =>
                  act(async () => {
                    const c = await api(`exchange/${selected.id}/action`, {
                      action: "enquire",
                    });
                    setConversation({
                      ...c,
                      title: selected.title,
                      seller_id: selected.user_id,
                    });
                    setSelected(null);
                  })
                }
              >
                Ask about this item <MessageCircle size={17} />
              </button>
            )}
            <button
              onClick={() =>
                act(async () => {
                  const reason = prompt("Why are you reporting this listing?");
                  if (reason)
                    await api("exchange/reports", {
                      kind: "listing",
                      targetId: selected.id,
                      reason,
                    });
                })
              }
            >
              Report listing
            </button>
          </div>
        </Modal>
      )}
      {draft && (
        <Modal
          title={
            preview
              ? "Your listing preview"
              : draft.id
                ? "Manage your listing"
                : "Give it a new beginning"
          }
          close={() => setDraft(null)}
        >
          {preview ? (
            <>
              <Badge>
                {draft.audience === "network"
                  ? "Across MDP · explicit opt-in"
                  : "My project only"}
              </Badge>
              <h2>{draft.title}</h2>
              <p>{draft.description}</p>
              <div className="cm-photo-strip">
                {draft.photos.map((p: string, i: number) => (
                  <img key={i} src={p} alt={`Listing preview ${i + 1}`} />
                ))}
              </div>
              <h3>{money(draft.price)}</h3>
            </>
          ) : (
            <div className="cm-form-grid">
              <Field label="Your project">
                <select
                  value={draft.projectId}
                  disabled={!!draft.id}
                  onChange={(e) => patch("projectId", e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.project_id}>
                      {m.project} · {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Listing type">
                <select
                  value={draft.type}
                  onChange={(e) => patch("type", e.target.value)}
                >
                  {["sale", "free", "wanted", "exchange"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => patch("title", e.target.value)}
                  maxLength={100}
                />
              </Field>
              <Field label="Category">
                <select
                  value={draft.category}
                  onChange={(e) => patch("category", e.target.value)}
                >
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Condition">
                <select
                  value={draft.condition}
                  onChange={(e) => patch("condition", e.target.value)}
                >
                  {["New", "Like new", "Good", "Fair"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Price ₹">
                <input
                  type="number"
                  min="0"
                  value={draft.price / 100}
                  onChange={(e) =>
                    patch("price", Math.round(Number(e.target.value) * 100))
                  }
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(e) => patch("description", e.target.value)}
                  maxLength={2500}
                />
              </Field>
              <Field label="Exchange preference (optional)">
                <input
                  value={draft.exchangePreference}
                  onChange={(e) => patch("exchangePreference", e.target.value)}
                />
              </Field>
              <Field label="Who can see it?">
                <select
                  value={draft.audience}
                  onChange={(e) => patch("audience", e.target.value)}
                >
                  <option value="project">My project only (default)</option>
                  <option value="network">I choose to share across MDP</option>
                </select>
              </Field>
              <Field label="Up to 5 photos">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  onChange={(e) =>
                    act(async () => {
                      const files = Array.from(e.target.files || []);
                      if (files.length + draft.photos.length > 5)
                        throw new Error("Choose up to five photos.");
                      patch("photos", [
                        ...draft.photos,
                        ...(await Promise.all(files.map(imageFile))),
                      ]);
                    })
                  }
                />
              </Field>
              <div className="cm-photo-strip">
                {draft.photos.map((p: string, i: number) => (
                  <button
                    key={i}
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() =>
                      patch(
                        "photos",
                        draft.photos.filter((_: string, n: number) => n !== i),
                      )
                    }
                  >
                    <img src={p} alt={`Listing photo ${i + 1}`} />
                    <X size={14} />
                  </button>
                ))}
              </div>
              {draft.id && (
                <Field label="Listing status">
                  <select
                    value={draft.status}
                    onChange={(e) => patch("status", e.target.value)}
                  >
                    {[
                      "draft",
                      "active",
                      "reserved",
                      "sold",
                      "withdrawn",
                      "expired",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}
          <p className="cm-footnote">
            No phone number or flat is shared by publishing. You decide what to
            share in a conversation.
          </p>
          <div className="cm-actions">
            <button onClick={() => setPreview(!preview)}>
              {preview ? "Keep editing" : "Preview"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await api(`exchange${draft.id ? "/" + draft.id : ""}`, {
                    ...draft,
                    status: draft.id ? draft.status : "draft",
                  });
                  setDraft(null);
                })
              }
            >
              Save {draft.id ? "changes" : "draft"}
            </button>
            {!draft.id && (
              <button
                className="cm-primary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api("exchange", { ...draft, status: "active" });
                    setDraft(null);
                  })
                }
              >
                Publish listing <ArrowRight size={16} />
              </button>
            )}
          </div>
          {error && (
            <p className="cm-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {conversation && (
        <Modal
          title={conversation.title || "Private enquiry"}
          close={() => setConversation(null)}
        >
          <div className="cm-privacy-note">
            <ShieldCheck size={18} /> This conversation keeps profiles locked.
            Share collection details only when you’re comfortable.
          </div>
          <div className="cm-messages">
            {!messages.length && (
              <Empty>Say hello and ask about availability.</Empty>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.user_id === data.user.id ? "cm-message mine" : "cm-message"
                }
              >
                <small>
                  {m.user_id === data.user.id ? "You" : "Neighbour"}
                </small>
                <p>{m.body}</p>
                <time>
                  {new Date(m.created).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </time>
              </div>
            ))}
          </div>
          <form
            className="cm-compose"
            onSubmit={(e) => {
              e.preventDefault();
              const body = message,
                k = key();
              act(async () => {
                await api(`exchange/conversations/${conversation.id}`, {
                  body,
                  key: k,
                });
                setMessages(
                  await api(`exchange/conversations/${conversation.id}`),
                );
                setMessage("");
              });
            }}
          >
            <input
              aria-label="Enquiry message"
              placeholder="Is this still available?"
              value={message}
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button className="cm-primary" disabled={busy || !message.trim()}>
              Send
            </button>
          </form>
          <div className="cm-actions">
            <button
              onClick={() =>
                act(async () => {
                  const reason = prompt("Report this conversation");
                  if (reason)
                    await api("exchange/reports", {
                      kind: "conversation",
                      targetId: conversation.id,
                      reason,
                    });
                })
              }
            >
              Report conversation
            </button>
            <button
              onClick={() =>
                act(async () => {
                  const target =
                    conversation.buyer_id === data.user.id
                      ? conversation.seller_id
                      : conversation.buyer_id;
                  await api(`blocks/${target}`, {});
                  setConversation(null);
                })
              }
            >
              Block neighbour
            </button>
            <span className="cm-footnote">Updates every 6 seconds</span>
          </div>
          {error && <p className="cm-error">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
type Spec = {
  name: string;
  label: string;
  type?: string;
  options?: (string | { value: string; label: string; projectId?: string })[];
  dependsOn?: string;
  optional?: boolean;
  value?: any;
  when?: { field: string; value?: string };
};
function RecordForm({
  title,
  fields,
  initial,
  onSubmit,
  close,
  busy,
  error,
  children,
}: {
  title: string;
  fields: Spec[];
  initial?: R;
  onSubmit: (v: R) => void;
  close: () => void;
  busy: boolean;
  error: string;
  children?: ReactNode;
}) {
  const [v, setV] = useState<R>(() => ({
    ...Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.value ??
          (f.type === "checkbox"
            ? false
            : f.type === "number"
              ? 0
              : (typeof f.options?.[0] === "object"
                  ? f.options[0].value
                  : f.options?.[0]) || ""),
      ]),
    ),
    ...initial,
  }));
  return (
    <Modal title={title} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v);
        }}
      >
        <div className="cm-form-grid">
          {fields
            .filter(
              (f) =>
                !f.when ||
                (f.when.value === undefined
                  ? !!v[f.when.field]
                  : v[f.when.field] === f.when.value),
            )
            .map((f) => (
              <Field key={f.name} label={f.label}>
                {f.options ? (
                  <select
                    value={v[f.name]}
                    onChange={(e) => setV((previous) => {
                      const next = { ...previous, [f.name]: e.target.value };
                      for (const dependent of fields.filter((field) => field.dependsOn === f.name)) {
                        const choices = formOptions(dependent.options || [], e.target.value);
                        if (!choices.some((choice) => optionValue(choice) === next[dependent.name])) {
                          next[dependent.name] = optionValue(choices[0]);
                        }
                      }
                      return next;
                    })}
                  >
                    {formOptions(f.options, f.dependsOn ? String(v[f.dependsOn] ?? "") : undefined).map((x) =>
                      typeof x === "string" ? (
                        <option key={x}>{x}</option>
                      ) : (
                        <option key={x.value} value={x.value}>
                          {x.label}
                        </option>
                      ),
                    )}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    required={!f.optional}
                    value={v[f.name]}
                    onChange={(e) => setV({ ...v, [f.name]: e.target.value })}
                  />
                ) : (
                  <input
                    required={!f.optional && f.type !== "checkbox"}
                    type={f.type || "text"}
                    checked={f.type === "checkbox" ? v[f.name] : undefined}
                    value={f.type === "checkbox" ? undefined : v[f.name]}
                    onChange={(e) =>
                      setV({
                        ...v,
                        [f.name]:
                          f.type === "checkbox"
                            ? e.target.checked
                            : f.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                      })
                    }
                  />
                )}
              </Field>
            ))}
        </div>
        {children}
        {error && (
          <p className="cm-error" role="alert">
            {error}
          </p>
        )}
        <div className="cm-actions">
          <button className="cm-primary" disabled={busy}>
            {busy ? "Saving…" : "Save record"} <Check size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function MyProject({ data }: { data: R }) {
  const [members, setMembers] = useState<R[]>([]),
    [invitations, setInvitations] = useState<R[]>([]),
    [pid, setPid] = useState(""),
    [w, setW] = useState<R | null>(null),
    [section, setSection] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [account, setAccount] = useState<R | null>(null),
    [selectedMonth, setSelectedMonth] = useState(month()),
    [form, setForm] = useState<R | null>(null),
    [attached, setAttached] = useState<R | null>(null),
    [redacted, setRedacted] = useState<R | null>(null),
    [question, setQuestion] = useState<R | null>(null),
    [reply, setReply] = useState(""),
    [billQuery, setBillQuery] = useState("");
  useEffect(() => {
    setW(null);
    api("my-project")
      .then((r) => {
        setMembers(r.projects);
        setInvitations(r.invitations);
        setPid(r.projects[0]?.project_id || "");
      })
      .catch((e) => setError(e.message));
  }, [data.user.id]);
  async function load() {
    if (pid) {
      setW(await api(`my-project/${pid}`));
      try {
        setAccount(
          await api(`my-project/${pid}/accounts?month=${selectedMonth}`),
        );
      } catch {
        setAccount(null);
      }
    }
  }
  useEffect(() => {
    setW(null);
    setQuestion(null);
    load().catch((e) => setError(e.message));
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pid)
      api(`my-project/${pid}/accounts?month=${selectedMonth}`)
        .then(setAccount)
        .catch(() => setAccount(null));
  }, [pid, selectedMonth]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function record(
    kind: string,
    title: string,
    fields: Spec[],
    initial: R = {},
  ) {
    setAttached(null);
    setRedacted(null);
    setError("");
    setForm({ kind, title, fields, initial });
  }
  function send(endpoint: string, body: R) {
    return api(`my-project/${pid}/${endpoint}`, body);
  }
  async function save(v: R) {
    if (form?.kind === "settings")
      await send("settings", {
        ...v,
        amount: Math.round(v.amount * 100),
        special: Math.round((v.special || 0) * 100),
        approvalThreshold: Math.round(v.approvalThreshold * 100),
        openingCash: Math.round(v.openingCash * 100),
        openingReserve: Math.round(v.openingReserve * 100),
        categories: v.categories
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean),
      });
    else if (form?.kind === "expense")
      await send("expenses", {
        ...v,
        amount: Math.round(v.amount * 100),
        rate: Math.round((v.rate || 0) * 100),
        attachmentId: attached?.id,
        redactedAttachmentId: redacted?.id,
      });
    else if (form?.kind === "cash")
      await send("cash", {
        ...v,
        amount: Math.round(v.amount * 100),
        key: form.initial.key,
      });
    else if (form?.kind === "payment")
      await send("payments", {
        ...v,
        amount: Math.round(v.amount * 100),
        attachmentId: attached?.id,
        key: form.initial.key,
      });
    else if (form?.kind === "question")
      await send("questions", { ...v, attachmentId: attached?.id });
    else if (form?.kind === "adjustment")
      await send("adjustments", { ...v, amount: Math.round(v.amount * 100) });
    else if (form?.kind === "liability")
      await send("settings", {
        ...v,
        action: "liability",
        openingDue: Math.round(v.openingDue * 100),
        exemption: Math.round(v.exemption * 100),
      });
    else if (form?.kind === "pay-expense")
      await send("pay-expense", {
        ...v,
        amount: Math.round(v.amount * 100),
        key: form.initial.key,
      });
    else if (form?.kind === "verify") await send("verify-payment", v);
    else if (form?.kind === "operation")
      await send("operations", {
        kind: form.initial.kind,
        title: v.title,
        payload: {
          body: v.body,
          category: v.category,
          month: v.month,
          amount: Math.round((v.amount || 0) * 100),
          renewal: v.renewal,
          agenda: v.agenda,
          minutes: v.minutes,
          decisions: v.decisions,
          options: v.options?.split(",").map((x: string) => x.trim()),
          ends: v.ends
            ? new Date(v.ends + "T23:59:59+05:30").toISOString()
            : undefined,
        },
      });
    else if (form?.kind === "credit")
      await send("apply-credit", { ...v, amount: Math.round(v.amount * 100) });
    setForm(null);
  }
  const amount = { name: "amount", label: "Amount ₹", type: "number" },
    dateField = { name: "date", label: "Date", type: "date", value: today() };
  const qFields: Spec[] = [
    { name: "subject", label: "What would you like help with?" },
    {
      name: "category",
      label: "Category",
      options: [
        "Billing",
        "Maintenance",
        "Repairs",
        "Water",
        "Power",
        "Lift",
        "Suggestion",
        "General",
      ],
    },
    { name: "body", label: "Tell your committee", type: "textarea" },
    {
      name: "visibility",
      label: "Who can see this?",
      options: ["private", "project"],
    },
    {
      name: "faqConsent",
      label: "Allow a redacted FAQ if this is a public, resolved question",
      type: "checkbox",
    },
  ];
  if (!w)
    return (
      <div className="cm-page">
        <Banner
          eyebrow="YOUR BUILDING. YOUR COMMUNITY."
          title="My Project"
          body="Accounts, conversations and decisions belong to each project."
        />
        {error ? (
          <p className="cm-error">{error}</p>
        ) : (
          <Empty>
            {members.length
              ? "Loading your project…"
              : "An active verified membership is needed."}
          </Empty>
        )}
      </div>
    );
  const committee = w.committeeMode,
    sections = [
      "Overview",
      "My dues",
      "Monthly accounts",
      "Expenses & bills",
      "Questions",
      "Notices",
      "Meetings",
      "Committee",
      "Assets & renewals",
    ];
  const due = w.invoices
    .filter((i: R) => i.payer_id === data.user.id)
    .reduce((a: number, i: R) => a + i.balance, 0);
  function operation(kind: string) {
    const fields: Spec[] = [
      { name: "title", label: "Title" },
      { name: "body", label: "Details", type: "textarea" },
    ];
    if (kind === "meeting")
      fields.push(
        { name: "agenda", label: "Agenda", type: "textarea" },
        { name: "minutes", label: "Minutes", type: "textarea", optional: true },
        {
          name: "decisions",
          label: "Recorded decisions",
          type: "textarea",
          optional: true,
        },
      );
    if (kind === "asset")
      fields.push(
        {
          name: "category",
          label: "Configured facility",
          options: w!.settings.policy.categories || [],
        },
        { name: "renewal", label: "Next renewal / service date", type: "date" },
      );
    if (kind === "poll")
      fields.push(
        { name: "options", label: "Options, separated by commas" },
        { name: "ends", label: "Closes on", type: "date" },
      );
    if (kind === "budget" || kind === "template")
      fields.push(
        amount,
        {
          name: "category",
          label: "Category",
          options: w!.settings.policy.categories || [],
        },
        { name: "month", label: "Period", type: "month", value: month() },
      );
    record("operation", `New ${kind}`, fields, { kind });
  }
  const pending = w.submissions.filter(
    (s: R) => s.status === "submitted",
  ).length;
  return (
    <div className="cm-page">
      <Banner
        eyebrow={
          committee
            ? "PROJECT COMMITTEE WORKSPACE"
            : "YOUR BUILDING. YOUR COMMUNITY."
        }
        title={w.project.name}
        body={
          committee
            ? "Your project’s funds, bills and resident conversations. Every action stays in this project."
            : "A clearer picture of your community, one month at a time."
        }
      >
        <div className="cm-project-select">
          <Building2 size={18} />
          <select
            aria-label="Active project"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
          >
            {Array.from(
              new Map(members.map((m) => [m.project_id, m])).values(),
            ).map((m) => (
              <option key={m.project_id} value={m.project_id}>
                {m.project} · {m.label}
              </option>
            ))}
          </select>
          <Badge>
            {committee ? w.appointment.position.replace("_", " ") : "Resident"}
          </Badge>
        </div>
      </Banner>
      <div className="cm-scope-note">
        <ShieldCheck size={16} />
        <span>
          Managed by your project committee. Maintenance funds stay with your
          project; MDP provides the software.
        </span>
        <button onClick={() => act(load)} aria-label="Refresh project">
          <RefreshCw size={16} />
        </button>
      </div>
      <nav className="cm-section-nav" aria-label="My Project sections">
        {sections.map((s) => (
          <button
            key={s}
            className={section === s ? "active" : ""}
            onClick={() => setSection(s)}
          >
            {s}
            {s === "Questions" &&
              w.questions.filter((q: R) => q.status !== "resolved").length >
                0 && (
                <span>
                  {w.questions.filter((q: R) => q.status !== "resolved").length}
                </span>
              )}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="cm-error">
          {error}
        </p>
      )}
      {section === "Overview" && (
        <>
          <div className="cm-overview-grid">
            <section className="cm-dues-hero">
              <span className="cm-eyebrow">YOUR PERSONAL LEDGER</span>
              <h2>Your maintenance dues</h2>
              <p className="cm-dues-description">
                Your home account, clearly in view.
              </p>
              <strong>{money(due)}</strong>
              <small>Outstanding on bills assigned to you</small>
              <button onClick={() => setSection("My dues")}>
                View my dues <ArrowUpRight size={18} />
              </button>
            </section>
            <section className="cm-panel cm-overview-statement">
              <div className="cm-between">
                <h2>This month at a glance</h2>
                <Badge>{selectedMonth}</Badge>
              </div>
              {account ? (
                <div className="cm-metric-grid">
                  <Metric
                    label="Collections received"
                    value={account.receipts}
                  />
                  <Metric label="Actual payments" value={account.payments} />
                  <Metric label="Closing cash / bank" value={account.closing} />
                  <Metric
                    label="Reserve, kept separate"
                    value={account.reserve}
                  />
                </div>
              ) : (
                <Empty>Monthly accounts are not published yet.</Empty>
              )}
              <button
                className="cm-text-link"
                onClick={() => setSection("Monthly accounts")}
              >
                Open the statement <ArrowRight size={16} />
              </button>
              {committee && (
                <p>
                  {pending} payment proofs awaiting verification ·{" "}
                  {w.bills.filter((b: R) => b.status === "pending").length}{" "}
                  bills awaiting review
                </p>
              )}
            </section>
          </div>
          <div className="cm-columns">
            <section className="cm-panel">
              <h2>On your noticeboard</h2>
              {w.operations
                .filter((o: R) => o.kind === "notice")
                .slice(0, 3)
                .map((o: R) => (
                  <div className="cm-note" key={o.id}>
                    <span className="cm-eyebrow">PROJECT NOTICE</span>
                    <h3>{o.title}</h3>
                    <p>{o.payload.body}</p>
                  </div>
                ))}
              {!w.operations.some((o: R) => o.kind === "notice") && (
                <p>Nothing urgent. A quiet noticeboard is a good thing.</p>
              )}
            </section>
            <section className="cm-panel">
              <h2>A direct line to your committee</h2>
              <p>
                Billing doubts, common repairs and suggestions have a home here.
              </p>
              <button
                className="cm-primary"
                onClick={() =>
                  record("question", "Ask my project committee", qFields)
                }
              >
                Ask a question <MessageCircle size={17} />
              </button>
              <div className="cm-committee-mini">
                {w.committee.map((a: R) => (
                  <div key={a.id}>
                    <span className="cm-person-initial">{a.name[0]}</span>
                    <span>
                      {a.name}
                      <small>{a.position.replace("_", " ")}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {!!w.renewals?.length && (
            <section className="cm-panel">
              <span className="cm-eyebrow">UPCOMING & OVERDUE RENEWALS</span>
              <h2>Keep your shared equipment cared for.</h2>
              {w.renewals.map((a: R) => (
                <div key={a.id} className="cm-ledger-row">
                  <span>{a.title}</span>
                  <Badge>
                    {a.renewal < today() ? "Overdue" : "Due soon"} · {a.renewal}
                  </Badge>
                </div>
              ))}
            </section>
          )}
          {!w.settings.enabled && (
            <div className="cm-panel">
              <h3>Maintenance is not activated</h3>
              <p>
                Ongoing projects begin billing only after their committee
                explicitly approves a policy and start date.
              </p>
            </div>
          )}
        </>
      )}
      {section === "My dues" && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">
                PRIVATE TO YOU & YOUR COMMITTEE
              </span>
              <h2>Your home. Your ledger.</h2>
            </div>
            <Badge>Advance credit {money(w.credit)}</Badge>
          </div>
          {!w.invoices.filter(
            (i: R) =>
              i.payer_id === data.user.id &&
              ["published", "closed"].includes(i.state),
          ).length && <Empty>No published bills assigned to you yet.</Empty>}
          {w.invoices
            .filter(
              (i: R) =>
                i.payer_id === data.user.id &&
                ["published", "closed"].includes(i.state),
            )
            .map((i: R) => (
              <section className="cm-panel cm-invoice" key={i.id}>
                <div className="cm-between">
                  <div>
                    <small>
                      {w.project.name} · Flat {i.label}
                    </small>
                    <h2>{i.month} maintenance</h2>
                  </div>
                  <Badge>{i.status}</Badge>
                </div>
                {i.lines.map((l: R, n: number) => (
                  <div className="cm-ledger-row" key={n}>
                    <span>{l.label}</span>
                    <strong>{money(l.amount)}</strong>
                  </div>
                ))}
                {i.adjustments?.map((a: R, n: number) => (
                  <div className="cm-ledger-row" key={`adjustment-${n}`}>
                    <span>
                      {a.reason}
                      <small>Effective {a.effective_month}</small>
                    </span>
                    <strong>{money(a.amount)}</strong>
                  </div>
                ))}
                {i.adjustment !== 0 && (
                  <div className="cm-ledger-row">
                    <span>Versioned adjustments</span>
                    <strong>{money(i.adjustment)}</strong>
                  </div>
                )}
                <div className="cm-ledger-row">
                  <span>Received / advance applied</span>
                  <strong>− {money(i.paid)}</strong>
                </div>
                <div className="cm-ledger-total">
                  <span>
                    Outstanding <small>Due {i.due_date}</small>
                  </span>
                  <strong>{money(i.balance)}</strong>
                </div>
                <div className="cm-actions">
                  <button
                    className="cm-primary"
                    onClick={() =>
                      record(
                        "payment",
                        "Submit a payment record",
                        [
                          amount,
                          {
                            name: "reference",
                            label: "Project bank / cash reference",
                          },
                        ],
                        {
                          invoiceId: i.id,
                          amount: i.balance / 100,
                          key: key(),
                        },
                      )
                    }
                  >
                    I paid my project <ArrowUpRight size={16} />
                  </button>
                  <button
                    onClick={() =>
                      record("question", "Ask about this bill", qFields, {
                        category: "Billing",
                        subject: `Question about ${i.month} bill`,
                        body: `Invoice ${i.id}: `,
                      })
                    }
                  >
                    Ask a billing question
                  </button>
                </div>
                <p className="cm-preserve">
                  {w.settings.policy.paymentInstructions ||
                    "Project payment instructions are not configured. Confirm the authorized destination with your committee before paying."}
                </p>
                <p className="cm-footnote">
                  Pay directly to your project’s authorized account. Proof stays
                  “submitted” until another committee member verifies the
                  project record.
                </p>
              </section>
            ))}
          <section className="cm-panel">
            <h2>Payment history & receipts</h2>
            {!w.submissions.filter((s: R) => s.user_id === data.user.id)
              .length && <p>No submitted payments.</p>}
            {w.submissions
              .filter((s: R) => s.user_id === data.user.id)
              .map((s: R) => (
                <div className="cm-ledger-row" key={s.id}>
                  <div>
                    {s.reference}
                    <small>
                      {new Date(s.created).toLocaleDateString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      ·{" "}
                      {s.status === "submitted"
                        ? "Awaiting verification"
                        : "Committee verified"}
                    </small>
                  </div>
                  <strong>{money(s.amount)}</strong>
                  {s.attachment_id && (
                    <a
                      href={`/api/my-project/${pid}/attachments/${s.attachment_id}`}
                    >
                      Your proof
                    </a>
                  )}
                </div>
              ))}
            {w.receipts
              .filter((r: R) => r.user_id === data.user.id)
              .map((r: R) => (
                <div className="cm-ledger-row" key={r.id}>
                  <span>
                    Receipt {r.id.slice(0, 8)} · {r.date}
                  </span>
                  <strong>{money(r.amount)}</strong>
                  <button
                    onClick={() =>
                      download(
                        `receipt-${r.id}.txt`,
                        `${w.project.name}\nCommittee-verified receipt ${r.id}\nDate ${r.date}\nAmount ${money(r.amount)}\nAllocated ${money(r.allocated)}\nVerified by ${r.verified_by}\nLocal synthetic demo receipt`,
                        "text/plain",
                      )
                    }
                  >
                    Download receipt
                  </button>
                </div>
              ))}
          </section>
        </>
      )}
      {section === "Monthly accounts" && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">TRANSPARENT BY DESIGN</span>
              <h2>Every rupee, in context.</h2>
            </div>
            <input
              type="month"
              aria-label="Statement month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          {committee && (
            <section className="cm-panel">
              <div className="cm-between">
                <h3>Monthly billing</h3>
                <button
                  onClick={() =>
                    act(() =>
                      send("billing", {
                        action: "draft",
                        month: selectedMonth,
                      }),
                    )
                  }
                >
                  <Plus size={16} /> Create draft
                </button>
              </div>
              <div className="cm-actions">
                <button
                  onClick={() =>
                    record(
                      "cash",
                      "Record a project receipt / reserve transfer",
                      [
                        {
                          name: "action",
                          label: "Record type",
                          options: ["other_receipt", "reserve_transfer"],
                        },
                        amount,
                        dateField,
                        {
                          name: "fund",
                          label: "Receiving fund (same project only)",
                          options: ["general", "reserve"],
                        },
                        {
                          name: "reference",
                          label: "Project cash / bank reference",
                        },
                        { name: "reason", label: "Reason", type: "textarea" },
                        {
                          name: "confirmed",
                          label:
                            "I checked the actual project cash / bank records; this only records a completed movement",
                          type: "checkbox",
                        },
                      ],
                      { key: key() },
                    )
                  }
                >
                  Other receipt / reserve movement
                </button>
              </div>
              <p>
                Charges use the approved policy and assigned payer. Vendor bills
                never change flat charges automatically.
              </p>
              {w.periods.map((p: R) => (
                <div className="cm-ledger-row" key={p.id}>
                  <strong>{p.month}</strong>
                  <Badge>{p.state}</Badge>
                  {p.state !== "closed" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          send("billing", {
                            periodId: p.id,
                            action:
                              p.state === "draft"
                                ? "review"
                                : p.state === "review"
                                  ? "publish"
                                  : "close",
                            reconciled:
                              p.state === "published"
                                ? confirm(
                                    "Have you reconciled project cash and bank records? Closing preserves an immutable monthly statement.",
                                  )
                                : false,
                          }),
                        )
                      }
                    >
                      {p.state === "draft"
                        ? "Send to review"
                        : p.state === "review"
                          ? "Publish bills"
                          : "Reconcile & close"}
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
          {account ? (
            <section
              className="cm-panel cm-statement"
              id="project-monthly-statement"
            >
              <div className="cm-statement-head">
                <div>
                  <span className="cm-eyebrow">
                    {w.project.name.toUpperCase()}
                  </span>
                  <h2>Monthly account statement</h2>
                  <p>
                    {selectedMonth} · {account.state} · synthetic local records
                  </p>
                </div>
                <Building2 size={36} />
              </div>
              <div className="cm-statement-grid">
                <Metric label="Opening cash / bank" value={account.opening} />
                <Metric
                  label="Actual collections / receipts"
                  value={account.receipts}
                />
                <Metric label="Actual payments" value={account.payments} />
                <Metric
                  label="Closing cash / bank"
                  value={account.closing}
                  featured
                />
              </div>
              <div className="cm-statement-secondary">
                <Metric
                  label="Unpaid resident dues"
                  value={account.receivables}
                />
                <Metric label="Unpaid vendor bills" value={account.payables} />
                <Metric
                  label="Reserve balance · separate"
                  value={account.reserve}
                />
              </div>
              <div className="cm-ledger-row">
                <span>Reserve transfers into / out of general fund</span>
                <strong>{money(account.reserveTransfer || 0)}</strong>
              </div>
              <div className="cm-ledger-row">
                <span>Resident advances held separately from unpaid dues</span>
                <strong>{money(account.advances || 0)}</strong>
              </div>
              <h3>Recorded expenses by category</h3>
              {Object.entries(account.categories).map(([c, v]) => (
                <div className="cm-ledger-row" key={c}>
                  <span>{c}</span>
                  <strong>{money(Number(v))}</strong>
                </div>
              ))}
              {!Object.keys(account.categories).length && (
                <p>No approved accrued expenses for this month.</p>
              )}
              <div className="cm-ledger-row">
                <span>
                  Opening receivables recognized · separate from current charges
                </span>
                <strong>{money(account.openingDues || 0)}</strong>
              </div>
              <div className="cm-ledger-row">
                <span>Current charges billed</span>
                <strong>{money(account.billed)}</strong>
              </div>
              <div className="cm-ledger-row">
                <span>Accrued expenses (bill counted once)</span>
                <strong>{money(account.expenses)}</strong>
              </div>
              <div className="cm-ledger-row">
                <span>Billing less accrued expenses · not cash balance</span>
                <strong>{money(account.accrualSurplus)}</strong>
              </div>
              {account.budgets
                .filter((b: R) => b.month === selectedMonth)
                .map((b: R, n: number) => (
                  <div className="cm-ledger-row" key={n}>
                    <span>{b.category} budget / actual</span>
                    <strong>
                      {money(b.amount)} /{" "}
                      {money(account.categories[b.category] || 0)}
                    </strong>
                  </div>
                ))}
              <p className="cm-footnote">
                Closing general balance = opening + actual receipts − actual
                payments + net reserve transfers. Unpaid dues and vendor bills
                are shown separately. No statutory compliance claim.
              </p>
              <div className="cm-actions">
                <button
                  onClick={() =>
                    download(
                      `${pid}-${selectedMonth}-statement.csv`,
                      csv([
                        ["Project", w.project.name],
                        ["Month", selectedMonth],
                        ...Object.entries(account)
                          .filter(([, v]) => typeof v === "number")
                          .map(([k, v]) => [k, Number(v) / 100]),
                      ]),
                    )
                  }
                >
                  <Download size={16} /> Export CSV
                </button>
                <button
                  onClick={() =>
                    act(async () => {
                      const a = await api(
                        `my-project/${pid}/annual?year=${selectedMonth.slice(0, 4)}`,
                      );
                      download(
                        `${pid}-${a.year}-annual.csv`,
                        csv([
                          ["Project", w.project.name],
                          ["Year", a.year],
                          [
                            "Month",
                            "Opening INR",
                            "Receipts INR",
                            "Payments INR",
                            "Closing INR",
                            "Reserve INR",
                          ],
                          ...a.months.map((m: R) => [
                            m.month,
                            m.opening / 100,
                            m.receipts / 100,
                            m.payments / 100,
                            m.closing / 100,
                            m.reserve / 100,
                          ]),
                        ]),
                      );
                    })
                  }
                >
                  Annual summary CSV
                </button>
                <button onClick={() => window.print()}>
                  <Printer size={16} /> Print statement
                </button>
              </div>
            </section>
          ) : (
            <Empty>This month’s statement is not published yet.</Empty>
          )}
        </>
      )}
      {section === "Expenses & bills" && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">COMMON EXPENSES</span>
              <h2>The details behind the total.</h2>
            </div>
            {committee && (
              <button
                className="cm-primary"
                onClick={() =>
                  record("expense", "Upload a common-area bill", [
                    {
                      name: "category",
                      label: "Applicable category",
                      options: w.settings.policy.categories || [],
                    },
                    {
                      name: "description",
                      label: "What was this for?",
                      type: "textarea",
                    },
                    {
                      name: "period",
                      label: "Service period",
                      type: "month",
                      value: selectedMonth,
                    },
                    { name: "vendor", label: "Vendor / payee" },
                    { name: "billNumber", label: "Unique vendor bill number" },
                    amount,
                    {
                      name: "billDate",
                      label: "Bill date",
                      type: "date",
                      value: today(),
                    },
                    {
                      name: "dueDate",
                      label: "Due date",
                      type: "date",
                      value: today(),
                    },
                    {
                      name: "litres",
                      label: "Diesel litres, when applicable",
                      when: { field: "category", value: "Generator diesel" },
                      type: "number",
                      optional: true,
                    },
                    {
                      name: "rate",
                      label: "Diesel rate ₹ / litre",
                      when: { field: "category", value: "Generator diesel" },
                      type: "number",
                      optional: true,
                    },
                    {
                      name: "meter",
                      label: "Meter / running-hour notes",
                      when: { field: "category", value: "Generator diesel" },
                      optional: true,
                    },
                    {
                      name: "serviceRequestId",
                      label: "Link a completed MDP specialist visit (optional)",
                      options: [
                        { value: "", label: "No specialist bill linked" },
                        ...(w.linkableServices || []).map((r: R) => ({
                          value: r.id,
                          label: `${r.category_id} · Flat ${r.label} · ${r.description}`,
                        })),
                      ],
                      optional: true,
                    },
                    {
                      name: "reviewedService",
                      label:
                        "I reviewed this common-area service bill before linking it",
                      when: { field: "serviceRequestId" },
                      type: "checkbox",
                    },
                    {
                      name: "correctionOf",
                      label: "Post a correction to an existing bill (optional)",
                      options: [
                        { value: "", label: "This is a new bill" },
                        ...w.bills
                          .filter(
                            (b: R) =>
                              !JSON.parse(b.details || "{}").correctionOf,
                          )
                          .map((b: R) => ({
                            value: b.id,
                            label: `${b.description} · ${b.period}`,
                          })),
                      ],
                      optional: true,
                    },
                    {
                      name: "reason",
                      label: "Correction reason",
                      when: { field: "correctionOf" },
                      optional: true,
                    },
                  ])
                }
              >
                <Plus size={16} /> Add vendor bill
              </button>
            )}
          </div>
          <div className="cm-filters">
            <input
              aria-label="Search project bills"
              placeholder="Search bills, vendor or category"
              value={billQuery}
              onChange={(e) => setBillQuery(e.target.value)}
            />
            {committee && (
              <>
                <button onClick={() => operation("template")}>
                  Recurring template
                </button>
                <button onClick={() => operation("budget")}>
                  Set category budget
                </button>
              </>
            )}
            <button
              onClick={() =>
                download(
                  `${pid}-common-bills.csv`,
                  csv([
                    [
                      "Category",
                      "Description",
                      "Period",
                      "Amount INR",
                      "Paid INR",
                      "Status",
                    ],
                    ...w.bills.map((b: R) => [
                      b.category,
                      b.description,
                      b.period,
                      b.amount / 100,
                      b.paid / 100,
                      b.status,
                    ]),
                  ]),
                )
              }
            >
              Export bills
            </button>
          </div>
          {!w.bills.length && (
            <Empty>
              Common bills will appear here after your committee records them.
            </Empty>
          )}
          {w.bills
            .filter((b: R) =>
              JSON.stringify([
                b.category,
                b.description,
                b.vendor,
                b.period,
                b.status,
              ])
                .toLowerCase()
                .includes(billQuery.toLowerCase()),
            )
            .map((b: R) => (
              <section className="cm-panel cm-bill" key={b.id}>
                <div className="cm-between">
                  <div>
                    <small>
                      {b.category} · {b.period}
                    </small>
                    <h3>{b.description}</h3>
                    <p>
                      {committee
                        ? `${b.vendor} · ${b.bill_number} · Bill date ${b.bill_date}`
                        : "Approved project bill"}
                    </p>
                  </div>
                  <strong>{money(b.amount)}</strong>
                </div>
                <div className="cm-between">
                  <Badge>
                    {b.status} ·{" "}
                    {b.paid === b.amount
                      ? "paid"
                      : b.paid
                        ? "part paid"
                        : "unpaid"}
                  </Badge>
                  <span>
                    Paid {money(b.paid)} · Balance {money(b.amount - b.paid)}
                  </span>
                </div>
                <div className="cm-actions">
                  {committee && b.attachment_id && (
                    <a
                      className="cm-link-button"
                      href={`/api/my-project/${pid}/attachments/${b.attachment_id}`}
                    >
                      <FileText size={16} /> Private original
                    </a>
                  )}
                  {b.redacted_attachment_id && (
                    <a
                      className="cm-link-button"
                      href={`/api/my-project/${pid}/attachments/${b.redacted_attachment_id}`}
                    >
                      Resident-safe bill copy
                    </a>
                  )}
                  {committee && b.status === "pending" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() => send("approve-expense", { id: b.id }))
                      }
                    >
                      Review & approve
                    </button>
                  )}
                  {committee &&
                    b.status === "approved" &&
                    b.paid < b.amount && (
                      <button
                        onClick={() =>
                          record(
                            "pay-expense",
                            "Record a vendor payment",
                            [
                              amount,
                              dateField,
                              {
                                name: "method",
                                label: "Payment method",
                                options: ["Bank transfer", "Cash", "UPI"],
                              },
                              {
                                name: "reference",
                                label: "Project payment reference",
                              },
                            ],
                            {
                              id: b.id,
                              amount: (b.amount - b.paid) / 100,
                              key: key(),
                            },
                          )
                        }
                      >
                        Record actual payment
                      </button>
                    )}
                </div>
              </section>
            ))}
          {committee &&
            w.operations
              .filter((o: R) => o.kind === "template")
              .map((o: R) => (
                <div className="cm-panel" key={o.id}>
                  <Badge>Recurring template · no automatic payment</Badge>
                  <h3>{o.title}</h3>
                  <p>
                    {o.payload.body} · {money(o.payload.amount)}
                  </p>
                  <button
                    onClick={() =>
                      record(
                        "expense",
                        "Create this month’s draft bill",
                        [
                          {
                            name: "category",
                            label: "Category",
                            options: w.settings.policy.categories,
                          },
                          { name: "description", label: "Description" },
                          {
                            name: "period",
                            label: "Month",
                            type: "month",
                            value: month(),
                          },
                          { name: "vendor", label: "Vendor" },
                          { name: "billNumber", label: "New bill number" },
                          amount,
                          {
                            name: "billDate",
                            label: "Bill date",
                            type: "date",
                            value: today(),
                          },
                          {
                            name: "dueDate",
                            label: "Due date",
                            type: "date",
                            value: today(),
                          },
                        ],
                        {
                          category: o.payload.category,
                          description: o.title,
                          amount: o.payload.amount / 100,
                        },
                      )
                    }
                  >
                    Use template
                  </button>
                </div>
              ))}
        </>
      )}
      {section === "Questions" && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">
                A CONVERSATION WITH YOUR COMMITTEE
              </span>
              <h2>Good communities listen.</h2>
            </div>
            <button
              className="cm-primary"
              onClick={() =>
                record("question", "Ask my project committee", qFields)
              }
            >
              <Plus size={17} /> Ask a question
            </button>
          </div>
          <div className="cm-privacy-note">
            <ShieldCheck size={18} /> Private to you and your committee by
            default. MDP specialist bookings live separately in Services.
          </div>
          {!w.questions.length && (
            <Empty>
              No questions yet. Your committee is here when you need them.
            </Empty>
          )}
          {w.questions.map((q: R) => (
            <button
              className="cm-question-row"
              key={q.id}
              onClick={() => setQuestion(q)}
            >
              <span className="cm-question-icon">
                <MessageCircle />
              </span>
              <span>
                <small>
                  {q.category} ·{" "}
                  {q.visibility === "private"
                    ? "Private to committee"
                    : "Project discussion"}
                </small>
                <strong>{q.subject}</strong>
                <small>
                  {q.replies.length} replies ·{" "}
                  {new Date(q.created).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </small>
              </span>
              <Badge>{q.status.replaceAll("_", " ")}</Badge>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </>
      )}
      {["Notices", "Meetings", "Assets & renewals"].includes(section) && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">YOUR PROJECT, TOGETHER</span>
              <h2>{section}</h2>
            </div>
            {committee && (
              <div className="cm-actions">
                <button
                  className="cm-primary"
                  onClick={() =>
                    operation(
                      section === "Notices"
                        ? "notice"
                        : section === "Meetings"
                          ? "meeting"
                          : "asset",
                    )
                  }
                >
                  <Plus size={16} /> Add{" "}
                  {section === "Notices"
                    ? "notice"
                    : section === "Meetings"
                      ? "meeting"
                      : "asset"}
                </button>
                {section === "Meetings" && (
                  <button onClick={() => operation("poll")}>
                    Create resident poll
                  </button>
                )}
              </div>
            )}
          </div>
          {w.operations
            .filter((o: R) =>
              section === "Notices"
                ? ["notice", "faq"].includes(o.kind)
                : section === "Meetings"
                  ? ["meeting", "poll"].includes(o.kind)
                  : o.kind === "asset",
            )
            .map((o: R) => (
              <section className="cm-panel" key={o.id}>
                <Badge>
                  {o.kind === "poll"
                    ? "Resident opinion poll · not a formal election"
                    : o.kind}
                </Badge>
                <h2>{o.title}</h2>
                <p>{o.payload.body}</p>
                {o.payload.renewal && (
                  <p>Next service / renewal: {o.payload.renewal}</p>
                )}
                {["agenda", "minutes", "decisions"].map(
                  (k) =>
                    o.payload[k] && (
                      <div key={k}>
                        <h3>{k}</h3>
                        <p className="cm-preserve">{o.payload[k]}</p>
                      </div>
                    ),
                )}
                {o.kind === "poll" && (
                  <>
                    <p>
                      Closes{" "}
                      {new Date(o.payload.ends).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                    <div className="cm-actions">
                      {o.payload.options?.map((option: string) => (
                        <button
                          key={option}
                          onClick={() =>
                            act(() =>
                              send("vote", { id: o.id, choice: option }),
                            )
                          }
                        >
                          {option} ·{" "}
                          {o.votes?.find((v: R) => v.choice === option)
                            ?.count || 0}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))}
          {!w.operations.some((o: R) =>
            section === "Notices"
              ? ["notice", "faq"].includes(o.kind)
              : section === "Meetings"
                ? ["meeting", "poll"].includes(o.kind)
                : o.kind === "asset",
          ) && (
            <Empty>
              {section === "Assets & renewals"
                ? "Only equipment your building actually has will be registered here."
                : "Your committee has not published any records here yet."}
            </Empty>
          )}
        </>
      )}
      {section === "Committee" && (
        <>
          <div className="cm-section-heading">
            <div>
              <span className="cm-eyebrow">PROJECT-SCOPED RESPONSIBILITY</span>
              <h2>Your community representatives.</h2>
            </div>
            <Badge>{w.project.name}</Badge>
          </div>
          <div className="cm-columns">
            {["president", "vice_president"].map((position) => {
              const a = w.committee.find((a: R) => a.position === position);
              return (
                <section className="cm-panel" key={position}>
                  <span className="cm-eyebrow">
                    {position.replace("_", " ")}
                  </span>
                  <h2>{a?.name || "Position vacant"}</h2>
                  <p>
                    {a
                      ? `Term ${a.starts} → ${a.ends}`
                      : "An authorized appointment administrator can invite an eligible resident."}
                  </p>
                  <button onClick={() => setSection("Questions")}>
                    Official project channel <MessageCircle size={16} />
                  </button>
                  {a?.user_id === data.user.id && (
                    <button
                      onClick={() =>
                        act(() =>
                          api("appointments", { id: a.id, action: "resign" }),
                        )
                      }
                    >
                      Resign appointment
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          {invitations
            .filter((a) => a.project_id === pid && a.status === "invited")
            .map((a) => (
              <div className="cm-panel" key={a.id}>
                <h3>You’re invited as {a.position.replace("_", " ")}</h3>
                <p>Accepting still requires administrator activation.</p>
                <button
                  onClick={() =>
                    act(async () => {
                      await api("appointments", { id: a.id, action: "accept" });
                      setInvitations((await api("my-project")).invitations);
                    })
                  }
                >
                  Accept invitation
                </button>
              </div>
            ))}
          {committee && (
            <>
              <section className="cm-panel">
                <div className="cm-between">
                  <h2>Project policy & billing register</h2>
                  <button
                    onClick={() =>
                      record(
                        "settings",
                        "Approve a project maintenance policy",
                        [
                          {
                            name: "mode",
                            label: "Charging rule",
                            options: ["fixed", "area"],
                          },
                          amount,
                          {
                            name: "dueDay",
                            label: "Monthly due day (1–28)",
                            type: "number",
                          },
                          {
                            name: "startDate",
                            label: "Approved start date",
                            type: "date",
                          },
                          {
                            name: "enabled",
                            label: "Explicitly activate maintenance",
                            type: "checkbox",
                          },
                          {
                            name: "approved",
                            label: "I approve this policy for this project",
                            type: "checkbox",
                          },
                          {
                            name: "paymentInstructions",
                            label:
                              "Authorized project payment instructions (optional; no MDP account)",
                            type: "textarea",
                            optional: true,
                          },
                          {
                            name: "categories",
                            label: `Applicable categories, comma separated: ${expenses.join(", ")}`,
                            type: "textarea",
                          },
                          {
                            name: "openingCash",
                            label: "Verified opening cash / bank ₹",
                            type: "number",
                          },
                          {
                            name: "openingReserve",
                            label: "Verified separate reserve ₹",
                            type: "number",
                          },
                          {
                            name: "independentReview",
                            label: "Independent review for every bill",
                            type: "checkbox",
                          },
                          {
                            name: "approvalThreshold",
                            label: "Independent review threshold ₹",
                            type: "number",
                          },
                          {
                            name: "special",
                            label: "Explicit special assessment ₹",
                            type: "number",
                            optional: true,
                          },
                          {
                            name: "specialLabel",
                            label: "Special assessment description",
                            optional: true,
                          },
                        ],
                        {
                          ...w.settings.policy,
                          amount: w.settings.policy.amount / 100,
                          startDate: w.settings.start_date || today(),
                          categories: (w.settings.policy.categories || []).join(
                            ", ",
                          ),
                          openingCash: w.settings.opening_cash / 100,
                          openingReserve: w.settings.opening_reserve / 100,
                          approvalThreshold:
                            (w.settings.policy.approvalThreshold || 0) / 100,
                          special: (w.settings.policy.special || 0) / 100,
                          enabled: !!w.settings.enabled,
                        },
                      )
                    }
                  >
                    Configure policy
                  </button>
                </div>
                <p>
                  Current: {w.settings.policy.mode || "Not configured"} ·{" "}
                  {money(w.settings.policy.amount || 0)} ·{" "}
                  {w.settings.enabled ? "Active" : "Not activated"}. Payer
                  changes affect future bills only.
                </p>
                {w.flats.map((f: R) => (
                  <div className="cm-ledger-row" key={f.id}>
                    <strong>{f.label}</strong>
                    <span>
                      {f.payer_id
                        ? `Assigned payer: ${w.eligiblePayers.find((p: R) => p.id === f.payer_id)?.name || "Previously verified payer"}`
                        : "Payer needs verification"}
                    </span>
                    <button
                      onClick={() =>
                        record(
                          "liability",
                          `Flat ${f.label} • future billing responsibility`,
                          [
                            {
                              name: "payerId",
                              label:
                                "Verified owner / resident responsible for future bills",
                              options: w.eligiblePayers
                                .filter((p: R) => p.label === f.label)
                                .map((p: R) => ({
                                  value: p.id,
                                  label: `${p.name} · ${p.label}`,
                                })),
                            },
                            {
                              name: "area",
                              label: "Verified area (sq ft)",
                              type: "number",
                              optional: true,
                            },
                            {
                              name: "areaVerified",
                              label:
                                "Area checked against an authorized register",
                              type: "checkbox",
                            },
                            {
                              name: "openingDue",
                              label: "Verified opening dues ₹",
                              type: "number",
                            },
                            {
                              name: "exemption",
                              label: "Approved monthly exemption ₹",
                              type: "number",
                            },
                          ],
                          {
                            flatId: f.id,
                            payerId: f.payer_id || "",
                            area: f.area || 0,
                            areaVerified: !!f.area_verified,
                            openingDue: (f.opening_due || 0) / 100,
                            exemption: (f.exemption || 0) / 100,
                          },
                        )
                      }
                    >
                      Set liability
                    </button>
                  </div>
                ))}
              </section>
              <section className="cm-panel">
                <h2>Verification queue</h2>
                {w.submissions
                  .filter((s: R) => s.status === "submitted")
                  .map((s: R) => (
                    <div className="cm-ledger-row" key={s.id}>
                      <span>
                        {s.reference}
                        <small>
                          {w.eligiblePayers.find((p: R) => p.id === s.user_id)
                            ?.name || "Billed resident"}{" "}
                          · awaiting verification
                        </small>
                      </span>
                      <strong>{money(s.amount)}</strong>
                      {s.attachment_id && (
                        <a
                          href={`/api/my-project/${pid}/attachments/${s.attachment_id}`}
                        >
                          Private proof
                        </a>
                      )}
                      <button
                        onClick={() =>
                          record(
                            "verify",
                            "Verify against project bank / cash records",
                            [
                              dateField,
                              {
                                name: "confirmed",
                                label:
                                  "Confirmed in project records; a screenshot alone is insufficient",
                                type: "checkbox",
                              },
                            ],
                            { id: s.id },
                          )
                        }
                      >
                        Verify receipt
                      </button>
                    </div>
                  ))}
                {!pending && <p>No payment proofs awaiting verification.</p>}
              </section>
              <section className="cm-panel">
                <h2>Invoice adjustments & advances</h2>
                {w.invoices.map((i: R) => (
                  <div className="cm-ledger-row" key={i.id}>
                    <span>
                      {i.month} · {i.label}
                      <small>
                        {w.eligiblePayers.find((p: R) => p.id === i.payer_id)
                          ?.name || "Billed resident"}{" "}
                        · balance {money(i.balance)}
                      </small>
                    </span>
                    <div className="cm-actions">
                      <button
                        onClick={() =>
                          record(
                            "adjustment",
                            "Append a reasoned charge / credit note",
                            [
                              amount,
                              {
                                name: "reason",
                                label: "Reason",
                                type: "textarea",
                              },
                              {
                                name: "effectiveMonth",
                                label: "Open effective month",
                                type: "month",
                                value: month(),
                              },
                            ],
                            { invoiceId: i.id },
                          )
                        }
                      >
                        Adjustment
                      </button>
                      <button
                        onClick={() =>
                          record(
                            "credit",
                            "Apply an existing advance",
                            [amount],
                            { invoiceId: i.id },
                          )
                        }
                      >
                        Apply advance
                      </button>
                    </div>
                  </div>
                ))}
              </section>
              <section className="cm-panel">
                <div className="cm-between">
                  <h2>Handover & audit trail</h2>
                  <button
                    onClick={() =>
                      download(
                        `${pid}-committee-handover.json`,
                        JSON.stringify(
                          {
                            project: w.project,
                            settings: w.settings,
                            pendingBills: w.bills.filter(
                              (b: R) =>
                                b.status === "pending" || b.paid < b.amount,
                            ),
                            openQuestions: w.questions.filter(
                              (q: R) => q.status !== "resolved",
                            ),
                            assets: w.operations.filter(
                              (o: R) => o.kind === "asset",
                            ),
                            history: w.history,
                          },
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    Export handover
                  </button>
                </div>
                {w.history.slice(0, 15).map((h: R) => (
                  <div className="cm-audit" key={h.id}>
                    <span>{h.kind}</span>
                    <small>
                      {h.actor} ·{" "}
                      {new Date(h.created).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </small>
                    <p>{h.details}</p>
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}
      {form && (
        <RecordForm
          key={form.kind + form.title + JSON.stringify(form.initial)}
          title={form.title}
          fields={form.fields}
          initial={form.initial}
          busy={busy}
          error={error}
          close={() => setForm(null)}
          onSubmit={(v) => act(() => save(v))}
        >
          {["expense", "payment", "question"].includes(form.kind) && (
            <div className="cm-upload-zone">
              <FileText />
              <h3>
                {form.kind === "expense"
                  ? "Private original bill"
                  : "Private supporting attachment"}
              </h3>
              <p>
                PDF, PNG or JPEG · up to 2 MB. Stored encrypted in this local
                demo. Use reviewed, clean files.
              </p>
              <input
                aria-label="Private attachment"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) act(async () => setAttached(await attachment(pid, f)));
                }}
              />
              {attached && <Badge>{attached.name} attached</Badge>}
              {form.kind === "expense" && (
                <>
                  <h3>Resident-safe, redacted copy (optional)</h3>
                  <p>
                    Remove personal bank details, employee identifiers and
                    unnecessary private data before uploading.
                  </p>
                  <input
                    aria-label="Redacted resident bill copy"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        act(async () =>
                          setRedacted(await attachment(pid, f, true)),
                        );
                    }}
                  />
                  {redacted && <Badge>{redacted.name} attached</Badge>}
                </>
              )}
            </div>
          )}
        </RecordForm>
      )}
      {question && (
        <Modal title={question.subject} close={() => setQuestion(null)}>
          <Badge>
            {question.visibility === "private"
              ? "Private to committee"
              : "Project discussion"}{" "}
            · {question.status.replaceAll("_", " ")}
          </Badge>
          <p className="cm-preserve">{question.body}</p>
          {question.attachment_id && (
            <a
              href={`/api/my-project/${pid}/attachments/${question.attachment_id}`}
            >
              Supporting attachment
            </a>
          )}
          <div className="cm-messages">
            {question.replies.map((r: R) => (
              <div className="cm-message" key={r.id}>
                <small>{r.name}</small>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
          <form
            className="cm-compose"
            onSubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await send(`questions/${question.id}`, { body: reply });
                const nw = await api(`my-project/${pid}`);
                setQuestion(nw.questions.find((q: R) => q.id === question.id));
                setReply("");
              });
            }}
          >
            <input
              aria-label="Committee question reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a helpful reply…"
            />
            <button className="cm-primary" disabled={busy || !reply.trim()}>
              Reply
            </button>
          </form>
          <div className="cm-actions">
            {(committee
              ? [
                  "in_progress",
                  "awaiting_resident",
                  "resolved",
                  "open",
                  "escalated",
                ]
              : ["open", "escalated"]
            ).map((status) => (
              <button
                key={status}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await send(`questions/${question.id}`, { status });
                    setQuestion({ ...question, status });
                  })
                }
              >
                {status === "open" ? "Reopen" : status.replaceAll("_", " ")}
              </button>
            ))}
            {committee && (
              <select
                aria-label="Assign question"
                value={question.assigned_to || ""}
                onChange={(e) =>
                  act(async () => {
                    await send(`questions/${question.id}`, {
                      assignedTo: e.target.value,
                    });
                    setQuestion({ ...question, assigned_to: e.target.value });
                  })
                }
              >
                <option value="">Assign committee member</option>
                {w.committee.map((a: R) => (
                  <option key={a.id} value={a.user_id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            {committee &&
              question.status === "resolved" &&
              question.visibility === "project" &&
              question.faq_consent === 1 && (
                <button
                  onClick={() =>
                    act(async () => {
                      const body = prompt(
                        "Write a redacted FAQ answer; exclude personal details.",
                      );
                      if (body)
                        await send("operations", {
                          kind: "faq",
                          title: question.subject,
                          payload: {
                            body,
                            questionId: question.id,
                            redacted: true,
                          },
                        });
                    })
                  }
                >
                  Publish redacted FAQ
                </button>
              )}
          </div>
          <div className="cm-footnote">
            {question.history.map((h: R, n: number) => (
              <p key={n}>
                {h.details} ·{" "}
                {new Date(h.created).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}
              </p>
            ))}
          </div>
          {error && (
            <p role="alert" className="cm-error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: number;
  featured?: boolean;
}) {
  return (
    <div className={`cm-metric ${featured ? "featured" : ""}`}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}
export function CommunityHome({
  go,
  userId,
  data,
}: {
  go: (tab: string) => void;
  userId: string;
  data: R;
}) {
  const [d, setD] = useState<R | null>(null);
  const [find, setFind] = useState<R | null>(null);
  const activeServices = (data.social?.requests || []).filter(
    (r: R) => !["completed", "cancelled"].includes(r.status),
  );
  useEffect(() => {
    let live = true;
    api("exchange")
      .then((r) => {
        if (live) setFind(r.listings[0] || null);
      })
      .catch(() => {});
    api("my-project")
      .then(async (r) => {
        const pid = r.projects[0]?.project_id;
        if (pid) {
          const w = await api(`my-project/${pid}`);
          if (live) setD(w);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!d) return null;
  const notice = d.operations.find((o: R) => o.kind === "notice");
  return (
    <section className="cm-home-strip">
      <button onClick={() => go("myproject")}>
        <span className="cm-mini-icon">
          <Wallet size={20} />
        </span>
        <span>
          <small>MY PROJECT · {d.project.name}</small>
          <strong>
            {money(
              d.invoices
                .filter(
                  (i: R) =>
                    i.payer_id === userId &&
                    ["published", "closed"].includes(i.state),
                )
                .reduce((a: number, i: R) => a + i.balance, 0),
            )}{" "}
            outstanding on your bills
          </strong>
        </span>
        <ArrowUpRight size={18} />
      </button>
      <button onClick={() => go("myproject")}>
        <span className="cm-mini-icon">
          <FileText size={20} />
        </span>
        <span>
          <small>ON THE NOTICEBOARD</small>
          <strong>{notice?.title || "Your project, all in one place"}</strong>
        </span>
        <ArrowUpRight size={18} />
      </button>
      <button onClick={() => go("exchange")}>
        <span className="cm-mini-icon">
          <Armchair size={20} />
        </span>
        <span>
          <small>MDP EXCHANGE</small>
          <strong>{find?.title || "A good find could be next door."}</strong>
        </span>
        <ArrowUpRight size={18} />
      </button>
      {!!activeServices.length && (
        <button onClick={() => go("services")}>
          <span className="cm-mini-icon">
            <ShieldCheck size={20} />
          </span>
          <span>
            <small>YOUR MDP SPECIALIST REQUESTS</small>
            <strong>
              {activeServices.length} active ·{" "}
              {activeServices[0].status.replaceAll("_", " ")}
            </strong>
          </span>
          <ArrowUpRight size={18} />
        </button>
      )}
    </section>
  );
}
export function AppointmentDesk() {
  const [options, setOptions] = useState<R>({ projects: [], residents: [] }),
    [rows, setRows] = useState<R[]>([]),
    [reports, setReports] = useState<R[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(false);
  async function load() {
    setRows(await api("appointments"));
    setOptions(await api("appointment-options"));
    setReports(await api("exchange-moderation"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cm-panel">
      <div className="cm-between">
        <h2>Project appointment administration</h2>
        <button onClick={() => setForm(true)}>Invite a committee member</button>
      </div>
      <p>
        Appointment authority grants no access to project accounts, bills,
        proofs or personal vaults. These are synthetic demo appointments.
      </p>
      {error && <p className="cm-error">{error}</p>}
      {rows.map((a) => (
        <div className="cm-ledger-row" key={a.id}>
          <span>
            {a.project} · {a.name}
            <small>
              {a.position.replace("_", " ")} · {a.status} · {a.starts} →{" "}
              {a.ends}
            </small>
          </span>
          {a.status === "accepted" && (
            <button
              disabled={busy}
              onClick={() =>
                act(() => api("appointments", { id: a.id, action: "activate" }))
              }
            >
              Activate accepted appointment
            </button>
          )}
          {!["revoked", "resigned"].includes(a.status) && (
            <button
              disabled={busy}
              onClick={() =>
                act(() => api("appointments", { id: a.id, action: "revoke" }))
              }
            >
              Revoke
            </button>
          )}
        </div>
      ))}
      {form && (
        <RecordForm
          title="Invite an eligible project resident"
          initial={{
            projectId: options.residents[0]?.project_id || "",
            userId: options.residents[0]?.id || "",
          }}
          close={() => setForm(false)}
          busy={busy}
          error={error}
          fields={[
            {
              name: "projectId",
              label: "Project",
              options: options.projects.map((p: R) => ({
                value: p.id,
                label: p.name,
              })),
            },
            {
              name: "userId",
              label: "Verified resident / owner in this project",
              dependsOn: "projectId",
              options: options.residents.map((p: R) => ({
                value: p.id,
                label: `${p.name} · ${p.label}`,
                projectId: p.project_id,
              })),
            },
            {
              name: "position",
              label: "Position",
              options: ["president", "vice_president"],
            },
            { name: "starts", label: "Term starts", type: "date" },
            { name: "ends", label: "Term ends", type: "date" },
          ]}
          onSubmit={(v) =>
            act(async () => {
              await api("appointments", { ...v, action: "invite" });
              setForm(false);
            })
          }
        />
      )}
      <h3>Exchange moderation</h3>
      {!reports.length && <p>No open reports.</p>}
      {reports.map((r) => (
        <div className="cm-ledger-row" key={r.id}>
          <span>
            {r.kind} · {r.reason}
            <small>{r.target_id}</small>
          </span>
          {r.kind === "listing" && (
            <button
              onClick={() =>
                act(() =>
                  api("exchange-moderation", { id: r.id, action: "withdraw" }),
                )
              }
            >
              Withdraw listing
            </button>
          )}
          <button
            onClick={() =>
              act(() =>
                api("exchange-moderation", { id: r.id, action: "dismiss" }),
              )
            }
          >
            Dismiss
          </button>
        </div>
      ))}
    </section>
  );
}
