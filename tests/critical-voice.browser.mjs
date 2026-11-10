import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const base = process.env.JUGAAD_BASE_URL ?? "http://127.0.0.1:3000";
const output = process.argv[2];
assert.ok(output);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BINARY });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  const page = await context.newPage();
  const transcripts = [];
  let nextId = 0;
  await page.addInitScript(() => {
    let audio;
    let stream;
    navigator.mediaDevices.getUserMedia = async () => {
      audio = new AudioContext();
      await audio.resume();
      stream = audio.createMediaStreamDestination();
      return stream.stream;
    };
    window.emitTestUtterance = async () => {
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      volume.gain.value = 0.3;
      tone.connect(volume).connect(stream);
      tone.start();
      tone.stop(audio.currentTime + 0.65);
    };
  });
  await page.route("**/api/voice/transcribe?*", async (route) => {
    const transcript = transcripts.shift();
    assert.ok(transcript, "Unexpected utterance");
    const language = new URL(route.request().url()).searchParams.get("language");
    await route.fulfill({ json: { text: transcript.text, requestId: transcript.id, language, latencyMs: 1 } });
  });
  async function say(text, id = String(++nextId)) {
    transcripts.push({ text, id });
    const final = page.waitForResponse((response) => response.url().includes("/api/voice/transcribe?"));
    await page.evaluate(() => window.emitTestUtterance());
    await final;
  }

  await page.goto(base + "/workspace");
  await page.getByRole("heading", { name: /enable your microphone/i }).waitFor();
  await page.getByRole("button", { name: "Start voice conversation" }).click();
  await page.getByText(/which language are you most comfortable/i).first().waitFor();
  const proposed = (language) => page.getByText(`You selected ${language}. Is that correct?`, { exact: true }).first();
  await say("Hinglish");
  await proposed("Hinglish").waitFor();
  await say("No, Telugu");
  await proposed("Telugu").waitFor();
  await say("Nahi, English");
  await proposed("English").waitFor();
  await say("Hinglish", "hinglish-final");
  await proposed("Hinglish").waitFor();
  await say("Yes", "hinglish-final");
  await proposed("Hinglish").waitFor();
  await say("Yes");
  await page.getByRole("heading", { name: /what should i call you/i }).waitFor();
  await page.getByText(/main Jugaad hoon/i).first().waitFor();
  await page.getByLabel("Your name", { exact: true }).fill("Voice QA");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Sandbox service city").selectOption("hyderabad");
  await page.getByRole("button", { name: /start with jugaad/i }).click();
  await page.getByRole("heading", { name: /good to have you here/i }).waitFor();

  const input = page.getByRole("textbox", { name: "Message Jugaad" });
  async function ask(text) {
    await input.fill(text);
    const pending = page.waitForResponse((response) => response.url().endsWith("/api/agent/interpret"));
    await page.getByRole("button", { name: "Send message" }).click();
    const response = await pending;
    assert.equal(response.status(), 200);
    return response.json();
  }
  await page.getByRole("button", { name: "Start voice conversation" }).evaluate((node) => { window.originalMic = node; });
  const initial = await ask("I want something sweet, maybe cake");
  assert.equal(initial.sandbox.offers.length, 3);
  assert.equal(initial.replyLanguage, "hi-en");
  const cards = page.locator(".comparison-cards-grid .comparison-card");
  await cards.nth(2).waitFor();
  for (const [width, height] of [[1440, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    const results = await page.locator("#offer-comparison").boundingBox();
    assert.ok(results);
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox();
      assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= Math.min(height, results.y + results.height) + 1, JSON.stringify({ width, height, bounds, results }));
    }
    const mic = await page.getByRole("button", { name: "Start voice conversation" }).boundingBox();
    const transcript = await page.locator(".conversation-panel").boundingBox();
    assert.ok(mic && mic.y + mic.height <= height);
    assert.ok(transcript && transcript.y + transcript.height <= height);
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight), height);
    await page.screenshot({ path: output + `/results-${width}x${height}.png` });
  }
  assert.equal(await page.getByRole("button", { name: "Start voice conversation" }).evaluate((node) => node === window.originalMic), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: output + "/results-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  const recommendation = await ask("Which option do you recommend if I want the lowest price?");
  assert.equal(recommendation.dialogueAction, "recommend");
  assert.match(recommendation.reply, /Mirchi Moon/i);
  const selected = await ask("Yes");
  assert.equal(selected.sandbox.quote.offer.listing.seller, "Mirchi Moon");
  assert.equal(selected.trace.searchAttempted, false);
  await ask("Correct");
  const paid = await ask("Yes, proceed");
  assert.equal(paid.sandbox.orders.length, 1);
  assert.equal(paid.sandbox.orders[0].payment, "simulated_no_charge");
  await ask("Yes, proceed");
  const saved = await page.evaluate(async () => (await fetch("/api/commerce")).json());
  assert.equal(saved.orders.length, 1);
  assert.equal(saved.profile.language, "hi-en");
  console.log("Mocked Prisma finals and real browser transitions passed. Three cards fit both desktop viewports. Live recommendation and simulated checkout passed.");
} finally {
  await browser.close();
}
