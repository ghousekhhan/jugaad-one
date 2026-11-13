import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/agent/interpret/route";
import { validateRewrite } from "../src/lib/dialogue/rewrite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedFields, rememberDecision, workflow } from "../src/lib/dialogue/memory";
import { preferenceActionSchema } from "../src/lib/dialogue/preferences";
import { MarketplaceError } from "../src/lib/marketplace/provider";
import { POST as commercePost, GET as commerceGet } from "../src/app/api/commerce/route";

test("interpret route fails closed when persistence is unavailable before calling a model or provider", async (context) => {
  const environment = process.env.NODE_ENV;
  const database = process.env.JUGAAD_DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.JUGAAD_DATABASE_URL;
  const transport = context.mock.method(globalThis, "fetch", async () => { throw new Error("No network permitted"); });
  try {
    const response = await POST(new NextRequest("http://localhost/api/agent/interpret", {
      method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Yes", current: {}, turnId: "00000000-0000-4000-8000-000000000001" }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("X-Dialogue-Error"), "TRANSACTION_STORAGE_UNAVAILABLE");
    assert.equal(transport.mock.callCount(), 0);
  } finally {
    if (environment === undefined) delete process.env.NODE_ENV;
    else Object.assign(process.env, { NODE_ENV: environment });
    if (database !== undefined) process.env.JUGAAD_DATABASE_URL = database;
  }
});

test("rewrite validation rejects changed amounts, invented numbers and missing seller identities", () => {
  const source = "First Kitchen costs 402.45 with delivery in 40 minutes.";
  assert.equal(validateRewrite(source, "Delivery in 40 minutes. First Kitchen costs 402.45.", ["First Kitchen"]), "Delivery in 40 minutes. First Kitchen costs 402.45.");
  for (const output of ["First Kitchen costs 300 in 40 minutes.", "First Kitchen costs 402.45 in 40 minutes with 20 off.", "Other Kitchen costs 402.45 in 40 minutes."]) {
    assert.throws(() => validateRewrite(source, output, ["First Kitchen"]), { code: "GEMINI_INVALID_RESPONSE" });
  }
});

test("interpret route replays a duplicate finalized turn and refuses an older processed turn", async (context) => {
  process.env.JUGAAD_TRANSACTION_DB_PATH = join(mkdtempSync(join(tmpdir(), "jugaad-v2-route-")), "test.sqlite");
  delete process.env.JUGAAD_DATABASE_URL;
  const transport = context.mock.method(globalThis, "fetch", async () => { throw new Error("No network permitted"); });
  const send = (suffix: string) => POST(new NextRequest("http://localhost/api/agent/interpret", {
    method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json", Cookie: "jugaad_checkout=00000000-0000-4000-8000-000000000099" },
    body: JSON.stringify({ text: "Hi", current: {}, turnId: `00000000-0000-4000-8000-${suffix.padStart(12, "0")}` }),
  }));
  const first = await send("1");
  assert.equal(first.status, 200);
  const cookie = first.headers.get("set-cookie");
  assert.equal(cookie, null, "fixture must reuse a recognized session cookie");
  const body = await first.json();
  assert.deepEqual(await (await send("1")).json(), body);
  assert.equal((await send("2")).status, 200);
  assert.equal((await send("1")).status, 409);
  assert.equal(transport.mock.callCount(), 0);
});

test("decision memory is bounded and contains field names rather than personal values", () => {
  assert.deepEqual(changedFields({ budgetPaise: 30000, city: "Hyderabad" }, { budgetPaise: 30000, city: "Delhi" }), ["city"]);
  let decisions: ReturnType<typeof rememberDecision> = [];
  for (let i = 0; i < 25; i++) decisions = rememberDecision(decisions, { taskId: String(i), action: "refine", transition: "refine", changedFields: ["priority"] });
  assert.equal(decisions.length, 12);
  assert.equal(workflow({ offers: [], orders: [], expiresAt: 0 }), "idle");
  assert.equal(workflow({ offers: [], orders: [], expiresAt: 0, dialogue: { previous: [], awaitingApproval: "quote" } }), "awaiting_quote_approval");
});

test("saved preferences require explicit consent and support clearing", () => {
  assert.equal(preferenceActionSchema.safeParse({ action: "preferences", preferences: { typicalBudgetPaise: 30000 } }).success, false);
  assert.equal(preferenceActionSchema.safeParse({ action: "preferences", userApproved: true, preferences: { typicalBudgetPaise: -1 } }).success, false);
  assert.equal(preferenceActionSchema.safeParse({ action: "preferences", userApproved: true, preferences: { cuisines: ["Telugu"], typicalBudgetPaise: 30000 } }).success, true);
  assert.equal(preferenceActionSchema.safeParse({ action: "preferences", userApproved: true, preferences: null }).success, true);
});

test("preference API persists only approved values and profile updates preserve them", async () => {
  const headers = { Origin: "http://localhost", "Content-Type": "application/json", Cookie: "jugaad_checkout=00000000-0000-4000-8000-000000000099" };
  const send = (body: unknown) => commercePost(new NextRequest("http://localhost/api/commerce", { method: "POST", headers, body: JSON.stringify(body) }));
  assert.equal((await send({ action: "profile", profile: { name: "Test", language: "en-IN", region: "hyderabad" } })).status, 200);
  assert.equal((await send({ action: "preferences", preferences: { typicalBudgetPaise: 30000 } })).status, 400);
  assert.equal((await send({ action: "preferences", userApproved: true, preferences: { typicalBudgetPaise: 30000 } })).status, 200);
  await send({ action: "profile", profile: { name: "Test", language: "hi-IN", region: "hyderabad" } });
  const read = () => commerceGet(new NextRequest("http://localhost/api/commerce", { headers })).then((response) => response.json());
  assert.equal((await read()).profile.preferences.typicalBudgetPaise, 30000);
  await send({ action: "preferences", userApproved: true, preferences: null });
  assert.equal((await read()).profile.preferences, undefined);
});

test("interpret route propagates storage read failure instead of discarding memory", async (context) => {
  const globals = globalThis as typeof globalThis & { jugaadTransactionStore?: unknown };
  const existing = globals.jugaadTransactionStore;
  const transport = context.mock.method(globalThis, "fetch", async () => { throw new Error("No network permitted"); });
  globals.jugaadTransactionStore = Promise.reject(new MarketplaceError("TRANSACTION_STORAGE_UNAVAILABLE", 503));
  try {
    const response = await POST(new NextRequest("http://localhost/api/agent/interpret", {
      method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Find biryani", current: {} }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("X-Dialogue-Error"), "TRANSACTION_STORAGE_UNAVAILABLE");
    assert.equal(transport.mock.callCount(), 0);
  } finally { globals.jugaadTransactionStore = existing; }
});
