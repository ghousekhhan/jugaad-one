import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { applyFoodIntent } from "../src/lib/integrations/food-intent";
import { runFoodTurn } from "../src/lib/integrations/food-conversation";
import { parseGeminiPlan } from "../src/lib/integrations/gemini";
import { listTransactions, readTransaction, runCheckout } from "../src/lib/marketplace/checkout";
import { searchFood } from "../src/lib/marketplace/discovery";
import type { FoodSearch } from "../src/lib/marketplace/discovery-types";
import { MarketplaceError, marketplaceProvider } from "../src/lib/marketplace/provider";
import { matchGpsToDemoCity } from "../src/lib/marketplace/demo-cities";
import { transactionSpeech } from "../src/lib/voice/transaction-speech";

// All network calls are isolated. The tests never use a deployed database or agent key.
const directory = mkdtempSync(join(tmpdir(), "jugaad-marketplace-test-"));
process.env.JUGAAD_TRANSACTION_DB_PATH = join(directory, "test.sqlite");
delete process.env.JUGAAD_DATABASE_URL;
process.env.MARKETPLACE_API_BASE_URL = "https://marketplace.test";
process.env.MARKETPLACE_AGENT_API_KEY = "unit-test-agent-key";
const realFetch = globalThis.fetch;
after(() => { globalThis.fetch = realFetch; });

const simulated = true as const;
const coordinates = { latitude: 17.4, longitude: 78.4 };
const etaMinutes = { min: 24, max: 36 };
const rating = { value: 4.4, count: 10, simulated };
const city = { id: "hyderabad", name: "Hyderabad" };
const neighborhood = { id: "hyderabad-banjara-hills", name: "Banjara Hills" };
const availability = { acceptingOrders: true, serviceHours: { opensAt: "10:00", closesAt: "22:00", timezone: "Asia/Kolkata" }, simulated };
const itemName = "Paneer Biryani";
const branchId = "test-branch";
const menuItemId = "test-item";
const search: FoodSearch = { mode: "dish", query: itemName, location: { source: "gps", coordinates }, radiusKm: 5, budgetPaise: 43000, priority: "lowest-price", page: 0 };
const quoteAction = { action: "quote", provider: "wiggy", branchId, item: { menuItemId, quantity: 1, selectedOptions: [] }, search } as const;
const signal = new AbortController().signal;

type MockOptions = { expired?: boolean; priceChanged?: boolean; readUnavailable?: boolean; wrongProvider?: boolean; catalogFailure?: string; quoteDistanceKm?: number };

function mockProvider(options: MockOptions = {}) {
  const metrics = { writes: 0, reads: 0, key: "", orderId: "", catalog: [] as URLSearchParams[] };
  const quotes = new Map<string, ReturnType<typeof makeQuote>>();
  const activeId = randomUUID();
  const makeProvider = (id: string) => ({ id, name: id === "wiggy" ? "Wiggy" : "Tomato", simulated });
  const amount = (provider: string) => provider === "wiggy" ? 32900 : 34700;
  const makeQuote = (provider: string, quantity: number) => {
    const subtotalPaise = amount(provider) * quantity;
    const price = { subtotalPaise, deliveryFeePaise: 3000, packagingFeePaise: 2000, platformFeePaise: 900, taxPaise: 1600, discountPaise: 0 };
    return { id: randomUUID(), provider: makeProvider(provider), branchId, listingId: `${provider}-listing`, lineItems: [{ menuItemId, name: itemName, quantity, unitPricePaise: amount(provider), selectedOptions: [], lineTotalPaise: subtotalPaise }], pricing: { currency: "INR", ...price, totalPaise: subtotalPaise + 7500 }, distanceKm: options.quoteDistanceKm ?? 1.1, etaMinutes, availability, expiresAt: new Date(Date.now() + (options.expired ? -1000 : 900_000)).toISOString(), simulated };
  };
  const menu = (provider: string) => ({
    id: menuItemId, provider: makeProvider(provider), restaurant: { listingId: `${provider}-listing`, branchId, brandId: "test-brand", name: "Test Restaurant", cuisine: "Biryani", city, neighborhood, coordinates, rating, reviewCount: 3 },
    name: itemName, description: "Test fixture", category: "Rice", cuisine: "Biryani", pricePaise: amount(provider),
    availability: { available: true, acceptingOrders: true, simulated }, dietary: { status: "verified", values: ["vegetarian"], note: "Test fixture" }, allergens: { status: "verified", values: ["dairy"], note: "Test fixture" },
    customization: [], image: { url: "/images/dish-biryani.png", alt: "Test fixture", source: "original_generated", simulated }, distanceKm: 1.1, simulated,
  });
  let order: object | undefined;
  function reply(data: object, provider: string | null, status = 200) {
    const meta = { requestId: randomUUID(), provider, simulated, dataStatus: "simulated", generatedAt: new Date().toISOString() };
    return Response.json(status < 400 ? { data, meta } : { error: data, meta }, { status });
  }
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://marketplace.test");
    const headers = new Headers(init?.headers);
    assert.equal(init?.redirect, "error");
    if (url.pathname === "/api/cities") {
      assert.equal(headers.has("authorization"), false);
      return reply({ cities: [{ ...city, state: "Telangana", coordinates, neighborhoods: [{ ...neighborhood, coordinates: { latitude: 17.41, longitude: 78.44 } }], simulated }] }, null);
    }
    if (url.pathname === "/api/menu-items") {
      assert.equal(headers.has("authorization"), false);
      metrics.catalog.push(url.searchParams);
      const provider = url.searchParams.get("provider")!;
      if (provider === options.catalogFailure) return reply({ code: "INTERNAL_ERROR", message: "Fixture" }, provider, 503);
      if (url.searchParams.get("q") === "biryani paneer") return reply({ menuItems: [], total: 0 }, provider);
      return reply({ menuItems: [menu(options.wrongProvider ? "tomato" : provider)], total: 1 }, provider);
    }
    if (url.pathname === "/api/quotes") {
      assert.equal(headers.has("authorization"), false);
      const body = JSON.parse(String(init?.body));
      const quote = makeQuote(body.provider, body.items[0].quantity);
      quotes.set(quote.id, quote);
      return reply(quote, body.provider, 201);
    }
    assert.equal(headers.get("authorization"), "Bearer unit-test-agent-key");
    if (url.pathname === "/api/simulated-orders") {
      metrics.writes += 1;
      const body = JSON.parse(String(init?.body));
      metrics.key = headers.get("idempotency-key") ?? "";
      assert.ok(metrics.key.startsWith("jugaad-"));
      if (options.priceChanged) return reply({ code: "PRICE_CHANGED", message: "Fixture" }, "wiggy", 409);
      const quote = quotes.get(body.quoteId);
      assert.ok(quote);
      const now = new Date().toISOString();
      order = { ...quote, id: activeId, status: "simulated_confirmed", paymentMethod: "simulated_card", customer: body.customer, deliveryAddress: body.deliveryAddress,
        createdAt: now, paymentStatus: "simulated_no_charge", fulfillmentStatus: "simulated_no_dispatch", reference: "WIG-TEST1234", currentStatus: "confirmed",
        tracking: { currentStatus: "confirmed", steps: ["confirmed", "preparing", "partner_assigned", "arriving_for_pickup", "picked_up", "out_for_delivery", "delivered"].map((id, index) => ({ id, label: id, state: index === 0 ? "current" : "upcoming", scheduledAt: now, occurredAt: index === 0 ? now : null, simulated })), assignmentEtaAt: now, assignmentWindowMinutes: { min: 5, max: 10 }, deliveryEtaAt: now, lastUpdateAt: now, partner: null, terminal: null, pollingIntervalSeconds: 6, simulated } };
      metrics.orderId = activeId;
      return reply({ order, replayed: false, simulated }, "wiggy", 201);
    }
    assert.equal(url.pathname, `/api/simulated-orders/${activeId}`);
    metrics.reads += 1;
    if (options.readUnavailable && metrics.reads === 1) return reply({ code: "INTERNAL_ERROR", message: "Fixture" }, "wiggy", 500);
    assert.ok(order);
    return reply(order, "wiggy");
  };
  return metrics;
}

function rejection(code: string) { return (error: unknown) => error instanceof MarketplaceError && error.code === code; }
const pay = (id: string) => ({ action: "pay", id, demoUpi: "test@demo", confirmed: true } as const);

async function approvedOrder(owner: string) {
  const txn = await runCheckout(owner, { ...quoteAction, item: { ...quoteAction.item, selectedOptions: [] } }, signal);
  await runCheckout(owner, { action: "approve", id: txn.id, totalPaise: txn.quote.pricing.totalPaise }, signal);
  return txn;
}

test("comparison uses full INR totals and enforces the budget after quoting both providers", async () => {
  mockProvider();
  const result = await searchFood({ ...search, budgetPaise: 41000 });
  assert.equal(result.kind, "offers");
  if (result.kind !== "offers") return;
  assert.deepEqual(result.offers.map(({ item, quote }) => [item.provider.id, quote.pricing.totalPaise]), [["wiggy", 40400]]);
  assert.deepEqual(result.excluded.map(({ provider, code }) => [provider, code]), [["tomato", "OVER_BUDGET"]]);
});

test("provider rejects cross-provider data", async () => {
  mockProvider({ wrongProvider: true });
  await assert.rejects(marketplaceProvider("wiggy").searchMenuItems({ lat: 17.4, lng: 78.4, radiusKm: 5 }), rejection("MARKETPLACE_PROVIDER_MISMATCH"));
});

test("a correction changes only its named constraints", () => {
  const original = { dish: "Paneer Makhani", city: "Hyderabad", budgetPaise: 35000, radiusKm: 5, minRating: 4.2, allergens: ["dairy"] };
  assert.deepEqual(applyFoodIntent(original, { budgetPaise: 45000, addAllergens: ["cashews"] }), { ...original, budgetPaise: 45000, allergens: ["dairy", "cashews"] });
});

test("four turns preserve strict constraints, use provider evidence, and select the lowest eligible total", async () => {
  const metrics = mockProvider();
  const input = { text: "Fixture", current: {}, recentRequests: [] };
  const first = await runFoodTurn(input, "fixture", { intent: "food_order", action: "search", patch: { dish: itemName, city: "Hyderabad", neighborhood: "Banjara Hills", budgetPaise: 45000, budgetExclusive: true } }, signal);
  assert.equal(first.status, "results");
  assert.equal(first.location?.label, "Banjara Hills, Hyderabad");
  assert.deepEqual(first.comparison?.result.evidence?.map(({ provider }) => provider), ["wiggy", "tomato"]);
  const second = await runFoodTurn({ ...input, current: first.constraints }, "fixture", { intent: "food_order", action: "search", patch: { minRating: 4, ratingExclusive: true } }, signal);
  const third = await runFoodTurn({ ...input, current: second.constraints }, "fixture", { intent: "food_order", action: "search", patch: { radiusKm: 5 } }, signal);
  const fourth = await runFoodTurn({ ...input, current: third.constraints }, "fixture", { intent: "food_order", action: "choose_cheapest", patch: {} }, signal);
  assert.deepEqual(fourth.constraints, { ...first.constraints, radiusKm: 5, minRating: 4, ratingExclusive: true });
  assert.equal(fourth.status, "selected");
  const offers = fourth.comparison?.result;
  assert.equal(offers?.kind, "offers");
  if (offers?.kind !== "offers") return;
  const selected = offers.offers.find(({ quote }) => quote.id === fourth.selectedQuoteId);
  assert.equal(selected?.item.provider.id, "wiggy");
  assert.equal(selected?.quote.pricing.totalPaise, 40400);
  assert.equal(metrics.writes, 0);
  assert.equal(metrics.catalog.at(-1)?.get("radiusKm"), "5");
  assert.equal(metrics.catalog.at(-1)?.get("lat"), "17.41");
});

test("strict rating and price limits do not admit equal values", async () => {
  mockProvider();
  const ratingResult = await searchFood({ ...search, minRating: 4.4, ratingExclusive: true });
  assert.equal(ratingResult.kind === "offers" && ratingResult.offers.length, 0);
  assert.equal(ratingResult.evidence?.every(({ quoteRequestIds }) => quoteRequestIds.length === 0), true);
  const budgetResult = await searchFood({ ...search, budgetPaise: 40400, budgetExclusive: true });
  assert.equal(budgetResult.kind === "offers" && budgetResult.offers.length, 0);
});

test("location and allergen exclusions are rechecked before showing quotes", async () => {
  const metrics = mockProvider({ quoteDistanceKm: 5.1 });
  const tooFar = await searchFood(search);
  assert.equal(tooFar.kind === "offers" && tooFar.offers.length, 0);
  assert.equal(tooFar.kind === "offers" && tooFar.excluded.every(({ code }) => code === "OUTSIDE_SEARCH_RADIUS"), true);
  const dairyFree = await searchFood({ ...search, allergens: ["milk"] });
  assert.equal(dairyFree.kind === "offers" && dairyFree.offers.length, 0);
  assert.equal(metrics.catalog.at(-1)?.get("allergenFree"), "dairy");
  assert.equal(dairyFree.evidence?.every(({ quoteRequestIds }) => quoteRequestIds.length === 0), true);
});

test("quantity, provider-only requests and delivery limits apply to full provider quotes", async () => {
  const metrics = mockProvider();
  const input = { ...search, quantity: 2, budgetPaise: 80000, providerPreference: { provider: "wiggy", mode: "only" } } as const;
  const result = await searchFood(input);
  assert.equal(result.kind, "offers");
  if (result.kind !== "offers") return;
  assert.deepEqual(result.offers.map(({ quote }) => [quote.lineItems[0].quantity, quote.pricing.totalPaise]), [[2, 73300]]);
  assert.deepEqual(metrics.catalog.map((params) => params.get("provider")), ["wiggy"]);
  const tooSlow = await searchFood({ ...input, maxEtaMinutes: 35 });
  assert.equal(tooSlow.kind === "offers" && tooSlow.offers.length, 0);
  assert.equal(tooSlow.kind === "offers" && tooSlow.excluded[0].code, "OVER_DELIVERY_ESTIMATE");
});

test("an unavailable provider cannot be mistaken for a complete comparison", async () => {
  mockProvider({ catalogFailure: "wiggy" });
  const result = await runFoodTurn({ text: "Pick the cheapest", current: { dish: itemName, city: "Hyderabad", radiusKm: 5 }, recentRequests: [] }, "fixture", { intent: "food_order", action: "choose_cheapest", patch: {} }, signal);
  assert.equal(result.status, "incomplete");
  assert.equal(result.selectedQuoteId, undefined);
  assert.deepEqual(result.comparison?.result.issues.map(({ provider }) => provider), ["wiggy"]);
  assert.match(result.reply, /can’t establish the cheapest/);
});

test("no eligible live quotes is distinct from missing location", async () => {
  mockProvider();
  const plan = { intent: "food_order", action: "search", patch: { dish: itemName, budgetPaise: 1 } } as const;
  const input = { text: "Find a dish", current: {}, recentRequests: [] };
  assert.equal((await runFoodTurn(input, "fixture", plan, signal)).status, "clarification");
  const result = await runFoodTurn({ ...input, current: { city: "Hyderabad" } }, "fixture", plan, signal);
  assert.equal(result.status, "no_match");
  assert.match(result.reply, /No eligible quotes/);
});

test("an empty literal lookup retries a known dish alias without weakening the budget", async () => {
  const runtime = globalThis as typeof globalThis & { jugaadRateLimits?: Map<string, unknown> };
  runtime.jugaadRateLimits?.delete("marketplace-search");
  const metrics = mockProvider();
  const result = await runFoodTurn(
    { text: "Find biryani paneer under ₹430", current: { city: "Hyderabad" }, recentRequests: [] },
    "fixture", { intent: "food_order", action: "search", patch: { dish: "biryani paneer", budgetPaise: 43000, budgetExclusive: true } }, signal,
  );
  assert.equal(result.status, "results");
  assert.equal(result.constraints.dish, "biryani paneer");
  assert.equal(result.comparison?.input.query, "paneer biryani");
  assert.equal(result.comparison?.input.budgetPaise, 43000);
  assert.deepEqual(metrics.catalog.map((query) => query.get("q")), ["biryani paneer", "biryani paneer", "paneer biryani", "paneer biryani"]);
  assert.ok(result.comparison?.result.offers.every(({ quote }) => quote.pricing.totalPaise < 43000));
  assert.equal(metrics.writes, 0);
});

test("invalid Gemini calls cannot introduce booking actions or clear constraints implicitly", () => {
  const call = (args: object) => [{ name: "plan_food_turn", args }];
  assert.throws(() => parseGeminiPlan(undefined), rejection("GEMINI_INVALID_RESPONSE"));
  assert.throws(() => parseGeminiPlan(call({ intent: "food_order", action: "book", patch: {} })), rejection("GEMINI_INVALID_RESPONSE"));
  assert.throws(() => parseGeminiPlan(call({ intent: "food_order", action: "search", patch: { dish: null } })), rejection("GEMINI_INVALID_RESPONSE"));
  assert.throws(() => parseGeminiPlan(call({ intent: "food_order", action: "search", patch: { city: "Hyderabad", clear: ["city"] } })), rejection("GEMINI_INVALID_RESPONSE"));
});

test("approval and ownership are enforced; concurrent payment only books once", async () => {
  const metrics = mockProvider();
  const owner = randomUUID();
  const txn = await runCheckout(owner, { ...quoteAction, item: { ...quoteAction.item, selectedOptions: [] } }, signal);
  assert.equal((await readTransaction(owner, txn.id, signal)).phase, "quoted");
  assert.match(transactionSpeech(txn, "approval", "en-IN") ?? "", /approve.*simulated checkout/);
  assert.equal(transactionSpeech(txn, "confirmation", "en-IN"), undefined);
  await assert.rejects(runCheckout(owner, pay(txn.id), signal), rejection("INVALID_TRANSACTION_STATE"));
  await assert.rejects(runCheckout(owner, { action: "approve", id: txn.id, totalPaise: 1 }, signal), rejection("APPROVAL_TOTAL_MISMATCH"));
  await assert.rejects(readTransaction(randomUUID(), txn.id, signal), rejection("TRANSACTION_NOT_FOUND"));
  await runCheckout(owner, { action: "approve", id: txn.id, totalPaise: txn.quote.pricing.totalPaise }, signal);
  const results = await Promise.all([runCheckout(owner, pay(txn.id), signal), runCheckout(owner, pay(txn.id), signal)]);
  assert.ok(results.some(({ phase }) => phase === "confirmed"));
  assert.equal(metrics.writes, 1);
  assert.equal(metrics.reads, 1);
  assert.equal(metrics.key, `jugaad-${txn.id}`);
  const saved = (await listTransactions(owner))[0];
  assert.equal(saved.order?.id, metrics.orderId);
  assert.equal(saved.order?.tracking.steps.length, 7);
  assert.ok(saved.paymentSimulatedAt);
  assert.match(transactionSpeech(saved, "confirmation", "en-IN") ?? "", /WIG-TEST1234/);
  assert.equal(transactionSpeech({ ...saved, providerOrderId: undefined }, "confirmation", "en-IN"), undefined);
  assert.equal("customer" in saved.order!, false);
});

test("a provider price change records the simulated attempt without a success receipt", async () => {
  mockProvider({ priceChanged: true });
  const owner = randomUUID();
  const txn = await approvedOrder(owner);
  const result = await runCheckout(owner, pay(txn.id), signal);
  assert.equal(result.phase, "rejected");
  assert.equal(result.failure, "PRICE_CHANGED");
  assert.ok(result.paymentSimulatedAt);
  assert.equal(result.order, undefined);
});

test("an expired quote blocks approval before any simulated payment", async () => {
  const metrics = mockProvider({ expired: true });
  const owner = randomUUID();
  const txn = await runCheckout(owner, { ...quoteAction, item: { ...quoteAction.item, selectedOptions: [] } }, signal);
  await assert.rejects(runCheckout(owner, { action: "approve", id: txn.id, totalPaise: txn.quote.pricing.totalPaise }, signal), rejection("QUOTE_EXPIRED"));
  assert.equal(metrics.writes, 0);
});

test("missing provider confirmation enters reconciliation and retries the saved order read", async () => {
  const metrics = mockProvider({ readUnavailable: true });
  const owner = randomUUID();
  const txn = await approvedOrder(owner);
  const attempt = await runCheckout(owner, pay(txn.id), signal);
  assert.equal(attempt.phase, "reconciliation");
  assert.equal(attempt.order, undefined);
  assert.equal(attempt.providerOrderId, metrics.orderId);
  const result = await runCheckout(owner, { action: "retry", id: txn.id }, signal);
  assert.equal(result.phase, "confirmed");
  assert.equal(metrics.writes, 1);
  assert.equal(metrics.reads, 2);
});

test("location matching identifies supported demo cities and provides truthful fallback when outside region", () => {
  // Banjara Hills coordinates in Hyderabad
  const hyderabadMatch = matchGpsToDemoCity({ latitude: 17.41, longitude: 78.44 });
  assert.equal(hyderabadMatch.isWithinSupportedRegion, true);
  assert.equal(hyderabadMatch.matchedCity.id, "hyderabad");
  assert.ok(hyderabadMatch.distanceKm < 15);

  // Indiranagar coordinates in Bengaluru
  const bengaluruMatch = matchGpsToDemoCity({ latitude: 12.978, longitude: 77.64 });
  assert.equal(bengaluruMatch.isWithinSupportedRegion, true);
  assert.equal(bengaluruMatch.matchedCity.id, "bengaluru");
  assert.ok(bengaluruMatch.distanceKm < 15);

  // Far away coordinates (e.g. London or outside demo regions)
  const outsideMatch = matchGpsToDemoCity({ latitude: 51.5074, longitude: -0.1278 });
  assert.equal(outsideMatch.isWithinSupportedRegion, false);
  assert.equal(outsideMatch.matchedCity.id, "bengaluru"); // Truthful default demo city
  assert.ok(outsideMatch.distanceKm > 1000);
});


test("cancelling an unpaid provider quote prevents a later payment", async () => {
  const metrics = mockProvider();
  const owner = "cancelled-checkout-owner";
  const quote = await approvedOrder(owner);
  const cancelled = await runCheckout(owner, { action: "cancel", id: quote.id }, signal);
  assert.equal(cancelled.failure, "CHECKOUT_CANCELLED");
  assert.equal((await runCheckout(owner, pay(quote.id), signal)).phase, "rejected");
  assert.equal(metrics.writes, 0);
});
