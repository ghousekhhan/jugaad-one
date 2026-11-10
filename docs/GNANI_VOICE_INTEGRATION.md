# Gnani voice personalization

Jugaad sends microphone audio to Gnani Prisma for transcription, passes finalized text and locale to Gemini for reasoning, and sends the visible assistant reply to Gnani Timbre for speech. Selecting a voice changes the Timbre voice ID. Gemini still controls phrasing through the existing locale and conversation context.

## Integration and models

- **Prisma** uses `POST https://api.vachana.ai/stt/v3` with a mono 16 kHz WAV, `language_code` and `format=transcribe`. Prior live responses reported `prisma-v2.5`. English, Hindi and Telugu use their matching recognition locales. Hinglish uses Hindi recognition and `hi-en` synthesis.
- **Timbre** uses `timbre-v2.5` on `POST /api/v1/tts/inference` for buffered WAV or `POST /api/v1/tts/sse` for streaming. The server validates the WAV and relays streaming audio as PCM for Web Audio playback. Gnani requests use direct HTTP and a server-side `X-API-Key-ID`.
- **Gemini** still interprets finalized transcripts and requests the existing workflows. Voice selection supplies no new parameters to Gemini or Prisma.

## Verified catalog

Each listed ID returned valid, non-silent WAV and completed SSE synthesis with the project credentials. The descriptions in the picker summarize the provider catalog. The timings below are individual short-sample measurements. They exclude browser playback and are not latency guarantees.

| Locale | Exact voice ID | WAV ms | SSE first audio ms |
| --- | --- | ---: | ---: |
| English `en-IN` | Kaveri (default) | 1157 | 753 |
| English `en-IN` | Pranav | 855 | 654 |
| English `en-IN` | Devika | 796 | 566 |
| English `en-IN` | Shlok | 1340 | 871 |
| English `en-IN` | Trupti | 944 | 619 |
| Hindi `hi-IN` | Nalini (default) | 727 | 582 |
| Hindi `hi-IN` | Bhavna | 1010 | 753 |
| Hindi `hi-IN` | Deepak | 1130 | 756 |
| Hindi `hi-IN` | Yashvi | 937 | 526 |
| Hindi `hi-IN` | Urmila | 825 | 584 |
| Telugu `te-IN` | Varuni (default) | 1065 | 724 |
| Telugu `te-IN` | Suhana | 888 | 686 |
| Telugu `te-IN` | Lehara | 1238 | 742 |
| Telugu `te-IN` | Lavanya | 781 | 622 |
| Telugu `te-IN` | Yukti | 1057 | 685 |
| Hinglish `hi-en` | Poorvi (default) | 767 | 709 |

Gnani lists Poorvi as the only preferred Hinglish voice. The first parallel verification run returned HTTP 429 for many probes. Paced requests completed for all 16 voices.

## Selection and playback

Onboarding shows the picker after language confirmation. Profile shows **Voice & Language**, the active voice and the same preview controls. The session stores `language`, `voice` and `model` together through the commerce endpoint. Saving a voice updates only that preference. Changing language uses the verified default for the new locale, with an on-screen notice.

Previews use fixed locale-specific samples. The server checks each voice and locale against the verified catalog. The same playback controller handles previews and agent replies, aborts stale requests and replays the most recent clip from memory. Saving a voice clears older audio. Signed reply tickets and verified transaction announcements resolve the current preference at synthesis time. Preview errors identify the requested voice accurately. For a recoverable failure before a reply stream starts, the server can try one compatible catalog voice and report the actual voice in a playback notice. Rate limits, authentication failures and failures after audio has started surface as errors.

Gnani credentials stay on the server. Preview callers can request a fixed sample and an allowlisted voice. Regular replies still require a signed ticket or an owned transaction. Audio responses are sent with `Cache-Control: no-store`.

## Verification and implementation files

- The live app regression ran English, Hindi, Telugu and Hinglish through previews, a general question, a marketplace search and a contextual follow-up. It checked the selected voice and model in the speech response, switched voices where the catalog offered a choice, and checked saved offers, dialogue and orders after the switch. Reload restored the saved voice in Profile.
- A Chrome UI check played and stopped a live Kaveri preview and saved Pranav. The synthetic microphone regression confirmed the spoken onboarding flow and completed simulated checkout. This verifies browser behavior with synthetic microphone input. Physical microphone capture and mobile Safari audio remain unverified.
- The 81-test suite, lint, typecheck and production build passed. Tests cover invalid combinations and IDs, provider failure and reply-only fallback. The compiled browser JavaScript contains no Gnani credential.

The catalog and Gnani payload are in `src/lib/voice/catalog.ts`, `types.ts` and `gnani.ts`. Session persistence is in `src/lib/commerce/session.ts` and `src/app/api/commerce/route.ts`. Synthesis resolves the selection in `src/app/api/voice/speak/route.ts`. The picker, onboarding and playback are in `src/components/voice-picker.tsx`, `approved-settings.tsx`, `workspace.tsx` and `use-voice-playback.ts`. The live regression is `tests/voice-personalization.browser.mjs`.

## Official references

- [Gnani speech API introduction](https://docs.gnani.ai/api/introduction/quick-start)
- [Timbre v2.5 available voices](https://docs.gnani.ai/api/TTS/available-voices)
- [Prisma speech-to-text](https://docs.gnani.ai/api/STT/speech-to-text)
- [Timbre inference](https://docs.gnani.ai/api/TTS/tts-inference) and [streaming](https://docs.gnani.ai/api/TTS/tts-sse)
- [Gnani Vachana SDK repository](https://github.com/Gnani-AI-Mintlify/Gnani-Vachana)
