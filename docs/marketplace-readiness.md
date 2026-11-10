# Wiggy and Tomato integration readiness

Independent verification on 9 November 2026 (India time). The [deployed OpenAPI contract](https://jugaad-food-marketplace.vercel.app/api/openapi) is OpenAPI 3.1, contract version 1.0.0. The Jugaad One workspace returned HTTP 200 locally. Its existing workspace saved draft requests and displayed provider placeholders before this integration.

| Live request | HTTP | Observed response |
| --- | --- | --- |
| `GET /api/openapi` | 200 | JSON document with `paths`, `components.schemas` and Bearer/session schemes |
| `GET /api/cities` | 200 | `data.cities` included Bengaluru, Delhi, Hyderabad and Mumbai with city and neighborhood coordinates |
| `GET /api/restaurants` for Wiggy and Tomato | 200 each | `data.restaurants`, `total`, `filters`. Banjara Hills coordinates with a 5 km radius and `minRating=4` returned in-range listings with qualifying provider ratings |
| `GET /api/menu-items` for both providers | 200 each | `data.menuItems`, `total`, `filters`. Same Boondi Raita item and branch returned 7,900 paise for Wiggy and 9,700 for Tomato. The paneer search in the tested area with availability enabled returned no items |
| Repeat `GET /api/menu-items` | 200 each | Both responses returned the same catalog records on a separate request |
| `GET /api/reviews` for both providers | 200 each | `data.summary`, `reviews`, `total`, `limit`, `offset`, `sort`, `filters`. Aggregate and written review records carried simulation markers |
| `GET /api/simulated-orders/{id}` without credentials | 401 | `error.code: UNAUTHORIZED` and `meta` |

Public data envelopes carried `meta.simulated: true` and `meta.dataStatus: "simulated"`. Repeatable populated reads support discovery readiness. Authenticated order persistence and the underlying production database configuration were not independently verified in Phase 1. The handoff reports its own hosted database checks.

`POST /api/quotes` is public and takes the provider ID, branch, items, selections and optional location. Order creation requires `Authorization: Bearer <agent key>` and `Idempotency-Key`. Order read and cancellation also use Bearer authentication for Jugaad. The provider documents `409 PRICE_CHANGED` and `410 QUOTE_EXPIRED`. Jugaad will keep the key server-side and must scope its own order records to the workspace that created them.

## Public quote verification

`POST /api/quotes` returned **201** for each provider for one Regular Chicken Dum Biryani at Mirchi Moon in Banjara Hills. Wiggy returned `totalPaise: 40245` (₹402.45). Tomato returned `totalPaise: 42335` (₹423.35). Both returned quote IDs, item/option details, integer paise components, distance, ETA, expiry and simulation metadata. The amounts reconciled to the component totals. Jugaad’s own `POST /api/marketplace/search` returned HTTP 200 with those two validated quotes and no provider errors.

## Credential and production checks

The initial configured key returned HTTP 401 `UNAUTHORIZED`. After the marketplace owner updated the production credential and redeployed, the dev server was restarted with the updated private environment. An authenticated read for a nonexistent order returned HTTP 404 `ORDER_NOT_FOUND`, confirming the provider accepted the key. No credential value was printed.

Jugaad then created and approved a fresh ₹402.45 quote and submitted one simulated Wiggy order through its checkout route. The provider accepted **WIG-94B2C716**. A separate authenticated `GET /api/simulated-orders/{id}` returned HTTP 200 with the same reference, the seven simulated steps, and a six-second polling interval. Replaying the original `POST /api/simulated-orders` with the same idempotency key returned HTTP 200 and the same order ID. Jugaad saved the verified receipt, and its tracking route returned 404 without the owning browser session.

Chrome at 375 px displayed the saved receipt after a reload and showed the provider’s Restaurant preparing step after confirmation. A separate browser context could not see the test receipt. The workspace was checked at 375, 768, 1024 and 1440 px. Browser requests stayed same-origin, the agent key was absent from checked responses, and Axe reported zero A/AA violations in the checked mobile and desktop states. The production build, type check, lint and seven isolated tests passed.

The live checkout used Jugaad’s local SQLite store. The production PostgreSQL connection for Jugaad is not configured in this workspace. Automated transaction tests use an isolated SQLite file and a test transport to exercise quote expiry, price changes and reconciliation without modifying provider prices. Gemini and Gnani accounts are not configured here. Gnani's [Prisma REST documentation](https://docs.gnani.ai/api/STT/speech-to-text) and [Timbre documentation](https://docs.gnani.ai/api/TTS/tts-sse) are available. Account-specific models, languages and authorization still require verification.
