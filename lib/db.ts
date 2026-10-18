import {AsyncLocalStorage} from "node:async_hooks";
import { migrateHomes } from "./homes-db.ts";
import { DatabaseSync } from "node:sqlite";
import { migrateRetail } from "./retail.ts";
import { migrateCommunity } from "./community-db.ts";
import { migrateSocial } from "./social-db.ts";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export type Row = Record<string, any>;
export const projects = [
  "Nest",
  "Casa",
  "Avasa",
  "Skylark",
  "Glenmore",
  "Hillock",
  "Summit",
  "Griffin",
  "Selene",
  "Atlantis",
  "Perch",
  "Solace",
  "Zenith",
  "Aurelia",
  "Elysium",
  "Aura",
  "Echelon",
  "Vale",
  "Ivy",
];
export function openDatabase(
  path = process.env.MDP_DATABASE || ".local/mdp.sqlite",
) {
  if ((process.env.MDP_MODE || "demo") !== "demo")
    throw new Error(
      "Production adapter not configured. Demo backend cannot run in production mode.",
    );
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  return initializeDemo(new DatabaseSync(path));
}
function initializeDemo(db:DatabaseSync){
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,project_id TEXT,deleted INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires TEXT,stepup_until TEXT);
  CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT,status TEXT);
  CREATE TABLE IF NOT EXISTS services(project_id TEXT PRIMARY KEY REFERENCES projects(id),groceries INTEGER DEFAULT 0,carpool INTEGER DEFAULT 0,maintenance INTEGER DEFAULT 0,simulation INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS flats(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),label TEXT);
  CREATE TABLE IF NOT EXISTS ownership(user_id TEXT REFERENCES users(id),flat_id TEXT REFERENCES flats(id),PRIMARY KEY(user_id,flat_id));
  CREATE TABLE IF NOT EXISTS memberships(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),flat_id TEXT REFERENCES flats(id),kind TEXT,status TEXT,move_in TEXT,move_out TEXT);
  CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT,category TEXT,unit TEXT,price INTEGER,cost INTEGER,stock INTEGER CHECK(stock>=0),emoji TEXT,featured INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,product_id TEXT REFERENCES products(id),quantity INTEGER CHECK(quantity>=0),expiry TEXT,supplier TEXT);
  CREATE TABLE IF NOT EXISTS stock_movements(id TEXT PRIMARY KEY,product_id TEXT,quantity INTEGER,reason TEXT,at TEXT);
  CREATE TABLE IF NOT EXISTS riders(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),name TEXT,bike TEXT UNIQUE,status TEXT,range_km INTEGER,charging INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),flat_id TEXT REFERENCES flats(id),status TEXT,payment TEXT,total INTEGER,subtotal INTEGER,fee INTEGER,cost INTEGER,slot TEXT,rider_id TEXT REFERENCES riders(id),otp_hash TEXT,created TEXT,substitution TEXT);
  CREATE TABLE IF NOT EXISTS order_items(order_id TEXT REFERENCES orders(id),product_id TEXT REFERENCES products(id),name TEXT,quantity INTEGER,price INTEGER,cost INTEGER,PRIMARY KEY(order_id,product_id));
  CREATE TABLE IF NOT EXISTS order_batches(order_id TEXT,batch_id TEXT,quantity INTEGER,PRIMARY KEY(order_id,batch_id));
  CREATE TABLE IF NOT EXISTS idempotency(user_id TEXT,key TEXT,request_hash TEXT,result TEXT,PRIMARY KEY(user_id,key));
  CREATE TABLE IF NOT EXISTS rides(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),project_id TEXT REFERENCES projects(id),destination TEXT,pickup TEXT,departure TEXT,seats INTEGER CHECK(seats>=0),contribution INTEGER,recurrence TEXT,status TEXT);
  CREATE TABLE IF NOT EXISTS ride_requests(id TEXT PRIMARY KEY,ride_id TEXT REFERENCES rides(id),user_id TEXT REFERENCES users(id),status TEXT,UNIQUE(ride_id,user_id));
  CREATE TABLE IF NOT EXISTS ride_contacts(ride_id TEXT REFERENCES rides(id),user_id TEXT REFERENCES users(id),contact TEXT NOT NULL,PRIMARY KEY(ride_id,user_id));
  CREATE INDEX IF NOT EXISTS rides_discovery ON rides(status,departure);
  CREATE INDEX IF NOT EXISTS ride_requests_inbox ON ride_requests(user_id,status);
  CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,project_id TEXT,title TEXT,category TEXT,starts TEXT,place TEXT,description TEXT,capacity INTEGER,budget INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS rsvps(event_id TEXT REFERENCES events(id),user_id TEXT REFERENCES users(id),volunteer INTEGER DEFAULT 0,PRIMARY KEY(event_id,user_id));
  CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,user_id TEXT,project_id TEXT,body TEXT,created TEXT,status TEXT DEFAULT 'published');
  CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,target_id TEXT,reason TEXT,status TEXT DEFAULT 'open');
  CREATE TABLE IF NOT EXISTS expenses(id TEXT PRIMARY KEY,user_id TEXT,description TEXT,category TEXT,amount INTEGER CHECK(amount>0),kind TEXT,date TEXT);
  CREATE TABLE IF NOT EXISTS loans(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,principal INTEGER,rate REAL,months INTEGER,due_day INTEGER);
  CREATE TABLE IF NOT EXISTS loan_payments(id TEXT PRIMARY KEY,loan_id TEXT REFERENCES loans(id),user_id TEXT,month TEXT,amount INTEGER,status TEXT,UNIQUE(loan_id,month));
  CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,user_id TEXT,project_id TEXT,category TEXT,description TEXT,status TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS dues(id TEXT PRIMARY KEY,user_id TEXT,flat_id TEXT,title TEXT,amount INTEGER,status TEXT);
  CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,folder TEXT,mime TEXT,encrypted TEXT,status TEXT,expires TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS shares(id TEXT PRIMARY KEY,document_id TEXT REFERENCES documents(id),owner_id TEXT,recipient_id TEXT,expires TEXT,revoked INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS preferences(user_id TEXT PRIMARY KEY,language TEXT DEFAULT 'en',notifications INTEGER DEFAULT 1,network INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT,target TEXT,at TEXT);
  CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT,payload TEXT,due TEXT,status TEXT DEFAULT 'pending');
  CREATE TABLE IF NOT EXISTS webhook_events(id TEXT PRIMARY KEY,provider TEXT,processed TEXT);`);
  if (!(db.prepare("SELECT COUNT(*) n FROM projects").get() as Row).n) {
    db.exec("BEGIN IMMEDIATE");
    try {
      seed(db);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  migrateSocial(db);
  migrateCommunity(db);
  migrateHomes(db);
  migrateRetail(db);
  return db;
}
/** Synthetic fixture database only. No filesystem path or production adapter is accepted. */
export function createShowcaseDatabase(){return initializeDemo(new DatabaseSync(':memory:'));}
const syntheticVault = new AsyncLocalStorage<Buffer>();
export function withSyntheticVault<T>(key:Buffer,work:()=>T):T{return syntheticVault.run(key,work);}
export function seed(db: DatabaseSync) {
  for (let i = 0; i < projects.length; i++) {
    const p = `p${i + 1}`;
    db.prepare("INSERT INTO projects VALUES(?,?,?)").run(
      p,
      `My Dream ${projects[i]}`,
      i < 13 ? "completed" : "ongoing",
    );
    db.prepare(
      "INSERT INTO services(project_id,groceries,carpool,maintenance) VALUES(?,?,?,?)",
    ).run(p, i === 0 ? 1 : 0, i < 2 ? 1 : 0, i === 0 ? 1 : 0);
  }
  const users = [
    ["resident", "Ananya Rao", "resident", null],
    ["neighbor", "Kiran Dev", "resident", null],
    ["outsider", "Maya Das", "resident", null],
    ["owner", "Demo Owner", "resident", null],
    ["pending", "New Resident", "resident", null],
    ["admin", "Community Manager", "association", "p1"],
    ["warehouse", "Warehouse Team", "warehouse", null],
    ["rider1", "Arjun · Delivery", "delivery", null],
    ["rider2", "Meera · Delivery", "delivery", null],
    ["platform", "Platform Operations", "platform", null],
  ];
  for (const u of users)
    db.prepare(
      "INSERT INTO users(id,name,role,project_id) VALUES(?,?,?,?)",
    ).run(...u);
  for (const [f, p, l] of [
    ["f1", "p1", "DEMO A-101"],
    ["f2", "p1", "DEMO A-102"],
    ["f3", "p2", "DEMO B-201"],
    ["f4", "p14", "DEMO C-101"],
  ])
    db.prepare("INSERT INTO flats VALUES(?,?,?)").run(f, p, l);
  for (const [u, f, k, s] of [
    ["resident", "f1", "tenant", "approved"],
    ["neighbor", "f2", "owner", "approved"],
    ["outsider", "f3", "tenant", "approved"],
    ["owner", "f4", "owner", "approved"],
    ["pending", "f1", "tenant", "pending"],
  ])
    db.prepare("INSERT INTO memberships VALUES(?,?,?,?,?,?,NULL)").run(
      id(),
      u,
      f,
      k,
      s,
      now(),
    );
  db.prepare("INSERT INTO ownership VALUES(?,?)").run("owner", "f1");
  db.prepare("INSERT INTO ownership VALUES(?,?)").run("owner", "f4");
  db.prepare("INSERT INTO ownership VALUES(?,?)").run("neighbor", "f2");
  const products = [
    ["milk", "Fresh toned milk", "Dairy", "500 ml", 3000, 2500, 35, "🥛", 1],
    ["eggs", "Farm fresh eggs", "Dairy", "6 pieces", 5400, 4400, 20, "🥚", 1],
    [
      "banana",
      "Yelakki bananas",
      "Fruits",
      "500 g pack",
      4500,
      3200,
      24,
      "🍌",
      1,
    ],
    [
      "tomato",
      "Fresh tomatoes",
      "Vegetables",
      "500 g pack",
      2400,
      1500,
      30,
      "🍅",
      1,
    ],
    ["onion", "Red onions", "Vegetables", "1 kg pack", 4200, 3000, 25, "🧅", 0],
    [
      "rice",
      "Premium sona masoori",
      "Staples",
      "5 kg",
      34900,
      28500,
      12,
      "🌾",
      0,
    ],
    ["bread", "Whole wheat bread", "Bakery", "400 g", 5000, 3900, 14, "🍞", 1],
    [
      "apple",
      "Royal gala apples",
      "Fruits",
      "4 pieces",
      14900,
      11000,
      15,
      "🍎",
      0,
    ],
    ["curd", "Fresh set curd", "Dairy", "500 g", 4500, 3500, 25, "🥣", 0],
    [
      "spinach",
      "Tender spinach",
      "Vegetables",
      "250 g",
      2000,
      1200,
      20,
      "🥬",
      0,
    ],
    [
      "soap",
      "Gentle bath soap",
      "Personal care",
      "100 g",
      3800,
      2800,
      18,
      "🧼",
      0,
    ],
    [
      "cleaner",
      "Floor cleaner",
      "Cleaning",
      "1 litre",
      17900,
      13500,
      12,
      "🫧",
      0,
    ],
    ["snacks", "Roasted makhana", "Snacks", "100 g", 9900, 7000, 15, "🍿", 0],
    [
      "tea",
      "Everyday leaf tea",
      "Beverages",
      "250 g",
      12500,
      9500,
      12,
      "🫖",
      0,
    ],
  ];
  for (const p of products) {
    db.prepare("INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?)").run(...p);
    db.prepare("INSERT INTO batches VALUES(?,?,?,?,?)").run(
      id(),
      p[0],
      p[6],
      new Date(Date.now() + 7 * 86400000).toISOString(),
      "Demo supplier",
    );
  }
  db.prepare("INSERT INTO riders VALUES(?,?,?,?,?,?,?)").run(
    "r1",
    "rider1",
    "Arjun",
    "EV-01",
    "available",
    60,
    0,
  );
  db.prepare("INSERT INTO riders VALUES(?,?,?,?,?,?,?)").run(
    "r2",
    "rider2",
    "Meera",
    "EV-02",
    "available",
    55,
    0,
  );
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setUTCHours(3, 30, 0, 0);
  db.prepare("INSERT INTO rides VALUES(?,?,?,?,?,?,?,?,?,?)").run(
    "ride1",
    "neighbor",
    "p1",
    "Financial District",
    "Ameenpur main road",
    tomorrow.toISOString(),
    3,
    7000,
    "Weekdays (demo instance)",
    "open",
  );
  db.prepare("INSERT INTO rides VALUES(?,?,?,?,?,?,?,?,?,?)").run(
    "ride2",
    "outsider",
    "p2",
    "HITEC City",
    "Ameenpur junction",
    new Date(tomorrow.getTime() + 1800000).toISOString(),
    2,
    5000,
    "One-time",
    "open",
  );
  const events = [
    [
      "event1",
      "p1",
      "An evening, together",
      "Cultural",
      2,
      "Community courtyard",
      "A resident-led evening of lights, music, and good food. Everyone is welcome.",
      60,
      1500000,
    ],
    [
      "event2",
      null,
      "MDP weekend walk",
      "Wellness",
      5,
      "Ameenpur meeting point",
      "Meet neighbours across our communities. Opt into the MDP network to join.",
      40,
      0,
    ],
    [
      "event3",
      "p2",
      "Neighbours’ potluck",
      "Social",
      3,
      "Community room",
      "Bring a dish, share a story.",
      25,
      0,
    ],
  ];
  for (const [eid, p, t, c, days, place, d, cap, budget] of events)
    db.prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)").run(
      eid,
      p,
      t,
      c,
      new Date(Date.now() + Number(days) * 86400000).toISOString(),
      place,
      d,
      cap,
      budget,
    );
  db.prepare(
    "INSERT INTO posts(id,user_id,project_id,body,created,status) VALUES(?,?,?,?,?,?)",
  ).run(
    "post1",
    "admin",
    "p1",
    "Welcome to MDP Living. This is a demo community: explore essentials, meet your neighbours, and make yourself at home.",
    now(),
    "published",
  );
  db.prepare("INSERT INTO expenses VALUES(?,?,?,?,?,?,?)").run(
    "expense1",
    "resident",
    "Weekly groceries",
    "Groceries",
    168000,
    "expense",
    now().slice(0, 10),
  );
  db.prepare("INSERT INTO expenses VALUES(?,?,?,?,?,?,?)").run(
    "expense2",
    "resident",
    "Internet",
    "Bills",
    79900,
    "expense",
    now().slice(0, 10),
  );
  db.prepare("INSERT INTO loans VALUES(?,?,?,?,?,?,?)").run(
    "loan1",
    "resident",
    "Home loan · demo",
    350000000,
    8.5,
    240,
    5,
  );
  db.prepare("INSERT INTO dues VALUES(?,?,?,?,?,?)").run(
    "due1",
    "resident",
    "f1",
    "Monthly maintenance · demo",
    250000,
    "due",
  );
  db.prepare("INSERT INTO preferences(user_id) VALUES(?)").run("resident");
}
let singleton: DatabaseSync | undefined;
export const getDb = () => (singleton ||= openDatabase());
function key() {
  const synthetic=syntheticVault.getStore();if(synthetic)return synthetic;
  const encoded = process.env.MDP_LOCAL_VAULT_KEY;
  if (!encoded || !/^[a-f0-9]{64}$/i.test(encoded))
    throw new Error(
      "Local vault key missing. Run node scripts/init-demo.mjs before starting the demo.",
    );
  return Buffer.from(encoded, "hex");
}
export function encrypt(data: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(data),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(data: string) {
  const b = Buffer.from(data, "base64"),
    decipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(-16));
  return Buffer.concat([
    decipher.update(b.subarray(12, -16)),
    decipher.final(),
  ]);
}
