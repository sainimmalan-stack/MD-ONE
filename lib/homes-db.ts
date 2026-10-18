import type { DatabaseSync } from "node:sqlite";
export function migrateHomes(db: DatabaseSync) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS home_listings(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),flat_id TEXT NOT NULL REFERENCES flats(id),purpose TEXT NOT NULL CHECK(purpose IN ('rent','sale')),title TEXT NOT NULL,description TEXT NOT NULL,bhk INTEGER NOT NULL,area INTEGER NOT NULL,floor INTEGER NOT NULL,furnishing TEXT NOT NULL,parking INTEGER NOT NULL,available TEXT NOT NULL,price INTEGER NOT NULL,deposit INTEGER NOT NULL,photos TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('available','rented','sold','withdrawn')),created TEXT NOT NULL,expires TEXT NOT NULL,request_key TEXT NOT NULL,UNIQUE(owner_id,request_key));
 CREATE UNIQUE INDEX IF NOT EXISTS home_one_active_offer ON home_listings(flat_id,purpose) WHERE status='available';
 CREATE INDEX IF NOT EXISTS home_discovery ON home_listings(status,purpose,expires);
 CREATE TABLE IF NOT EXISTS home_interests(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES home_listings(id),user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','withdrawn')),created TEXT NOT NULL,UNIQUE(listing_id,user_id));
 CREATE TABLE IF NOT EXISTS home_contacts(listing_id TEXT NOT NULL REFERENCES home_listings(id),user_id TEXT NOT NULL REFERENCES users(id),contact TEXT NOT NULL,PRIMARY KEY(listing_id,user_id));
`);
}
