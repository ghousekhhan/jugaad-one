import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createOffers, totalFor } from "../src/lib/commerce/catalog";
import { bookCommerce } from "../src/lib/commerce/booking";
import { deleteProfile, readSession, updateSession } from "../src/lib/commerce/session";
import { demoCode, trackingStage } from "../src/lib/commerce/types";
import type { FoodIntent } from "../src/lib/integrations/food-intent";

process.env.JUGAAD_TRANSACTION_DB_PATH = join(mkdtempSync(join(tmpdir(), "jugaad-commerce-")), "orders.sqlite");
delete process.env.JUGAAD_DATABASE_URL;

const clothing: FoodIntent = { commerce: { category: "clothing", product: "shirt", attributes: { color: "black", fit: "oversized", material: "cotton" } }, budgetPaise: 80_000, budgetExclusive: true };

test("sandbox variants have stable IDs, deterministic totals and hard-constraint filtering", () => {
  const offers = createOffers(clothing, "hyderabad");
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(({ listing }) => listing.id)).size, 3);
  assert.deepEqual(offers, createOffers(clothing, "hyderabad"));
  assert.ok(offers.every(({ listing, totalPaise }) => listing.attributes.color === "black" && totalPaise === listing.pricePaise + listing.taxPaise + listing.deliveryPaise && totalPaise < 80_000));
  assert.equal(createOffers({ ...clothing, budgetPaise: offers[0].totalPaise }, "hyderabad").length, 0);
  assert.equal(createOffers({ ...clothing, allergens: ["dairy"] }, "hyderabad").length, 0);
  assert.equal(createOffers({ ...clothing, providerPreference: { mode: "only", provider: "wiggy" } }, "hyderabad").length, 0);
  assert.equal(createOffers({ commerce: { category: "food", product: "spicy vegetarian", attributes: { spicy: true } }, dietaryRestrictions: ["vegetarian"], budgetPaise: 30_000 }, "mumbai").length, 3);
});

test("open-ended food discovery ranks distinct existing dishes by verified full total", () => {
  const intent: FoodIntent = { commerce: { category: "food", product: "food" }, priority: "lowest-price", budgetPaise: 30_000, budgetExclusive: true };
  const offers = createOffers(intent, "hyderabad");
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(({ listing }) => listing.name)).size, 3);
  assert.deepEqual(offers.map(({ totalPaise }) => totalPaise), offers.map(({ totalPaise }) => totalPaise).sort((a, b) => a - b));
  assert.ok(offers.every(({ totalPaise }) => totalPaise < 30_000));
  assert.deepEqual(createOffers({ ...intent, providerPreference: { mode: "only", provider: "wiggy" } }, "hyderabad"), []);
});

test("an invalid model decision on an explicit deal request falls back to eligible catalog options", async () => {
  const { orchestrate } = await import("../src/lib/dialogue/controller");
  const { MarketplaceError } = await import("../src/lib/marketplace/provider");
  const owner = "invalid-deal-response";
  const session = await readSession(owner);
  const result = await orchestrate({
    text: "Surprise me under ₹300", current: {}, recentRequests: [], location: { source: "manual", cityId: "hyderabad" },
  }, session, {
    owner, requestId: "00000000-0000-4000-8000-000000000044", persisted: true, signal: new AbortController().signal,
    interpret: async () => { throw new MarketplaceError("GEMINI_INVALID_RESPONSE", 502); },
  });
  assert.equal(result.result.trace?.searchAttempted, true);
  assert.equal(result.result.sandbox?.offers.length, 3);
  assert.ok(result.result.sandbox?.offers.every(({ totalPaise }) => totalPaise < 30_000));
  assert.deepEqual(result.state.orders, []);
});

test("sandbox checkout enforces ownership, amount, expiry and approval and creates one durable order", async () => {
  const owner = "checkout-test";
  const offers = createOffers(clothing, "hyderabad");
  await updateSession(owner, (state) => ({ ...state, current: clothing, offers, profile: { name: "Kiran", region: "hyderabad", language: "en-IN" } }));
  const quote = (await bookCommerce(owner, { action: "select", listingId: offers[1].listing.id })).session.quote!;
  assert.equal(quote.offer.listing.id, offers[1].listing.id);
  const pay = { action: "pay", quoteId: quote.id, code: demoCode } as const;
  await assert.rejects(bookCommerce("other-browser", pay), { code: "TRANSACTION_NOT_FOUND" });
  await assert.rejects(bookCommerce(owner, pay), { code: "COMMERCE_APPROVAL_REQUIRED" });
  await assert.rejects(bookCommerce(owner, { action: "approve", quoteId: quote.id, totalPaise: quote.offer.totalPaise - 1 }), { code: "PRICE_CHANGED" });
  await bookCommerce(owner, { action: "approve", quoteId: quote.id, totalPaise: quote.offer.totalPaise });
  const [a, b] = await Promise.all([bookCommerce(owner, pay), bookCommerce(owner, pay)]);
  assert.ok(a.order && b.order);
  assert.equal(a.order.reference, b.order.reference);
  const restored = await readSession(owner);
  assert.equal(restored.profile?.name, "Kiran");
  assert.equal(restored.orders.length, 1);
  assert.equal(trackingStage(a.order, a.order.confirmedAt), "Confirmed");
  assert.equal(trackingStage(a.order, a.order.confirmedAt + 200 * 60_000), "Delivered");
  await updateSession(owner, (state) => ({ ...state, quote: { ...quote, expiresAt: Date.now() - 100 } }));
  await assert.rejects(bookCommerce(owner, { action: "approve", quoteId: quote.id, totalPaise: quote.offer.totalPaise }), { code: "QUOTE_EXPIRED" });
  await deleteProfile(owner);
  const cleared = await readSession(owner);
  assert.equal(cleared.profile, undefined);
  assert.equal(cleared.current, undefined);
  assert.equal(cleared.orders.length, 1);
});

test("sandbox add-ons preserve the strict budget and charge once for duplicate requests", async () => {
  const owner = "sandbox-addon-budget";
  const current: FoodIntent = { commerce: { category: "food", product: "sweet" } };
  const offer = createOffers(current, "hyderabad").find(({ listing }) => listing.modifiers?.some(({ options }) => options.length));
  assert.ok(offer);
  const option = offer.listing.modifiers?.flatMap(({ options }) => options)[0];
  assert.ok(option);
  const total = totalFor(offer.listing, offer.quantity, [option]);
  await updateSession(owner, (state) => ({ ...state, offers: [offer], current: { ...current, budgetPaise: total, budgetExclusive: true } }));
  const { session } = await bookCommerce(owner, { action: "select", listingId: offer.listing.id });
  assert.ok(session.quote);
  const action = { action: "customize", quoteId: session.quote.id, modifierId: option.id } as const;
  await assert.rejects(bookCommerce(owner, action), { code: "OVER_BUDGET" });
  await updateSession(owner, (state) => ({ ...state, current: { ...current, budgetPaise: total } }));
  await bookCommerce(owner, action);
  const repeated = await bookCommerce(owner, action);
  assert.equal(repeated.session.quote?.offer.totalPaise, total);
  assert.deepEqual(repeated.session.quote?.offer.selectedModifiers, [option]);
});

test("dialogue selects a stored non-food offer, approves its exact quote and retires it after a persisted payment", async () => {
  const { orchestrate } = await import("../src/lib/dialogue/controller");
  const owner = "dialogue-checkout";
  const requestId = "00000000-0000-4000-8000-000000000013";
  const signal = new AbortController().signal;
  let modelCalls = 0;
  await updateSession(owner, (state) => ({ ...state, searchId: requestId, profile: { name: "QA", language: "en-IN", region: "hyderabad" } }));
  async function say(text: string) {
    const stored = await readSession(owner);
    const turn = await orchestrate({ text, current: {}, recentRequests: [] }, stored, {
      owner, signal, requestId, persisted: true,
      interpret: async () => {
        modelCalls++;
        return { model: "fixture", plan: { intent: "sandbox_order", action: "new_task", patch: clothing } };
      },
    });
    await updateSession(owner, (state) => ({ ...state, ...turn.state }));
    return turn.result;
  }
  const result = await say("Find a black oversized cotton shirt under ₹800");
  const second = result.sandbox?.offers[1];
  assert.ok(second);
  const selected = await say("I'll take the second one.");
  const quote = selected.sandbox?.quote;
  assert.equal(quote?.offer.listing.id, second.listing.id);
  assert.ok(quote && !quote.approvedAt);
  await say("Why is the second one more expensive?");
  assert.equal((await say("Yes")).status, "clarification");
  await say("Great, proceed");
  const approved = await say("Yes, I approve that amount.");
  assert.ok(approved.sandbox?.quote?.approvedAt);
  const action = { action: "pay", quoteId: quote.id, code: demoCode } as const;
  const first = await bookCommerce(owner, action);
  const duplicate = await bookCommerce(owner, action);
  assert.equal(first.order?.reference, duplicate.order?.reference);
  const recovered = await readSession(owner);
  assert.equal(recovered.orders.length, 1);
  assert.ok(result.taskId);
  assert.equal(recovered.dialogue?.task, undefined);
  assert.equal(recovered.current, undefined);
  assert.equal(recovered.offers.length, 0);
  assert.equal(modelCalls, 1);
});

test("an older dialogue revision cannot select an offer after a newer turn reserves the session", async () => {
  const owner = "stale-dialogue-checkout";
  const offers = createOffers(clothing, "hyderabad");
  await updateSession(owner, (state) => ({ ...state, offers, searchId: "new-turn" }));
  await assert.rejects(bookCommerce(owner, { action: "select", listingId: offers[0].listing.id }, "old-turn"), { code: "COMMERCE_CONFLICT" });
  assert.equal((await readSession(owner)).quote, undefined);
});

test("sandbox reports budget and dietary misses without returning relaxed offers", async () => {
  const { discoverCommerce } = await import("../src/lib/commerce/discovery");
  const session = { offers: [], orders: [], expiresAt: Date.now() + 10000 };
  const plan = { intent: "sandbox_order", action: "search", patch: {} } as const;
  const budget = discoverCommerce(session, { ...clothing, budgetPaise: 100 }, plan, "en-IN", "fixture", "hyderabad");
  assert.equal(budget.turn.searchFailure, "FILTERED_BY_BUDGET");
  assert.deepEqual(budget.state.offers, []);
  const diet = discoverCommerce(session, { commerce: { category: "food", product: "chicken biryani" }, dietaryRestrictions: ["vegetarian"] }, plan, "en-IN", "fixture", "hyderabad");
  assert.equal(diet.turn.searchFailure, "FILTERED_BY_DIET");
  assert.deepEqual(diet.state.offers, []);
});
