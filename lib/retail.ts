import range from "./grocery-range.json" with { type: "json" };
import type { DatabaseSync } from "node:sqlite";
import type { Service } from "./service.ts";
import { retailDefaults } from "./retail-model.ts";
import type { Row } from "./db.ts";
export const groceryRange = range;
export function rangeTotals() {
  return [...new Set(range.map((p) => p.group))].map((group) => {
    const items = range.filter((p) => p.group === group);
    return {
      group,
      skus: items.length,
      sales: items.reduce((a, p) => a + p.price * p.monthlyUnits, 0),
    };
  });
}
export function migrateRetail(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS grocery_assortment(product_id TEXT PRIMARY KEY REFERENCES products(id),store_group TEXT NOT NULL,launch_state TEXT NOT NULL CHECK(launch_state IN ('planned','demo-stocked')))",
  );
  if (
    db.prepare("SELECT id FROM app_migrations WHERE id='retail-range-v1'").get()
  )
    return;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const p of range) {
      const exists = !!db
        .prepare("SELECT id FROM products WHERE id=?")
        .get(p.id);
      db.prepare(
        "INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(p.id, p.name, p.group, p.unit, p.price, 0, 0, p.emoji, 0);
      db.prepare("INSERT OR IGNORE INTO grocery_assortment VALUES(?,?,?)").run(
        p.id,
        p.group,
        exists ? "demo-stocked" : "planned",
      );
    }
    db.prepare("INSERT INTO app_migrations VALUES(?,?)").run(
      "retail-range-v1",
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function retailOverview(s: Service, u: Row) {
  s.role(u, ["warehouse", "platform"]);
  const month = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .slice(0, 7);
  const actual = s.one(
    "SELECT coalesce(sum(subtotal),0) sales,count(*) orders,coalesce(sum(cost),0) cogs FROM orders WHERE status='delivered' AND payment='cod_collected' AND strftime('%Y-%m',datetime(created,'+5 hours','+30 minutes'))=?",
    month,
  )!;
  return {
    month,
    actual,
    assumptions: retailDefaults,
    groups: rangeTotals(),
    products: range.map((p) => ({
      ...p,
      plannedSales: p.price * p.monthlyUnits,
      openingUnits: Math.ceil((p.monthlyUnits / 30) * p.openingDays),
      current: s.one(
        "SELECT p.price,p.cost,p.stock,a.launch_state FROM products p JOIN grocery_assortment a ON a.product_id=p.id WHERE p.id=?",
        p.id,
      ),
    })),
  };
}
