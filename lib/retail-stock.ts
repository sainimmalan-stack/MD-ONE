import { Service, fail, text, integer } from "./service.ts";
import { id, now, type Row } from "./db.ts";
/** Receive a real recorded batch; assortment planning itself never receives stock. */
export function receiveStock(s: Service, u: Row, b: Row) {
  s.role(u, ["warehouse", "platform"]);
  const quantity = integer(b.quantity, 1, 10000),
    pid = text(b.productId);
  if (!s.one("SELECT id FROM products WHERE id=?", pid))
    fail("Unknown product.");
  const expiry = new Date(text(b.expiry));
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())
    fail("Expiry must be in the future.");
  const supplier = text(b.supplier, 100);
  const planned =
    s.one("SELECT launch_state FROM grocery_assortment WHERE product_id=?", pid)
      ?.launch_state === "planned";
  const configured = b.unitCost !== undefined || b.sellingPrice !== undefined;
  if (planned && !configured)
    fail(
      "Confirm unit buying cost and selling price before receiving a proposed item.",
    );
  const unitCost = configured ? integer(b.unitCost, 1) : null,
    sellingPrice = configured ? integer(b.sellingPrice, 1) : null;
  return s.tx(() => {
    if (configured) {
      s.run(
        "UPDATE products SET cost=?,price=? WHERE id=?",
        unitCost,
        sellingPrice,
        pid,
      );
      s.run(
        "UPDATE grocery_assortment SET launch_state='demo-stocked' WHERE product_id=?",
        pid,
      );
    }
    s.run(
      "INSERT INTO batches VALUES(?,?,?,?,?)",
      id(),
      pid,
      quantity,
      expiry.toISOString(),
      supplier,
    );
    s.run("UPDATE products SET stock=stock+? WHERE id=?", quantity, pid);
    s.run(
      "INSERT INTO stock_movements VALUES(?,?,?,?,?)",
      id(),
      pid,
      quantity,
      "purchase_received",
      now(),
    );
    s.audit(u, "stock.received", pid);
    return { ok: true };
  });
}
