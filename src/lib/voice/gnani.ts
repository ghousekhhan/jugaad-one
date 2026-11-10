import "server-only";

import { z } from "zod";
import { MarketplaceError } from "../marketplace/provider";
import { voiceLanguages, type VoiceLocale, type VoiceTranscript } from "./types";
import { finalizeTimbreWave, inspectVoiceWave, voiceSampleRate } from "./wave";

const prismaEndpoint = "https://api.vachana.ai/stt/v3";
const timbreEndpoint = "https://api.vachana.ai/api/v1/tts/inference";
export const timbreModel = "timbre-v2.5";
export const maxVoiceReplyLength = 550;

export function gnaniConfigured() { return Boolean(process.env.GNANI_API_KEY?.trim()); }

export async function readAudioBytes(body: ReadableStream<Uint8Array> | null, limit: number): Promise<ArrayBuffer> {
  if (!body) throw new MarketplaceError("VOICE_FORMAT", 400);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => undefined);
        throw new MarketplaceError("VOICE_SIZE", 413);
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

async function requestGnani(endpoint: string, body: BodyInit, contentType: string | undefined, signal: AbortSignal) {
  const key = process.env.GNANI_API_KEY?.trim();
  if (!key) throw new MarketplaceError("VOICE_NOT_CONFIGURED", 503);
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST", body, signal: requestSignal, redirect: "error", cache: "no-store",
      headers: { "X-API-Key-ID": key, ...(contentType ? { "Content-Type": contentType } : {}) },
    });
  } catch {
    throw new MarketplaceError(requestSignal.aborted ? "VOICE_TIMEOUT" : "VOICE_UNAVAILABLE", requestSignal.aborted ? 504 : 502);
  }
  if (response.ok) return response;
  await response.body?.cancel().catch(() => undefined);
  if (response.status === 401 || response.status === 403) throw new MarketplaceError("VOICE_AUTH", 503);
  if (response.status === 429) throw new MarketplaceError("VOICE_RATE_LIMIT", 429);
  if (response.status === 400 || response.status === 415 || response.status === 422) throw new MarketplaceError("VOICE_REJECTED", 422);
  throw new MarketplaceError("VOICE_UNAVAILABLE", 502);
}

const transcriptResponse = z.object({ success: z.literal(true), transcript: z.string().max(10_000), model: z.string().max(60).optional(), request_id: z.string().max(80).optional() });

export async function transcribeVoice(audio: ArrayBuffer, language: VoiceLocale, signal: AbortSignal): Promise<VoiceTranscript> {
  const form = new FormData();
  form.append("audio_file", new Blob([audio], { type: "audio/wav" }), "recording.wav");
  form.append("language_code", voiceLanguages[language].prisma);
  form.append("format", "transcribe");
  const start = performance.now();
  const response = await requestGnani(prismaEndpoint, form, undefined, signal);
  const result = transcriptResponse.safeParse(await response.json().catch(() => undefined));
  if (!result.success) throw new MarketplaceError("VOICE_RESPONSE", 502);
  const text = result.data.transcript.trim();
  if (!text || !/[\p{L}\p{N}]/u.test(text)) throw new MarketplaceError("VOICE_SILENCE", 422);
  return { text, language, latencyMs: Math.round(performance.now() - start), model: result.data.model, requestId: result.data.request_id };
}

function synthesisPayload(text: string, language: VoiceLocale) {
  if (!text.trim() || text.length > maxVoiceReplyLength) throw new MarketplaceError("VOICE_RESPONSE", 422);
  const speed = Number(process.env.GNANI_TTS_SPEED || 1);
  return JSON.stringify({
    text, language, voice: voiceLanguages[language].voice, model: timbreModel, speed: speed >= 0.85 && speed <= 1.15 ? speed : 1,
    audio_config: { container: "wav", encoding: "linear_pcm", sample_rate: voiceSampleRate, num_channels: 1, sample_width: 2 },
  });
}

export async function speakVoice(text: string, language: VoiceLocale, signal: AbortSignal) {
  const start = performance.now();
  const response = await requestGnani(timbreEndpoint, synthesisPayload(text, language), "application/json", signal);
  const audio = finalizeTimbreWave(await readAudioBytes(response.body, 2_100_000));
  if (!inspectVoiceWave(audio)?.hasSignal) throw new MarketplaceError("VOICE_RESPONSE", 502);
  return { audio, latencyMs: Math.round(performance.now() - start) };
}

async function* timbreChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  let receivedHeader = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 4_000_000) throw new MarketplaceError("VOICE_RESPONSE", 502);
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const lines = event.split(/\r?\n/);
        const type = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        if (type === "error") throw new MarketplaceError("VOICE_RESPONSE", 502);
        if (type !== "chunk" && type !== "complete") continue;
        const data = JSON.parse(lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n")) as { audio?: unknown };
        if (typeof data.audio === "string" && data.audio.length) {
          let audio = Buffer.from(data.audio, "base64");
          if (!receivedHeader) {
            if (audio.length < 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 16) !== "WAVEfmt " ||
                audio.readUInt32LE(16) !== 16 || audio.readUInt16LE(20) !== 1 || audio.readUInt16LE(22) !== 1 ||
                audio.readUInt32LE(24) !== voiceSampleRate || audio.readUInt16LE(34) !== 16 || audio.toString("ascii", 36, 40) !== "data") {
              throw new MarketplaceError("VOICE_RESPONSE", 502);
            }
            receivedHeader = true;
            audio = audio.subarray(44);
          }
          bytes += audio.length;
          if (bytes > 2_100_000 || audio.length % 2) throw new MarketplaceError("VOICE_RESPONSE", 502);
          if (audio.length) yield new Uint8Array(audio);
        }
        if (type === "complete") {
          if (!bytes) throw new MarketplaceError("VOICE_RESPONSE", 502);
          return;
        }
      }
    }
    throw new MarketplaceError("VOICE_RESPONSE", 502);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function streamVoice(text: string, language: VoiceLocale, signal: AbortSignal) {
  const start = performance.now();
  const response = await requestGnani("https://api.vachana.ai/api/v1/tts/sse", synthesisPayload(text, language), "application/json", signal);
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new MarketplaceError("VOICE_RESPONSE", 502);
  const chunks = timbreChunks(response.body);
  const first = await chunks.next();
  if (first.done) throw new MarketplaceError("VOICE_RESPONSE", 502);
  return {
    firstMs: Math.round(performance.now() - start),
    body: new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(first.value); },
      async pull(controller) {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      async cancel() { await chunks.return(undefined); },
    }),
  };
}
