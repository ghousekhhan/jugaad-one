import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { catalogExclusions, defaultQuoteOptions, matchesDish, menuItemExclusion, queryFor, quoteExclusion, quoteRequestForItem, resolveFoodLocation } from "./discovery";
import { trackingFinished, type CheckoutAction, type FoodTransaction } from "./checkout-types";
import { MarketplaceError, marketplaceOrderConfigured, marketplaceProvider } from "./provider";
import { receiptOrderSchema, type MarketplaceOrder } from "./schemas";
import { transactionStorageConfigured, transactionStore, type TransactionRow } from "./transaction-store";

export const checkoutCookie = "jugaad_checkout";
const retryAfterMs = 20_000;
const confirmedFailures = new Set(["QUOTE_EXPIRED", "QUOTE_NOT_FOUND", "PRICE_CHANGED", "RESTAURANT_UNAVAILABLE", "ITEM_UNAVAILABLE", "MENU_ITEM_NOT_FOUND", "MINIMUM_ORDER_NOT_MET", "OUTSIDE_DELIVERY_AREA", "UNAUTHORIZED", "FORBIDDEN", "PROVIDER_MISMATCH"]);

export function checkoutConfigured() {
  return marketplaceOrderConfigured() && transactionStorageConfigured();
}

export function checkoutOwner(cookie?: string) {
  return cookie && /^[a-f\d-]{36}$/.test(cookie) ? createHash("sha256").update(cookie).digest("hex") : undefined;
}

function rejectExpired(transaction: FoodTransaction) {
  if (Date.parse(transaction.quote.expiresAt) <= Date.now()) throw new MarketplaceError("QUOTE_EXPIRED", 410);
}

async function createTransaction(owner: string, input: Extract<CheckoutAction, { action: "quote" }>, signal: AbortSignal) {
  if (!checkoutConfigured()) throw new MarketplaceError("CHECKOUT_NOT_CONFIGURED", 503);
  const store = await transactionStore();
  const { search, item: selection } = input;
  catalogExclusions(search.allergens);
  if (search.mode === "restaurant" || (search.mode === "menu" && search.branchId !== input.branchId)) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
  if (search.providerPreference?.mode === "only" && search.providerPreference.provider !== input.provider) throw new MarketplaceError("PROVIDER_MISMATCH", 409);
  const location = await resolveFoodLocation(search.location, signal);
  const adapter = marketplaceProvider(input.provider);
  const { data } = await adapter.searchMenuItems({ ...queryFor(search, location), q: undefined, branchId: input.branchId, limit: 100 }, signal);
  const item = data.menuItems.find(({ id }) => id === selection.menuItemId);
  if (!item || (search.mode === "dish" && !matchesDish(item.name, search.query))) throw new MarketplaceError("ITEM_UNAVAILABLE", 409);
  const exclusion = menuItemExclusion(item, search);
  if (exclusion) throw new MarketplaceError(exclusion, 409);
  const options = selection.selectedOptions ?? defaultQuoteOptions(item);
  if (search.dietary || search.dietaryRestrictions?.length || search.allergens?.length) {
    const defaults = defaultQuoteOptions(item);
    if (options.length !== defaults.length || defaults.some((option) => !options.some((value) => value.groupId === option.groupId && value.optionId === option.optionId))) {
      throw new MarketplaceError("OPTION_METADATA_UNVERIFIED", 400);
    }
  }
  const { data: quote } = await adapter.createQuote(quoteRequestForItem(item, location, { ...selection, selectedOptions: options }), signal);
  const quoteFailure = quoteExclusion(quote, search);
  if (quoteFailure) throw new MarketplaceError(quoteFailure, 409);
  const transaction: FoodTransaction = {
    id: randomUUID(), provider: input.provider, restaurant: item.restaurant.name, quote,
    neighborhoodId: location.neighborhoodId ?? item.restaurant.neighborhood.id,
    phase: "quoted", createdAt: new Date().toISOString(), simulated: true,
  };
  await store.create(owner, transaction);
  return transaction;
}

async function scopedTransaction(owner: string, id: string) {
  const store = await transactionStore();
  const row = await store.get(owner, id);
  if (!row) throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
  return { store, row };
}

function verifiedReceipt(transaction: FoodTransaction, order: MarketplaceOrder) {
  if (order.provider.id !== transaction.provider || order.branchId !== transaction.quote.branchId || order.pricing.totalPaise !== transaction.quote.pricing.totalPaise ||
    JSON.stringify(order.lineItems) !== JSON.stringify(transaction.quote.lineItems) || JSON.stringify(order.pricing) !== JSON.stringify(transaction.quote.pricing) ||
    !order.reference.startsWith(transaction.provider === "wiggy" ? "WIG-" : "TOM-")) {
    throw new MarketplaceError("ORDER_RESPONSE_MISMATCH", 502);
  }
  return receiptOrderSchema.parse(order);
}

async function reconcileBooking(owner: string, row: TransactionRow) {
  const store = await transactionStore();
  let current = row;
  let transaction = row.transaction;
  const provider = marketplaceProvider(transaction.provider);
  try {
    if (!transaction.providerOrderId) {
      const { data } = await provider.createSimulatedOrder({
        quoteId: transaction.quote.id,
        customer: { name: "Jugaad Sandbox", phone: "1000000000" },
        deliveryAddress: { line1: "Fictional Jugaad One demo delivery", neighborhoodId: transaction.neighborhoodId },
        paymentMethod: "simulated_card",
      }, `jugaad-${transaction.id}`);
      const withReference = { ...transaction, providerOrderId: data.order.id };
      if (!await store.update(owner, current, withReference)) return (await scopedTransaction(owner, transaction.id)).row.transaction;
      transaction = withReference;
      current = { version: current.version + 1, transaction };
    }
    const { data } = await provider.getSimulatedOrder(transaction.providerOrderId!);
    const confirmed: FoodTransaction = { ...transaction, phase: "confirmed", order: verifiedReceipt(transaction, data), lastCheckedAt: new Date().toISOString(), failure: undefined };
    if (await store.update(owner, current, confirmed)) return confirmed;
  } catch (error) {
    const code = error instanceof MarketplaceError ? error.code : "BOOKING_UNCERTAIN";
    const phase = !transaction.providerOrderId && confirmedFailures.has(code) ? "rejected" : "reconciliation";
    const failed: FoodTransaction = { ...transaction, phase, failure: code };
    if (await store.update(owner, current, failed)) return failed;
  }
  return (await scopedTransaction(owner, transaction.id)).row.transaction;
}

export async function runCheckout(owner: string, input: CheckoutAction, signal: AbortSignal): Promise<FoodTransaction> {
  if (input.action === "quote") return createTransaction(owner, input, signal);
  const { store, row } = await scopedTransaction(owner, input.id);
  const transaction = row.transaction;
  if (input.action === "cancel") {
    if (transaction.phase === "rejected" && transaction.failure === "CHECKOUT_CANCELLED") return transaction;
    if (transaction.phase !== "quoted" && transaction.phase !== "approved") throw new MarketplaceError("INVALID_TRANSACTION_STATE", 409);
    const cancelled: FoodTransaction = { ...transaction, phase: "rejected", failure: "CHECKOUT_CANCELLED" };
    if (await store.update(owner, row, cancelled)) return cancelled;
    throw new MarketplaceError("COMMERCE_CONFLICT", 409);
  }
  if (input.action === "approve") {
    if (transaction.quote.pricing.totalPaise !== input.totalPaise) throw new MarketplaceError("APPROVAL_TOTAL_MISMATCH", 409);
    if (transaction.phase === "approved") return transaction;
    if (transaction.phase !== "quoted") throw new MarketplaceError("INVALID_TRANSACTION_STATE", 409);
    rejectExpired(transaction);
    const approved: FoodTransaction = { ...transaction, phase: "approved", approvedAt: new Date().toISOString() };
    return await store.update(owner, row, approved) ? approved : (await scopedTransaction(owner, input.id)).row.transaction;
  }
  if (transaction.phase === "confirmed" || transaction.phase === "rejected") return transaction;
  if (!checkoutConfigured()) throw new MarketplaceError("CHECKOUT_NOT_CONFIGURED", 503);
  const now = Date.now();
  if (input.action === "pay" && transaction.phase === "approved") rejectExpired(transaction);
  else if (transaction.phase === "booking" && now - Date.parse(transaction.bookingStartedAt ?? "") < retryAfterMs) return transaction;
  else if (input.action !== "retry" || (transaction.phase !== "booking" && transaction.phase !== "reconciliation")) throw new MarketplaceError("INVALID_TRANSACTION_STATE", 409);
  const timestamp = new Date(now).toISOString();
  const booking: FoodTransaction = {
    ...transaction, phase: "booking", paymentSimulatedAt: transaction.paymentSimulatedAt ?? timestamp, bookingStartedAt: timestamp, failure: undefined,
  };
  if (!await store.update(owner, row, booking)) return (await scopedTransaction(owner, input.id)).row.transaction;
  return reconcileBooking(owner, { version: row.version + 1, transaction: booking });
}

export async function listTransactions(owner?: string) {
  if (!owner || !transactionStorageConfigured()) return [];
  return (await (await transactionStore()).list(owner)).map(({ transaction }) => transaction);
}

export async function readTransaction(owner: string, id: string, signal: AbortSignal) {
  const { store, row } = await scopedTransaction(owner, id);
  const { transaction } = row;
  if (transaction.phase !== "confirmed" || !transaction.order || trackingFinished(transaction.order) || !marketplaceOrderConfigured()) return transaction;
  if (Date.now() - Date.parse(transaction.lastCheckedAt ?? "") < transaction.order.tracking.pollingIntervalSeconds * 1000 - 200) return transaction;
  const { data } = await marketplaceProvider(transaction.provider).getSimulatedOrder(transaction.order.id, signal);
  const refreshed: FoodTransaction = { ...transaction, order: verifiedReceipt(transaction, data), lastCheckedAt: new Date().toISOString() };
  return await store.update(owner, row, refreshed) ? refreshed : (await scopedTransaction(owner, id)).row.transaction;
}
