import { Homes } from "./homes";
import { Governance } from "./governance";
import { Exchange } from "./exchange";
import { Service, fail } from "./service";
import type { Row } from "./db";
export function communityApi(
  s: Service,
  u: Row,
  p: string[],
  method: string,
  b: Row,
  q: Row,
): unknown {
  const g = new Governance(s),
    e = new Exchange(s),
    read = method === "GET";
  if (p[0] === "appointment-options" && read) return g.appointmentOptions(u);
  if (p[0] === "appointments") return g.appointments(u, read ? undefined : b);
  if (p[0] === "exchange-moderation")
    return e.moderate(u, read ? undefined : b);
  if (p[0] === "homes") {
    const homes = new Homes(s);
    if (!p[1]) return read ? homes.browse(u, q) : homes.create(u, b);
    if (read) return homes.detail(u, p[1]);
    if (p[2] === "action") return homes.action(u, p[1], b);
    fail("Home route not found.", 404);
  }
  if (p[0] === "exchange") {
    if (p[1] === "reports" && !read) return e.report(u, b);
    if (p[1] === "conversations") {
      if (!p[2]) return e.inbox(u);
      return read ? e.messages(u, p[2]) : e.message(u, p[2], b);
    }
    if (!p[1]) return read ? e.browse(u, q) : e.saveListing(u, b);
    if (read) return e.safe(e.listing(u, p[1]));
    if (p[2] === "action") return e.action(u, p[1], b);
    return e.saveListing(u, b, p[1]);
  }
  if (p[0] === "my-project") {
    if (!p[1])
      return { projects: g.memberships(u.id), invitations: g.appointments(u) };
    const pid = p[1];
    if (!p[2] && read) return g.workspace(u, pid);
    if (p[2] === "cash" && !read) return g.cashRecord(u, pid, b);
    if (p[2] === "annual" && read) return g.annual(u, pid, String(q.year));
    if (p[2] === "accounts" && read) return g.accounts(u, pid, String(q.month));
    if (p[2] === "settings" && !read) return g.configure(u, pid, b);
    if (p[2] === "billing" && !read) return g.billing(u, pid, b);
    if (p[2] === "adjustments" && !read) return g.adjustment(u, pid, b);
    if (p[2] === "payments" && !read) return g.submitPayment(u, pid, b);
    if (p[2] === "verify-payment" && !read) return g.verifyPayment(u, pid, b);
    if (p[2] === "apply-credit" && !read) return g.applyCredit(u, pid, b);
    if (p[2] === "expenses" && !read) return g.expense(u, pid, b);
    if (p[2] === "approve-expense" && !read) return g.approveExpense(u, pid, b);
    if (p[2] === "pay-expense" && !read) return g.payExpense(u, pid, b);
    if (p[2] === "attachments" && !read) return g.upload(u, pid, b);
    if (p[2] === "questions" && !read)
      return p[3] ? g.reply(u, pid, { ...b, id: p[3] }) : g.ask(u, pid, b);
    if (p[2] === "operations" && !read) return g.operation(u, pid, b);
    if (p[2] === "vote" && !read) return g.vote(u, pid, b);
    fail("Community route not found.", 404);
  }
  fail("Community route not found.", 404);
}
