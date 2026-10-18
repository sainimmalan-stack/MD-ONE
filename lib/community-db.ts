import type { DatabaseSync } from "node:sqlite";

/** Labels change only after the entire proposed mapping has passed collision checks. */
export function numericFlatMapping(db: DatabaseSync) {
  const rows = db.prepare("SELECT id,project_id,label FROM flats").all() as {
    id: string;
    project_id: string;
    label: string;
  }[];
  const mapping = rows.map((r) => ({
    ...r,
    numeric:
      r.label.match(/(?:^|[\s-])(\d+)$/)?.[1] ||
      (/^\d+$/.test(r.label) ? r.label : ""),
  }));
  const seen = new Map<string, string>();
  for (const r of mapping) {
    const key = `${r.project_id}:${r.numeric}`;
    if (!r.numeric || seen.has(key))
      throw new Error(
        `Flat register requires correction: ${JSON.stringify(mapping.map((x) => ({ id: x.id, project: x.project_id, from: x.label, to: x.numeric })))}`,
      );
    seen.set(key, r.id);
  }
  return mapping;
}
export function migrateCommunity(db: DatabaseSync) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS committee_appointments(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),position TEXT CHECK(position IN ('president','vice_president')),status TEXT CHECK(status IN ('invited','accepted','active','revoked','resigned')),appointed_by TEXT,appointed_at TEXT,accepted_at TEXT,starts TEXT,ends TEXT);
  CREATE UNIQUE INDEX IF NOT EXISTS committee_position ON committee_appointments(project_id,position) WHERE status='active';
  CREATE UNIQUE INDEX IF NOT EXISTS committee_person ON committee_appointments(project_id,user_id) WHERE status='active';
  CREATE TABLE IF NOT EXISTS project_settings(project_id TEXT PRIMARY KEY REFERENCES projects(id),enabled INTEGER DEFAULT 0,start_date TEXT,policy TEXT NOT NULL DEFAULT '{}',opening_cash INTEGER DEFAULT 0,opening_reserve INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS flat_liability(flat_id TEXT PRIMARY KEY REFERENCES flats(id),project_id TEXT REFERENCES projects(id),payer_id TEXT REFERENCES users(id),area INTEGER,area_verified INTEGER DEFAULT 0,opening_due INTEGER DEFAULT 0,exemption INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS billing_periods(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),month TEXT,state TEXT CHECK(state IN ('draft','review','published','closed')),snapshot TEXT,UNIQUE(project_id,month));
  CREATE TABLE IF NOT EXISTS flat_invoices(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),period_id TEXT REFERENCES billing_periods(id),flat_id TEXT REFERENCES flats(id),payer_id TEXT REFERENCES users(id),due_date TEXT,lines TEXT,amount INTEGER,UNIQUE(period_id,flat_id));
  CREATE TABLE IF NOT EXISTS invoice_adjustments(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),invoice_id TEXT REFERENCES flat_invoices(id),amount INTEGER,reason TEXT,created TEXT,effective_month TEXT,actor TEXT);
  CREATE TABLE IF NOT EXISTS payment_submissions(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),invoice_id TEXT REFERENCES flat_invoices(id),amount INTEGER,reference TEXT,attachment_id TEXT,status TEXT DEFAULT 'submitted',created TEXT,request_key TEXT,UNIQUE(user_id,request_key));
  CREATE UNIQUE INDEX IF NOT EXISTS unique_project_payment_reference ON payment_submissions(project_id,reference);
  CREATE TABLE IF NOT EXISTS project_receipts(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),submission_id TEXT UNIQUE,amount INTEGER,allocated INTEGER,date TEXT,verified_by TEXT);
  CREATE TABLE IF NOT EXISTS credit_allocations(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT,invoice_id TEXT,amount INTEGER,created TEXT);
  CREATE TABLE IF NOT EXISTS project_expense_bills(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),category TEXT,description TEXT,period TEXT,vendor TEXT,bill_date TEXT,bill_number TEXT,amount INTEGER,due_date TEXT,status TEXT,created_by TEXT,reviewed_by TEXT,attachment_id TEXT,redacted_attachment_id TEXT,details TEXT,service_request_id TEXT UNIQUE,created TEXT,UNIQUE(project_id,vendor,bill_number));
  CREATE TABLE IF NOT EXISTS project_expense_payments(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),bill_id TEXT REFERENCES project_expense_bills(id),amount INTEGER,date TEXT,method TEXT,reference TEXT,actor TEXT,request_key TEXT,UNIQUE(project_id,request_key));
  CREATE TABLE IF NOT EXISTS project_cash(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),fund TEXT CHECK(fund IN ('general','reserve')),amount INTEGER,date TEXT,source TEXT UNIQUE,description TEXT);
  CREATE TABLE IF NOT EXISTS project_attachments(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),owner_id TEXT,name TEXT,mime TEXT,encrypted TEXT,visibility TEXT CHECK(visibility IN ('private','redacted')),created TEXT);
  CREATE TABLE IF NOT EXISTS project_questions(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),category TEXT,subject TEXT,body TEXT,visibility TEXT,status TEXT,assigned_to TEXT,attachment_id TEXT,faq_consent INTEGER DEFAULT 0,created TEXT);
  CREATE TABLE IF NOT EXISTS project_replies(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),question_id TEXT REFERENCES project_questions(id),user_id TEXT,body TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS project_history(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),actor TEXT,kind TEXT,target TEXT,details TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS project_operations(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),kind TEXT,title TEXT,payload TEXT,created_by TEXT,created TEXT);
  CREATE TABLE IF NOT EXISTS project_votes(project_id TEXT,operation_id TEXT,user_id TEXT,choice TEXT,PRIMARY KEY(operation_id,user_id));
  CREATE TABLE IF NOT EXISTS exchange_listings(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),user_id TEXT REFERENCES users(id),title TEXT,description TEXT,category TEXT,condition TEXT,type TEXT,price INTEGER,audience TEXT,status TEXT,photos TEXT,exchange_preference TEXT,created TEXT,expires TEXT,request_key TEXT,UNIQUE(user_id,request_key));
  CREATE TABLE IF NOT EXISTS exchange_saves(user_id TEXT,listing_id TEXT,PRIMARY KEY(user_id,listing_id));
  CREATE TABLE IF NOT EXISTS exchange_conversations(id TEXT PRIMARY KEY,listing_id TEXT REFERENCES exchange_listings(id),buyer_id TEXT REFERENCES users(id),created TEXT,UNIQUE(listing_id,buyer_id));
  CREATE TABLE IF NOT EXISTS exchange_messages(id TEXT PRIMARY KEY,conversation_id TEXT REFERENCES exchange_conversations(id),user_id TEXT,body TEXT,created TEXT,request_key TEXT,UNIQUE(user_id,request_key));
  CREATE TABLE IF NOT EXISTS exchange_reports(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,target_id TEXT,reason TEXT,status TEXT,created TEXT);
  `);
  if (db.prepare("SELECT id FROM app_migrations WHERE id='community-v1'").get())
    return;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const r of numericFlatMapping(db))
      db.prepare("UPDATE flats SET label=? WHERE id=?").run(r.numeric, r.id);
    db.exec(`INSERT INTO project_settings(project_id) SELECT id FROM projects;
      INSERT INTO committee_appointments VALUES('demo-president','p1','neighbor','president','active','platform',datetime('now'),datetime('now'),'2026-01-01','2028-01-01');
      INSERT INTO committee_appointments VALUES('demo-vp','p1','resident','vice_president','active','platform',datetime('now'),datetime('now'),'2026-01-01','2028-01-01');
      INSERT INTO flat_liability(flat_id,project_id,payer_id) VALUES('f1','p1','resident'),('f2','p1','neighbor');
      UPDATE project_settings SET enabled=1,start_date='2026-10-01',policy='{"mode":"fixed","amount":250000,"dueDay":10,"categories":["Security","Electricity","Water","Repairs","Cleaning"],"independentReview":true,"approvalThreshold":100000}' WHERE project_id='p1';
      INSERT INTO project_operations VALUES('demo-notice','p1','notice','Water tank cleaning • Sunday','{"body":"Synthetic notice: water supply pauses 10 am–12 pm. Please plan ahead."}','neighbor',datetime('now'));
      INSERT INTO exchange_listings VALUES('demo-exchange-chair','p1','neighbor','A reading chair, ready for a new corner','Synthetic listing. A comfortable occasional chair; discuss collection privately.','Furniture','Good','sale',250000,'project','active','[]','',datetime('now'),'2028-01-01','demo-chair');
      INSERT INTO exchange_listings VALUES('demo-exchange-books','p4','sky-resident','Stories looking for their next reader','Synthetic listing. A small collection of well-loved books.','Books','Good','free',0,'network','active','[]','',datetime('now'),'2028-01-01','demo-books');
      INSERT INTO app_migrations VALUES('community-v1',datetime('now'));`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
