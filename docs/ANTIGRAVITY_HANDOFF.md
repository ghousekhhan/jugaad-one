# Antigravity Handoff: Jugaad One Codebase Audit & System Architecture

**Document Date:** 9 November 2026  
**Auditor / Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)  
**Status:** Pre-implementation codebase inspection and transition audit  
**Repository Location:** `~/Desktop/Jugaad_ONE`

---

## A. What Jugaad One Does

Jugaad One is a voice-first AI transaction orchestration platform tailored for Indian consumers.

* **Core Tagline:** *Say it. Find it. Pay for it.*
* **Main Headline:** *One conversation. From wanting it to getting it.*
* **Brand Language:** Multilingual natural interaction across Indian English (`en-IN`), Hindi (`hi-IN`), Telugu (`te-IN`), and Hinglish (`hi-en`).
* **Transaction Lifecycle:**
  1. **Intent Understanding:** Users speak naturally. Jugaad extracts dishes, budgets, location, delivery radii, ratings, dietary preferences, and allergen exclusions.
  2. **Catalog Discovery & Quoting:** Queries simulated marketplace providers (**Wiggy** and **Tomato**) through server-side REST APIs to discover restaurants and dishes, requesting live exact quotes that include line items, delivery fees, packaging, platform fees, taxes, and discounts.
  3. **Multi-Provider Comparison:** Ranks eligible quotes by total cost (in integer paise) or delivery speed, re-verifies allergen and distance exclusions, and flags provider errors or catalog bounds.
  4. **Voice & Visual Selection:** Presents structured results visually with price breakdowns while synthesizing spoken explanations via Gnani Timbre.
  5. **Explicit Approval & Demonstration Payment:** Requires explicit user authorization of the final quoted price before unlocking demonstration payment (supporting demo UPI ending in `@demo`).
  6. **Backend-Confirmed Booking & Tracking:** Creates simulated orders on the marketplace using server-side Bearer authentication and unique idempotency keys (`jugaad-<uuid>`), confirms the order via an independent authenticated read, and polls a 7-step simulated tracking pipeline with live ETA countdowns.

---

## B. Current Architecture

```
                                  [ Browser / Client ]
                     +---------------------------------------------+
                     |  Next.js 16 (React 19) + Tailwind CSS v4    |
                     |  - Warm Paper Design System (#F8F5EE)       |
                     |  - AudioWorklet (16 kHz mono WAV capture)   |
                     |  - useVoicePlayback (Timbre WAV synthesis)  |
                     |  - Workspace UI / FoodCheckout / Discovery  |
                     +---------------------------------------------+
                                        | (HTTPS / Same-origin)
                                        v
                               [ Next.js API Layer ]
          +-----------------------------+-----------------------------+
          |                             |                             |
          v                             v                             v
[ /api/voice/* ]              [ /api/agent/interpret ]      [ /api/marketplace/* ]
  - transcribe (Prisma)         - Gemini 3.5 Flash Lite       - cities, search, reviews
  - speak (Timbre)              - plan_food_turn tool call    - transactions (quote/pay)
  - HMAC speech tickets         - Multi-turn constraints      - tracking polling
          |                             |                             |
          +--------------+--------------+-----------------------------+
                         |
                         v
                [ Server Core Libs ]
          +---------------------------------------------+
          | lib/integrations/gemini.ts                  |
          | lib/integrations/food-conversation.ts       |
          | lib/voice/gnani.ts & wave.ts                |
          | lib/marketplace/provider.ts & discovery.ts  |
          | lib/marketplace/checkout.ts                 |
          | lib/marketplace/transaction-store.ts        |
          +---------------------------------------------+
                   |                            |
                   v                            v
      [ External Services ]           [ Persistence Layer ]
   - Gnani Vachana STT & TTS      - SQLite (.data/marketplace.sqlite)
   - Google Gemini 3.5 Flash Lite - PostgreSQL (Production fallback)
   - Wiggy & Tomato Marketplace   - HttpOnly session cookies
```

### 1. Technology Stack
* **Runtime:** Node.js `>=22.13.0`
* **Framework:** Next.js 16.0.0 (App Router, Turbopack/Webpack enabled in scripts)
* **Frontend:** React 19.2.0, Tailwind CSS 4.0.0, Motion 12.0.0, Lucide React 1.70.0
* **Typography:** Locally bundled variable fonts (`next/font/local`): Bricolage Grotesque (Headings), Instrument Sans (UI/Body), Noto Sans Devanagari (Hindi), Noto Sans Telugu (Telugu)
* **Validation:** Zod 4.0.0 (strict schemas for API contracts, constraints, transactions)
* **Database Driver:** `node:sqlite` (`DatabaseSync` for local dev) and `pg` (`Pool` for production PostgreSQL)
* **Testing:** Node Native Test Runner (`node --conditions=react-server --import tsx --test tests/*.test.ts`)

### 2. Key Directories & Routes
* `src/app/page.tsx`: Landing page with interactive `AgentPreview` walkthrough, process rows, Jugaad Pay specimen, and provider directory.
* `src/app/workspace/page.tsx`: Main user workstation initializing draft requests, Gemini status, and voice service status.
* `src/app/api/agent/interpret/route.ts`: Natural language intent interpreter using Gemini structured tool calling.
* `src/app/api/voice/transcribe/route.ts`: Gnani Prisma STT proxy (16 kHz mono WAV -> text).
* `src/app/api/voice/speak/route.ts`: Gnani Timbre TTS proxy (signed speech ticket or verified transaction -> WAV audio).
* `src/app/api/marketplace/search/route.ts`: Multi-provider catalog search and quote aggregator.
* `src/app/api/marketplace/transactions/route.ts` & `[id]/route.ts`: Transaction lifecycle (quote generation, explicit approval, simulated payment, provider booking, and order polling).
* `src/app/api/marketplace/cities/route.ts`, `reviews/route.ts`, `image/[file]/route.ts`: City coordinates, reviews, and dish asset proxies.

---

## C. Features Already Implemented & Verified

1. **Marketplace & Provider Integration:**
   * Full client implementations for fictional providers **Wiggy** and **Tomato** via `https://jugaad-food-marketplace.vercel.app`.
   * Public discovery for restaurants, menu items, reviews, and quote generation (`POST /api/quotes`).
   * Authenticated simulated order placement (`POST /api/simulated-orders`) with idempotency keys (`jugaad-<uuid>`).
   * Authenticated order status lookup (`GET /api/simulated-orders/{id}`) with 7-step tracking lifecycle (`confirmed`, `preparing`, `partner_assigned`, `arriving_for_pickup`, `picked_up`, `out_for_delivery`, `delivered`).
2. **Gemini Multi-Turn Structured Reasoning:**
   * `@google/genai` 3.0.0 integration using `gemini-3.5-flash-lite`.
   * Single allowed function declaration `plan_food_turn` enforcing strict constraint patches (dish, restaurant, city, neighborhood, budget, distance radius, rating, quantity, allergens, dietary preferences).
   * Context memory across turns maintaining accumulated preferences while allowing surgical edits and clear directives.
   * Grounded fallback responses when dishes are missing, locations cannot be matched, or budgets are exceeded.
3. **Voice STT & TTS Pipelines:**
   * Gnani Prisma v3 endpoint integration (`https://api.vachana.ai/stt/v3`) with format validation, silence rejection, and language routing.
   * Gnani Timbre TTS integration (`https://api.vachana.ai/api/v1/tts/inference`) with `timbre-v2.5` model, 16 kHz mono WAV synthesis, and voice catalog matching (Kaveri for `en-IN`, Nalini for `hi-IN`, Varuni for `te-IN`, Poorvi for `hi-en`).
   * Open-ended WAV header finalization (`finalizeTimbreWave`) ensuring clean browser playback.
   * Cryptographically signed HMAC speech tickets (`issueSpeechTicket`, `readSpeechTicket`) preventing unauthorized TTS synthesis.
4. **Checkout & Transaction Safety:**
   * Complete transactional state machine: `quoted` -> `approved` -> `booking` -> `confirmed` (with `rejected` and `reconciliation` error boundaries).
   * Idempotency protection ensuring payment cannot double-book even under concurrent submissions.
   * Quote expiry checks (rejecting stale quotes before payment).
   * Price-change rejection gating orders if provider quote amounts shift before booking.
   * Reconciliation logic for transient provider timeouts on booking confirmation.
   * Owner scoping via SHA-256 hashed HttpOnly session cookies.
5. **Design System & UX Integrity:**
   * Editorial "Jugaad Grid V2" layout with warm paper (`#F8F5EE`), ink (`#161616`), orange (`#FF633A`), success teal (`#16866E`), and graph-paper ruling.
   * Full responsiveness verified from mobile (375px) to desktop (1440px).
   * Zero WCAG A/AA contrast violations; accessible keyboard navigation.
6. **Automated Test Suite:**
   * 19 out of 19 automated tests passing across `tests/marketplace.test.ts` and `tests/voice.test.ts`.
   * ESLint and TypeScript checks passing cleanly with zero errors.

---

## D. Features Partially Implemented

1. **Voice Conversational Experience:**
   * **Current State:** A push-to-talk loop: *Click "Record voice" -> Speak -> Click "Stop recording" -> Transcript pasted into textarea -> User edits or clicks "Send message" -> Spoken reply played*.
   * **Deficiency:** Behaves as manual sequential operations instead of one fluid conversational session.
2. **Onboarding & Location Handling:**
   * **Current State:** Location selection exists only as an inline form field (`FoodLocationFields`) inside the constraints panel, alongside a simple browser geolocation button.
   * **Deficiency:** No dedicated onboarding greeting, no spoken name capture or personalized Timbre welcome, and no structured handling when a user's physical GPS is outside the 4 demo cities (Hyderabad, Mumbai, Bengaluru, Delhi).
3. **Voice-Driven Actions:**
   * **Current State:** Voice can search and refine constraints. However, selecting a quote, approving an offer, and executing demo checkout requires clicking physical UI buttons.
   * **Deficiency:** Spoken commands like "Choose the Wiggy biryani", "Approve the ₹402 total", or "Pay with demo UPI" are not orchestrated through voice.

---

## E. Missing Features

1. **Continuous Conversational Voice Session:**
   * Single session activation with microphone permission granted once.
   * Automatic Voice Activity Detection (VAD) / speech turn detection (detecting speech onset and natural silence pauses to finalize utterances without pressing "Stop recording").
   * Barge-in / interruption handling (speaking while TTS plays automatically pauses playback and begins capturing the new turn).
   * Dynamic visual listening, thinking, comparing, and speaking states.
   * Persistent session mute/unmute and end-session controls.
2. **Onboarding Wizard with Personalized Spoken Welcome:**
   * Introductory modal/card for first-time visitors asking for user's name and preferred language.
   * Spoken welcome greeting synthesized via Gnani Timbre addressing the user by name in their language.
   * Location permission flow: checks device GPS against supported demo cities; provides clear, truthful fallback to manual selection of Hyderabad, Mumbai, Bengaluru, or Delhi when out-of-range.
3. **Dynamic Fictional Inventory Fallback Generator:**
   * Currently, searching for an item not present in Wiggy/Tomato seeded data (e.g., "Pesarattu", "Rogan Josh", "Momos") returns a dead-end `no_match` state.
   * Required: An internally consistent, deterministic synthetic offer generator that activates when seeded catalog has zero matches.
   * Must clearly disclose simulation status without spoofing real marketplace API signatures, adhering to strict validation schemas.
4. **Voice-Driven Order Progression:**
   * Natural voice intent recognition for selection ("Go with the first one"), approval ("Yes, approve it"), and payment simulation.

---

## F. Known Issues & Operational Considerations

1. **Git Repository Status:**
   * The workspace directory `~/Desktop/Jugaad_ONE` is currently **not an active Git repository** (`fatal: not a git repository`).
   * *Precaution:* In accordance with user rules, do not run destructive `git init` or overwrite existing local files without explicit instruction.
2. **Prisma Speech-to-Text Transience:**
   * Upstream Gnani Prisma API has exhibited occasional rate limits (HTTP 429) or transient 502/503 errors during rapid consecutive requests.
   * The client must handle transcription failures gracefully, retaining user text and providing immediate fallback to typing without breaking continuous voice session state.
3. **AudioWorklet & VAD Buffer Management:**
   * Continuous recording must stream audio into a real-time energy/silence detector without memory leaks or excessive payload uploads to Gnani STT.
4. **Database Configuration:**
   * Local development runs on Node's built-in SQLite (`DatabaseSync`).
   * Production deployment requires setting `JUGAAD_DATABASE_URL` (PostgreSQL) and `JUGAAD_DATABASE_CA`.

---

## G. Integration Dependencies & Secret Presence

All required API keys are configured and confirmed present in `.env.local` (checked safely without revealing secret values):

| Variable | Present Status | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Present** (53 chars) | Google GenAI SDK (`@google/genai` 3.0.0) multi-turn intent extraction |
| `GNANI_API_KEY` | **Present** (134 chars) | Gnani Vachana API (Prisma STT + Timbre TTS) |
| `MARKETPLACE_API_BASE_URL` | **Present** (42 chars) | Deployed Wiggy & Tomato mock marketplace |
| `MARKETPLACE_AGENT_API_KEY` | **Present** (64 chars) | Bearer token for authenticated simulated order creation & polling |
| `GEMINI_MODEL` | Optional (default: `gemini-3.5-flash-lite`) | Model override |
| `JUGAAD_DATABASE_URL` | Absent (uses SQLite `.data/marketplace.sqlite`) | PostgreSQL production transaction storage |

---

## H. Safe Next Development Milestones

To maximize credit efficiency and avoid destabilizing existing working logic, implementation should proceed in four focused phases:

### Phase 1: Continuous Conversational Voice Engine
* Upgrade `public/voice/capture.js` and `src/lib/voice/capture.ts` to support continuous audio streaming and speech turn boundary detection (silence detection window of ~1.2s - 1.5s).
* Implement interruption / barge-in support in `useVoicePlayback.ts` and `voice-controls.tsx`.
* Create a dedicated `VoiceSessionManager` state machine: `idle` -> `listening` -> `user_speaking` -> `processing_stt` -> `reasoning_gemini` -> `speaking_tts`.
* Maintain mute, unmute, and manual stop controls.

### Phase 2: Onboarding & Location UX
* Build an onboarding modal/card that prompts for the user's name and language preference.
* Trigger an initial Gnani Timbre greeting: *"Hello [Name], welcome to Jugaad One. What would you like to eat today?"* in the chosen language.
* Implement location permission detection: test GPS coordinates against bounding boxes of Hyderabad, Mumbai, Bengaluru, and Delhi. If outside, display polite disclosure and offer manual selection of the 4 demo cities.

### Phase 3: Dynamic Fictional Inventory Fallback
* When `searchFood` returns empty results from live Wiggy/Tomato catalogs, trigger a deterministic fallback catalog synthesizer.
* Generate persistent, realistic offers (consistent restaurant names, realistic price points in paise, item options, simulated ratings, delivery estimates).
* Display explicit, tasteful simulation disclosure ("Fictional sandbox listing generated for demonstration").
* Ensure synthesized offers cleanly transition into quote review, approval, and mock order confirmation.

### Phase 4: Voice-Driven Checkout Progression & End-to-End Verification
* Extend Gemini interpretation schema and intent router to recognize approval and payment intents.
* Allow voice confirmation to trigger checkout approval and demo UPI submission.
* Write comprehensive unit tests for VAD, fallback inventory, and voice actions. Run full validation (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`).

---

## I. How to Run and Test the Project

```bash
# 1. Run local development server
npm run dev

# 2. Run static analysis and linting
npm run lint

# 3. Run TypeScript typecheck
npm run typecheck

# 4. Run automated test suite
npm test

# 5. Verify production build
npm run build
```

---

## J. Files That Should Not Be Modified Without Justification

1. `src/lib/marketplace/schemas.ts`: Defines canonical schemas for Wiggy and Tomato marketplace entities. Breaking changes here will corrupt provider contracts.
2. `src/lib/marketplace/provider.ts`: Manages authenticated HTTP requests, idempotency headers, and error transformations for the live deployed marketplace.
3. `src/lib/marketplace/transaction-store.ts`: Database DDL and optimistic concurrency versioning for transaction persistence.
4. `.env.local` / `.env.example`: Must never be deleted, overwritten, or committed.
5. `DESIGN_SYSTEM.md`: Source of truth for brand colors, font tokens, and editorial UI guidelines.
