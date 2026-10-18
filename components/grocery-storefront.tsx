"use client";
import { useState, type ReactNode, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  ShoppingBasket,
  Search,
  Milk,
  Wheat,
  Leaf,
  Coffee,
  Droplets,
  Sparkles,
  Clock3,
  Wrench,
  Users,
  CarFront,
  LayoutDashboard,
} from "lucide-react";
type R = Record<string, any>;
export const storeGroups = [
  { name: "Dairy & eggs", short: "Milk & eggs", icon: Milk, tile: 0 },
  { name: "Rice, atta & dals", short: "Rice & staples", icon: Wheat, tile: 6 },
  {
    name: "Oils, ghee & masalas",
    short: "Oils & masalas",
    icon: Droplets,
    tile: 15,
  },
  { name: "Vegetables & fruit", short: "Fruit & veg", icon: Leaf, tile: 3 },
  {
    name: "Breakfast, snacks & drinks",
    short: "Breakfast",
    icon: Coffee,
    tile: 4,
  },
  {
    name: "Home & personal care",
    short: "Home care",
    icon: Sparkles,
    tile: 10,
  },
];
const tiles: Record<string, number> = {
  milk: 0,
  eggs: 1,
  banana: 2,
  tomato: 3,
  bread: 4,
  onion: 5,
  rice: 6,
  apple: 7,
  curd: 8,
  spinach: 9,
  soap: 10,
  cleaner: 11,
  snacks: 12,
  tea: 13,
};
export function ProductArt({ p }: { p: R }) {
  const tile = tiles[p.id];
  if (tile === undefined) {
    const g = storeGroups.find((g) => g.name === p.category);
    const Icon = g?.icon || ShoppingBasket;
    return (
      <div className="md-product-placeholder">
        <Icon size={44} strokeWidth={1} />
        <small>Image coming soon</small>
      </div>
    );
  }
  return (
    <div
      className="md-product-photo"
      role="img"
      aria-label={`${p.name} — illustrative image`}
      style={
        {
          "--tile-x": `${((tile % 4) * 100) / 3}%`,
          "--tile-y": `${(Math.floor(tile / 4) * 100) / 3}%`,
        } as CSSProperties
      }
    />
  );
}
export function GroceryStorefront({
  data,
  renderProduct,
  go,
  onCart,
  count,
  hosted = false,
}: {
  data: R;
  renderProduct: (p: R) => ReactNode;
  go: (tab: string) => void;
  onCart: () => void;
  count: number;
  hosted?: boolean;
}) {
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [range, setRange] = useState("stocked");
  const stocked = (p: R) => p.stock > 0 && p.launch_state !== "planned";
  const filtered = data.products
    .filter(
      (p: R) =>
        (category === "All" || p.category === category) &&
        (!search ||
          `${p.name} ${p.category}`
            .toLowerCase()
            .includes(search.toLowerCase().trim())) &&
        (range === "all" || stocked(p)),
    )
    .sort(
      (a: R, b: R) =>
        Number(stocked(b)) - Number(stocked(a)) || b.featured - a.featured,
    );
  const previousNames = new Set(
    (data.orders || [])
      .filter((o: R) => o.status === "delivered")
      .flatMap((o: R) => o.items.map((i: R) => i.name)),
  );
  const again = data.products
    .filter((p: R) => previousNames.has(p.name) && stocked(p))
    .slice(0, 4);
  const slot = data.slots?.find(
    (s: R) => s.available > 0 || s.remaining > 0 || s.capacity > 0,
  );
  const slotLabel =
    slot?.label ||
    (slot?.id
      ? new Date(slot.id).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
        }) + " IST"
      : null);
  const browse = (c = "All") => {
    setCategory(c);
    document
      .getElementById("mdp-daily-shop")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="daily-store">
      <div className="daily-title">
        <div>
          <span className="daily-overline">Your neighbourhood, delivered.</span>
          <h1>
            Everyday, made easy<span>.</span>
          </h1>
        </div>
        <button
          className="daily-basket"
          onClick={onCart}
          disabled={!count}
          aria-label={`Open basket, ${count} items`}
        >
          <ShoppingBasket size={19} />
          <span>Basket</span>
          <b>{count}</b>
        </button>
      </div>
      <label className="daily-search">
        <Search size={21} />
        <input
          aria-label="Search neighbourhood store"
          placeholder="What does home need today?"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>Search essentials</kbd>
      </label>
      <div className="daily-availability">
        <span>
          <span
            className={`daily-status ${data.services?.groceries ? "enabled" : ""}`}
          />
          {data.services?.groceries
            ? "Delivery to your community"
            : "Explore the store · delivery not enabled here"}
        </span>
        <button onClick={() => go("essentials")}>
          <Clock3 size={14} />
          {data.services?.groceries
            ? slotLabel
              ? `Next slot · ${slotLabel}`
              : "Check available delivery slots"
            : "View catalogue"}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {!search && category === "All" && (
        <section className="daily-editorial">
          <img
            src="/grocery/everyday-table.png"
            alt="Milk, bread, eggs and fresh produce on a kitchen counter — illustrative photography"
          />
          <div className="daily-editorial-copy">
            <span>The morning edit</span>
            <h2>
              A good day starts
              <br />
              with the little things.
            </h2>
            <p>
              Milk, eggs, fresh fruit.
              <br />
              Your everyday essentials, closer to home.
            </p>
            <button onClick={() => browse("Dairy & eggs")}>
              Shop breakfast <ArrowRight size={17} />
            </button>
          </div>
          <span className="daily-image-note">Illustrative imagery</span>
        </section>
      )}
      <section className="daily-categories" aria-label="Shop by category">
        {storeGroups.map((g) => (
          <button
            key={g.name}
            aria-pressed={category === g.name}
            onClick={() => setCategory(category === g.name ? "All" : g.name)}
          >
            <span
              className="daily-category-photo"
              style={{
                backgroundPosition: `${((g.tile % 4) * 100) / 3}% ${(Math.floor(g.tile / 4) * 100) / 3}%`,
              }}
            />
            <span>{g.short}</span>
          </button>
        ))}
      </section>
      {again.length > 0 && !search && category === "All" && (
        <section className="daily-repeat">
          <div className="daily-section-heading">
            <div>
              <span>From your delivered orders</span>
              <h2>Your usuals, ready again.</h2>
            </div>
          </div>
          <div className="product-grid">
            {again.map((p: R) => (
              <div key={p.id}>{renderProduct(p)}</div>
            ))}
          </div>
        </section>
      )}
      <section id="mdp-daily-shop" className="daily-shop">
        <div className="daily-section-heading">
          <div>
            <span>
              {search
                ? "Search results"
                : category === "All"
                  ? "A little of everything, every day"
                  : "Your selected shelf"}
            </span>
            <h2>
              {search
                ? `Results for “${search}”`
                : category === "All"
                  ? "Everyday essentials"
                  : category}
            </h2>
          </div>
          <button onClick={() => go("essentials")}>
            All products & orders <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="daily-shelf-controls">
          <div role="group" aria-label="Product availability">
            <button
              aria-pressed={range === "stocked"}
              onClick={() => setRange("stocked")}
            >
              In stock
            </button>
            <button
              aria-pressed={range === "all"}
              onClick={() => setRange("all")}
            >
              {hosted ? "All products" : "Planned range"}
            </button>
          </div>
          <span>{filtered.length} products</span>
          {category !== "All" && (
            <button onClick={() => setCategory("All")}>Clear category</button>
          )}
        </div>
        {range === "all" && !hosted && (
          <p className="daily-notice">
            Proposed products have indicative prices and cannot be ordered until
            stocked. Images are illustrative, not supplier packaging.
          </p>
        )}
        <div className="product-grid daily-product-grid">
          {filtered.map((p: R) => (
            <div key={p.id}>{renderProduct(p)}</div>
          ))}
        </div>
        {!filtered.length && (
          <div className="daily-empty">
            <Search size={28} />
            <h3>No products on this shelf.</h3>
            <p>Try a different search or browse another category.</p>
            <button
              onClick={() => {
                setSearch("");
                setCategory("All");
                setRange("stocked");
              }}
            >
              Browse essentials <ArrowRight size={16} />
            </button>
          </div>
        )}
        <p className="daily-caption">
          Stock and delivery slots confirmed at checkout. Product images are
          illustrative.
        </p>
      </section>
      {!hosted && <section className="daily-living">
        <div className="daily-section-heading">
          <div>
            <span>Beyond the basket</span>
            <h2>A little more connected.</h2>
          </div>
          <span className="daily-living-sub">Your people. Your place.</span>
        </div>
        <div className="daily-living-grid">
          {[
            [
              "services",
              "Home services",
              "A helping hand, on request.",
              Wrench,
            ],
            [
              "circle",
              "Your community",
              "Conversations closer to home.",
              Users,
            ],
            [
              "myproject",
              "My Project",
              "Bills, notices and your committee.",
              LayoutDashboard,
            ],
            [
              "carpool",
              "Go together",
              "Meet neighbours going your way.",
              CarFront,
            ],
          ].map(([id, label, desc, Icon]: any) => (
            <button key={id} onClick={() => go(id)}>
              <Icon size={22} strokeWidth={1.3} />
              <b>{label}</b>
              <span>{desc}</span>
              <ArrowUpRight className="daily-link-arrow" size={17} />
            </button>
          ))}
        </div>
        <div className="daily-more">
          <button onClick={() => go("exchange")}>
            Marketplace <ArrowUpRight size={14} />
          </button>
          <button onClick={() => go("myhome")}>
            Documents & home tools <ArrowUpRight size={14} />
          </button>
          <button onClick={() => go("finance")}>
            Personal finances <ArrowUpRight size={14} />
          </button>
          <button onClick={() => go("community")}>
            Events <ArrowUpRight size={14} />
          </button>
        </div>
      </section>}
    </div>
  );
}
