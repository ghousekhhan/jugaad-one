import { z } from "zod";
import { searchInputSchema } from "./discovery-types";
import { foodProviderSchema, quoteInputSchema, quoteSchema, receiptOrderSchema } from "./schemas";

const id = z.string().min(1).max(160);
const money = z.number().int().nonnegative();
export const demoUpiSchema = z.string().trim().regex(/^[a-zA-Z0-9._-]{2,40}@demo$/, "Enter a fictional UPI ID ending in @demo.");
const item = quoteInputSchema.shape.items.unwrap();
export const checkoutActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), provider: foodProviderSchema, branchId: id, item, search: searchInputSchema }).strict(),
  z.object({ action: z.literal("approve"), id: z.uuid(), totalPaise: money }).strict(),
  z.object({ action: z.literal("pay"), id: z.uuid(), demoUpi: demoUpiSchema, confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("retry"), id: z.uuid() }).strict(),
  z.object({ action: z.literal("cancel"), id: z.uuid() }).strict(),
]);
export type CheckoutAction = z.infer<typeof checkoutActionSchema>;
export const transactionSchema = z.object({
  id: z.uuid(), phase: z.enum(["quoted", "approved", "booking", "reconciliation", "rejected", "confirmed"]),
  provider: foodProviderSchema, restaurant: z.string(), quote: quoteSchema, neighborhoodId: id,
  createdAt: z.iso.datetime(), approvedAt: z.iso.datetime().optional(), paymentSimulatedAt: z.iso.datetime().optional(),
  bookingStartedAt: z.iso.datetime().optional(), providerOrderId: z.uuid().optional(), order: receiptOrderSchema.optional(),
  lastCheckedAt: z.iso.datetime().optional(), failure: z.string().optional(), simulated: z.literal(true),
});
export type FoodTransaction = z.infer<typeof transactionSchema>;
export type CheckoutSummary = { configured: boolean; transactions: FoodTransaction[] };

export function trackingFinished(order: FoodTransaction["order"]) {
  return Boolean(order && (order.currentStatus === "delivered" || order.tracking.terminal));
}
