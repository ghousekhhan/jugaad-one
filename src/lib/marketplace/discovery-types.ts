import { z } from "zod";
import { coordinatesSchema, foodProviderSchema, radiusSchema, type FoodProviderId, type MarketplaceMenuItem, type MarketplaceQuote, type MarketplaceRestaurant } from "./schemas";

export const dietarySchema = z.enum(["vegetarian", "vegan", "gluten-free", "halal"]);
export const dietaryRestrictionsSchema = z.array(dietarySchema).min(1).max(4);
export const providerPreferenceSchema = z.object({ provider: foodProviderSchema, mode: z.enum(["only", "prefer"]) }).strict();

export const locationSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("manual"), cityId: z.string().min(1).max(80), neighborhoodId: z.string().min(1).max(120).optional() }).strict(),
  z.object({ source: z.literal("gps"), coordinates: coordinatesSchema }).strict(),
]);
export type FoodLocation = z.infer<typeof locationSchema>;
export const searchInputSchema = z.object({
  mode: z.enum(["dish", "restaurant", "menu"]),
  query: z.string().trim().max(120),
  branchId: z.string().min(1).max(160).optional(),
  location: locationSchema,
  radiusKm: radiusSchema,
  budgetPaise: z.number().int().positive().max(10_000_000).optional(),
  budgetExclusive: z.boolean().optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  restaurant: z.string().trim().min(1).max(120).optional(),
  cuisine: z.string().trim().max(60).optional(),
  dietary: dietarySchema.optional(),
  dietaryRestrictions: dietaryRestrictionsSchema.optional(),
  allergens: z.array(z.string().trim().toLowerCase().min(1).max(24).regex(/^[a-z -]+$/)).max(5).optional(),
  minRating: z.number().min(1).max(5).optional(),
  ratingExclusive: z.boolean().optional(),
  maxEtaMinutes: z.number().int().min(1).max(240).optional(),
  providerPreference: providerPreferenceSchema.optional(),
  priority: z.enum(["fastest", "lowest-price"]).optional(),
  page: z.number().int().min(0).max(20).default(0),
}).strict().refine((input) => input.mode === "menu" ? Boolean(input.branchId) : input.query.length > 0, { message: "Enter a dish or restaurant name." });
export type FoodSearch = z.infer<typeof searchInputSchema>;
export type QuotedOffer = { item: MarketplaceMenuItem; quote: MarketplaceQuote };
export type ProviderIssue = { provider: FoodProviderId; code: string; requestId?: string };
export type OfferExclusion = { provider: FoodProviderId; item: string; code: string };
export type ProviderEvidence = { provider: FoodProviderId; catalogRequestId: string; quoteRequestIds: string[] };
type DiscoveryBase = { simulated: true; issues: ProviderIssue[]; more: boolean; evidence?: ProviderEvidence[] };
export type FoodSearchResult =
  | (DiscoveryBase & { kind: "restaurants"; restaurants: MarketplaceRestaurant[] })
  | (DiscoveryBase & { kind: "offers"; offers: QuotedOffer[]; excluded: OfferExclusion[] });

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
export function formatPaise(amount: number) {
  return inr.format(amount / 100);
}

export function marketplaceImage(path: string) {
  return `/api/marketplace/image/${path.slice("/images/".length)}`;
}
