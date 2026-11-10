type Note = readonly [frequency: number, offset: number, length: number, gain: number];

export const cues = {
  "ui.click": [[330, 0, .055, .11]],
  "voice.start": [[392, 0, .085, .22], [587, .065, .115, .18]],
  "voice.stop": [[440, 0, .065, .15], [330, .05, .09, .12]],
  "voice.ready": [[523, 0, .105, .15]],
  "search.results": [[440, 0, .085, .17], [659, .055, .125, .16]],
  "offer.select": [[349, 0, .065, .19], [523, .04, .095, .12]],
  "discount.applied": [[440, 0, .095, .17], [554, .06, .11, .15], [659, .12, .14, .13]],
  "payment.processing": [[349, 0, .085, .13], [440, .065, .105, .1]],
  "payment.success": [[392, 0, .14, .21], [494, .08, .15, .17], [587, .16, .19, .15], [784, .25, .23, .13]],
  "action.error": [[330, 0, .09, .14], [294, .065, .13, .12]],
} as const satisfies Record<string, readonly Note[]>;

export type SoundEvent = keyof typeof cues;
export type FeedbackPreferences = { sounds: boolean; volume: "low" | "medium" | "high"; motion: "system" | "reduce" };
const defaults: FeedbackPreferences = { sounds: true, volume: "low", motion: "system" };
const key = "jugaad-feedback-v1";
const subscribers = new Set<() => void>();
const volumes = { low: .14, medium: .23, high: .34 };
let preferences = defaults;
let loaded = false;
let context: AudioContext | undefined;
let resuming: Promise<void> | undefined;
let master: GainNode | undefined;
let current: { stop: () => void; event: SoundEvent } | undefined;
let last: { event: SoundEvent; at: number } | undefined;
let holds = 0;

export function getPreferences() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      if (value && typeof value.sounds === "boolean" && Object.hasOwn(volumes, value.volume) &&
          (value.motion === "system" || value.motion === "reduce")) preferences = value;
    } catch { /* Use browser defaults when storage is unavailable. */ }
  }
  return preferences;
}

export const getDefaultPreferences = () => defaults;

export function subscribePreferences(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

export function updatePreferences(next: FeedbackPreferences) {
  preferences = next;
  loaded = true;
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Changes still apply to this page. */ }
  if (!next.sounds) stopSound();
  if (context && master) master.gain.setValueAtTime(volumes[next.volume], context.currentTime);
  for (const listener of subscribers) listener();
}

export function primeSound() {
  if (typeof window === "undefined" || !window.AudioContext || !getPreferences().sounds) return;
  try {
    if (!context || context.state === "closed") {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = volumes[preferences.volume];
      master.connect(context.destination);
    }
    if (context.state !== "running") resuming = context.resume().catch(() => {});
  } catch { /* Interface feedback remains available without audio. */ }
}

export function stopSound() {
  current?.stop();
}

export function holdSounds() {
  holds++;
  stopSound();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
  };
}

export function closeSound() {
  stopSound();
  if (context && context.state !== "closed") void context.close().catch(() => {});
  context = undefined;
  master = undefined;
  resuming = undefined;
  last = undefined;
}

export async function playSound(event: SoundEvent, signal?: AbortSignal) {
  if (signal?.aborted || holds || !getPreferences().sounds) return;
  if (context?.state === "suspended" && resuming) {
    const attempt = resuming;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 80);
      void attempt.then(() => { clearTimeout(timeout); resolve(); });
    });
  }
  const audio = context;
  const output = master;
  if (signal?.aborted || !getPreferences().sounds || holds || !audio || !output || audio.state !== "running") return;
  const now = performance.now();
  if (current?.event === event || (last?.event === event && now - last.at < 380)) return;
  if (current?.event === "payment.success") return;
  stopSound();
  last = { event, at: now };

  await new Promise<void>((resolve) => {
    const nodes: { tone: OscillatorNode; envelope: GainNode }[] = [];
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", stop);
      for (const { tone, envelope } of nodes) {
        try { tone.stop(); } catch { /* It may have already ended. */ }
        tone.disconnect();
        envelope.disconnect();
      }
      if (current?.stop === stop) current = undefined;
      resolve();
    };
    current = { event, stop };
    signal?.addEventListener("abort", stop, { once: true });
    try {
      const start = audio.currentTime + .008;
      let duration = 0;
      for (const [frequency, offset, length, gain] of cues[event]) {
        const tone = audio.createOscillator();
        const envelope = audio.createGain();
        nodes.push({ tone, envelope });
        const at = start + offset;
        tone.type = "sine";
        tone.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001, at);
        envelope.gain.exponentialRampToValueAtTime(gain, at + .012);
        envelope.gain.exponentialRampToValueAtTime(.0001, at + length);
        tone.connect(envelope).connect(output);
        tone.start(at);
        tone.stop(at + length);
        duration = Math.max(duration, offset + length);
      }
      timeout = setTimeout(stop, (duration + .055) * 1000);
    } catch { stop(); }
  });
}
