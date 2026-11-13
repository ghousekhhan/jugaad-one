# JUGAAD ONE — PRODUCT SPECIFICATION

**Document Version:** 1.2.0  
**Status:** Active Shared Specification  
**Design System:** Quiet Intelligence (approved three-tab package)  
**Core Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Google Gemini GenAI SDK, Gnani Vachana (Prisma STT + Timbre TTS), SQLite / PostgreSQL

**V2 branch checkpoint (2026-11-13):** `codex/intelligence-engine-v2` adds safe storage failure handling, pending-confirmation preservation, distinct repeat/simplify/elaborate/translate actions, bounded decision history, rejected recommendation memory and an explicit-consent preference API. These are local branch changes, not deployed behavior. See `docs/INTELLIGENCE_ENGINE_V2.md` for verified scope and outstanding live acceptance checks. No visual redesign or provider adapter replacement is part of this branch.

---

## 1. Product Vision & Tagline

* **Product:** Jugaad One
* **Tagline:** *Say it. Find it. Pay for it.*
* **Primary Headline:** *You say it. Jugaad makes it happen.*
* **Primary CTA:** *Try Jugaad*

Jugaad One is a voice-first, multilingual, AI-powered transaction orchestration platform. It closes the gap between human intention and commerce transaction. Instead of forcing customers to juggle multiple apps, type manual searches, interpret conflicting filters, and navigate fragmented checkouts, Jugaad One conducts a single, continuous, natural conversation that evaluates options across simulated commerce providers, explains trade-offs, secures approval, processes demonstration payments, and monitors backend-confirmed deliveries.

---

## 2. Core Transaction Pipeline

$$\text{User Speech} \longrightarrow \text{Gnani Prisma STT} \longrightarrow \text{Gemini Reasoning} \longrightarrow \text{Marketplace Orchestration} \longrightarrow \text{Choice Comparison} \longrightarrow \text{Explicit Approval} \longrightarrow \text{Jugaad Pay} \longrightarrow \text{Backend-Confirmed Booking} \longrightarrow \text{Live Tracking} \longrightarrow \text{Gnani Timbre TTS}$$

1. **Natural input:** The browser currently uses a selected Indian English, Hindi, Telugu or Hinglish locale. Automatic spoken-language selection remains a product target.
2. **Speech recognition:** The browser detects utterance boundaries locally and sends completed WAV clips to Gnani Prisma REST. Browser partial transcripts and automatic language identification are not implemented. A direct realtime API fixture was verified separately.
3. **Intent and reasoning:** The controller resolves clear local actions and Gemini (`gemini-3.5-flash-lite`) can return validated direct replies or propose an action with `plan_food_turn` in AUTO mode. Only eligible discovery actions in compatible domains reach a marketplace service.
4. **Marketplace Discovery & Quoting:** Server-side orchestration across simulated providers (**Wiggy** and **Tomato**) querying live item availability and calculating itemized quotes with taxes, packaging, and delivery fees.
5. **Comparison & Trade-offs:** Ranked comparison highlighting pricing, speed, rating, and constraint eligibility.
6. **Voice & Visual Selection:** Dual presentation where the interface highlights winning offers and Gnani Timbre vocalizes the trade-offs.
7. **Explicit Approval:** Strict requirement for user confirmation of the exact calculated total before unlocking payment.
8. **Jugaad Pay (Simulated Checkout):** The dedicated `/payment` route loads the approved quote from the current session and displays a fictional payer identity. Demo authorization reuses the existing simulated services and server-side idempotency protections. The page shows success only after confirmed booking.
9. **Backend-Confirmed Booking:** Orders submitted to the provider backend with polling verification ensuring receipts are only issued upon genuine provider acknowledgment.
10. **Persistent Tracking:** 7-step simulated tracking lifecycle (`confirmed`, `preparing`, `partner_assigned`, `arriving_for_pickup`, `picked_up`, `out_for_delivery`, `delivered`) with elapsed time updates.

---

## 3. Mandatory Multilingual & Speech Standards

### Supported Indian Languages
* **English (`en-IN`):** Voice: *Kaveri*
* **Hindi (`hi-IN`):** Voice: *Nalini*
* **Telugu (`te-IN`):** Voice: *Varuni*
* **Hinglish (`hi-en`):** Voice: *Poorvi*

### Language Intelligence Rules
* **Microphone permission first:** Try Jugaad requests microphone access from the entry click. New visitors confirm a detected location or choose a service city before selecting a language and giving their name. A text path is available. Spoken locale choices are confirmed before changing recognition and playback. Returning profiles reuse their saved locale.
* **Code-Switching:** Preserve mixed-language context (e.g. *"Hyderabad mein biryani chahiye, under 400"*).
* **Same-Language Responses:** Spoken output must match the user's conversational language.
* **Grounded Currency Pronunciation:** Amounts (e.g. ₹402.45) must be vocalized naturally in the active language (e.g., *"₹402 रुपये और 45 पैसे"* or *"₹402 రూపాయలు 45 పైసలు"*), never read as isolated digits.

---

## 4. Quiet Intelligence

The approved three-tab package defines the production layout. The canvas is `#F7F7F3`, surfaces are `#FFFFFF`, text is `#17191C`, accent is `#F26A35`, and borders are `#DADDD9`. Geist is the Latin UI font. Locally bundled Noto Sans Devanagari and Noto Sans Telugu support Indic scripts. The approved editorial emphasis retains its italic styling.

- The homepage has a text wordmark, Try Jugaad, a launch-film poster, a concise How It Works section and the fictional Wiggy and Tomato providers.
- A first visit goes through microphone choice, language, name and city. A complete saved profile opens directly into the workspace.
- The primary destinations are Jugaad, Orders and Profile. Their URLs are `/workspace`, `/workspace?tab=orders` and `/workspace?tab=profile`. Desktop uses the approved side rail and mobile uses a bottom navigation bar.
- Jugaad keeps one conversation and real voice state while results, quotes and checkout unfold. Orders shows persisted simulated records and their details. Profile saves the language and location used by later requests.
- Only backend-confirmed bookings are presented as confirmed. Pricing, estimates and ratings come from the actual eligible offers.

---

## 5. Architectural Non-Negotiables

1. **Real Integrations Only:** Spoken output must originate from Gnani Timbre WAV audio; never fallback to `window.speechSynthesis`.
2. **Server-Side API Key Isolation:** `GEMINI_API_KEY`, `GNANI_API_KEY`, and `MARKETPLACE_AGENT_API_KEY` must never be exposed to the client bundle.
3. **Optimistic Concurrency & Idempotency:** Orders use unique idempotency keys (`jugaad-<uuid>`). Database updates use versioned rows to eliminate race conditions.
4. **Transparent Simulation Disclosure:** Merchants, inventory, and payments are simulated. Never conceal simulation status, but avoid annoying robotic disclaimers in spoken output.
5. **Anti-Slop Craft:** No generic AI gradient orbs, no purple/blue neon glows, no random particle effects, no emoji dashboards.

## 6. Autonomous Discovery and Keyboard-Free Journey

The normal journey must work without typing. A user can choose a demonstration city, give their name by voice, keep a continuous conversation, select an offer, review its exact total and authorize checkout. Text remains an optional fallback. Any demonstration payment code has an accessible on-screen keypad and is clearly labeled as fictional.

Discovery progresses from the literal provider lookup to equivalent aliases, then toward category-aware retrieval and persistent sandbox inventory. All stages preserve hard constraints and validate the full payable amount. A provider error is distinct from an empty catalog. Generated listings require stable identifiers and internal fulfillment provenance before checkout. Wiggy and Tomato confirmations remain attributable to their own APIs.

Search, comparison and quote preparation may proceed automatically. Payment and order placement require explicit authorization tied to the current quote. Browser refresh should restore the structured session and transaction references without storing raw microphone audio.

## 7. Voice Recovery and Verification

Voice-only onboarding should capture a preferred name in its own conversation stage and offer durable anonymous profile retention and deletion. Precise delivery location should be requested with consent and confirmed before it is saved. Browser coordinates require an accuracy check, and a human-readable address requires a verified lookup or explicit user input.

Wake phrases apply only during an active, authorized session. The interface should describe the actual recognition mode and language behavior. Model or transport upgrades require official API contracts and account-level verification.

Use monotonic measurements at each observable stage. Traces should contain timing and outcome data without speech, transcript text, credentials or precise location. Report fixture, browser and physical microphone results separately.

## 8. Internal Sandbox Commerce

The internal catalog covers supported food, clothing, grocery, electronics, household and accessory families. It generates deterministic variants with stable identities and stores each listing separately from the browser's active result set. Internal quote approval binds a listing, quantity and full total. Demo-code payment creates at most one stored `JG-` order per quote. Provider bookings retain their authenticated Wiggy or Tomato confirmation paths.

Anonymous profiles, active requirements, and internal receipts are scoped by an HTTP-only browser session. Location can be saved after explicit confirmation. The closest known demo neighborhood is an approximation and the user can supply a delivery landmark. Returning users can forget their saved profile without discarding their order references.

## 9. Dialogue orchestration

The agent resolves clear reference, repeat, comparison, navigation and microphone actions before invoking Gemini. Gemini returns a validated action and constraint patch for requests that need reasoning. The server stores a bounded task history, canonical intent, displayed result order, current selection and last answer. Repetition reuses saved speech text and an unexpired Timbre ticket. Offer explanations use saved quotes. Reopening a task restores its comparison and requires a fresh quote before payment.

Quote review and explicit approval are separate from payment authorization. A model action cannot approve payment. The browser still requires the demo keypad, and order creation remains idempotent. Request IDs protect the session from duplicate turns and stale updates. Diagnostic headers carry action labels, durations and provider batch counts.

### Conversation-first routing

A dialogue action and its subject domain are separate. Gemini uses optional function calling and can return a validated direct answer, advice or clarification. Discovery is gated on a shopping action and a compatible domain. The controller also handles greetings, references and other clear actions locally. A direct answer can keep a task in the background, and a task switch starts fresh requirements while preserving the approved profile.

Conversation state stores a bounded topic, last response and clarification. The shopping task owns constraints and offer snapshots. The checkout backend owns quote validity, authorization, payment and order state. Diagnostics report routing, task transitions, tool choices, search outcomes and timings without logging transcripts or secrets.

### Verification boundary

The latest reference was verified via live API calls through an unapproved quote. Prior browser checkout used synthetic microphone input and mocked speech with real SQLite booking. Physical microphone accuracy, first audible response latency and production PostgreSQL checkout require separate verification. See [the current takeover handoff](docs/DEVELOPMENT_HANDOFF.md#latest-handoff--codex-to-antigravity) for evidence and the next test.
