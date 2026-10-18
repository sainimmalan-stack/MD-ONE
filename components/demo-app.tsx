"use client";
import { appFetch, appApiUrl } from "@/lib/app-fetch";
import { GroceryStorefront, ProductArt } from "@/components/grocery-storefront";
import { useBasket } from "@/components/use-basket";
import { basketKey } from "@/lib/basket";
import { DemoRoleSwitcher, DemoIdentitySummary } from "./demo-role-switcher";
import { LivingHome } from "./living-home";
import { BrandLockup } from "@/components/brand-lockup";
import { ThemeToggle } from "@/components/theme-toggle";
import { Carpool } from "@/components/carpool";
import { RetailPlan } from "@/components/retail-plan";
import "../app/grocery.css";
import {
  Exchange,
  MyProject,
  CommunityHome,
  AppointmentDesk,
} from "@/components/community-management";
import "../app/community.css";
import {
  ModerationDesk,
  ProjectExplorer,
  SocialCircle,
  InstaServices,
  ResidentProfile,
  ServiceDesk,
} from "@/components/experience";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  TrendingUp,
  Building2,
  Home,
  ShoppingBasket,
  Users,
  CarFront,
  FolderLock,
  Wallet,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  Search,
  Bell,
  ChevronDown,
  Check,
  X,
  Leaf,
  MapPin,
  Clock3,
  ShieldCheck,
  Package,
  Bike,
  LogOut,
  CalendarDays,
  Wrench,
  FileText,
  Download,
  Trash2,
  Heart,
  SlidersHorizontal,
  Menu,
  ChevronRight,
  Sparkles,
  IndianRupee,
  LayoutDashboard,
  RefreshCw,
  CheckCircle2,
  Send,
  Globe2,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";

type R = Record<string, any>;
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 100 ? 2 : 0,
  }).format(n / 100);
const when = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const day = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
const cx = (...c: (string | false | undefined)[]) =>
  c.filter(Boolean).join(" ");
const nav = [
 ["home", "Home", Home, "హోమ్"],
 ["orders", "Orders", ShoppingBasket, "ఆర్డర్లు"],
 ["circle", "Community", Users, "మన కమ్యూనిటీ"],
 ["profile", "Account", Settings, "ఖాతా"],
] as const;
const sectionNavigation: Record<string, [string, string][]> = {
  daily: [["daily", "Groceries"], ["orders", "My orders"]],
  circle: [
    ["circle", "Neighbours"],
    ["exchange", "Marketplace"],
    ["carpool", "Carpool"],
    ["community", "Events"],
    ["projects", "Our projects"],
  ],
  myhome: [
    ["myhome", "Documents"],
    ["finance", "My finances"],
    ["profile", "Profile & settings"],
  ],
};
function navigationGroup(tab: string) {
  if (["daily", "essentials", "orders"].includes(tab)) return "orders";
  if (tab === "home") return "home";
  if (
    [
      "circle",
      "exchange",
      "carpool",
      "community",
      "projects",
      "resident-profile",
    ].includes(tab)
  )
    return "circle";
  if (["myhome", "finance", "profile", "myproject", "services"].includes(tab)) return "profile";
  if (tab === "homes") return "circle";
  return tab;
}

async function api(path: string, method = "GET", body?: unknown) {
  const res = await appFetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function Button({
  children,
  onClick,
  variant = "",
  disabled = false,
  type = "button",
  ...props
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  return (
    <button
      className={cx("button", variant)}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  icon: Icon = Package,
  title,
  description,
}: {
  icon?: typeof Package;
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <Icon size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function SectionTitle({
  eyebrow,
  title,
  action,
  onClick,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-link" onClick={onClick}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", f);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function DemoApp({ showcase = false }: { showcase?: boolean } = {}) {
  const [data, setData] = useState<R | null>(null),
    [tab, setTab] = useState("home"),
    [actor, setActor] = useState("resident"),
    [cartOpen, setCartOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [notifications, setNotifications] = useState(false),
    [visiting, setVisiting] = useState<string | undefined>();
  const basket = useBasket(
    data?.user.role === "resident" && data?.active?.flat_id
      ? basketKey(
          (showcase ? "showcase:" + data.demoRunId + ":" : "") + data.user.id,
          data.active.flat_id,
        )
      : null,
  );
  const cart = basket.cart;
  const load = async () => {
    const d = await api("bootstrap");
    setData(d);
    setActor(d.user.id);
  };
  useEffect(() => {
    api("bootstrap")
      .then((d) => {
        setData(d);
        setActor(d.user.id);
        if (d.user.role !== "resident") setTab("operations");
      })
      .catch(() =>
        api("demo-login", "POST", { actor: "resident" })
          .then(() => api("bootstrap"))
          .then(setData)
          .catch((e) => setError(e.message)),
      );
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const act = async (
    fn: () => Promise<any>,
    message = "Saved successfully",
  ) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      await load();
      setNotice(message);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const switchPersona = async (v: string) => {
    setActor(v);
    setCartOpen(false);
    setData(null);
    await act(async () => {
      await api("demo-login", "POST", { actor: v });
      setTab(
        [
          "warehouse",
          "rider1",
          "rider2",
          "admin",
          "platform",
          "service",
          "tech1",
          "tech2",
          "tech3",
        ].includes(v)
          ? "operations"
          : "home",
      );
    }, "Demo persona switched");
  };
  const go = (v: string) => {
    setTab(v);
    setMenu(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openProfile = (uid: string) => {
    setVisiting(uid);
    go(uid === data?.user.id ? "profile" : "resident-profile");
  };
  const add = (pid: string, delta: number) =>
    basket.edit((c) => {
      const max = data?.products.find((p: R) => p.id === pid)?.stock || 0;
      const next = { ...c };
      const qty = Math.max(0, Math.min(20, max, (c[pid] || 0) + delta));
      if (qty) next[pid] = qty;
      else delete next[pid];
      return next;
    });
  const count = Object.values(cart).reduce((a, b) => a + b, 0),
    total =
      data?.products.reduce(
        (n: number, p: R) => n + p.price * (cart[p.id] || 0),
        0,
      ) || 0;
  const te = data?.preferences.language === "te";
  const isResident = data?.user.role === "resident";
  const activeGroup = navigationGroup(tab);
  const sectionLinks = isResident && tab !== "home" ? sectionNavigation[tab === "daily" || tab === "orders" || tab === "essentials" ? "daily" : activeGroup] || [] : [];
  const ownNav = isResident
    ? nav
    : ([
        ["operations", "Operations", LayoutDashboard, "నిర్వహణ"],
        ["profile", "My profile", Users, "సెట్టింగ్‌లు"],
      ] as const);
  return (
    <div
      className={cx("app-shell living-shell", showcase && "md-showcase")}
      onClickCapture={
        showcase
          ? (e) => {
              if (
                e.target instanceof HTMLInputElement &&
                e.target.type === "file"
              ) {
                e.preventDefault();
                setNotice(
                  "Demo preview uses built-in sample files only. Use your live account for personal uploads.",
                );
              }
            }
          : undefined
      }
    >
      {showcase && (
        <div className="showcase-ribbon">
          <details className="showcase-explanation"><summary>Demo preview · Sample data</summary><p>Synthetic people, money & orders. Never enter personal IDs or files. Temporary session may reset after inactivity or a server restart.</p></details>
          <div>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api("demo-reset", "POST", {});
                  window.location.reload();
                }, "Demo reset")
              }
            >
              Reset demo
            </button>
            <a href="/">Exit demo</a>
          </div>
        </div>
      )}
      <aside className={cx("sidebar", menu && "shown")}>
        <a
          className="brand"
          aria-label="My Dream Projects — MD One"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <BrandLockup />
        </a>
        <div className="sidebar-line" />
        <div className="residents-label">
          <span className="tiny-dot" /> A SPACE FOR OUR RESIDENTS
        </div>
        <nav aria-label="Main navigation">
          {ownNav.map(([key, label, Icon, telugu]) => (
            <button
              key={key}
              onClick={() => go(key)}
              className={cx("nav-item", activeGroup === key && "active")}
              aria-current={activeGroup === key ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{te ? telugu : label}</span>
              {activeGroup === key && <span className="nav-active-dot" />}
            </button>
          ))}
          {data && ["warehouse", "platform"].includes(data.user.role) && (
            <button
              className={cx("nav-item", tab === "retail-plan" && "active")}
              onClick={() => go("retail-plan")}
            >
              <TrendingUp size={18} />
              <span>Daily retail plan</span>
            </button>
          )}
          {data && ["association", "platform"].includes(data.user.role) && (
            <button
              className={cx("nav-item", tab === "moderation" && "active")}
              onClick={() => go("moderation")}
            >
              <ShieldCheck size={17} />
              <span>Community moderation</span>
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button className="user-card" onClick={() => go("profile")}>
            <span className="avatar">
              {data?.social?.profile.avatar ? (
                <img src={data.social.profile.avatar} alt="Your profile" />
              ) : (
                data?.user.name.slice(0, 1) || "A"
              )}
            </span>
            <span>
              <b>{data?.user.name || "Welcome home"}</b>
              <small>{data?.active?.label || "Private membership"}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        {showcase && <div className="demo-strip"><DemoRoleSwitcher actor={actor} busy={busy} onChange={switchPersona}/></div>}
        <header className="topbar">
          <div className="location">
            <a
              className="header-brand"
              href="#"
              aria-label="My Dream Projects — MD One"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
            >
              <BrandLockup />
            </a>
            <span className="location-icon">
              <MapPin size={20} />
            </span>
            <div className="header-project">
              <small className="md-one-mobile-brand">
                My Dream Projects · MD One
              </small>
              <button onClick={() => go("profile")}>
                {data?.active ? `${data.active.project} · ${data.active.label}` : "My Dream Projects"}{" "}
                <ChevronDown size={14} />
              </button>
            </div>
            <span className="location-tag">AMEENPUR, HYDERABAD</span>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <button
              className="icon-button"
              aria-label="View notifications"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={20} />
              <i />
            </button>
            <span className="header-divider" />
            <button
              className="avatar"
              onClick={() => go("profile")}
              aria-label="Open profile"
            >
              {data?.social?.profile.avatar ? (
                <img src={data.social.profile.avatar} alt="Your profile" />
              ) : (
                data?.user.name.slice(0, 1) || "A"
              )}
            </button>
          </div>
          {notifications && (
            <div className="notification-pop">
              <b>Your updates</b>
              <p>
                Delivery and EMI reminders will appear here. Push notifications
                are not connected in this demo.
              </p>
              <button
                className="text-link"
                onClick={() => {
                  setNotifications(false);
                  go("community");
                }}
              >
                View community updates <ArrowRight size={15} />
              </button>
            </div>
          )}
        </header>
        <main>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              <h2>Making room for everyday life…</h2>
              {error && (
                <Button onClick={() => location.reload()}>Try again</Button>
              )}
            </div>
          ) : (
            <>
              {sectionLinks.length > 0 && (
                <nav
                  className="section-navigation"
                  aria-label={`${nav.find((n) => n[0] === activeGroup)?.[1] || "Section"} sections`}
                >
                  {sectionLinks.map(([key, label]) => (
                    <button
                      key={key}
                      aria-current={tab === key ? "page" : undefined}
                      onClick={() => go(key)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              )}
              {data.active && tab !== "home" && (
                <div className="mobile-residence">
                  {data.active.project} · {data.active.label}
                </div>
              )}
              {isResident && !data.active && tab !== "profile" && (
                <div className="pending-panel">
                  <ShieldCheck />
                  <h2>Your community is one approval away.</h2>
                  <p>
                    Your membership is pending. Your project support team or flat owner
                    can verify you. Government IDs are optional.
                  </p>
                  <Button onClick={() => go("profile")}>View membership</Button>
                </div>
              )}
              {(data.active || !isResident || tab === "profile") && (
                <>
                  {tab === "myproject" && data.social && (
                    <MyProject key={data.user.id} data={data} />
                  )}
                  {["exchange", "homes"].includes(tab) && data.social && (
                    <Exchange
                      initialSection={tab === "homes" ? "homes" : "items"}
                      key={data.user.id + tab}
                      data={data}
                      openProfile={openProfile}
                    />
                  )}
                  {tab === "home" && <LivingHome name={data.user.name} orders={data.orders} go={go} onBasket={() => setCartOpen(true)} count={count}/> }
                  {tab === "daily" && data.social && (
                    <>
                      <GroceryStorefront
                        data={data}
                        go={go}
                        onCart={() => setCartOpen(true)}
                        count={count}
                        renderProduct={(p) => (
                          <Product
                            p={p}
                            qty={cart[p.id] || 0}
                            add={add}
                            enabled={!!data.services?.groceries}
                          />
                        )}
                      />

                    </>
                  )}
                  {tab === "retail-plan" &&
                    ["warehouse", "platform"].includes(data.user.role) && (
                      <RetailPlan />
                    )}
                  {tab === "projects" && data.social && (
                    <ProjectExplorer
                      data={data}
                      act={act}
                      busy={busy}
                      openProfile={openProfile}
                    />
                  )}
                  {tab === "circle" && data.social && (
                    <SocialCircle
                      go={go}
                      data={data}
                      act={act}
                      busy={busy}
                      openProfile={openProfile}
                    />
                  )}
                  {tab === "services" && data.social && (
                    <InstaServices data={data} act={act} busy={busy} />
                  )}
                  {showcase && tab === "profile" && <DemoIdentitySummary actor={actor}/>}
                  {["profile", "resident-profile"].includes(tab) &&
                    data.social && (
                      <ResidentProfile
                        data={data}
                        act={act}
                        busy={busy}
                        uid={tab === "resident-profile" ? visiting : undefined}
                        openProfile={openProfile}
                        go={go}
                      />
                    )}
                  {["essentials", "orders"].includes(tab) && (
                    <Essentials
                      key={tab}
                      initialView={tab === "orders" ? "orders" : "shop"}
                      data={data}
                      cart={cart}
                      add={add}
                      search={search}
                      setSearch={setSearch}
                      onCart={() => setCartOpen(true)}
                      count={count}
                      act={act}
                      busy={busy}
                    />
                  )}
                  {tab === "carpool" && (
                    <Carpool data={data} act={act} busy={busy} api={api} />
                  )}
                  {tab === "community" && (
                    <Community data={data} act={act} busy={busy} />
                  )}
                  {tab === "myhome" && (
                    <MyHome
                      data={data}
                      act={act}
                      busy={busy}
                      go={go}
                      showcase={showcase}
                    />
                  )}
                  {tab === "finance" && (
                    <Finance data={data} act={act} busy={busy} />
                  )}
                  {(tab === "account" ||
                    (tab === "profile" && !data.social)) && (
                    <Profile
                      data={data}
                      act={act}
                      switchPersona={switchPersona}
                      busy={busy}
                    />
                  )}
                  {tab === "moderation" && (
                    <ModerationDesk data={data} act={act} busy={busy} />
                  )}
                  {tab === "operations" && data.user.role === "platform" && (
                    <AppointmentDesk />
                  )}
                  {tab === "operations" && (
                    <Operations data={data} act={act} busy={busy} />
                  )}
                </>
              )}
            </>
          )}
          <footer>
            <span>
              MD One<span className="gold-dot">.</span>
              <small> By My Dream Projects</small>
            </span>
            <span>
              One app. Everyday living. <Heart size={12} />
            </span>
          </footer>
        </main>
        {count > 0 && isResident && (
          <button className="cart-floating" onClick={() => setCartOpen(true)}>
            <ShoppingBasket size={20} />
            <span>
              {count} {count === 1 ? "item" : "items"} in your basket
            </span>
            <b>{money(total)}</b>
            <ArrowRight size={18} />
          </button>
        )}
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {ownNav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={activeGroup === key ? "active" : ""}
              aria-current={activeGroup === key ? "page" : undefined}
              onClick={() => go(key)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
        </div>
      )}
      {basket.error && (
        <div className="toast" role="alert">
          {basket.error}
        </div>
      )}
      {busy && <div className="busy-bar" />}
      {cartOpen && data && (
        <Checkout
          data={data}
          cart={cart}
          add={add}
          close={() => setCartOpen(false)}
          busy={busy}
          pending={basket.pending}
          ready={basket.ready}
          submit={async (details: {
            flatId: string;
            slot: string;
            substitution: string;
          }) => {
            setBusy(true);
            setError("");
            try {
              const result = await basket.checkout(details);
              setCartOpen(false);
              go("essentials");
              setNotice(`Order confirmed · ${result.id}`);
              try {
                await load();
              } catch {
                setError(
                  "Your order is confirmed. Refresh My orders to update the list.",
                );
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          error={error}
        />
      )}
    </div>
  );
}
function Product({
  p,
  qty,
  add,
  enabled,
}: {
  p: R;
  qty: number;
  add: (id: string, d: number) => void;
  enabled: boolean;
}) {
  return (
    <article className="product-card">
      <div className={`product-image product-${p.id}`}>
        <ProductArt p={p} />
        {p.launch_state === "planned" && (
          <span className="product-tag">PROPOSED RANGE</span>
        )}
        {p.featured === 1 && (
          <span className="product-tag">DAILY FAVOURITE</span>
        )}
      </div>
      <div className="product-info">
        <small>{p.unit}</small>
        <h3>{p.name}</h3>
        <div className="product-price">
          <b>{money(p.price)}</b>
          {qty > 0 ? (
            <div className="stepper">
              <button
                aria-label={`Remove one ${p.name}`}
                onClick={() => add(p.id, -1)}
              >
                <Minus size={13} />
              </button>
              <span>{qty}</span>
              <button
                aria-label={`Add one ${p.name}`}
                disabled={qty >= p.stock || qty >= 20}
                onClick={() => add(p.id, 1)}
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <button
              className="add-button"
              disabled={!enabled || !p.stock || p.launch_state === "planned"}
              onClick={() => add(p.id, 1)}
              aria-label={`Add ${p.name}`}
            >
              {p.launch_state === "planned"
                ? "PLANNED"
                : p.stock
                  ? "ADD"
                  : "OUT"}
              {p.stock > 0 && <Plus size={13} />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
function Essentials({
  initialView = "shop",
  data,
  cart,
  add,
  search,
  setSearch,
  onCart,
  count,
  act,
  busy,
}: any) {
  const [category, setCategory] = useState("All essentials"),
    [view, setView] = useState(initialView);
  const cats = [
    "All essentials",
    ...new Set(data.products.map((p: R) => p.category)),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FRESH FINDS, FAMILIAR SERVICE</span>
          <h1>
            The daily basket<span className="gold-dot">.</span>
          </h1>
          <p>Your everyday essentials, from our neighbourhood warehouse.</p>
        </div>
        <Button variant="outline" onClick={onCart} disabled={!count}>
          <ShoppingBasket size={17} />
          Your basket ({count})
        </Button>
      </div>
      <div className="tabs">
        <button
          className={view === "shop" ? "selected" : ""}
          onClick={() => setView("shop")}
        >
          Shop essentials
        </button>
        <button
          className={view === "orders" ? "selected" : ""}
          onClick={() => setView("orders")}
        >
          My orders ({data.orders.length})
        </button>
      </div>
      {view === "shop" ? (
        <>
          <div className="essentials-banner">
            <div>
              <Badge>
                <Bike size={13} /> ELECTRIC DELIVERY
              </Badge>
              <h2>
                Little things.
                <br />A well-stocked home.
              </h2>
              <p>Choose a convenient delivery slot. No rushed promises.</p>
            </div>
            <div className="basket-illustration">
              🥬<span>🍅</span>🥛<i>YOUR DAILY GOODNESS</i>
            </div>
          </div>
          <div className="shop-toolbar">
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Search essentials"
                placeholder="What does your home need?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Badge tone={data.services?.groceries ? "green" : "amber"}>
              {data.services?.groceries
                ? "Demo delivery available"
                : "Service not enabled"}
            </Badge>
          </div>
          <div className="category-list">
            {cats.map((c: any) => (
              <button
                className={category === c ? "selected" : ""}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="product-grid shop-products">
            {data.products
              .filter(
                (p: R) =>
                  (category === "All essentials" || p.category === category) &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p: R) => (
                <Product
                  key={p.id}
                  p={p}
                  qty={cart[p.id] || 0}
                  add={add}
                  enabled={!!data.services?.groceries}
                />
              ))}
          </div>
          {!data.products.some(
            (p: R) =>
              (category === "All essentials" || p.category === category) &&
              p.name.toLowerCase().includes(search.toLowerCase()),
          ) && (
            <Empty
              icon={Search}
              title="No essentials found"
              description="Try another product or category."
            />
          )}
          <p className="muted footnote">
            Demo catalog and prices. All weights are fixed packs;
            variable-weight pricing is not enabled. Recurring delivery and
            online payment are coming later.
          </p>
        </>
      ) : (
        <div className="list-stack">
          {data.orders.length ? (
            data.orders.map((o: R) => (
              <OrderCard key={o.id} o={o}>
                <p>
                  {o.items
                    .map((i: R) => `${i.quantity} × ${i.name}`)
                    .join(" · ")}
                </p>
                {["placed", "picking"].includes(o.status) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          api(`orders/${o.id}`, "PATCH", {
                            status: "cancelled",
                          }),
                        "Order cancelled; stock released",
                      )
                    }
                  >
                    Cancel order
                  </Button>
                )}
                {o.status === "out_for_delivery" && (
                  <div className="inline-note">
                    Demo delivery confirmation code: <b>123456</b>. Switch to
                    the assigned delivery persona to complete it.
                  </div>
                )}
              </OrderCard>
            ))
          ) : (
            <Empty
              title="Your first basket is waiting"
              description="Place an order and follow its journey from our shelves to your home."
            />
          )}
        </div>
      )}
    </>
  );
}
function OrderCard({ o, children }: { o: R; children: ReactNode }) {
  return (
    <article className="panel order-card">
      <div className="card-row">
        <div>
          <span className="eyebrow">
            ORDER {o.id.slice(0, 8).toUpperCase()}
          </span>
          <h3>
            {money(o.total)} <small>· {o.label}</small>
          </h3>
        </div>
        <Badge
          tone={
            o.status === "cancelled" || o.status === "returned"
              ? "amber"
              : "green"
          }
        >
          {o.status.replaceAll("_", " ")}
        </Badge>
      </div>
      <p className="muted">
        <Clock3 size={14} /> {when(o.slot)} IST ·{" "}
        {o.payment.replaceAll("_", " ")}
      </p>
      <div className="order-track">
        {["placed", "picking", "packed", "out_for_delivery", "delivered"].map(
          (s, i) => (
            <span
              className={
                [
                  "placed",
                  "picking",
                  "packed",
                  "out_for_delivery",
                  "delivered",
                ].indexOf(o.status) >= i
                  ? "complete"
                  : ""
              }
              key={s}
            >
              <i />
              {s.replaceAll("_", " ")}
            </span>
          ),
        )}
      </div>
      {children}
    </article>
  );
}
function Checkout({
  data,
  cart,
  add,
  close,
  busy,
  pending,
  ready,
  submit,
  error,
}: any) {
  const [slot, setSlot] = useState(
      pending?.slot || data.slots.find((s: R) => s.remaining > 0)?.id || "",
    ),
    [sub, setSub] = useState(pending?.substitution || "none");
  const lines = data.products.filter((p: R) => cart[p.id] > 0),
    subtotal = lines.reduce((n: number, p: R) => n + p.price * cart[p.id], 0),
    fee = subtotal >= 29900 ? 0 : 2000;
  return (
    <Modal title="Your daily basket" onClose={close}>
      <p className="muted">
        {data.active?.project} · {data.active?.label}
      </p>
      {error && <p role="alert">{error}</p>}
      {pending && (
        <p role="status">
          An earlier checkout needs confirmation. Retry checks that same order;
          items and delivery choices stay unchanged.
        </p>
      )}
      <div className="checkout-items">
        {lines.map((p: R) => (
          <div key={p.id}>
            <span className="mini-product">
              <ProductArt p={p} />
            </span>
            <div>
              <b>{p.name}</b>
              <small>{p.unit}</small>
            </div>
            <div className="stepper">
              <button
                aria-label={`Remove ${p.name}`}
                disabled={busy || !!pending}
                onClick={() => add(p.id, -1)}
              >
                <Minus size={14} />
              </button>
              <span>{cart[p.id]}</span>
              <button
                disabled={busy || !!pending}
                aria-label={`Add ${p.name}`}
                onClick={() => add(p.id, 1)}
              >
                <Plus size={14} />
              </button>
            </div>
            <b>{money(p.price * cart[p.id])}</b>
          </div>
        ))}
      </div>
      <Field label="Choose your delivery window (IST)">
        <select
          disabled={busy || !!pending}
          value={pending?.slot || slot}
          onChange={(e) => setSlot(e.target.value)}
        >
          {pending && !data.slots.some((s: R) => s.id === pending.slot) && (
            <option value={pending.slot}>
              {when(pending.slot)} · previous checkout
            </option>
          )}
          {data.slots.map((s: R) => (
            <option key={s.id} value={s.id} disabled={!s.remaining}>
              {when(s.id)} · {s.remaining} slots left
            </option>
          ))}
        </select>
      </Field>
      <Field label="If something becomes unavailable">
        <select
          disabled={busy || !!pending}
          value={pending?.substitution || sub}
          onChange={(e) => setSub(e.target.value)}
        >
          <option value="none">Do not substitute; contact me</option>
          <option value="ask">Ask me before any substitution</option>
        </select>
      </Field>
      <div className="bill">
        <div>
          <span>Items</span>
          <b>{money(subtotal)}</b>
        </div>
        <div>
          <span>Delivery · free from ₹299</span>
          <b>{fee ? money(fee) : "FREE"}</b>
        </div>
        <div className="bill-total">
          <span>Total</span>
          <b>{money(subtotal + fee)}</b>
        </div>
      </div>
      <div className="inline-note">
        <ShieldCheck size={17} />
        <span>
          Demo cash on delivery. Online payments are not connected. No money
          will be charged.
        </span>
      </div>
      <Button
        variant="full"
        disabled={
          busy ||
          !ready ||
          (!pending && (!lines.length || !slot || !data.services?.groceries))
        }
        onClick={() =>
          submit({ flatId: data.active.flat_id, slot, substitution: sub })
        }
      >
        {pending ? "Check previous order" : "Place demo order"}{" "}
        <ArrowRight size={17} />
      </Button>
    </Modal>
  );
}

function Community({ data, act, busy }: any) {
  const [post, setPost] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BEST PART OF HOME IS THE PEOPLE</span>
          <h1>
            Our kind of together<span className="gold-dot">.</span>
          </h1>
          <p>
            Small conversations. Big celebrations. A community for everyone.
          </p>
        </div>
        <Badge>
          <Users size={14} />
          {data.active.project}
        </Badge>
      </div>
      <SectionTitle title="Make a little room for good times." />
      <div className="community-events">
        {data.events.map((e: R, i: number) => (
          <article className="panel community-event" key={e.id}>
            <div className={`community-art art-${i}`}>
              <span>{e.category === "Wellness" ? "☀" : "✧"}</span>
              <span className="event-date">{day(e.starts)}</span>
              <small>DEMO COMMUNITY EVENT</small>
            </div>
            <div className="event-content">
              <Badge tone="amber">{e.category}</Badge>
              <h2>{e.title}</h2>
              <p>{e.description}</p>
              <p className="muted">
                <CalendarDays size={14} />
                {when(e.starts)} IST
              </p>
              <p className="muted">
                <MapPin size={14} />
                {e.place}
              </p>
              <div className="card-row">
                <small>
                  {e.attending} of {e.capacity} neighbours joining
                </small>
                <Button
                  variant={e.joined ? "outline" : ""}
                  disabled={busy}
                  onClick={() =>
                    act(
                      () =>
                        api(`events/${e.id}`, "POST", { cancel: !!e.joined }),
                      e.joined ? "RSVP removed" : "You’re on the list",
                    )
                  }
                >
                  {e.joined ? (
                    <>
                      <Check size={15} />
                      Joined
                    </>
                  ) : (
                    "Count me in"
                  )}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="inline-note">
        <Globe2 size={18} />
        <p>
          Every celebration is open and optional. Enable the MDP network in your
          profile to see events across projects. Donations, event photos, and
          budget payments are not connected.
        </p>
      </div>
      <div className="community-board">
        <SectionTitle
          eyebrow="A NOTE FROM NEXT DOOR"
          title="The neighbourhood board"
        />
        <form
          className="post-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await act(
              () => api("posts", "POST", { body: post }),
              "Shared with your community",
            );
            if (r) setPost("");
          }}
        >
          <span className="avatar pale">{data.user.name[0]}</span>
          <textarea
            aria-label="Community message"
            maxLength={1500}
            required
            placeholder="Something to share with your neighbours?"
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
          <Button type="submit" disabled={busy || !post.trim()}>
            <Send size={16} />
            Post
          </Button>
        </form>
        <div className="list-stack">
          {data.posts.map((p: R) => (
            <article className="panel post-card" key={p.id}>
              <div className="card-row">
                <span className="avatar pale">{p.name[0]}</span>
                <div className="grow">
                  <b>{p.name}</b>
                  <small>{when(p.created)} IST</small>
                </div>
                <button
                  className="text-link muted"
                  onClick={() => {
                    const reason = window.prompt(
                      "Why are you reporting this post?",
                    );
                    if (reason)
                      act(
                        () =>
                          api("reports", "POST", { targetId: p.id, reason }),
                        "Report sent to your association",
                      );
                  }}
                >
                  Report
                </button>
              </div>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
function MyHome({ data, act, busy, go, showcase }: any) {
  const [view, setView] = useState("vault"),
    [unlocked, setUnlocked] = useState(false),
    [share, setShare] = useState<R | null>(null),
    [uploading, setUploading] = useState(false);
  const unlock = async () => {
    const r = await act(
      () => api("vault-unlock", "POST", {}),
      "Demo vault unlocked for five minutes",
    );
    if (r) setUnlocked(true);
  };
  async function uploadFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      window.alert("Choose a file smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        await act(
          () =>
            api("documents", "POST", {
              name: file.name,
              folder: "Property",
              mime: file.type,
              data: String(reader.result).split(",")[1],
            }),
          "File encrypted and quarantined pending malware scan",
        );
        setUploading(false);
      };
      reader.onerror = () => setUploading(false);
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A PLACE FOR EVERYTHING THAT MATTERS</span>
          <h1>
            Home, thoughtfully organised<span className="gold-dot">.</span>
          </h1>
          <p>Your private documents, household details, and a helping hand.</p>
        </div>
        <Badge>
          <LockKeyhole size={13} />
          PRIVATE TO YOU
        </Badge>
      </div>
      <div className="tabs">
        {[
          ["vault", "My documents"],
          ["history", "Previous requests & dues"],
        ].map(([v, l]) => (
          <button
            className={view === v ? "selected" : ""}
            key={v}
            onClick={() => setView(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "vault" ? (
        <>
          <section className="vault-banner">
            <FolderLock size={48} strokeWidth={1.2} />
            <div>
              <h2>Important papers. A little peace of mind.</h2>
              <p>
                Locally encrypted. Private to your account. Shared only when you
                choose.
              </p>
            </div>
            <Button variant="cream" onClick={unlock} disabled={busy}>
              {unlocked ? (
                <>
                  <Check size={16} />
                  Reconfirm access
                </>
              ) : (
                <>
                  <LockKeyhole size={16} />
                  Unlock demo vault
                </>
              )}
            </Button>
          </section>
          <div className="inline-note">
            <ShieldCheck size={20} />
            <p>
              Demo confirmation is not real multi-factor authentication. Use
              synthetic files only. PDF and image uploads stay quarantined until
              a real scanner is configured. Do not upload government IDs in this
              demo.
            </p>
          </div>
          <div className="toolbar">
            <h2>
              My documents{" "}
              <span className="count-label">{data.documents.length}</span>
            </h2>
            <div className="button-row">
              <Button
                variant="outline"
                disabled={!unlocked || busy}
                onClick={() =>
                  act(
                    () =>
                      api("documents", "POST", {
                        name: "Sample property record.txt",
                        folder: "Property",
                        mime: "text/plain",
                        data: btoa(
                          "MD One synthetic sample document. No personal information.",
                        ),
                      }),
                    "Synthetic sample added",
                  )
                }
              >
                Add safe sample
              </Button>
              <label
                className={cx(
                  "button",
                  (showcase || !unlocked || uploading) && "disabled",
                )}
              >
                <Plus size={16} />
                {showcase
                  ? "Sample documents only"
                  : uploading
                    ? "Uploading…"
                    : "Upload document"}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  disabled={showcase || !unlocked || uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                    e.target.value = "";
                  }}
                  hidden
                />
              </label>
            </div>
          </div>
          <div className="document-grid">
            {data.documents.map((d: R) => (
              <article className="panel document-card" key={d.id}>
                <div className="card-row">
                  <span className="document-icon">
                    <FileText size={25} />
                  </span>
                  <Badge tone={d.status === "clean" ? "green" : "amber"}>
                    {d.status === "clean" ? "Ready" : "Quarantined"}
                  </Badge>
                </div>
                <h3>{d.name}</h3>
                <p>
                  {d.folder} · {day(d.created)}
                </p>
                <div className="button-row">
                  <a
                    className={cx(
                      "button outline",
                      (!unlocked || d.status !== "clean") && "disabled",
                    )}
                    href={
                      unlocked && d.status === "clean"
                        ? appApiUrl(`documents/${d.id}`)
                        : undefined
                    }
                    download
                  >
                    <Download size={15} />
                    Download
                  </a>
                  <button
                    className="icon-button"
                    aria-label={`Share ${d.name}`}
                    disabled={!unlocked || d.status !== "clean"}
                    onClick={() => setShare(d)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${d.name}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Permanently delete this document and its shares?",
                        )
                      )
                        act(
                          () => api(`documents/${d.id}`, "DELETE"),
                          "Document deleted",
                        );
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!data.documents.length && (
            <Empty
              icon={FolderLock}
              title="A little space for the important things"
              description="Unlock the demo vault to add a synthetic sample or a file for quarantine testing."
            />
          )}
          {data.shares.length > 0 && (
            <section className="panel">
              <h3>Your document shares</h3>
              {data.shares.map((s: R) => (
                <div className="table-row" key={s.id}>
                  <span>
                    Recipient: {s.recipient_id}
                    <small>Expires {when(s.expires)} IST</small>
                  </span>
                  <Badge tone={s.revoked ? "amber" : "green"}>
                    {s.revoked
                      ? "Revoked"
                      : new Date(s.expires) < new Date()
                        ? "Expired"
                        : "Active"}
                  </Badge>
                  <Button
                    variant="outline"
                    disabled={!!s.revoked}
                    onClick={() =>
                      act(
                        () => api(`shares/${s.id}`, "DELETE"),
                        "Access revoked",
                      )
                    }
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <section className="panel">
          <SectionTitle title="Your previous community records" />
          <p className="muted">
            Historical requests and assigned dues remain here for reference. New
            committee questions and maintenance bills live in My Project.
          </p>
          <div className="button-row">
            <Button onClick={() => go("myproject")}>Open My Project</Button>
            <Button onClick={() => go("services")}>
              Request an MDP specialist
            </Button>
          </div>
          {data.tickets.map((t: R) => (
            <article className="table-row" key={t.id}>
              <span>
                {t.category}
                <small>{t.description}</small>
              </span>
              <Badge>{t.status}</Badge>
            </article>
          ))}
          {data.dues.map((d: R) => (
            <article className="table-row" key={d.id}>
              <span>
                {d.title}
                <small>
                  Historical assigned due · separate from new project billing
                </small>
              </span>
              <strong>{money(d.amount)}</strong>
              <Badge>{d.status}</Badge>
            </article>
          ))}
          {!data.tickets.length && !data.dues.length && (
            <p className="muted">No previous records.</p>
          )}
        </section>
      )}
      {share && (
        <Modal
          title="Share with a trusted person"
          onClose={() => setShare(null)}
        >
          <p>Access is limited to the chosen account and can be revoked.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await act(
                () =>
                  api(`documents/${share.id}/share`, "POST", {
                    recipientId: f.get("recipient"),
                    expires: new Date(
                      Date.now() + Number(f.get("hours")) * 3600000,
                    ).toISOString(),
                  }),
                "Time-limited access created",
              );
              if (r) setShare(null);
            }}
          >
            <Field label="Demo recipient">
              <select name="recipient">
                <option value="neighbor">Kiran · neighbour</option>
                <option value="owner">Demo owner</option>
              </select>
            </Field>
            <Field label="Access expires in">
              <select name="hours">
                <option value="1">One hour</option>
                <option value="24">24 hours</option>
                <option value="168">Seven days</option>
              </select>
            </Field>
            <Button type="submit" disabled={busy}>
              Create private share
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Finance({ data, act, busy }: any) {
  const [view, setView] = useState("expenses"),
    [addLoan, setAddLoan] = useState(false),
    [calc, setCalc] = useState<R | null>(null);
  const spent = data.expenses
      .filter(
        (e: R) =>
          e.kind === "expense" &&
          e.date.slice(0, 7) === new Date().toISOString().slice(0, 7),
      )
      .reduce((s: number, e: R) => s + e.amount, 0),
    income = data.expenses
      .filter(
        (e: R) =>
          e.kind === "income" &&
          e.date.slice(0, 7) === new Date().toISOString().slice(0, 7),
      )
      .reduce((s: number, e: R) => s + e.amount, 0);
  const csv = () => {
    const escape = (s: any) =>
      `"${String(s)
        .replaceAll('"', '""')
        .replace(/^[=+\-@]/, "'")}"`;
    const rows = [
      ["Date", "Description", "Category", "Type", "Amount INR"],
      ...data.expenses.map((e: R) => [
        e.date,
        e.description,
        e.category,
        e.kind,
        e.amount / 100,
      ]),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = "mdp-expenses.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>
            Make room for what matters<span className="gold-dot">.</span>
          </h1>
          <p>
            Everyday spending and your home’s bigger plans, privately organised.
          </p>
        </div>
        <Badge>
          <LockKeyhole size={13} />
          ONLY YOU CAN SEE THIS
        </Badge>
      </div>
      <div className="tabs">
        {[
          ["expenses", "Daily spending"],
          ["loans", "My loans & EMIs"],
          ["calculator", "EMI calculator"],
        ].map(([v, l]) => (
          <button
            className={view === v ? "selected" : ""}
            key={v}
            onClick={() => setView(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "expenses" ? (
        <>
          <div className="metric-grid">
            <Metric
              title="Spent this month"
              value={money(spent)}
              icon={Wallet}
            />
            <Metric
              title="Income recorded"
              value={money(income)}
              icon={IndianRupee}
            />
            <Metric
              title="Entries recorded"
              value={String(data.expenses.length)}
              icon={FileText}
            />
          </div>
          <div className="two-column">
            <section className="panel">
              <SectionTitle title="Note a little expense" />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  const r = await act(
                    () =>
                      api("expenses", "POST", {
                        description: f.get("description"),
                        category: f.get("category"),
                        amount: Math.round(Number(f.get("amount")) * 100),
                        kind: f.get("kind"),
                        date: f.get("date"),
                      }),
                    "Entry saved privately",
                  );
                  if (r) form.reset();
                }}
              >
                <Field label="What was it for?">
                  <input
                    name="description"
                    required
                    maxLength={120}
                    placeholder="e.g. This week’s groceries"
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Amount (₹)">
                    <input
                      name="amount"
                      required
                      type="number"
                      min="0.01"
                      max="10000000"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Date">
                    <input
                      name="date"
                      required
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </Field>
                </div>
                <div className="form-grid">
                  <Field label="Category">
                    <select name="category">
                      {[
                        "Groceries",
                        "Bills",
                        "Travel",
                        "Dining",
                        "Health",
                        "Home",
                        "Other",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Entry type">
                    <select name="kind">
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </Field>
                </div>
                <Button type="submit" disabled={busy}>
                  <Plus size={16} />
                  Save entry
                </Button>
              </form>
            </section>
            <section className="panel">
              <SectionTitle
                title="The everyday ledger"
                action="Export CSV"
                onClick={csv}
              />
              {data.expenses.map((e: R) => (
                <div className="ledger-row" key={e.id}>
                  <span className="document-icon">
                    <Wallet size={17} />
                  </span>
                  <div className="grow">
                    <b>{e.description}</b>
                    <small>
                      {day(e.date)} · {e.category}
                    </small>
                  </div>
                  <b>
                    {e.kind === "income" ? "+" : "−"}
                    {money(e.amount)}
                  </b>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${e.description}`}
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api(`expenses/${e.id}`, "DELETE"),
                        "Entry removed",
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </section>
          </div>
        </>
      ) : view === "loans" ? (
        <>
          <div className="toolbar">
            <h2>Your bigger plans</h2>
            <Button onClick={() => setAddLoan(true)}>
              <Plus size={16} />
              Add a loan
            </Button>
          </div>
          <div className="ride-grid">
            {data.loans.map((l: R) => (
              <article className="panel loan-card" key={l.id}>
                <Badge>MANUAL TRACKING</Badge>
                <h2>{l.title}</h2>
                <div className="loan-principal">
                  {money(l.principal)}
                  <small>Original principal</small>
                </div>
                <p>
                  {l.rate}% annual rate · {l.months} months
                </p>
                <p className="muted">
                  Monthly reminder date: day {l.due_day} · notifications not
                  connected
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    act(
                      () =>
                        api("loan-payment", "POST", {
                          loanId: l.id,
                          month: f.get("month"),
                          amount: Math.round(Number(f.get("amount")) * 100),
                        }),
                      "Payment marked by you; not bank verified",
                    );
                  }}
                >
                  <div className="form-grid">
                    <Field label="EMI month">
                      <input
                        name="month"
                        type="month"
                        required
                        defaultValue={new Date().toISOString().slice(0, 7)}
                      />
                    </Field>
                    <Field label="Amount paid (₹)">
                      <input
                        name="amount"
                        required
                        min="0.01"
                        step="0.01"
                        type="number"
                      />
                    </Field>
                  </div>
                  <Button variant="outline" type="submit" disabled={busy}>
                    Record a payment
                  </Button>
                </form>
                {data.loanPayments
                  .filter((p: R) => p.loan_id === l.id)
                  .map((p: R) => (
                    <div className="table-row" key={p.id}>
                      <span>
                        {p.month} · {money(p.amount)}
                      </span>
                      <Badge tone="amber">User marked</Badge>
                    </div>
                  ))}
              </article>
            ))}
          </div>
          <div className="inline-note">
            Loan tracking only. Lending partners, bank verification, automatic
            payments, receipt attachments, and partial/overdue schedule
            management are not connected.
          </div>
        </>
      ) : (
        <div className="two-column">
          <section className="panel">
            <SectionTitle title="A clearer picture of your EMI" />
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const r = await act(
                  () =>
                    api("emi", "POST", {
                      principal: Number(f.get("principal")),
                      rate: Number(f.get("rate")),
                      months: Number(f.get("months")),
                      prepayment: Number(f.get("prepayment")),
                    }),
                  "EMI calculated",
                );
                if (r) setCalc(r);
              }}
            >
              <Field label="Loan amount (₹)">
                <input
                  type="number"
                  name="principal"
                  min={1}
                  max={1e10}
                  required
                  defaultValue={3500000}
                />
              </Field>
              <div className="form-grid">
                <Field label="Annual interest (%)">
                  <input
                    type="number"
                    name="rate"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    defaultValue={8.5}
                  />
                </Field>
                <Field label="Tenure (months)">
                  <input
                    type="number"
                    name="months"
                    min={1}
                    max={600}
                    required
                    defaultValue={240}
                  />
                </Field>
              </div>
              <Field label="Extra payment every month (₹)">
                <input
                  type="number"
                  name="prepayment"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                />
              </Field>
              <Button type="submit" disabled={busy}>
                Calculate my EMI <ArrowRight size={16} />
              </Button>
            </form>
          </section>
          <section className="panel emi-result">
            {calc ? (
              <>
                <span className="eyebrow">ESTIMATED MONTHLY EMI</span>
                <h2>{money(Math.round(calc.emi * 100))}</h2>
                <div className="bill">
                  <div>
                    <span>Total interest</span>
                    <b>{money(Math.round(calc.totalInterest * 100))}</b>
                  </div>
                  <div>
                    <span>Total repayment</span>
                    <b>{money(Math.round(calc.totalRepayment * 100))}</b>
                  </div>
                  <div>
                    <span>Repayment length</span>
                    <b>{calc.months} months</b>
                  </div>
                </div>
                <p className="footnote muted">{calc.assumption}</p>
                <details>
                  <summary>View amortization schedule</summary>
                  <div className="schedule-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Payment</th>
                          <th>Interest</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.schedule.map((r: R) => (
                          <tr key={r.month}>
                            <td>{r.month}</td>
                            <td>{money(Math.round(r.payment * 100))}</td>
                            <td>{money(Math.round(r.interest * 100))}</td>
                            <td>{money(Math.round(r.balance * 100))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <Empty
                icon={Wallet}
                title="Plan with a little confidence"
                description="Enter your loan details to see repayment and monthly interest. Estimates exclude lender fees."
              />
            )}
          </section>
        </div>
      )}
      {addLoan && (
        <Modal
          title="Add a loan to your home"
          onClose={() => setAddLoan(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const r = await act(
                () =>
                  api("loans", "POST", {
                    title: f.get("title"),
                    principal: Math.round(Number(f.get("principal")) * 100),
                    rate: Number(f.get("rate")),
                    months: Number(f.get("months")),
                    dueDay: Number(f.get("dueDay")),
                  }),
                "Loan added",
              );
              if (r) setAddLoan(false);
            }}
          >
            <Field label="Loan name">
              <input
                name="title"
                required
                maxLength={80}
                placeholder="e.g. Home loan"
              />
            </Field>
            <Field label="Original principal (₹)">
              <input
                name="principal"
                type="number"
                min={1}
                max={1e10}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Annual rate (%)">
                <input
                  name="rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                />
              </Field>
              <Field label="Tenure (months)">
                <input name="months" type="number" min={1} max={600} required />
              </Field>
            </div>
            <Field label="Due day each month">
              <input
                name="dueDay"
                type="number"
                min={1}
                max={28}
                defaultValue={5}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Save loan
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Package;
}) {
  return (
    <div className="panel metric">
      <span className="document-icon">
        <Icon size={20} />
      </span>
      <small>{title}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Profile({ data, act, switchPersona, busy }: any) {
  const [managed, setManaged] = useState<R[]>([]);
  useEffect(() => {
    api("memberships")
      .then(setManaged)
      .catch(() => {});
  }, [data]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR CHOICES</span>
          <h1>
            Make yourself at home<span className="gold-dot">.</span>
          </h1>
          <p>Your membership and privacy preferences, all in one place.</p>
        </div>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="profile-header">
            <span className="avatar big">{data.user.name[0]}</span>
            <div>
              <h2>{data.user.name}</h2>
              <p>Demo access · {({association:"Project support",warehouse:"Warehouse",delivery:"Delivery partner",services:"Service coordinator",technician:"Technician",platform:"Platform administrator",resident:"Resident"} as R)[data.user.role] || "Member"}</p>
            </div>
          </div>
          <h3>Your MDP memberships</h3>
          {data.memberships.map((m: R) => (
            <div className="membership-row" key={m.id}>
              <Home size={20} />
              <div className="grow">
                <b>{m.project}</b>
                <small>
                  {m.label} · {m.kind}
                </small>
              </div>
              <Badge tone={m.status === "approved" ? "green" : "amber"}>
                {m.status}
              </Badge>
            </div>
          ))}
          {!data.memberships.length && (
            <p className="muted">
              Staff access is restricted to your operational role.
            </p>
          )}
          <div className="inline-note">
            Flat labels and people are synthetic. Ownership and residence are
            separate records. Production OTP and invitation onboarding are not
            connected.
          </div>
          <h3>Privacy at home</h3>
          <p className="muted">
            Your documents and financial entries belong to you. Flat owners and
            association managers cannot see them.
          </p>
          <a className="text-link" href="/privacy">
            Privacy notice <ArrowUpRight size={15} />
          </a>
          <div className="button-row account-actions">
            <a
              className="button outline"
              href={appApiUrl("export")}
              download="mdp-account.json"
            >
              <Download size={16} />
              Export my records
            </a>
            <Button
              variant="outline danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Delete this demo account and private records? This cannot be undone.",
                  )
                )
                  act(async () => {
                    await api("account", "DELETE");
                    location.reload();
                  }, "Account deleted");
              }}
            >
              Delete demo account
            </Button>
          </div>
        </section>
        <section className="panel">
          <SectionTitle title="The way you like it" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(
                () =>
                  api("preferences", "POST", {
                    language: f.get("language"),
                    notifications: f.get("notifications") === "on",
                    network: f.get("network") === "on",
                  }),
                "Your preferences are saved",
              );
            }}
          >
            <Field label="Preferred language">
              <select name="language" defaultValue={data.preferences.language}>
                <option value="en">English</option>
                <option value="te">తెలుగు · Telugu navigation preview</option>
              </select>
            </Field>
            <label className="check-field">
              <input
                name="notifications"
                type="checkbox"
                defaultChecked={!!data.preferences.notifications}
              />
              <span>
                <b>Important updates</b>
                <small>Save preference; push delivery is not connected.</small>
              </span>
            </label>
            <label className="check-field">
              <input
                name="network"
                type="checkbox"
                defaultChecked={!!data.preferences.network}
              />
              <span>
                <b>The wider MDP community</b>
                <small>Opt into events across MDP projects.</small>
              </span>
            </label>
            <Button type="submit" disabled={busy}>
              Save preferences <Check size={16} />
            </Button>
          </form>
          <div className="settings-note">
            <Globe2 size={23} />
            <h3>Rooted in Ameenpur.</h3>
            <p>
              Founded in 2020 by Nimmala Sai and Kotapati Akhil. My Dream
              Projects brings together 19 developments.
            </p>
            <a
              className="text-link"
              href="https://mydreamprojects.in/about"
              target="_blank"
              rel="noreferrer"
            >
              The MDP story <ArrowUpRight size={15} />
            </a>
          </div>
        </section>
      </div>
      {managed.length > 0 && (
        <section className="panel">
          <SectionTitle title="Memberships for flats you own" />
          {managed.map((m: R) => (
            <div className="table-row" key={m.id}>
              <div>
                <b>{m.name}</b>
                <small>
                  {m.label} · {m.kind}
                </small>
              </div>
              <Badge>{m.status}</Badge>
              <div className="button-row">
                {m.status === "pending" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          api(`memberships/${m.id}`, "PATCH", {
                            status: "approved",
                          }),
                        "Membership approved",
                      )
                    }
                  >
                    Approve
                  </Button>
                )}
                {m.status === "approved" && m.kind === "tenant" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          api(`memberships/${m.id}`, "PATCH", {
                            status: "expired",
                          }),
                        "Residence access revoked; personal records retained",
                      )
                    }
                  >
                    Mark moved out
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="inline-note">
        Telugu navigation is available as a preview. Full content translation,
        accessibility review, account export attachments, and a production
        retention policy remain release work.
      </div>
    </>
  );
}
function Operations({ data, act, busy }: any) {
  if (["services", "technician"].includes(data.user.role))
    return <ServiceDesk data={data} act={act} busy={busy} />;
  return <WarehouseOperations data={data} act={act} busy={busy} />;
}
function WarehouseOperations({ data, act, busy }: any) {
  const [ops, setOps] = useState<R | null>(null),
    [view, setView] = useState("orders"),
    [err, setErr] = useState("");
  const load = () =>
    api("operations")
      .then(setOps)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [data]);
  const isRider = data.user.role === "delivery",
    isAssociation = data.user.role === "association";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {isRider ? "THE LAST MILE, WITH CARE" : "A WELL-RUN COMMUNITY"}
          </span>
          <h1>
            {isRider
              ? "Your delivery day"
              : isAssociation
                ? "Project support desk"
                : "The neighbourhood warehouse"}
            <span className="gold-dot">.</span>
          </h1>
          <p>
            {isRider
              ? "Only your assigned orders appear here."
              : isAssociation
                ? "Resident verification, complaints and moderation for your project. Committee accounts are managed separately."
                : "One warehouse. Two electric bikes. A little everyday coordination."}
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw size={16} />
          Refresh
        </Button>
      </div>
      {err && <div className="alert error">{err}</div>}
      {!ops ? (
        <div className="loading">
          <LoaderCircle className="spin" />
        </div>
      ) : isAssociation ? (
        <>
          <section className="panel">
            <SectionTitle title="Resident memberships" />
            {ops.memberships.map((m: R) => (
              <div className="table-row" key={m.id}>
                <div>
                  <b>{m.name}</b>
                  <small>
                    {m.project} · {m.label} · {m.kind}
                  </small>
                </div>
                <Badge tone={m.status === "pending" ? "amber" : "green"}>
                  {m.status}
                </Badge>
                <div className="button-row">
                  {m.status === "pending" && (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(`memberships/${m.id}`, "PATCH", {
                                status: "approved",
                              }),
                            "Membership approved",
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(`memberships/${m.id}`, "PATCH", {
                                status: "rejected",
                              }),
                            "Membership rejected",
                          )
                        }
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {m.status === "approved" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        act(
                          () =>
                            api(`memberships/${m.id}`, "PATCH", {
                              status: "expired",
                            }),
                          "Residence expired",
                        )
                      }
                    >
                      Move out
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </section>
          <section className="panel">
            <SectionTitle title="Help at home" />
            {ops.tickets.map((t: R) => (
              <div className="table-row" key={t.id}>
                <div>
                  <b>{t.category}</b>
                  <p>{t.description}</p>
                </div>
                <Badge>{t.status}</Badge>
                <Button
                  variant="outline"
                  disabled={busy || t.status === "resolved"}
                  onClick={() =>
                    act(
                      () =>
                        api(`tickets/${t.id}`, "PATCH", {
                          status:
                            t.status === "open" ? "in_progress" : "resolved",
                        }),
                      "Request updated",
                    )
                  }
                >
                  {t.status === "open" ? "Start work" : "Resolve"}
                </Button>
              </div>
            ))}
            {!ops.tickets.length && (
              <p className="muted">No resident requests yet.</p>
            )}
          </section>
          <section className="panel">
            <SectionTitle title="Community moderation" />
            {ops.reports.map((r: R) => (
              <div className="table-row" key={r.id}>
                <span>
                  {r.reason} · {r.status}
                </span>
                <Button
                  variant="outline"
                  disabled={busy || r.status === "resolved"}
                  onClick={() =>
                    act(
                      () => api("moderate", "POST", { postId: r.target_id }),
                      "Post hidden; report resolved",
                    )
                  }
                >
                  Hide reported post
                </Button>
              </div>
            ))}
            {!ops.reports.length && (
              <p className="muted">No reports in your project.</p>
            )}
          </section>
        </>
      ) : (
        <>
          {!isRider && (
            <>
              <div className="metric-grid four">
                <Metric
                  title="Delivered item sales"
                  value={money(ops.metrics.sales)}
                  icon={ShoppingBasket}
                />
                <Metric
                  title="Cost of goods"
                  value={money(ops.metrics.cogs)}
                  icon={Package}
                />
                <Metric
                  title="Contribution estimate"
                  value={money(ops.metrics.contribution)}
                  icon={IndianRupee}
                />
                <Metric
                  title="Electric delivery bikes"
                  value="02"
                  icon={Bike}
                />
              </div>
              <p className="footnote muted">{ops.metrics.assumption}</p>
              <div className="tabs">
                {[
                  ["orders", "Fulfillment queue"],
                  ["inventory", "Stock & receiving"],
                  ["fleet", "Bikes & delivery team"],
                  ["audit", "Activity log"],
                ].map(([v, l]) => (
                  <button
                    className={view === v ? "selected" : ""}
                    key={v}
                    onClick={() => setView(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </>
          )}
          {(view === "orders" || isRider) && (
            <div className="list-stack">
              {ops.orders.length ? (
                ops.orders.map((o: R) => (
                  <OrderCard key={o.id} o={o}>
                    <p>
                      {o.items
                        .map((i: R) => `${i.quantity} × ${i.name}`)
                        .join(" · ")}
                    </p>
                    {!isRider && ["placed", "picking"].includes(o.status) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              api(`orders/${o.id}`, "PATCH", {
                                status:
                                  o.status === "placed" ? "picking" : "packed",
                              }),
                            "Fulfillment updated",
                          )
                        }
                      >
                        {o.status === "placed"
                          ? "Start picking"
                          : "Mark packed"}
                        <ArrowRight size={16} />
                      </Button>
                    )}
                    {!isRider && o.status === "packed" && (
                      <form
                        className="dispatch-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          act(
                            () =>
                              api(`orders/${o.id}`, "PATCH", {
                                status: "out_for_delivery",
                                riderId: f.get("riderId"),
                              }),
                            "Order dispatched",
                          );
                        }}
                      >
                        <select name="riderId" aria-label="Assign rider">
                          {ops.riders.map((r: R) => (
                            <option
                              key={r.id}
                              value={r.id}
                              disabled={
                                !!r.charging || r.status === "off_shift"
                              }
                            >
                              {r.name} · {r.bike}
                              {r.charging ? " · Charging" : ""}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" disabled={busy}>
                          Dispatch <Bike size={17} />
                        </Button>
                      </form>
                    )}
                    {isRider && o.status === "out_for_delivery" && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          act(
                            () =>
                              api(`orders/${o.id}`, "PATCH", {
                                status: "delivered",
                                otp: f.get("otp"),
                              }),
                            "Delivery confirmed; demo COD marked collected",
                          );
                        }}
                      >
                        <Field label="Resident confirmation code (demo: 123456)">
                          <input
                            name="otp"
                            required
                            pattern="[0-9]{6}"
                            inputMode="numeric"
                            maxLength={6}
                          />
                        </Field>
                        <div className="button-row">
                          <Button type="submit" disabled={busy}>
                            Confirm delivery <Check size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () =>
                                  api(`orders/${o.id}`, "PATCH", {
                                    status: "returned",
                                  }),
                                "Failed delivery returned for warehouse inspection",
                              )
                            }
                          >
                            Failed / return
                          </Button>
                        </div>
                      </form>
                    )}
                  </OrderCard>
                ))
              ) : (
                <Empty
                  icon={isRider ? Bike : Package}
                  title={
                    isRider
                      ? "A clear delivery queue"
                      : "Ready for the first basket"
                  }
                  description={
                    isRider
                      ? "Your assigned orders will appear here after warehouse dispatch."
                      : "Switch to the resident demo and place an essentials order."
                  }
                />
              )}
            </div>
          )}
          {view === "inventory" && !isRider && (
            <div className="two-column">
              <section className="panel">
                <SectionTitle title="Receive a fresh batch" />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    act(
                      () =>
                        api("stock", "POST", {
                          productId: f.get("product"),
                          quantity: Number(f.get("quantity")),
                          expiry: new Date(
                            String(f.get("expiry")),
                          ).toISOString(),
                          supplier: f.get("supplier"),
                          ...(f.get("unitCost") && f.get("sellingPrice")
                            ? {
                                unitCost: Math.round(
                                  Number(f.get("unitCost")) * 100,
                                ),
                                sellingPrice: Math.round(
                                  Number(f.get("sellingPrice")) * 100,
                                ),
                              }
                            : {}),
                        }),
                      "Batch received; stock updated",
                    );
                  }}
                >
                  <Field label="Product">
                    <select name="product">
                      {ops.products.map((p: R) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Quantity (packs)">
                    <input
                      required
                      name="quantity"
                      type="number"
                      min={1}
                      max={10000}
                    />
                  </Field>
                  <Field label="Expiry date">
                    <input required name="expiry" type="date" />
                  </Field>
                  <Field label="Supplier">
                    <input required name="supplier" maxLength={100} />
                  </Field>
                  <Field label="Unit buying cost ₹ (required for proposed items)">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="unitCost"
                    />
                  </Field>
                  <Field label="Confirmed selling price ₹ (required with cost)">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="sellingPrice"
                    />
                  </Field>
                  <Button type="submit" disabled={busy}>
                    Receive batch <Plus size={16} />
                  </Button>
                </form>
                <p className="footnote muted">
                  Picking consumes the first-expiring valid stock. Returned
                  goods require inspection and are not automatically restocked.
                </p>
              </section>
              <section className="panel">
                <SectionTitle title="On the shelves" />
                {ops.products.map((p: R) => (
                  <div className="stock-row" key={p.id}>
                    <span>{p.emoji}</span>
                    <div className="grow">
                      <b>{p.name}</b>
                      <small>
                        {p.unit} · SKU {p.id}
                      </small>
                    </div>
                    <Badge tone={p.stock < 10 ? "amber" : "green"}>
                      {p.stock} packs
                    </Badge>
                  </div>
                ))}
              </section>
              <section className="panel full-span">
                <SectionTitle title="Batch expiry register" />
                <div className="schedule-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Supplier</th>
                        <th>Remaining</th>
                        <th>Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.batches.map((b: R) => (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>{b.supplier}</td>
                          <td>{b.quantity}</td>
                          <td>{day(b.expiry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {view === "fleet" && !isRider && (
            <div className="ride-grid">
              {ops.riders.map((r: R) => (
                <section className="panel fleet-card" key={r.id}>
                  <Bike size={40} />
                  <h2>{r.name}</h2>
                  <Badge>{r.bike} · ELECTRIC</Badge>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      act(
                        () =>
                          api(`riders/${r.id}`, "PATCH", {
                            status: f.get("status"),
                            charging: f.get("charging") === "on",
                            rangeKm: Number(f.get("range")),
                          }),
                        "Rider and bike availability updated",
                      );
                    }}
                  >
                    <Field label="Shift">
                      <select name="status" defaultValue={r.status}>
                        <option value="available">On shift</option>
                        <option value="off_shift">Off shift</option>
                      </select>
                    </Field>
                    <Field label="Estimated remaining range (km)">
                      <input
                        type="number"
                        name="range"
                        min={0}
                        max={200}
                        defaultValue={r.range_km}
                      />
                    </Field>
                    <label className="check-field">
                      <input
                        name="charging"
                        type="checkbox"
                        defaultChecked={!!r.charging}
                      />
                      Charging (exclude from delivery capacity)
                    </label>
                    <Button type="submit" disabled={busy}>
                      Update availability
                    </Button>
                  </form>
                </section>
              ))}
            </div>
          )}
          {view === "audit" && !isRider && (
            <section className="panel">
              <SectionTitle title="Privileged activity" />
              {ops.audit.map((a: R, i: number) => (
                <div className="table-row" key={i}>
                  <b>{a.action}</b>
                  <span>{String(a.target).slice(0, 14)}</span>
                  <small>{when(a.at)} IST</small>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
