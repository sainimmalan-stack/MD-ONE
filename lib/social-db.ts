import type { DatabaseSync } from "node:sqlite";
export function migrateSocial(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS social_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),bio TEXT DEFAULT '',occupation TEXT DEFAULT '',contact TEXT DEFAULT '',contact_visibility TEXT DEFAULT 'friends',avatar TEXT DEFAULT '',locked INTEGER DEFAULT 1,discoverable INTEGER DEFAULT 0,network_visible INTEGER DEFAULT 0,updated TEXT);
 CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY,sender_id TEXT REFERENCES users(id),recipient_id TEXT REFERENCES users(id),status TEXT CHECK(status IN ('pending','accepted','declined','cancelled')),created TEXT,updated TEXT,CHECK(sender_id<>recipient_id));
 CREATE UNIQUE INDEX IF NOT EXISTS friendship_pair ON friendships(min(sender_id,recipient_id),max(sender_id,recipient_id));
 CREATE TABLE IF NOT EXISTS blocks(user_id TEXT,target_id TEXT,created TEXT,PRIMARY KEY(user_id,target_id));
 CREATE TABLE IF NOT EXISTS post_likes(post_id TEXT REFERENCES posts(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(post_id,user_id));
 CREATE TABLE IF NOT EXISTS post_comments(id TEXT PRIMARY KEY,post_id TEXT REFERENCES posts(id),user_id TEXT,body TEXT,created TEXT);
 CREATE TABLE IF NOT EXISTS social_reports(id TEXT PRIMARY KEY,user_id TEXT,target_kind TEXT,target_id TEXT,reason TEXT,status TEXT DEFAULT 'open',created TEXT);
 CREATE TABLE IF NOT EXISTS service_catalog(id TEXT PRIMARY KEY,name TEXT,description TEXT,icon TEXT);
 CREATE TABLE IF NOT EXISTS technicians(id TEXT PRIMARY KEY,user_id TEXT UNIQUE REFERENCES users(id),name TEXT,trade TEXT REFERENCES service_catalog(id),status TEXT,simulation INTEGER DEFAULT 1);
 CREATE TABLE IF NOT EXISTS service_requests(id TEXT PRIMARY KEY,user_id TEXT,flat_id TEXT REFERENCES flats(id),category_id TEXT REFERENCES service_catalog(id),description TEXT,preferred TEXT,urgency TEXT,status TEXT,technician_id TEXT REFERENCES technicians(id),created TEXT,updated TEXT);
 CREATE TABLE IF NOT EXISTS service_history(id TEXT PRIMARY KEY,request_id TEXT REFERENCES service_requests(id),actor_id TEXT,status TEXT,note TEXT,created TEXT);
 CREATE TABLE IF NOT EXISTS app_migrations(id TEXT PRIMARY KEY,applied TEXT);`);
  const cols = db.prepare("PRAGMA table_info(posts)").all() as {
    name: string;
  }[];
  for (const [col, def] of [
    ["visibility", "TEXT DEFAULT 'project'"],
    ["image", "TEXT DEFAULT ''"],
    ["post_kind", "TEXT DEFAULT 'update'"],
  ])
    if (!cols.some((c) => c.name === col))
      db.exec(`ALTER TABLE posts ADD COLUMN ${col} ${def}`);
  if (db.prepare("SELECT id FROM app_migrations WHERE id='social-v1'").get())
    return;
  db.exec("BEGIN IMMEDIATE");
  try {
    const ts = new Date().toISOString();
    for (const [u, bio, occupation, locked, discover, network] of [
      [
        "resident",
        "Finding joy in the everyday. Coffee, plants & good neighbours.",
        "Product designer",
        0,
        1,
        1,
      ],
      [
        "neighbor",
        "Weekend cyclist. Always up for a good conversation.",
        "Software engineer",
        1,
        1,
        1,
      ],
      [
        "outsider",
        "Food, family and a little balcony gardening.",
        "Architect",
        0,
        1,
        1,
      ],
      ["owner", "Building our next chapter.", "Entrepreneur", 1, 0, 0],
      ["pending", "", "", 1, 0, 0],
    ])
      db.prepare(
        "INSERT OR IGNORE INTO social_profiles(user_id,bio,occupation,locked,discoverable,network_visible,updated) VALUES(?,?,?,?,?,?,?)",
      ).run(u, bio, occupation, locked, discover, network, ts);
    // Explicit synthetic Skylark flats demonstrate the requested 101/102/103 journey.
    // They are not inferred from website's published count of 15 residences.
    for (const [f, l] of [
      ["sky101", "DEMO 101"],
      ["sky102", "DEMO 102"],
      ["sky103", "DEMO 103"],
    ])
      db.prepare("INSERT OR IGNORE INTO flats VALUES(?,?,?)").run(f, "p4", l);
    for (const [uid, name, flat, bio, occupation, locked] of [
      [
        "sky-resident",
        "Rhea Sharma",
        "sky101",
        "A photographer who believes the best stories start at home.",
        "Photographer",
        0,
      ],
      [
        "sky-neighbor",
        "Aditya Varma",
        "sky102",
        "Designing things. Growing plants. Learning the guitar.",
        "UX designer",
        1,
      ],
      [
        "sky-family",
        "Neha Menon",
        "sky103",
        "A little baking, a little reading, a lot of community.",
        "Educator",
        0,
      ],
    ]) {
      db.prepare("INSERT OR IGNORE INTO users(id,name,role) VALUES(?,?,?)").run(
        uid,
        name,
        "resident",
      );
      db.prepare("INSERT INTO memberships VALUES(?,?,?,?,?,?,NULL)").run(
        "m-" + uid,
        uid,
        flat,
        "tenant",
        "approved",
        ts,
      );
      db.prepare(
        "INSERT OR IGNORE INTO social_profiles(user_id,bio,occupation,locked,discoverable,network_visible,updated) VALUES(?,?,?,?,?,?,?)",
      ).run(uid, bio, occupation, locked, 1, 1, ts);
    }
    const categories = [
      [
        "plumbing",
        "Plumbing",
        "Leaks, fittings, taps & water lines",
        "Droplets",
      ],
      ["electrical", "Electrical", "Switches, wiring, lights & power", "Zap"],
      [
        "tiles",
        "Tiles & stone",
        "Repairs, retiling & finishing work",
        "Grid2X2",
      ],
      ["painting", "Painting", "A fresh coat, inside and out", "Paintbrush"],
      ["carpentry", "Carpentry", "Doors, cabinets & small fixes", "Hammer"],
      [
        "cleaning",
        "Deep cleaning",
        "A little reset for your space",
        "Sparkles",
      ],
      [
        "waterproofing",
        "Waterproofing",
        "Damp walls, seepage & sealing",
        "Umbrella",
      ],
      ["ac", "AC care", "Servicing, installation & repairs", "Wind"],
    ];
    for (const c of categories)
      db.prepare("INSERT OR IGNORE INTO service_catalog VALUES(?,?,?,?)").run(
        ...c,
      );
    db.prepare(
      "INSERT OR IGNORE INTO users(id,name,role) VALUES('service','MDP Service Desk','services')",
    ).run();
    for (const [tid, uid, name, trade] of [
      ["t1", "tech1", "Ravi · Demo specialist", "plumbing"],
      ["t2", "tech2", "Imran · Demo specialist", "electrical"],
      ["t3", "tech3", "Suresh · Demo specialist", "tiles"],
      ["t4", "tech4", "Prakash · Demo specialist", "painting"],
      ["t5", "tech5", "Hari · Demo specialist", "carpentry"],
      ["t6", "tech6", "Sana · Demo specialist", "cleaning"],
    ]) {
      db.prepare("INSERT OR IGNORE INTO users(id,name,role) VALUES(?,?,?)").run(
        uid,
        name,
        "technician",
      );
      db.prepare("INSERT OR IGNORE INTO technicians VALUES(?,?,?,?,?,?)").run(
        tid,
        uid,
        name,
        trade,
        "available",
        1,
      );
    }
    const seeds = [
      [
        "social1",
        "sky-resident",
        "p4",
        "The light at Skylark this evening. Some days, your own balcony is the best place to be.",
        "network",
        "architecture",
      ],
      [
        "social2",
        "neighbor",
        "p1",
        "Anyone up for an early morning cycle ride this weekend? Ameenpur → the lake, followed by chai.",
        "friends",
        "update",
      ],
      [
        "social3",
        "outsider",
        "p2",
        "First tomato harvest from our balcony! Happy to swap gardening tips with fellow plant parents.",
        "network",
        "garden",
      ],
    ];
    for (const [pid, uid, p, body, vis, kind] of seeds)
      db.prepare(
        "INSERT OR IGNORE INTO posts(id,user_id,project_id,body,created,status,visibility,image,post_kind) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(pid, uid, p, body, ts, "published", vis, "", kind);
    db.prepare("INSERT INTO app_migrations VALUES(?,?)").run("social-v1", ts);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
