export const voiceSampleRate = 16_000;
export const maxRecordingSeconds = 30;
export const maxWaveBytes = 44 + voiceSampleRate * 2 * maxRecordingSeconds;
export const waveformBars = 9;

export function waveformLevels(sampleCount: number, sampleAt: (index: number) => number) {
  return Array.from({ length: waveformBars }, (_, bar) => {
    let peak = 0;
    const start = Math.floor(bar * sampleCount / waveformBars);
    const end = Math.floor((bar + 1) * sampleCount / waveformBars);
    for (let index = start; index < end; index += 4) peak = Math.max(peak, Math.abs(sampleAt(index)));
    return Math.min(1, Math.sqrt(peak));
  });
}

const isTag = (bytes: Uint8Array, at: number, tag: string) => [...tag].every((character, offset) => bytes[at + offset] === character.charCodeAt(0));

export function encodeVoiceWave(chunks: readonly Float32Array[]) {
  const count = Math.min(chunks.reduce((total, chunk) => total + chunk.length, 0), voiceSampleRate * maxRecordingSeconds);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const tag = (offset: number, text: string) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  tag(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); tag(8, "WAVE");
  tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, voiceSampleRate, true); view.setUint32(28, voiceSampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, "data"); view.setUint32(40, count * 2, true);
  let index = 0;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      if (index === count) return buffer;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(44 + index * 2, clamped * (clamped < 0 ? 32768 : 32767), true);
      index += 1;
    }
  }
  return buffer;
}

export function inspectVoiceWave(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 44 || !isTag(bytes, 0, "RIFF") || !isTag(bytes, 8, "WAVE") || view.getUint32(4, true) + 8 !== bytes.length) return;
  let formatFound = false;
  let audio: { start: number; length: number } | undefined;
  for (let cursor = 12; cursor + 8 <= bytes.length;) {
    const length = view.getUint32(cursor + 4, true);
    const start = cursor + 8;
    if (start + length > bytes.length) return;
    if (isTag(bytes, cursor, "fmt ")) {
      if (formatFound || length < 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1 || view.getUint32(start + 4, true) !== voiceSampleRate || view.getUint32(start + 8, true) !== voiceSampleRate * 2 || view.getUint16(start + 12, true) !== 2 || view.getUint16(start + 14, true) !== 16) return;
      formatFound = true;
    }
    if (isTag(bytes, cursor, "data")) {
      if (audio || length % 2 !== 0) return;
      audio = { start, length };
    }
    cursor = start + length + (length % 2);
  }
  if (!formatFound || !audio?.length) return;
  const samples = audio.length / 2;
  let signal = 0;
  for (let index = 0; index < samples; index += 1) {
    if (Math.abs(view.getInt16(audio.start + index * 2, true)) > 100) signal += 1;
  }
  return { seconds: samples / voiceSampleRate, hasSignal: signal >= voiceSampleRate * 0.025, pcmStart: audio.start, samples };
}

export function finalizeTimbreWave(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length > 44 && isTag(bytes, 0, "RIFF") && isTag(bytes, 8, "WAVE") && isTag(bytes, 12, "fmt ") &&
      view.getUint32(16, true) === 16 && isTag(bytes, 36, "data") && view.getUint32(4, true) === 0xffffffff && view.getUint32(40, true) === 0xffffffff) {
    view.setUint32(4, bytes.length - 8, true);
    view.setUint32(40, bytes.length - 44, true);
  }
  return buffer;
}

export function calculateChunkEnergy(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const val = samples[index];
    sum += val * val;
  }
  return Math.sqrt(sum / samples.length);
}

export const minTurnSpeechSeconds = 0.22;
export const turnSilenceSeconds = 0.85;

export type VadOptions = {
  speechThreshold?: number;
  silenceThreshold?: number;
  minSpeechSamples?: number;
  silenceTimeoutSamples?: number;
};

export type VadState = {
  energy: number;
  speaking: boolean;
  hasSpoken: boolean;
  speechSamples: number;
  silenceSamples: number;
  turnEnded: boolean;
};

export function createVoiceActivityDetector(options: VadOptions = {}) {
  const speechThreshold = options.speechThreshold ?? 0.025;
  const silenceThreshold = options.silenceThreshold ?? 0.016;
  const minSpeechSamples = options.minSpeechSamples ?? Math.round(voiceSampleRate * minTurnSpeechSeconds);
  const silenceTimeoutSamples = options.silenceTimeoutSamples ?? Math.round(voiceSampleRate * turnSilenceSeconds);

  let speechSamples = 0;
  let silenceSamples = 0;
  let hasSpoken = false;

  return {
    process(chunk: Float32Array): VadState {
      const energy = calculateChunkEnergy(chunk);
      const isSpeechFrame = energy >= speechThreshold;
      const isSilenceFrame = energy < silenceThreshold;

      if (isSpeechFrame) {
        hasSpoken = true;
        speechSamples += chunk.length;
        silenceSamples = 0;
      } else if (isSilenceFrame && hasSpoken) {
        silenceSamples += chunk.length;
      }

      const turnEnded = hasSpoken && speechSamples >= minSpeechSamples && silenceSamples >= silenceTimeoutSamples;

      return {
        energy,
        speaking: isSpeechFrame,
        hasSpoken,
        speechSamples,
        silenceSamples,
        turnEnded,
      };
    },
    reset() {
      speechSamples = 0;
      silenceSamples = 0;
      hasSpoken = false;
    },
  };
}

