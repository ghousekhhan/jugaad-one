import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const base = process.env.JUGAAD_BASE_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME_BINARY });

try {
  const page = await browser.newPage();
  const post = (path, data, headers = {}) => page.request.post(base + path, { headers: { Origin: base, ...headers }, data });
  async function json(path, data) {
    const response = await post(path, data);
    assert.ok(response.ok(), `${path}: ${response.status()}`);
    return response.json();
  }
  const cases = [
    ["en-IN", "Pranav", "Kaveri", "What is a rainbow?"],
    ["hi-IN", "Bhavna", "Nalini", "इंद्रधनुष क्या है?"],
    ["te-IN", "Suhana", "Varuni", "ఇంద్రధనస్సు అంటే ఏమిటి?"],
    ["hi-en", "Poorvi", "Poorvi", "Rainbow kya hota hai?"],
  ];
  const location = { source: "manual", cityId: "hyderabad" };
  const session = async () => (await page.request.get(base + "/api/commerce")).json();
  const speak = async (source, voice, language, accept = "audio/wav") => {
    const response = await post("/api/voice/speak", source, { Accept: accept });
    assert.ok(response.ok(), `${source.kind} ${voice}: ${response.status()}`);
    assert.equal(response.headers()["x-voice-id"], voice);
    assert.equal(response.headers()["x-voice-language"], language);
    assert.equal(response.headers()["x-voice-model"], "timbre-v2.5");
    const body = await response.body();
    assert.ok(body.byteLength > 44);
    assert.equal(response.headers()["content-type"], accept);
    if (accept === "audio/wav") assert.equal(body.toString("ascii", 0, 4), "RIFF");
    await delay(4300);
  };
  const invalid = await post("/api/voice/speak", { kind: "preview", language: "hi-en", voice: "Kaveri" });
  assert.equal(invalid.status(), 400);
  const invalidSave = await post("/api/commerce", { action: "voice", language: "en-IN", voice: "unknown" });
  assert.equal(invalidSave.status(), 400);

  for (const [language, voice, alternate, question] of cases) {
    await json("/api/commerce", { action: "profile", profile: { name: "Voice QA", language, location, region: "hyderabad" } });
    const before = await session();
    assert.ok(!before.voicePreference || before.voicePreference.language === language);
    await json("/api/commerce", { action: "voice", language, voice });
    await speak({ kind: "preview", language, voice }, voice, language, "audio/x-pcm");
    const ask = (text) => json("/api/agent/interpret", { text, current: {}, location, voiceLanguage: language, turnId: randomUUID() });
    const general = await ask(question);
    assert.equal(general.replyLanguage, language);
    assert.equal(general.trace.searchAttempted, false);
    await speak({ kind: "reply", ticket: general.speechTicket }, voice, language);
    const search = await ask("I want something sweet, maybe cake");
    assert.ok(search.sandbox?.offers?.length);
    const followup = await ask("Which option is cheapest?");
    assert.equal(followup.trace.searchAttempted, false);
    const active = await session();
    await json("/api/commerce", { action: "voice", language, voice: alternate });
    const after = await session();
    assert.deepEqual(after.dialogue, active.dialogue);
    assert.deepEqual(after.offers, active.offers);
    assert.deepEqual(after.orders, active.orders);
    await speak({ kind: "reply", ticket: followup.speechTicket }, alternate, language, "audio/x-pcm");
    await ask("End this conversation");
    console.log(`${language}: ${voice} preview and conversation, ${alternate} follow-up, persisted context`);
  }

  await page.goto(base + "/workspace?tab=profile");
  await page.getByRole("heading", { name: "Voice & Language" }).waitFor();
  await page.getByText("Hinglish · Current voice: Poorvi", { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Hinglish · Current voice: Poorvi", { exact: true }).waitFor();
} finally {
  await browser.close();
}
