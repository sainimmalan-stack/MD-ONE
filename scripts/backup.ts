import { backup } from "node:sqlite";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "../lib/db.ts";
const target = process.argv[2];
if (!target)
  throw new Error(
    "Usage: node --experimental-transform-types scripts/backup.ts <backup-directory>",
  );
mkdirSync(target, { recursive: true, mode: 0o700 });
const db = openDatabase();
await backup(db, resolve(target, "mdp.sqlite"));
db.close();
if (existsSync(".local/vault.key"))
  copyFileSync(".local/vault.key", resolve(target, "vault.key"));
console.log(
  "Local database and vault key backed up. Protect both files; neither should be committed.",
);
