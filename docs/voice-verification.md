# Gnani voice verification

The workspace originally displayed voice placeholders and integration interfaces. It now records a 16 kHz mono PCM WAV with AudioWorklet, displays the Prisma transcript for review, and sends the edited text through the existing Gemini turn. The server builds spoken replies from validated marketplace results and checkout state. It signs conversational replies and checks transaction ownership for quote and receipt announcements. Gnani Timbre is the only speech playback source.

## API contracts

- Prisma uses the Vachana speech-to-text v3 endpoint with multipart `audio_file`, `language_code`, and `format=transcribe`. The live responses identified the model as `prisma-v2.5`. [Prisma documentation](https://docs.gnani.ai/api/STT/speech-to-text)
- Timbre uses the Vachana inference endpoint with `timbre-v2.5` and returns 16 kHz mono PCM WAV. The server finalizes open-ended WAV headers before sending audio to the browser. Push-to-talk replies use the binary REST endpoint. [Timbre inference](https://docs.gnani.ai/api/TTS/tts-inference) · [Voice catalog](https://docs.gnani.ai/api/TTS/available-voices) · [SSE documentation](https://docs.gnani.ai/api/TTS/tts-sse)
- Both requests authenticate through the server with the configured `GNANI_API_KEY`. The browser gets a transcript or audio and its caption. [Gnani quick start](https://docs.gnani.ai/api/introduction/quick-start)

## Live account probes

Each row is one direct API measurement. Timbre synthesized the test utterance, then Prisma transcribed that generated clip. These samples check the account, language handling and audio format. Browser capture and the physical microphone test are separate checks.

| Utterance | Timbre voice | Prisma locale | Timbre | Prisma | Verified transcript details |
| --- | --- | --- | ---: | ---: | --- |
| English search | Kaveri | `en-IN` | 1,425 ms | 300 ms | Chicken dum biryani, Banjara Hills in Hyderabad, under ₹450 |
| Hindi search | Nalini | `hi-IN` | 911 ms | 277 ms | The dish, location and ₹450 budget in Hindi |
| Telugu search | Varuni | `te-IN` | 645 ms | 359 ms | The dish, location and ₹450 budget in Telugu |
| Hinglish search | Poorvi | `hi-IN` | 784 ms | 223 ms | The dish, location and ₹450 budget in code-mixed speech |
| Telugu revision | Varuni | `te-IN` | 706 ms | 353 ms | Keep the budget, stay within 5 km and choose the cheapest offer |
| Hinglish revision | Poorvi | `hi-IN` | 694 ms | 224 ms | Keep the budget, stay within 5 km and choose the cheapest offer |

The user confirmed that a physical-microphone request produced a transcript and audible reply in the local workspace. That manual check did not capture timings or an annotated test utterance.

## Live conversation and checkout

The Telugu and Hinglish audio fixtures each ran through the workspace routes for two turns. Prisma transcribed the search for chicken dum biryani under ₹450 in Banjara Hills, Hyderabad. Gemini `gemini-3.5-flash-lite` used the transcript to search both live provider APIs. Wiggy quoted ₹402.45 and Tomato quoted ₹423.35. The second utterance kept the dish, location, and budget, added a 5 km radius, and selected Wiggy at the lower eligible total. Timbre returned WAV audio with a caption that matched each displayed reply.

| Workspace request | Prisma | Gemini and marketplace | Timbre |
| --- | ---: | ---: | ---: |
| Telugu search | 863 ms | 7,560 ms | 1,769 ms |
| Telugu revision | 404 ms | 4,480 ms | 2,059 ms |
| Hinglish search | 370 ms | 7,793 ms | 1,025 ms |
| Hinglish revision | 382 ms | 4,882 ms | 1,433 ms |

The timings are individual successful requests and exclude recording time. The browser also captured the initial Telugu fixture through AudioWorklet. It received a Prisma transcript, provider results and a 245,804-byte Timbre WAV.

The marketplace returned independent quote request IDs for both providers after each revision.

| Revision | Wiggy quote request | Tomato quote request |
| --- | --- | --- |
| Telugu | `fd157614-7b2e-49af-93c9-1692648f1169` | `ae15850e-6abe-456f-93ff-43b2cedae1c9` |
| Hinglish | `90ca314c-3fa8-453b-afff-f2eaffc52cf6` | `76e5457e-6148-4497-b2ae-3d03e5f864cf` |

The Telugu checkout used the exact ₹402.45 quote. Timbre generated the approval question in 1,373 ms. The confirmation route returned HTTP 409 before booking. Following explicit approval and simulated payment, Wiggy confirmed sandbox order `WIG-D8CE35AD`. The receipt reported `simulated_no_charge`, and a separate tracking read returned `confirmed`. Timbre generated the confirmation with the actual reference in 1,574 ms.

An English request without a location produced a spoken clarification in 596 ms. Lowering the budget to ₹10 produced a spoken no-match reply in 1,281 ms after both provider searches returned evidence.

## Failure and fallback checks

- The local transcription route returned `422 VOICE_SILENCE` for silent PCM, `415 VOICE_FORMAT` for malformed audio, and `400 VOICE_LANGUAGE` for an unsupported locale.
- Chrome at 375 px showed a microphone-denial message and kept typing enabled. Two rapid clicks on **Send message** issued one Gemini request and received a clarification. An injected speech outage displayed the error and kept the conversation usable.
- Automated tests cover the upstream Gnani contract, sanitized upstream errors, invalid audio, signed reply validation, transaction ownership and provider confirmation gating. Marketplace tests cover failure, price changes, quote expiry, retries and duplicate booking prevention.
- Prisma intermittently returned service errors and rate limits during repeated fixture tests. The workspace exposed the failure and kept text input usable. The same Hinglish fixture succeeded on a later attempt.
