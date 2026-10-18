export default function Privacy() {
  return (
    <main className="legal">
      <a href="/">← Back to MD One</a>
      <h1>Your privacy, at home.</h1>
      <p>Draft notice · Local demonstration · 18 October 2026</p>
      <h2>What this demo stores</h2>
      <p>
        Synthetic account profiles, memberships, orders, rides, posts, RSVPs,
        expenses, loan records, preferences, service tickets, and encrypted
        document uploads in a local database on this computer. Role selection is
        a demonstration tool, not secure production authentication.
      </p>
      <h2>Private by default</h2>
      <p>
        Document and finance access is checked against the signed-in account. An
        owner or association role cannot automatically read another person's
        vault or finances. Demo vault confirmation expires after five minutes.
        File uploads remain quarantined pending a real malware scanner; only the
        exact synthetic sample is available immediately.
      </p>
      <h2>Your choices</h2>
      <p>
        Export your account records from Profile. Delete individual documents
        and financial entries, revoke document shares, leave events, and opt out
        of the wider network. Account deletion erases private records and
        expires memberships; demo operational orders and audit records remain
        for integrity. Export currently includes JSON records, not document
        attachments.
      </p>
      <h2>Before a real launch</h2>
      <p>
        This draft must be replaced with the actual operator identity, contact,
        retention periods, provider/subprocessor list, deletion exceptions,
        incident procedures, and consent flows. No government, bank, payment,
        tracking, or push provider is connected. Never put real identity or bank
        documents in this demo.
      </p>
      <a href="/support">Support and launch information →</a>
    </main>
  );
}
