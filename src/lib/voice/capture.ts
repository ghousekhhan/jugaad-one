import { createVoiceActivityDetector, encodeVoiceWave, maxRecordingSeconds, minTurnSpeechSeconds, turnSilenceSeconds, voiceSampleRate, waveformLevels, type VadState } from "./wave";

export type VoiceCapture = {
  finish: () => Promise<ArrayBuffer>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  extractTurn: () => ArrayBuffer | null;
  resetTurn: () => void;
};

export type VoiceCaptureCallbacks = {
  onLevels?: (levels: number[]) => void;
  onSpeechState?: (state: VadState) => void;
  onTurnEnd?: (audio: ArrayBuffer, timing: { audioMs: number; endpointMs: number; encodeMs: number }) => void;
};

export async function beginVoiceCapture(
  signal: AbortSignal,
  onLevelsOrCallbacks: ((levels: number[]) => void) | VoiceCaptureCallbacks,
  continuousMode = false,
): Promise<VoiceCapture> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error("MIC_UNSUPPORTED");
  const context = new AudioContext({ sampleRate: voiceSampleRate });
  let stream: MediaStream | undefined;
  let worklet: AudioWorkletNode | undefined;
  let closed = false;

  const callbacks: VoiceCaptureCallbacks = typeof onLevelsOrCallbacks === "function"
    ? { onLevels: onLevelsOrCallbacks }
    : onLevelsOrCallbacks;

  const vad = createVoiceActivityDetector();

  const close = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", close);
    stream?.getTracks().forEach((track) => track.stop());
    worklet?.port.close();
    if (context.state !== "closed") void context.close().catch(() => undefined);
  };
  signal.addEventListener("abort", close, { once: true });
  try {
    if (context.sampleRate !== voiceSampleRate || !context.audioWorklet) throw new Error("MIC_UNSUPPORTED");
    const permission = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then((device) => {
      if (closed) { device.getTracks().forEach((track) => track.stop()); return; }
      stream = device;
    });
    await Promise.all([context.resume(), permission]);
    signal.throwIfAborted();
    await context.audioWorklet.addModule("/voice/capture.js");
    signal.throwIfAborted();
    const source = context.createMediaStreamSource(stream!);
    worklet = new AudioWorkletNode(context, "jugaad-voice-capture", { channelCount: 1, channelCountMode: "explicit" });
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(worklet).connect(silent).connect(context.destination);
    const chunks: Float32Array[] = [];
    let samples = 0;
    let complete: (() => void) | undefined;
    worklet.port.onmessage = ({ data }: MessageEvent<{ chunk?: Float32Array; done?: boolean }>) => {
      if (data.done) { complete?.(); return; }
      if (data.chunk) {
        const chunk = data.chunk;
        const vadState = vad.process(chunk);
        callbacks.onLevels?.(waveformLevels(chunk.length, (index) => chunk[index]));
        callbacks.onSpeechState?.(vadState);
        if (samples >= voiceSampleRate * maxRecordingSeconds && !continuousMode) return;
        samples += data.chunk.length;
        chunks.push(data.chunk);
        if (continuousMode && !vadState.turnEnded && vadState.silenceSamples >= Math.round(voiceSampleRate * turnSilenceSeconds)) {
          chunks.length = 0;
          samples = 0;
          vad.reset();
          return;
        }
        if (continuousMode && (vadState.turnEnded || samples >= voiceSampleRate * maxRecordingSeconds)) {
          const encodeStart = performance.now();
          const turnAudio = encodeVoiceWave(chunks);
          const timing = { audioMs: samples / voiceSampleRate * 1000, endpointMs: vadState.silenceSamples / voiceSampleRate * 1000, encodeMs: performance.now() - encodeStart };
          chunks.length = 0;
          samples = 0;
          vad.reset();
          if (vadState.speechSamples >= voiceSampleRate * minTurnSpeechSeconds) callbacks.onTurnEnd?.(turnAudio, timing);
        } else if (continuousMode && !vadState.hasSpoken && chunks.length > 2) {
          samples -= chunks.shift()!.length;
        }
      }
    };
    return {
      cancel: close,
      pause() {
        worklet?.port.postMessage({ pause: true });
      },
      resume() {
        vad.reset();
        chunks.length = 0;
        samples = 0;
        worklet?.port.postMessage({ resume: true });
      },
      resetTurn() {
        chunks.length = 0;
        samples = 0;
        vad.reset();
      },
      extractTurn() {
        if (chunks.length === 0) return null;
        const turnAudio = encodeVoiceWave(chunks);
        chunks.length = 0;
        samples = 0;
        vad.reset();
        return turnAudio;
      },
      async finish() {
        try {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("MIC_CAPTURE_FAILED")), 1500);
            complete = () => { clearTimeout(timer); resolve(); };
            worklet!.port.postMessage({ stop: true });
          });
          signal.throwIfAborted();
          return encodeVoiceWave(chunks);
        } finally { close(); }
      },
    };
  } catch (error) { close(); throw error; }
}

