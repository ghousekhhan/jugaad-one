import { encodeVoiceWave, voiceSampleRate } from "./wave";

export function pcmPlayback(context: AudioContext, muted: boolean) {
  const gain = context.createGain();
  gain.gain.value = muted ? 0 : 1;
  gain.connect(context.destination);
  const sources = new Set<AudioBufferSourceNode>();
  const chunks: Uint8Array[] = [];
  let cursor = context.currentTime + 0.06;
  let bytes = 0;
  let finished = false;
  let carry: number | undefined;
  let resolveEnd: () => void;
  const end = new Promise<void>((resolve) => { resolveEnd = resolve; });

  function settle() {
    if (finished && !sources.size) {
      gain.disconnect();
      resolveEnd();
    }
  }

  return {
    end,
    mute(value: boolean) { gain.gain.value = value ? 0 : 1; },
    stop() {
      finished = true;
      for (const source of sources) { source.onended = null; source.stop(); source.disconnect(); }
      sources.clear();
      settle();
    },
    add(chunk: Uint8Array) {
      if (finished) return undefined;
      const data = new Uint8Array(chunk.length + (carry === undefined ? 0 : 1));
      if (carry !== undefined) data[0] = carry;
      data.set(chunk, data.length - chunk.length);
      const even = data.length - data.length % 2;
      carry = even === data.length ? undefined : data[even];
      if (even === 0) return undefined;
      bytes += even;
      if (bytes > 2_100_000) throw new Error("Timbre returned too much audio.");
      chunks.push(data.subarray(0, even));
      const buffer = context.createBuffer(1, even / 2, voiceSampleRate);
      const samples = buffer.getChannelData(0);
      const view = new DataView(data.buffer);
      for (let index = 0; index < samples.length; index++) samples[index] = view.getInt16(index * 2, true) / 32768;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      sources.add(source);
      const startsAt = Math.max(cursor, context.currentTime + 0.025);
      source.onended = () => { sources.delete(source); source.disconnect(); settle(); };
      source.start(startsAt);
      cursor = startsAt + buffer.duration;
      return { samples, leadMs: (startsAt - context.currentTime) * 1000 };
    },
    finish() {
      if (!bytes || carry !== undefined) throw new Error("Timbre did not return complete audio.");
      finished = true;
      settle();
      const wav = new Uint8Array(44 + bytes);
      wav.set(new Uint8Array(encodeVoiceWave([])));
      const view = new DataView(wav.buffer);
      view.setUint32(4, wav.length - 8, true);
      view.setUint32(40, bytes, true);
      let offset = 44;
      for (const part of chunks) { wav.set(part, offset); offset += part.length; }
      return wav.buffer;
    },
  };
}
