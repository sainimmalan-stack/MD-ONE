import { parentPort, workerData } from "node:worker_threads";
import { openDatabase } from "../lib/db.ts";
import { Service } from "../lib/service.ts";
const db = openDatabase(workerData.file),
  s = new Service(db);
try {
  if (workerData.action === "checkout")
    s.checkout(s.one("SELECT * FROM users WHERE id='resident'")!, {
      flatId: "f1",
      key: crypto.randomUUID(),
      items: [{ id: "milk", qty: 20 }],
      payment: "cod",
      substitution: "none",
      slot: workerData.slot,
    });
  else
    s.rideAction(s.one("SELECT * FROM users WHERE id='neighbor'")!, "ride1", {
      action: "accept",
      requestId: workerData.requestId,
    });
  parentPort!.postMessage({ ok: true });
} catch (e) {
  parentPort!.postMessage({ ok: false, error: (e as Error).message });
} finally {
  db.close();
}
