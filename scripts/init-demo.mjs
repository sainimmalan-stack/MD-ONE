import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync(".local", { recursive: true, mode: 0o700 });
// Keep secret generation outside bundled app code and preserve the previous demo key.
if (!existsSync(".local/vault.key"))
  writeFileSync(".local/vault.key", randomBytes(32), {
    mode: 0o600,
    flag: "wx",
  });
const current = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
  : "";
if (!/^MDP_LOCAL_VAULT_KEY=/m.test(current)) {
  const line =
    "\nMDP_LOCAL_VAULT_KEY=" +
    readFileSync(".local/vault.key").toString("hex") +
    "\n";
  if (existsSync(".env.local"))
    appendFileSync(".env.local", line, { mode: 0o600 });
  else
    writeFileSync(
      ".env.local",
      "# Local demo only. Never commit this file.\n" + line,
      { mode: 0o600, flag: "wx" },
    );
}
console.log("Local demo storage initialized. No secrets printed.");
