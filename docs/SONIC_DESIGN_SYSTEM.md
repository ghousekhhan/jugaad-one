# Jugaad One sonic design

Jugaad uses short, rounded sine tones for changes users can see. A low-volume tap marks navigation. Rising intervals mark activation and discovery. A four-note cadence belongs to a confirmed simulated payment. The interface stays quiet during typing, thinking and continuous microphone capture.

All cues are synthesized in the browser by [the sound engine](../src/lib/sound/engine.ts). The registry contains original note sequences and envelopes. It uses no external recordings, samples or third-party sound assets.

| Event | Trigger | Nominal length | Visual counterpart |
| --- | --- | ---: | --- |
| `ui.click` | Switch workspace tabs | 55 ms | Active tab |
| `voice.start` | Start recording from a user gesture | 180 ms | Activation ring and microphone state |
| `voice.stop` | Finish or end recording | 140 ms | Capture stops and the status changes |
| `voice.ready` | Homepage microphone permission is granted and the permission probe releases its tracks | 105 ms | Onboarding advances |
| `search.results` | A new search returns results | 180 ms | Offer cards appear |
| `offer.select` | Choose a provider quote or resolve an offer selection | 135 ms | Selected quote opens |
| `discount.applied` | Backend returns an applied welcome offer | 260 ms | Discount line and updated total |
| `payment.processing` | Start payment authorization or explicitly check a pending booking | 170 ms | Progress indicator |
| `payment.success` | Backend confirms the simulated booking at the approved total | 480 ms | Receipt, checkmark and confetti |
| `action.error` | A supported microphone, search, checkout or payment action fails | 195 ms | Error text and recovery controls |

A trusted pointer or keyboard gesture primes a shared Web Audio context. A master gain controls volume. The engine replaces an active cue before scheduling another and drops rapid repeats of the same cue. A confirmed payment cadence takes priority over subsequent interface cues. Oscillators disconnect after playback or cancellation. The app releases the shared context when the root client component unmounts. The visual states continue to work if Web Audio is unavailable or autoplay is blocked.

The browser requests microphone permission from the original gesture. The recorder waits for the activation cue and its short tail before connecting the microphone to the worklet. Capture holds interface audio until the stream closes, including when a continuous session is paused. Timbre loading and playback also hold interface audio. Interruption clears active feedback. Payment narration waits for the success cue to settle and is cancelled if the user leaves the payment page. Prisma transcription, Timbre playback and backend checkout still use their existing services.

Motion uses a 140 ms press transition, a 240 ms entrance, and the existing card stagger. The homepage heading and activation ring animate once. The orb scales from microphone levels while listening and playback levels while speaking. The payment confirmation draws the checkmark before the canvas celebration, with fewer particles on smaller or less capable devices. Motion relies mostly on opacity and transforms.

**Profile → Sound & Motion** stores interface sound, volume and motion in this browser. Sound defaults to on at Low. Switching it off stops an active cue immediately. Voice playback has its own mute control. The motion preference follows the system by default. Selecting Reduce motion disables decorative CSS motion and canvas confetti even if the system allows animation. Labels, focus indicators, errors and receipts remain available regardless of preference.

## Verification

- The test suite passed 80 tests. The sound test covers gesture initialization, cue replacement, duplicate suppression, capture holds, immediate mute and preference storage.
- The Chrome voice regression verified that both activation notes stopped before the capture worklet loaded. Mocked Prisma finals drove the existing dialogue and checkout flow. Browser instrumentation verified one discovery cue, one selection cue and one cue after the backend applied the discount.
- The Chrome payment regression verified that processing and an injected failure did not schedule the success signature. A confirmed internal simulated checkout scheduled it once. Reload restored the receipt without replaying the signature. Profile preferences survived refresh. The checkout was tested at desktop and mobile viewport sizes, with browser payment narration intercepted.
- Lint, typecheck and the production build passed.

Browser tests observe scheduling and state changes. Acoustic leakage, playback loudness, speech intelligibility and mobile Safari remain unverified on physical devices. See the [development handoff](DEVELOPMENT_HANDOFF.md) for the working tree state.
