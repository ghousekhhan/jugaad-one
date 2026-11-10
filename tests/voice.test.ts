import assert from "node:assert/strict";
import { test } from "node:test";
import { speakVoice, streamVoice, transcribeVoice } from "../src/lib/voice/gnani";
import { issueSpeechTicket, readSpeechTicket } from "../src/lib/voice/speech-ticket";
import { speechSourceSchema } from "../src/lib/voice/types";
import { calculateChunkEnergy, createVoiceActivityDetector, encodeVoiceWave, finalizeTimbreWave, inspectVoiceWave, maxWaveBytes, voiceSampleRate } from "../src/lib/voice/wave";

const testKey = "voice-unit-test-key";
const sample = () => encodeVoiceWave([Float32Array.from({ length: voiceSampleRate }, (_, i) => Math.sin(i / 5) * 0.25)]);
const signal = new AbortController().signal;

function withKey(run: () => void) {
  const previous = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = testKey;
  try { run(); }
  finally {
    if (previous === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = previous;
  }
}

test("capture emits bounded mono 16 kHz PCM WAV and detects quiet clips", () => {
  const wave = sample();
  assert.deepEqual(inspectVoiceWave(wave), { seconds: 1, hasSignal: true, pcmStart: 44, samples: voiceSampleRate });
  assert.equal(inspectVoiceWave(encodeVoiceWave([new Float32Array(voiceSampleRate)]))?.hasSignal, false);
  assert.equal(inspectVoiceWave(wave.slice(0, 60)), undefined);
  assert.equal(encodeVoiceWave([new Float32Array(voiceSampleRate * 32)]).byteLength, maxWaveBytes);
});

test("Timbre's open-ended WAV lengths are finalized only for the expected header", () => {
  const buffer = sample();
  const view = new DataView(buffer);
  view.setUint32(4, 0xffffffff, true);
  view.setUint32(40, 0xffffffff, true);
  assert.equal(inspectVoiceWave(buffer), undefined);
  assert.deepEqual(inspectVoiceWave(finalizeTimbreWave(buffer)), { seconds: 1, hasSignal: true, pcmStart: 44, samples: voiceSampleRate });
  const malformed = new ArrayBuffer(100);
  assert.equal(inspectVoiceWave(finalizeTimbreWave(malformed)), undefined);
});

test("speech requires a valid backend ticket or an owned transaction reference", () => {
  withKey(() => {
    const ticket = issueSpeechTicket("Which dish would you like?", "hi-en");
    assert.ok(ticket);
    const decoded = readSpeechTicket(ticket);
    assert.equal(decoded.text, "Which dish would you like?");
    assert.equal(decoded.language, "hi-en");
    const [payload, signature] = ticket.split(".");
    assert.throws(() => readSpeechTicket(`A${payload.slice(1)}.${signature}`), { code: "VOICE_TICKET" });
    assert.equal(speechSourceSchema.safeParse({ kind: "reply", text: "Order confirmed", language: "en-IN" }).success, false);
  });
});

test("Prisma and Timbre use the documented endpoints, language codes and audio formats", async (context) => {
  const previous = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = testKey;
  context.after(() => {
    if (previous === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = previous;
  });
  const transport = context.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("X-API-Key-ID"), testKey);
    assert.equal(init.redirect, "error");
    if (input === "https://api.vachana.ai/stt/v3") {
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get("language_code"), "hi-IN");
      assert.equal(init.body.get("format"), "transcribe");
      assert.equal((init.body.get("audio_file") as Blob).type, "audio/wav");
      return Response.json({ success: true, transcript: "पाँच किलोमीटर", model: "prisma-v2.5" });
    }
    assert.equal(input, "https://api.vachana.ai/api/v1/tts/inference");
    const request = JSON.parse(String(init.body));
    assert.equal(request.model, "timbre-v2.5");
    assert.equal(request.voice, "Poorvi");
    assert.equal(request.language, "hi-en");
    assert.equal(request.audio_config.sample_rate, 16000);
    return new Response(sample(), { headers: { "Content-Type": "audio/wav" } });
  });
  assert.equal((await transcribeVoice(sample(), "hi-en", signal)).text, "पाँच किलोमीटर");
  assert.ok(inspectVoiceWave((await speakVoice("कौन सी डिश?", "hi-en", signal)).audio)?.hasSignal);
  assert.equal(transport.mock.callCount(), 2);
});

test("provider failures and unusable speech produce typed, sanitized errors", async (context) => {
  const previous = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = testKey;
  context.after(() => {
    if (previous === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = previous;
  });
  const mock = context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  await assert.rejects(transcribeVoice(sample(), "en-IN", signal), { code: "VOICE_RATE_LIMIT" });
  mock.mock.mockImplementation(async () => Response.json({ success: true, transcript: "..." }));
  await assert.rejects(transcribeVoice(sample(), "en-IN", signal), { code: "VOICE_SILENCE" });
  mock.mock.mockImplementation(async () => new Response("not a wave"));
  await assert.rejects(speakVoice("What dish?", "en-IN", signal), { code: "VOICE_RESPONSE" });
});

test("voice activity detector measures audio energy and triggers turn completion on silence", () => {
  const silentChunk = new Float32Array(512);
  assert.equal(calculateChunkEnergy(silentChunk), 0);

  const speechChunk = Float32Array.from({ length: 512 }, (_, i) => Math.sin(i / 4) * 0.2);
  const energy = calculateChunkEnergy(speechChunk);
  assert.ok(energy > 0.1);

  const detector = createVoiceActivityDetector({
    minSpeechSamples: 1000,
    silenceTimeoutSamples: 1500,
  });

  // Initial silence should not start speech or end turn
  let state = detector.process(silentChunk);
  assert.equal(state.speaking, false);
  assert.equal(state.hasSpoken, false);
  assert.equal(state.turnEnded, false);

  // Two speech chunks (total 1024 samples >= minSpeechSamples 1000)
  state = detector.process(speechChunk);
  assert.equal(state.speaking, true);
  assert.equal(state.hasSpoken, true);
  assert.equal(state.turnEnded, false);

  state = detector.process(speechChunk);
  assert.equal(state.speaking, true);
  assert.equal(state.turnEnded, false);

  // Silence begins (chunk 1: 512 samples)
  state = detector.process(silentChunk);
  assert.equal(state.speaking, false);
  assert.equal(state.turnEnded, false);

  // Silence continues (chunk 2: +512 = 1024 samples)
  state = detector.process(silentChunk);
  assert.equal(state.turnEnded, false);

  // Silence reaches timeout (chunk 3: +512 = 1536 samples >= 1500)
  state = detector.process(silentChunk);
  assert.equal(state.turnEnded, true);

  // Reset clears state
  detector.reset();
  state = detector.process(silentChunk);
  assert.equal(state.hasSpoken, false);
  assert.equal(state.turnEnded, false);
});


test("Timbre streaming forwards real PCM chunks and requires a complete vendor stream", async (context) => {
  const prior = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = testKey;
  context.after(() => {
    if (prior === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = prior;
  });
  const wave = Buffer.from(sample());
  const first = wave.subarray(0, 2044).toString("base64");
  const second = wave.subarray(2044).toString("base64");
  const event = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  const mock = context.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://api.vachana.ai/api/v1/tts/sse");
    return new Response(event("start", {}) + event("chunk", { audio: first }) + event("chunk", { audio: second }) + event("complete", {}), {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  const output = await streamVoice("What should I call you?", "en-IN", signal);
  const reader = output.body.getReader();
  const a = await reader.read();
  assert.equal(a.value?.byteLength, 2000);
  const b = await reader.read();
  assert.deepEqual(Buffer.concat([a.value!, b.value!]), wave.subarray(44));
  assert.equal((await reader.read()).done, true);

  mock.mock.mockImplementation(async () => new Response(event("chunk", { audio: first }), {
    headers: { "Content-Type": "text/event-stream" },
  }));
  const broken = (await streamVoice("Try again", "en-IN", signal)).body.getReader();
  assert.equal((await broken.read()).done, false);
  await assert.rejects(broken.read(), { code: "VOICE_RESPONSE" });
});

test("a rejected reply voice can fall back within its locale while previews stay exact", async (context) => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../src/app/api/voice/speak/route");
  const previous = process.env.GNANI_API_KEY;
  process.env.GNANI_API_KEY = testKey;
  context.after(() => {
    if (previous === undefined) delete process.env.GNANI_API_KEY;
    else process.env.GNANI_API_KEY = previous;
  });
  const voices: string[] = [];
  context.mock.method(globalThis, "fetch", async (_input: string, init: RequestInit) => {
    const { voice, language } = JSON.parse(String(init.body));
    assert.equal(language, "en-IN");
    voices.push(voice);
    return voice === "Kaveri" ? new Response(null, { status: 422 }) : new Response(sample());
  });
  const send = (data: unknown) => POST(new NextRequest("http://localhost/api/voice/speak", {
    method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify(data),
  }));
  const invalid = await send({ kind: "preview", language: "en-IN", voice: "Poorvi" });
  assert.equal(invalid.status, 400);
  assert.deepEqual(voices, []);
  const preview = await send({ kind: "preview", language: "en-IN", voice: "Kaveri" });
  assert.equal(preview.status, 422);
  assert.deepEqual(voices, ["Kaveri"]);
  const reply = await send({ kind: "reply", ticket: issueSpeechTicket("Which dish?", "en-IN") });
  assert.equal(reply.status, 200);
  assert.equal(reply.headers.get("X-Voice-Id"), "Pranav");
  assert.equal(reply.headers.get("X-Voice-Fallback"), "1");
  assert.deepEqual(voices, ["Kaveri", "Kaveri", "Pranav"]);
});
