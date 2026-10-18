# MDP Living implementation plan

Verified 18 October 2026 against https://mydreamprojects.in/projects and /about: 19 developments (13 completed, six ongoing); Ameenpur; founded 2020; Nimmala Sai and Kotapati Akhil. Official assets remain owned by MDP. No occupancy or service zone inferred from completion status.

Architecture: Next.js/TypeScript resident, warehouse, and rider interfaces; shared server-only domain service; transactional SQLite local demo; native Expo resident client using same API. Supabase PostgreSQL migration is a production foundation, not a connected production backend. No public hosting requested; work stays in this checkout.

Demo actors and flat labels are synthetic. Demo project service flags are explicit simulation records separate from official project status. Demo role switching is allowed only when MDP_MODE=demo; server defaults to demo and binds loopback via scripts. Refuse production startup until real identity, storage, provider, deployment and security review work is done.

Model: users; projects; flats; ownership; memberships; project service flags; inventory and batches; orders and immutable line prices; idempotency keys; riders and bikes; rides and seat requests; scoped events/RSVPs/posts; personal expenses/loans; private vault/quarantine/shares; tickets; dues; audit log. Personal records belong to people, not flats.

Screens: Home, Essentials/cart/orders, Carpool, Community/events, My Home/documents/expenses/EMI/services, Profile/membership/privacy; Operations dashboard with approval, inventory, fulfillment and two-rider dispatch; Delivery mobile queue.

Implementation order: local executable vertical slices with server access rules → community/carpool → personal tools and private encrypted demo vault → native client → production SQL and release/operations documentation → domain tests, build and browser QA. External providers must remain visibly unconfigured.
