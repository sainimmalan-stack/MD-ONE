# Source and asset ledger

Verified 18 October 2026:

- https://mydreamprojects.in — company identity, tagline, location.
- https://mydreamprojects.in/projects — 19 named developments, 13 completed and six ongoing.
- https://mydreamprojects.in/about — founders and 2020 founding.

Downloaded directly from official site, used in this owner's requested app:

- public/brand/mdp-icon.png ← https://mydreamprojects.in/assets/logo-icon.png
- public/brand/mdp-logo.png ← https://mydreamprojects.in/assets/logo-full-dark.png
- public/brand/nest.webp ← https://mydreamprojects.in/assets/projects/my-dream-nest/elevation-day.webp
  These remain MDP assets; confirm distribution rights with the owner before a third-party/public release. Building illustration and festival lamps are original CSS artwork; grocery emoji are platform glyphs, not catalog photography. Demo stock, prices, people, flat labels, events, dates, rides and services are synthetic.

Implementation references:

- https://nextjs.org/docs/app/getting-started/installation and installed next/dist/docs.
- https://docs.expo.dev/get-started/create-a-project/
- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/deploy/submit-to-app-stores/
- https://supabase.com/docs/guides/database/postgres/row-level-security

Expo SDK 58 native versions taken from installed expo/bundledNativeModules.json.

### Full project catalog refresh

`lib/project-catalog.json` was extracted without executing JavaScript from the official public bundle at https://mydreamprojects.in/static/js/main.fb996883.js. Each record retains its project page URL and 2026-10-18 verification date. Explicit source fields include floors, published total flats, BHK mix, completed/expected year and lift brand; existing map coordinates are not used as resident addresses or service coverage. `scripts/import-projects.py` reproduces the import. `public/projects/` stores the exact official night elevations for 13 completed projects and 3D floor plans for six ongoing projects. Each JSON record preserves the remote image URL and image type.

Skylark’s public project page https://mydreamprojects.in/projects/my-dream-skylark confirms G+5, 15 residences, 2/3 BHK and 2023. Its 101/102/103 app profiles are synthetic demo data, not sourced real occupants or numbering. No public source provided private resident photos, occupations, phone numbers or flat-to-resident mappings.

Photo picker implementation: https://docs.expo.dev/versions/latest/sdk/imagepicker/ (SDK 58). Native photo permission text is scoped to profile/post image selection; camera and microphone permissions are disabled.
