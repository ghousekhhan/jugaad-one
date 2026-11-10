import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const base = process.env.JUGAAD_BASE_URL ?? "http://127.0.0.1:3000";
const output = process.argv[2];
assert.ok(output, "Pass a screenshot output directory");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BINARY });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultNavigationTimeout(90000);
  await page.route("**/api/voice/speak", (route) => route.abort());
  await page.goto(base + "/payment");
  await page.getByRole("heading", { name: "No approved checkout" }).waitFor();
  const post = async (path, data) => {
    const response = await page.request.post(base + path, { headers: { Origin: base }, data });
    assert.ok(response.ok(), `${path} returned ${response.status()}`);
    return response.json();
  };
  await post("/api/commerce", { action: "profile", profile: { name: "Payment QA", language: "en-IN", region: "hyderabad", location: { source: "manual", cityId: "hyderabad" } } });
  const offers = await post("/api/agent/interpret", { text: "I want something sweet, maybe cake", turnId: randomUUID(), current: {}, voiceLanguage: "en-IN" });
  assert.ok(offers.sandbox.offers.length);
  const commerce = (input) => post("/api/commerce", { input, language: "en-IN" });
  const { quote } = await commerce({ action: "select", listingId: offers.sandbox.offers[0].listing.id });
  await page.goto(base + "/payment?source=jugaad&id=" + quote.id);
  await page.getByRole("heading", { name: "No approved checkout" }).waitFor();
  const discounted = (await commerce({ action: "welcome_offer", quoteId: quote.id, accept: true })).quote;
  assert.ok(discounted.offer.totalPaise < quote.offer.totalPaise);
  await commerce({ action: "approve", quoteId: discounted.id, totalPaise: discounted.offer.totalPaise });
  const paymentUrl = base + "/payment?source=jugaad&id=" + discounted.id;
  await page.goto(paymentUrl);
  await page.getByText("Payment QA", { exact: false }).first().waitFor();
  await page.getByText("Fictional UPI identity", { exact: false }).waitFor();
  await page.getByText("Jugaad Welcome Offer", { exact: true }).waitFor();
  await page.screenshot({ path: output + "/payment-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  const keypad = await page.getByRole("button", { name: "9", exact: true }).boundingBox();
  assert.ok(keypad && keypad.y + keypad.height < 844);
  await page.screenshot({ path: output + "/payment-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Cancel authorization" }).click();
  await page.waitForURL("**/workspace");
  await page.goto(paymentUrl);

  let payments = 0;
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const handler = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    payments += 1;
    await delayed;
    await route.fulfill({ status: 503, json: { error: { message: "Test provider failure" } } });
  };
  await page.route("**/api/commerce", handler);
  const ready = () => page.waitForFunction(() => {
    const keypad = document.querySelector(".jugaad-pay-scene");
    return keypad && Object.keys(keypad).some((key) => key.startsWith("__reactProps"));
  });
  const fillDemo = async () => {
    await ready();
    await page.getByRole("button", { name: /tap to autofill/i }).click();
  };
  await fillDemo();
  const authorize = page.getByRole("button", { name: /authorize simulated payment/i });
  await page.keyboard.press("Backspace");
  assert.equal(await authorize.isEnabled(), false);
  await page.keyboard.press("8");
  assert.equal(await authorize.isEnabled(), true);
  const outgoing = page.waitForRequest((request) => request.url().endsWith("/api/commerce") && request.method() === "POST");
  try {
    await authorize.click();
    await outgoing;
    await page.locator('.pay-outcome[data-stage="processing"]').waitFor();
    assert.equal(await authorize.count(), 0);
    assert.equal(await page.getByRole("heading", { name: /payment successful/i }).count(), 0);
    assert.equal(payments, 1);
  } finally {
    release();
  }
  await page.getByRole("heading", { name: /simulated payment could not be completed/i }).waitFor();
  await page.unroute("**/api/commerce", handler);
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByRole("button", { name: "Check checkout status" }).click()]);
  await fillDemo();
  await authorize.click();
  await page.getByRole("heading", { name: /payment successful/i }).waitFor();
  assert.equal(await page.locator(".pay-confetti").count(), 1);
  await page.screenshot({ path: output + "/payment-success-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: output + "/payment-success-desktop.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator(".pay-confetti").isVisible(), false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /payment successful/i }).waitFor();
  assert.equal(await page.locator(".pay-confetti").count(), 0);
  const saved = await (await page.request.get(base + "/api/commerce")).json();
  assert.equal(saved.orders.length, 1);
  await page.getByRole("link", { name: "View order" }).click();
  await page.getByRole("dialog").getByText("No money was charged.").waitFor();
  console.log("Payment route, approved amount, demo authorization, failure, success, reduced motion and persisted receipt passed.");
  if (process.env.JUGAAD_LIVE_PROVIDER === "1") {
    const search = {
      mode: "dish", query: "Chicken Dum Biryani", location: { source: "manual", cityId: "hyderabad" },
      radiusKm: 12, budgetPaise: 60000, priority: "lowest-price", page: 0,
    };
    const providerResult = await post("/api/marketplace/search", search);
    assert.equal(providerResult.kind, "offers");
    const [offer] = providerResult.offers;
    assert.ok(offer);
    const line = offer.quote.lineItems[0];
    const checkout = (action) => post("/api/marketplace/transactions", action);
    const quoted = await checkout({
      action: "quote", provider: offer.item.provider.id, branchId: offer.item.restaurant.branchId, search,
      item: { menuItemId: line.menuItemId, quantity: line.quantity, selectedOptions: line.selectedOptions.map(({ groupId, optionId }) => ({ groupId, optionId })) },
    });
    await checkout({ action: "approve", id: quoted.id, totalPaise: quoted.quote.pricing.totalPaise });
    await page.goto(base + "/payment?source=provider&id=" + quoted.id);
    await page.locator(".pay-parties dd").filter({ hasText: quoted.restaurant }).waitFor();
    await fillDemo();
    await authorize.click();
    await page.getByRole("heading", { name: /payment successful/i }).waitFor({ timeout: 60000 });
    const savedProvider = (await (await page.request.get(base + "/api/marketplace/transactions")).json()).transactions
      .find(({ id }) => id === quoted.id);
    assert.ok(savedProvider?.order && savedProvider.phase === "confirmed");
    assert.equal(savedProvider.quote.pricing.totalPaise, quoted.quote.pricing.totalPaise);
    console.log(`Live ${offer.item.provider.name} confirmed a simulated booking at the approved total.`);
  }
} finally {
  await browser.close();
}
