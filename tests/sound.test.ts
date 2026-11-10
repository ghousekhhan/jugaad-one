import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeSound, getPreferences, holdSounds, playSound, primeSound, updatePreferences,
} from "../src/lib/sound/engine";

test("interface cues require audio initialization, stay exclusive, and stop immediately on mute or capture", async () => {
  const saved = new Map<string, string>();
  const tones: { frequency: number; stopped: boolean }[] = [];
  let active = 0;
  let peak = 0;
  const gain = () => ({
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect: () => ({ connect() {} }), disconnect() {},
  });
  class MockAudio {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain = gain;
    createOscillator() {
      const frequency = { value: 0 };
      let note: (typeof tones)[number];
      return {
        type: "sine", frequency,
        connect: () => ({ connect() {} }), disconnect() {},
        start() {
          note = { frequency: frequency.value, stopped: false };
          tones.push(note);
          peak = Math.max(peak, ++active);
        },
        stop(at?: number) { if (at === undefined && !note.stopped) { note.stopped = true; active--; } },
      };
    }
    async close() { this.state = "closed"; }
  }
  Object.assign(globalThis, {
    window: { AudioContext: MockAudio },
    AudioContext: MockAudio,
    localStorage: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) },
  });
  try {
    await playSound("voice.start");
    assert.equal(tones.length, 0);
    primeSound();
    const activation = playSound("voice.start");
    await playSound("voice.start");
    assert.deepEqual(tones.map(({ frequency }) => frequency), [392, 587]);
    const releaseCapture = holdSounds();
    await activation;
    assert.equal(active, 0);
    await playSound("search.results");
    assert.equal(tones.length, 2);
    releaseCapture();
    releaseCapture();
    const search = playSound("search.results");
    const selection = playSound("offer.select");
    await search;
    assert.equal(active, 2);
    assert.equal(peak, 2);
    updatePreferences({ sounds: false, volume: "medium", motion: "reduce" });
    await selection;
    assert.equal(active, 0);
    await playSound("payment.success");
    assert.equal(tones.length, 6);
    assert.deepEqual(JSON.parse([...saved.values()][0]), getPreferences());
  } finally {
    closeSound();
    for (const name of ["window", "AudioContext", "localStorage"]) Reflect.deleteProperty(globalThis, name);
  }
});
