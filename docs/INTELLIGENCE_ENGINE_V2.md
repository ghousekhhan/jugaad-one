# Intelligence engine V2

Branch `codex/intelligence-engine-v2`, based on `5d4101c`. This is a local engineering candidate, not a production-readiness certification. No deployment or merge was performed.

## Request path

The existing recorder produces completed PCM WAV utterances. Prisma returns a final transcript; voice-controls rejects aborted and repeated response IDs. Workspace sends a UUID turn ID to `/api/agent/interpret`. The route reserves that ID in the existing versioned session document before interpretation. A duplicate last turn replays its saved result, older processed IDs conflict, and a newer reservation prevents a stale result from committing.

The dialogue controller resolves unambiguous local actions before calling Gemini with the existing AUTO function-calling contract. The current model default remains `gemini-3.5-flash-lite`. Model interpretation cannot authorize transactions. Only explicit discovery actions in compatible domains reach the provider or internal catalog. An informational-question reclassification fallback remains deliberately intact; removing it safely needs live evaluations.

The controller passes bounded history, current structured constraints, selected offer, recommendation, explicit pending action, derived workflow, recent decisions and up to three previous task snapshots to Gemini. Saved preferences are suggestion context only. Backend filters and ranking still determine eligible offers using final payable amounts, rating, distance, exclusions and availability. Recommendation explanations read saved provider data. Declined recommendation IDs are remembered within the task and excluded from subsequent automatic recommendations.

## Memory and state

- Working memory remains the validated FoodIntent, current Task, exact offers, selected ID and authoritative quote. Missing patch properties preserve values. `clear` explicitly removes a property. Numeric amounts and quote IDs never move into generated summaries.
- Session memory retains four recent dialogue pairs, three recent requests and three previous tasks. The added twelve-entry decision history records actions, transitions and changed field names without duplicating user text or locations. It is a deterministic compact record, not a narrative LLM summary.
- Workflow is derived from existing state as idle, clarifying, comparing, awaiting selection, awaiting quote approval or awaiting payment approval. Processing and confirmed/failed phases remain in transaction records, avoiding contradictory parallel state machines.
- Long-term language and voice persistence remain unchanged. `POST /api/commerce` accepts `{action:"preferences",userApproved:true,preferences:{dietaryRestrictions?,cuisines?,typicalBudgetPaise?}}`; `preferences:null` clears saved preferences. A saved profile is required. Ordinary turns never write these preferences. Profile changes retain them, and deleting a profile clears them. No new preference form was added to the UI.

## Response actions

Repeat uses exact stored text without Gemini. Simplify, elaborate and translate use a bounded, tool-free Gemini generation call with JSON validation, an abort signal and a 15-second timeout. The legacy rephrase action maps to simplification or translation. Names and numeric occurrence counts are checked against the source, and invalid rewrites produce a recoverable error rather than becoming a saved answer. This mechanical validation does not prove semantic equivalence, and live multilingual rewriting still requires evaluation.

Read-only follow-ups preserve the pending confirmation and quote approval reference. Recommendation → explanation → yes selects the saved recommended offer. Quote review → explanation → yes approves that quote, separately from payment. Stop-speaking/pause controls clear the transient confirmation, retaining the existing pause behavior. Cancellation, changed requirements, replacement quotes and task switching continue to invalidate transactional context. Expiry and payable totals remain checked by backend transaction services.

## Persistence and payment safety

Missing or unavailable session storage returns HTTP 503 before model or commerce work. The route never substitutes an empty session. The client receives a retry message. Existing provider and internal booking services enforce owner, approved total, expiry and idempotency. The workspace still opens Jugaad Pay for explicit simulated payment authorization. Legacy API voice authorization remains supported through its separate pending-payment confirmation. No automatic payment retries were introduced.

The application retains PostgreSQL support and development SQLite. No migration, dependency or environment change is required. Production still requires its configured persistent database. No environment values were inspected during this work.

## Diagnostics and verification

Each result retains its turn ID, reasoning source, invoked tool names and timings. The trace adds derived workflow before/after and changed field names. Existing development-only `JUGAAD_DEBUG_DIALOGUE=1` diagnostics remain available. Full transcripts, credentials and addresses are not added to diagnostics.

Verified on 2026-11-13 with isolated fixtures and temporary SQLite databases:

- `npm test`: 91 passed, including the existing 30-utterance interrupted-session regression and provider, internal checkout, multilingual state and voice transport fixtures.
- Added route tests cover missing persistence, storage failure during session read, cached duplicate reply and older processed turn rejection. No network or paid model calls are used in these tests.
- Added controller checks cover recommendation → explain → repeat → yes, exact repeat versus generated simplification, and declined recommendations.
- Added rewrite guards, bounded decision history and preference validation/persistence/clear tests.
- Lint, typecheck and production build passed. Local `/workspace` responded HTTP 200.

The model's understanding of Romanized languages, actual rewrite quality, phone audio leakage, physical microphone behavior, remote PostgreSQL concurrency and deployment behavior were not reverified here. Existing tests with injected plans validate state handling, not real model comprehension. Existing saved provider fixtures validate integration compatibility, not current deployed provider uptime.

For an opt-in live model check, run the application, then `JUGAAD_LIVE_EVAL=1 node tests/intelligence.live.mjs`. It tests general answer → simplify → repeat → Hindi translation → end session, logs action/model/latency only and consumes Gemini credits. It is never part of `npm test`. This check was not executed during this change.

## Manual acceptance before merge

1. In a separate browser session, search for biryani under a budget, refine rating and distance, ask for the fastest recommendation, then ask why. Verify every displayed constraint and offer ID remains appropriate.
2. Say yes to select, review the quote, ask about price, approve it, and confirm payment remains a separate Jugaad Pay step.
3. Repeat, simplify, elaborate and translate a response. Compare all facts, prices and names. Check the selected Timbre voice and locale.
4. Switch to a clothing task, return with Go back, and verify a fresh quote is required. Cancel and end the voice session.
5. Evaluate actual Romanized Hindi/Telugu and physical microphone input. Check mobile Safari separately.

Next work should concentrate on live semantic rewrite evaluation and phone regression. The saved preference API needs a consent-aware Profile interface before it becomes a discoverable consumer feature. No claim is made that the entire V2 product brief is complete or ready to merge solely from these checks.

Official API reference consulted: [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). The existing Google GenAI SDK and model configuration are preserved.
