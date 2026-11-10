import { z } from "zod";

export const regions = ["hyderabad", "bengaluru", "mumbai", "delhi"] as const;
export const regionSchema = z.enum(regions);
export const productCategory = z.enum(["food", "clothing", "groceries", "electronics", "household", "accessories"]);
export const productAttributes = z.object({
  color: z.string().trim().min(1).max(30).optional(),
  material: z.string().trim().min(1).max(30).optional(),
  fit: z.string().trim().min(1).max(30).optional(),
  size: z.string().trim().min(1).max(20).optional(),
  spicy: z.boolean().optional(),
}).strict();
export const commerceProduct = z.object({
  category: productCategory, product: z.string().trim().min(1).max(80),
  attributes: productAttributes.optional(),
  unsupportedRequirements: z.boolean().optional(),
}).strict();
export type CommerceProduct = z.infer<typeof commerceProduct>;
export type Region = z.infer<typeof regionSchema>;
export type ModifierOption = { id: string; name: string; pricePaise: number };
export type ModifierGroup = { id: string; name: string; options: ModifierOption[] };
export type ReviewSummary = { rating: number; count: number; summary: string; positivePoints?: string[]; complaints?: string[] };
export type Listing = {
  id: string; category: CommerceProduct["category"]; name: string; seller: string; region: Region;
  attributes: Record<string, string>; rating: number; etaMinutes: number; origin: "jugaad_sandbox";
  currency: "INR"; available: true; pricePaise: number; deliveryPaise: number; taxPaise: number;
  modifiers?: ModifierGroup[];
  reviews?: ReviewSummary;
};
export type Offer = { listing: Listing; quantity: number; totalPaise: number; selectedModifiers?: ModifierOption[] };
export type SandboxQuote = { id: string; offer: Offer; expiresAt: number; approvedAt?: number };
export type SandboxOrder = { reference: string; quote: SandboxQuote; confirmedAt: number; destination?: string; payment: "simulated_no_charge" };
export type SandboxState = { offers: Offer[]; quote?: SandboxQuote; orders: SandboxOrder[] };
export const demoCode = "2468";
export const commerceAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select"), listingId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("approve"), quoteId: z.uuid(), totalPaise: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("pay"), quoteId: z.uuid(), code: z.literal(demoCode) }).strict(),
  z.object({ action: z.literal("cancel"), quoteId: z.uuid() }).strict(),
  z.object({ action: z.literal("customize"), quoteId: z.uuid(), modifierId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("status") }).strict(),
]);
export type CommerceAction = z.infer<typeof commerceAction>;

export function trackingStage(order: SandboxOrder, now = Date.now()) {
  const minutes = (now - order.confirmedAt) / 60_000;
  const eta = order.quote.offer.listing.etaMinutes;
  if (minutes >= eta) return "Delivered";
  if (minutes >= eta * 0.35) return "Out for delivery";
  if (minutes >= eta * 0.1) return "Preparing";
  return "Confirmed";
}
