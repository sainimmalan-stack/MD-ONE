"use client";
import "./retail-plan.css";
import { useEffect, useState } from "react";
import {
  Download,
  TrendingUp,
  ArrowUpRight,
  Package,
  ShoppingBasket,
  Users,
  Bike,
} from "lucide-react";
import { retailDefaults, retailScenario } from "@/lib/retail-model";
type R = Record<string, any>;
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n / 100);
function csv(rows: unknown[][]) {
  return rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}
export function RetailPlan() {
  const [data, setData] = useState<R | null>(null),
    [error, setError] = useState(""),
    [x, setX] = useState({ ...retailDefaults }),
    [group, setGroup] = useState("All");
  useEffect(() => {
    fetch("/api/retail-plan")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);
  let scenario: ReturnType<typeof retailScenario> | null = null;
  try {
    scenario = retailScenario(x);
  } catch {}
  const update = (field: keyof typeof x, value: number) =>
    setX((v) => ({ ...v, [field]: value }));
  function exportRange() {
    if (!data) return;
    const blob = new Blob(
      [
        csv([
          [
            "MDP Daily • proposed assortment • estimates, not supplier quotations",
          ],
          [
            "Product",
            "Group",
            "Pack",
            "Assumed selling price INR",
            "Monthly units",
            "Monthly sales INR",
            "Opening cover days",
            "Indicative opening units",
            "Storage",
            "Current launch state",
          ],
          ...data.products.map((p: R) => [
            p.name,
            p.group,
            p.unit,
            p.price / 100,
            p.monthlyUnits,
            p.plannedSales / 100,
            p.openingDays,
            p.openingUnits,
            p.storage,
            p.current.launch_state,
          ]),
        ]),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MDP-Daily-76-SKU-300000-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (error)
    return (
      <p className="cm-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <p>Loading your retail plan…</p>;
  const total = data.products.reduce(
      (a: number, p: R) => a + p.plannedSales,
      0,
    ),
    ready = data.products.filter(
      (p: R) => p.current.launch_state === "demo-stocked",
    ).length;
  return (
    <div className="retail-plan cm-page">
      <header className="cm-banner">
        <div>
          <span className="cm-eyebrow">MD One DAILY · OPERATOR WORKSPACE</span>
          <h1>A ₹3 lakh everyday habit.</h1>
          <p>
            A balanced 76-SKU assortment for a 130-family pilot. This is a
            demand and revenue plan, not a purchase order or a promise of
            profit.
          </p>
        </div>
        <button className="cm-primary" onClick={exportRange}>
          <Download size={17} /> Export product plan
        </button>
      </header>
      <div className="rp-kpis">
        <Stat
          title="Monthly sales plan"
          value={money(total)}
          note="76 SKUs · planned volumes × assumed prices"
        />
        <Stat
          title="Delivered grocery sales"
          value={money(data.actual.sales)}
          note={`${data.month} · local demo · fees excluded`}
        />
        <Stat
          title="Household spend to capture"
          value="46.2%"
          note="₹3 lakh of your estimated ₹6.5 lakh market"
        />
        <Stat
          title="Catalog readiness"
          value={`${ready} / ${data.products.length}`}
          note="Demo-stocked / proposed range; no real stock assumed"
        />
      </div>
      <section className="cm-panel">
        <div className="cm-between">
          <div>
            <span className="cm-eyebrow">THE PRODUCT MIX</span>
            <h2>Six shelves. One clear target.</h2>
          </div>
          <strong>{money(total)} / month</strong>
        </div>
        <div className="rp-category-mix">
          {data.groups.map((g: R, i: number) => (
            <div key={g.group}>
              <div>
                <span className={`rp-dot dot-${i}`} />
                <strong>{g.group}</strong>
                <small>{g.skus} SKUs</small>
                <b>{money(g.sales)}</b>
              </div>
              <div className="rp-track">
                <span style={{ width: `${(g.sales / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="cm-footnote">
          Planning prices and pack sizes are assumptions. Confirm supplier,
          brand, buying cost, selling price and actual demand before stocking.
          Monthly sales are not the value to keep in the warehouse.
        </p>
      </section>
      <div className="cm-columns">
        <section className="cm-panel">
          <span className="cm-eyebrow">REVENUE ENGINE</span>
          <h2>Make repeat buying the habit.</h2>
          <div className="rp-habit">
            <Users />
            <div>
              <strong>75 active families × ₹4,000</strong>
              <p>
                ₹3 lakh per month. Keep the 130-family estimate separate from
                registered residents.
              </p>
            </div>
          </div>
          <div className="rp-habit">
            <ShoppingBasket />
            <div>
              <strong>600 baskets × ₹500</strong>
              <p>
                About 20 orders per day across 30 days. Basket value is an
                assumption to validate.
              </p>
            </div>
          </div>
          <div className="rp-habit">
            <Bike />
            <div>
              <strong>About 10 orders per bike per day</strong>
              <p>
                With two working riders; plan around actual slots, distance,
                charging and delivery capacity.
              </p>
            </div>
          </div>
        </section>
        <section className="cm-panel">
          <span className="cm-eyebrow">SMALL WAREHOUSE DISCIPLINE</span>
          <h2>Stock for the week, not the month.</h2>
          <p>
            <strong>Daily:</strong> milk, chilled products, bread, batter and
            produce. Follow supplier storage conditions and shelf life;
            quantities are only demand estimates.
          </p>
          <p>
            <strong>7–10 day cover:</strong> sealed staples, oils, snacks and
            home care. Replenish from actual sales instead of buying all monthly
            quantities upfront.
          </p>
          <p>
            <strong>One core brand / pack per item:</strong> add alternatives
            only after repeat demand. Separate cleaning products from food.
          </p>
          <div className="cm-privacy-note">
            <Package size={18} /> New items have zero stock. Receiving requires
            confirmed cost, selling price, supplier and expiry.
          </div>
        </section>
      </div>
      <section className="cm-panel">
        <span className="cm-eyebrow">SALES ARE NOT PROFIT</span>
        <h2>Check the margin before the momentum.</h2>
        <div className="rp-scenario">
          <div className="cm-form-grid">
            {[
              { field: "target", label: "Monthly sales target ₹", scale: 100 },
              { field: "activeFamilies", label: "Buying families", scale: 1 },
              { field: "basket", label: "Average basket ₹", scale: 100 },
              { field: "margin", label: "Blended gross margin %", scale: 1 },
              {
                field: "driverSalary",
                label: "Monthly salary per rider ₹",
                scale: 100,
              },
              {
                field: "rent",
                label: "Monthly warehouse allocation ₹",
                scale: 100,
              },
              {
                field: "utilities",
                label: "Monthly utilities allocation ₹",
                scale: 100,
              },
              {
                field: "packingPerOrder",
                label: "Packing cost / order ₹",
                scale: 100,
              },
              {
                field: "wastage",
                label: "Wastage provision % of sales",
                scale: 1,
              },
            ].map((f) => (
              <label className="cm-field" key={f.field}>
                <span>{f.label}</span>
                <input
                  aria-label={f.label}
                  type="number"
                  min={f.scale === 100 ? 0 : 0.1}
                  step="0.1"
                  value={x[f.field as keyof typeof x] / f.scale}
                  onChange={(e) =>
                    update(
                      f.field as keyof typeof x,
                      Number(e.target.value) * f.scale,
                    )
                  }
                />
              </label>
            ))}
          </div>
          {scenario ? (
            <div className="rp-economics">
              <p>
                Illustrative scenario · {x.drivers} riders · {x.days} days
              </p>
              <Stat
                title="Gross margin before fulfilment"
                value={money(scenario.gross)}
                note={`${x.margin}% of sales`}
              />
              <div className="cm-ledger-row">
                <span>Listed operating costs + wastage</span>
                <strong>{money(scenario.costs)}</strong>
              </div>
              <Stat
                title="Remainder before other costs"
                value={money(scenario.operatingRemainder)}
                note="Not net profit. Excludes owner/admin salary, bike lease/depreciation, repairs, payment fees, tax, discounts and other unlisted costs."
              />
              <div className="cm-ledger-row">
                <span>Indicative break-even on listed costs</span>
                <strong>
                  {scenario.breakEven === null
                    ? "No break-even at this margin"
                    : money(scenario.breakEven)}
                </strong>
              </div>
              <p>
                {scenario.orders.toFixed(0)} orders / month ·{" "}
                {scenario.ordersPerDay.toFixed(1)} per day ·{" "}
                {money(scenario.perActive)} per buying family
              </p>
              <p className="cm-footnote">
                All margin, wage and overhead inputs are editable
                assumptions—not supplier quotes or a profit forecast. Changing
                this scenario does not change catalog prices, stock or the fixed
                ₹3 lakh assortment plan.
              </p>
            </div>
          ) : (
            <p role="alert">
              Use positive inputs and percentages between 0 and 100.
            </p>
          )}
        </div>
      </section>
      <section className="cm-panel">
        <div className="cm-between">
          <div>
            <span className="cm-eyebrow">THE ACTUAL PRODUCT LIST</span>
            <h2>Build the range with intention.</h2>
          </div>
          <select
            aria-label="Assortment group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option>All</option>
            {data.groups.map((g: R) => (
              <option key={g.group}>{g.group}</option>
            ))}
          </select>
        </div>
        <div className="rp-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product / pack</th>
                <th>Plan price</th>
                <th>Units / month</th>
                <th>Sales / month</th>
                <th>Opening cover</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.products
                .filter((p: R) => group === "All" || p.group === group)
                .map((p: R) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {p.unit} · {p.group}
                      </small>
                    </td>
                    <td>
                      {money(p.price)}
                      <small>assumed</small>
                    </td>
                    <td>{p.monthlyUnits}</td>
                    <td>{money(p.plannedSales)}</td>
                    <td>
                      {p.openingUnits} units
                      <small>
                        {p.openingDays} day cover · {p.storage}
                      </small>
                    </td>
                    <td>
                      <span className="cm-badge">
                        {p.current.launch_state === "planned"
                          ? "Proposed · not stocked"
                          : "Demo catalog"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Full assortment planned sales</td>
                <td>{money(total)}</td>
                <td colSpan={2}>No automatic procurement</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
function Stat({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rp-stat">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
