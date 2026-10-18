import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase, id, now } from "../lib/db.ts";
import { Service, AppError } from "../lib/service.ts";
import {
  groceryRange,
  rangeTotals,
  migrateRetail,
  retailOverview,
} from "../lib/retail.ts";
import { retailDefaults, retailScenario } from "../lib/retail-model.ts";
import { receiveStock } from "../lib/retail-stock.ts";
const setup = () => {
  const db = openDatabase(":memory:"),
    s = new Service(db),
    u = (uid: string) => s.one("SELECT * FROM users WHERE id=?", uid)!;
  return { db, s, u };
};
const denied = (fn: () => unknown, status?: number) =>
  assert.throws(
    fn,
    (e: unknown) => e instanceof AppError && (!status || e.status === status),
  );
test("76-SKU unit-price demand plan totals exactly 3 lakh, without calling monthly demand opening stock", () => {
  assert.equal(groceryRange.length, 76);
  assert.equal(new Set(groceryRange.map((p) => p.id)).size, 76);
  assert.equal(
    groceryRange.reduce((a, p) => a + p.price * p.monthlyUnits, 0),
    30000000,
  );
  assert.deepEqual(
    rangeTotals().map((g) => g.sales),
    [6000000, 7500000, 4500000, 4500000, 3600000, 3900000],
  );
  assert.ok(
    groceryRange.every(
      (p) => p.monthlyUnits > 0 && p.openingDays >= 1 && p.openingDays <= 10,
    ),
  );
  assert.ok(
    groceryRange
      .filter(
        (p) => p.group === "Vegetables & fruit" || p.group === "Dairy & eggs",
      )
      .every((p) => p.openingDays === 1),
  );
});
test("pilot arithmetic distinguishes revenue, gross margin, operating remainder and break-even", () => {
  const x = retailScenario();
  assert.equal(x.market, 65000000);
  assert.ok(Math.abs(x.capture - 46.153846) < 0.0001);
  assert.equal(x.perActive, 400000);
  assert.equal(x.orders, 600);
  assert.equal(x.ordersPerDay, 20);
  assert.equal(x.ordersPerDriver, 10);
  assert.equal(x.gross, 5400000);
  assert.equal(x.costs, 5350000);
  assert.equal(x.operatingRemainder, 50000);
  assert.equal(
    retailScenario({ ...retailDefaults, margin: 1 }).breakEven,
    null,
  );
  assert.throws(() => retailScenario({ ...retailDefaults, basket: 0 }));
});
test("migration preserves current pricing and stock, adds proposed zero-stock SKUs and is idempotent", () => {
  const { db, s } = setup();
  const before = s.one("SELECT * FROM products WHERE id='milk'")!;
  s.run("UPDATE products SET price=3100 WHERE id='milk'");
  const batches = s.one("SELECT count(*) n FROM batches")!.n;
  migrateRetail(db);
  assert.equal(
    s.one("SELECT price FROM products WHERE id='milk'")!.price,
    3100,
  );
  assert.equal(
    s.one("SELECT stock FROM products WHERE id='milk'")!.stock,
    before.stock,
  );
  assert.equal(s.one("SELECT count(*) n FROM batches")!.n, batches);
  assert.equal(s.one("SELECT count(*) n FROM products")!.n, 76);
  assert.equal(
    s.one("SELECT stock,cost FROM products WHERE id='atta'")!.stock,
    0,
  );
  assert.equal(
    s.one(
      "SELECT launch_state FROM grocery_assortment WHERE product_id='atta'",
    )!.launch_state,
    "planned",
  );
  db.close();
});
test("planned assortment does not become purchasable until privileged receiving confirms cost and price", () => {
  const { db, s, u } = setup();
  const b = {
    productId: "atta",
    quantity: 3,
    supplier: "Synthetic test supplier",
    expiry: new Date(Date.now() + 86400000 * 14).toISOString(),
  };
  denied(
    () =>
      receiveStock(s, u("resident"), {
        ...b,
        unitCost: 20000,
        sellingPrice: 25000,
      }),
    403,
  );
  denied(() => receiveStock(s, u("warehouse"), b));
  assert.equal(s.one("SELECT stock FROM products WHERE id='atta'")!.stock, 0);
  denied(() =>
    receiveStock(s, u("warehouse"), {
      ...b,
      unitCost: 20000,
      sellingPrice: -1,
    }),
  );
  receiveStock(s, u("warehouse"), {
    ...b,
    unitCost: 20000,
    sellingPrice: 25000,
  });
  assert.equal(s.one("SELECT stock FROM products WHERE id='atta'")!.stock, 3);
  assert.equal(s.one("SELECT cost FROM products WHERE id='atta'")!.cost, 20000);
  assert.equal(
    s.one(
      "SELECT launch_state FROM grocery_assortment WHERE product_id='atta'",
    )!.launch_state,
    "demo-stocked",
  );
  const order = s.checkout(u("resident"), {
    flatId: "f1",
    key: id(),
    items: [{ id: "atta", qty: 1 }],
    slot: s.slots()[0].id,
    payment: "cod",
    substitution: "none",
  });
  assert.ok(order);
  assert.equal(s.one("SELECT stock FROM products WHERE id='atta'")!.stock, 2);
  db.close();
});
test("storefront only exposes fresh available quantities; retail plan and actuals remain operator-only", () => {
  const { db, s, u } = setup();
  s.run("UPDATE batches SET expiry='2000-01-01' WHERE product_id='milk'");
  assert.equal(
    s.bootstrap(u("resident")).products.find((p) => p.id === "milk")!.stock,
    0,
  );
  assert.equal(s.one("SELECT stock FROM products WHERE id='milk'")!.stock, 35);
  denied(() => retailOverview(s, u("resident")), 403);
  denied(() => retailOverview(s, u("neighbor")), 403);
  denied(() => retailOverview(s, u("admin")), 403);
  const plan = retailOverview(s, u("warehouse"));
  assert.equal(plan.actual.sales, 0);
  assert.equal(plan.products.length, 76);
  assert.equal(s.one("SELECT count(*) n FROM orders")!.n, 0);
  db.close();
});
