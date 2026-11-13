import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (process.env.JUGAAD_LIVE_EVAL !== "1") throw new Error("Opt in with JUGAAD_LIVE_EVAL=1. This evaluation consumes Gemini credits on the running app.");
const origin = process.env.JUGAAD_EVAL_ORIGIN || "http://127.0.0.1:3000";
let cookie;
async function turn(text) {
  const start = performance.now();
  const response = await fetch(`${origin}/api/agent/interpret`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ text, current: {}, voiceLanguage: "en-IN", turnId: randomUUID(), paymentPage: true }),
  });
  cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
  assert.equal(response.status, 200, `Request failed: ${response.headers.get("X-Dialogue-Error")}`);
  const data = await response.json();
  assert.equal(data.trace?.searchAttempted, false);
  console.log(JSON.stringify({ action: data.dialogueAction, model: data.model, ms: Math.round(performance.now() - start) }));
  return data;
}
const original = await turn("Explain why the sky looks blue in two sentences.");
const simplified = await turn("Say it more simply");
assert.notEqual(simplified.reply, original.reply);
const repeat = await turn("Repeat what you just said");
assert.equal(repeat.reply, simplified.reply);
const hindi = await turn("Say that in Hindi");
assert.equal(hindi.replyLanguage, "hi-IN");
assert.match(hindi.reply, /[\u0900-\u097f]/u);
assert.equal((await turn("End this conversation")).voiceControl, "stop");
