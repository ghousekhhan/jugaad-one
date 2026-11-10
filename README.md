# Jugaad One

Jugaad One takes spoken or typed shopping requests through comparison, quote review and simulated checkout. Wiggy and Tomato use a separately deployed marketplace with its own simulated data and tracking API. Ride discovery remains pending.

## Run locally

Use Node.js 22.13 or later. The local checkout store uses Node’s SQLite module.

```sh
npm ci
npm run dev
```

Open [the homepage](http://localhost:3000) or [the agent workspace](http://localhost:3000/workspace). To try a verified food comparison, select Hyderabad and Banjara Hills, set a 5 km radius, and search by dish for `Chicken Dum Biryani`. The marketplace calculates each total. Use the current quotes on screen because prices can change.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Configure services privately

Copy `.env.example` to `.env.local` and keep `.env.local` private. Restart Next.js after changing it.

| Setting | Purpose |
| --- | --- |
| `MARKETPLACE_API_BASE_URL` | Marketplace origin. Defaults to the deployed Wiggy and Tomato marketplace. |
| `MARKETPLACE_AGENT_API_KEY` | Marketplace Production `AGENT_API_KEY`. Public discovery and quotes work without it. Jugaad uses it server-side for simulated order creation and tracking. |
| `JUGAAD_DATABASE_URL` | Jugaad’s own PostgreSQL connection URI. Required for checkout when running a production build or deployment. Use a separate database from the marketplace. |
| `JUGAAD_DATABASE_CA` | Optional CA certificate for a PostgreSQL host using a private trust root. TLS certificate verification stays enabled. |
| `JUGAAD_TRANSACTION_DB_PATH` | Optional path for the local dev SQLite database. Defaults to `.data/marketplace.sqlite`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Enable text food conversations. The default model is `gemini-3.5-flash-lite`. A model override must support structured function calling. Manual search works independently. |
| `GNANI_API_KEY` | Enables server-side Gnani Prisma and Timbre. |
| `GNANI_TTS_SPEED` | Optional documented Timbre speed from 0.85 to 1.15. Defaults to 1.0. |

The app creates its transaction table and owner index on first use. The configured production database role needs access to that table and permission to initialize it. `npm start` serves the production build. Stop the dev server first if both would use port 3000.

## Food and sandbox checkout

Use **Send message** to start a food conversation and type follow-ups to change your constraints. The workspace shows the constraints after each turn and the request IDs from live provider calls. The browser restores saved constraints and internal sandbox offers through a first-party session cookie. A cheapest-offer request opens quote review if a complete comparison identifies an eligible offer. Approval and simulated booking still use the checkout controls. See the [live Gemini verification](docs/gemini-verification.md).

- Pick a city and neighborhood or explicitly request browser location. Jugaad sends coordinates only to the marketplace search and quote APIs when required.
- Search by dish or restaurant. Location, rating, availability, diet, and supported allergen filters are enforced. The app compares provider quotes that include required options, fees and tax. Each page quotes a bounded set of candidates, and the results disclose when more candidates are available.
- Select a quote, choose available options and quantity, and request a fresh exact quote. The quoted total must be explicitly approved before checkout opens.
- The demo keypad uses the displayed fictional code. Provider checkout uses a fixed sandbox payment alias and synthetic delivery details. Jugaad records the simulated payment attempt and sends a server-generated idempotency key when creating the order. No money moves.
- A receipt appears only after a separate authenticated provider read confirms the booking. The browser’s HTTP-only session cookie scopes its local transaction history. The app polls active receipts at the cadence returned by the provider. Tracking advances with elapsed server time in the simulation.

## Voice in the workspace

Choose English, Hindi, Telugu, or Hinglish, then select **Start continuous conversation**. Jugaad asks for your name and a demo city on the first visit. Say a city or approve the optional device location. The app sends each completed utterance to Prisma and resumes listening automatically. The manual mode remains available when you want to review a transcript before sending.

Voice turns use Gnani Timbre to speak the displayed reply. Select **Replay audio** if your browser blocks automatic playback, or **Hear reply** on a typed turn. Checkout keeps explicit approval and simulated payment controls. Jugaad can speak the exact quote and the provider-confirmed sandbox receipt.

Jugaad sends the microphone clip to Gnani for transcription, the submitted text to Gemini for interpretation, and grounded reply text to Gnani for synthesis. Text input works when microphone access or a speech service is unavailable. See the [voice verification](docs/voice-verification.md) for model, language, and timing details.

## Internal sandbox commerce

The internal catalog covers selected food, clothing, grocery, electronics, household and accessory products. It creates consistent variants with deterministic totals and stores the offers. Try “Find a black oversized cotton shirt under ₹800 in Hyderabad,” then say “second one” and “yes, proceed.” Complete the fictional code on the keypad. The internal receipt has a `JG-` reference. Wiggy and Tomato issue their own sandbox receipts for their inventory.

An HTTP-only browser session scopes the saved profile, location, active requirements, offers and orders. **Forget saved profile** clears your saved identity, location and active request. The browser session is valid for 30 days. Keep a separate PostgreSQL database for production. Local development uses SQLite.

## Project map

- `src/app/` contains the existing homepage and workspace plus same-origin marketplace and agent routes.
- `src/components/food-*` contains location selection, discovery, quote review, checkout and tracking UI using the existing Jugaad Grid styles.
- `src/lib/marketplace/` contains the validated provider contract, discovery rules, checkout state machine and persistent transaction store.
- `src/lib/integrations/` contains the server-side Gemini SDK and conversation orchestration. `src/lib/voice/` contains Gnani transport, audio format handling and grounded spoken replies.
- `tests/marketplace.test.ts` exercises discovery, constraint preservation, persistence and safe checkout using an isolated database and test transport.
- [Marketplace verification](docs/marketplace-readiness.md) records independent live checks and remaining external verification. [Design system](DESIGN_SYSTEM.md) documents the shared visual language.
