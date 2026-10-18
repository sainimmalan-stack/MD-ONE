# MD One — premium redesign review

Implemented 18 October 2026 in the existing local app.

## Design

The home screen now opens with compact branding, prominent search and delivery availability from the existing project/slot data. A compact photographic morning feature leads into category shelves, delivered-order repeat products and the actual grocery catalogue. No order history is invented. A dedicated compact repeat-purchase layout prevents a single past purchase from leaving an empty full-width shelf.

The interface uses near-black, layered neutral surfaces and warm-white typography. Orange is reserved for the original My Dream Projects logo, selection markers and small highlights. Product photography retains natural colours. Prices, pack sizes, stock and ordering eligibility still come from existing data. Generic AI imagery is labelled illustrative; products without a suitable photo use an explicit placeholder. Planned products remain unavailable to order.

Replaced the accumulated grocery home styling and brand overrides with dedicated storefront styles and shared surface/text/control tokens. Removed the decorative sidebar quote card. Mobile navigation is Daily/Home, Services, Community, My Project and Profile. Other tools remain reachable through desktop navigation, the mobile menu and the home’s community gateways.

Refined existing community/social post surfaces, profile cover, service header/cards, carpool search/cards, financial panels and statement rows. Raised legacy sub-10px feature typography. Split operator retail styles into their own financial workspace stylesheet, including an independently scrollable product table. The original carpool privacy, consent and seat operations were not changed.

Native Expo has the same photographic home, category search, actual-history repeat buying and available-slot information. Its shared shell, community and social/service styles now consume native design tokens. Screen changes reset scroll position.

## Verification

- Production Next.js build passed, including web TypeScript validation.
- Native TypeScript validation passed.
- iOS Hermes export passed, including all three local image assets.
- Android Hermes export passed, including all three local image assets.
- Browser layout reviewed at 1440px and 390px. Observed document width equalled viewport width at both sizes.
- Product search for tomato returned one stocked item.
- Dairy category returned three stocked products; add/remove updated basket count and totals.
- Opened and reviewed the mobile basket, delivery slot selector, substitution choice and demo-payment notice; no order was submitted.
- Reviewed existing community/profile and service layouts. Saved storefront, community and basket previews in outputs/premium.

This remains a local demo. Real payments, fulfilment, road-route carpool matching and production authentication are not added by a visual redesign. Native exports are compilation checks; physical-device visual testing, signing and store release were not performed. Database/domain behaviour was not modified, so domain tests were not rerun for these presentation changes.

## Original image assets

Generated using the built-in image generation tool via the imagegen skill. No real supplier packaging or brand relationship is represented. Original My Dream Projects logo assets remain unchanged.

Final workspace assets:

- public/grocery/everyday-table.png
- public/grocery/product-sheet.png
- mobile/assets/grocery/everyday-table.png
- mobile/assets/grocery/product-sheet.png

The product sheet is displayed through CSS background positions on web and clipped native Image positioning; the raster is not cropped or edited on disk. Unavailable product photos are not substituted with misleading images.

### Hero prompt

Create one photorealistic editorial grocery still-life photograph, landscape 1536x1024. Premium food magazine photography for a private Hyderabad neighbourhood grocery app. On a matte warm charcoal stone kitchen counter: a plain glass milk bottle, six brown eggs in a small recycled paper tray, a rustic loaf of bread, ripe tomatoes on vine, a few small bananas, a folded cotton shopping bag, and leafy spinach. Objects grouped on right two thirds, left third mostly empty dark charcoal background for separately rendered UI copy. Beautiful soft side window light, subtle film grain, natural authentic food colours, tactile materials, sophisticated and inviting, realistic scale. No writing, logos, labels, typography, graphic elements, UI, people or watermarks. This is generic illustrative food photography, no branded packaging.

### Product sheet prompt

One square 2048x2048 photographic contact sheet consisting of exactly 4 columns and 4 rows, sixteen perfectly equal square cells, no borders, no margins, no text. Each cell is a distinct photorealistic grocery still-life isolated on the same light warm grey studio background, soft natural shadows, centered with generous space within its own cell, no objects crossing between cells. Row 1 left to right: plain clear glass bottle of white milk; six brown eggs in paper tray; small bunch of ripe yellow bananas; three red tomatoes. Row 2: plain unlabelled sliced whole wheat bread loaf; three red onions; a small bowl of white uncooked rice; two red apples. Row 3: plain white bowl of curd yogurt; a small bunch of fresh spinach; a plain white soap bar on paper; plain clear bottle of floor cleaning liquid with black cap, no label. Row 4: small bowl of roasted foxnuts makhana; small bowl of dry black tea leaves; plain bowl of yellow lentils; plain glass bottle of golden cooking oil. No brands, labels, writing, numbers, logos or graphic overlays. Consistent premium grocery catalogue lighting. Each product occupies about sixty percent of its own tile. Precise equal 4x4 grid layout.
