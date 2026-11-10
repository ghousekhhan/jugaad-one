# Approved three-tab implementation

The extracted prototype supplies the layout, palette, screen previews and interaction reference. Production keeps the existing Next.js routes and uses the existing backend state.

| Screen | Components | Backend and interaction | Implementation |
|---|---|---|---|
| Homepage | `src/app/page.tsx`, `ApprovedWordmark` | Try Jugaad opens `/workspace`. Wordmark returns home. How It Works and Wiggy/Tomato are on the homepage. | Implemented. Launch film has a labeled poster. No video asset was supplied. |
| Onboarding | `Workspace`, compact `VoiceControls` | Language, name and city use the existing profile store. Optional device location requires confirmation. Typed name remains available. | Implemented. |
| Jugaad | `ApprovedShell`, `Workspace`, `VoiceControls`, `FoodConversationLog` | Existing Gemini interpretation, Prisma final transcripts and Timbre playback. Animation follows application state. New and End conversation use the existing controller. | Implemented. |
| Comparison | `FoodDiscovery`, `SandboxCommerce` | Real offer IDs, provider or internal sandbox provenance, quote totals, ETA and ratings. Price details and merchant reviews use existing data. | Implemented. |
| Checkout | `FoodCheckout`, `SandboxCommerce`, existing keypad | Existing quote and modifier actions, exact approval, explicit demo authorization and backend-confirmed order. | Implemented. |
| Orders | `ApprovedOrders`, `OrderHistory` | Existing local-sandbox and provider history, actual totals, native detail dialog, provider tracking and reconciliation. | Implemented. |
| Profile | `ApprovedProfile` | Server-backed name, language and region. Language updates the voice and conversation locale. Changing city invalidates stale quotes and comparisons. | Implemented. |
| Navigation | `ApprovedShell` | Exactly three destinations. `/workspace`, `/workspace?tab=orders` and `/workspace?tab=profile` support refresh and history. | Implemented. |

## Running the browser smoke test

The test drives the running app with an isolated Chrome context and creates one clearly labeled simulated order. It requires configured application integrations and Playwright available to Node. Set `PLAYWRIGHT_MODULE` to an installed Playwright entry point and `CHROME_BINARY` to Chrome if needed. Set `JUGAAD_BASE_URL` to test a different port.

```sh
node tests/approved-ui.browser.mjs /absolute/path/to/screenshots
```

The supplied prototype’s interaction results describe its standalone fixtures. Production results are tracked in the development handoff.

## Production verification matrix

| Interaction | Evidence | Remaining issue |
|---|---|---|
| Homepage, onboarding and returning profile | Real Chrome flow with the existing session store. First-time language, name and city, then refresh into a saved Profile tab. | Approved launch-film asset was not supplied. |
| Direct answers and offers | Real Gemini answer produced no search. The existing internal sandbox returned three eligible offers in Chrome. | Physical-microphone acceptance is tracked separately. |
| Select, customize, approve and pay | Real browser flow selected a saved listing, changed its quote with a supported modifier, approved the exact total and explicitly authorized a simulated order. | None observed on the internal sandbox path. |
| Orders | Real stored order opened in the detail dialog, closed with Escape, and remained visible after refresh and a new conversation. | Production hosting needs the existing PostgreSQL configuration. |
| Profile | Name, Hinglish and Mumbai persisted through refresh and the workspace reopened without onboarding. A separate Chrome check confirmed that Mumbai and Hinglish reached the next dialogue turn before refresh. | Optional browser geolocation was not exercised in the smoke test. |
| Live voice | A recorded Telugu Chrome microphone fixture passed through Prisma, Gemini, live provider quotes and Timbre with a matching caption. | A physical microphone was not tested. |
| External providers | Live Wiggy and Tomato quotes, provider-confirmed simulated booking, tracking and Telugu confirmation passed through the app APIs. | Production hosting needs PostgreSQL. |
| Reset and exit | Chrome cleared an active comparison with New conversation and received the real stop decision from End conversation. | Spoken interruption on a physical device remains unverified. |
| Responsive | Real Chrome at 375, 768, 1024 and 1440 px. Screenshots in the artifact directory linked from the handoff. | None observed in these viewport checks. |
| Project checks | 74 tests, lint, typecheck and production build passed. | The local production server returns a storage error without PostgreSQL. Interaction tests used development mode with its existing SQLite storage. |
