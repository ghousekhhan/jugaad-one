import { z } from "zod";

export const foodProviders = ["wiggy", "tomato"] as const;
export const foodProviderSchema = z.enum(foodProviders);
export type FoodProviderId = z.infer<typeof foodProviderSchema>;
export const foodProviderNames: Record<FoodProviderId, string> = { wiggy: "Wiggy", tomato: "Tomato" };

const id = z.string().min(1).max(160);
const identifier = z.object({ id, name: z.string() });
const simulated = z.literal(true);
const timestamp = z.iso.datetime({ offset: true });
const paise = z.number().int().nonnegative();
const eta = z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() });
const distance = z.number().nonnegative().nullable();
export const coordinatesSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
export const radiusSchema = z.number().positive().max(50);
export const citySchema = identifier.extend({ state: z.string(), coordinates: coordinatesSchema, neighborhoods: z.array(identifier.extend({ coordinates: coordinatesSchema })), simulated });
export const citiesSchema = z.object({ cities: z.array(citySchema) });
export type MarketplaceCity = z.infer<typeof citySchema>;

export const metadataSchema = z.object({ requestId: z.uuid(), provider: foodProviderSchema.nullable(), simulated, dataStatus: z.literal("simulated"), generatedAt: timestamp });
export type MarketplaceResult<T> = { data: T; meta: z.infer<typeof metadataSchema> };
export const providerErrorSchema = z.object({ error: z.object({ code: z.string().regex(/^[A-Z_]+$/), message: z.string() }), meta: metadataSchema });
const provider = z.object({ id: foodProviderSchema, name: z.string(), simulated });
const availability = z.object({ acceptingOrders: z.boolean(), serviceHours: z.object({ opensAt: z.string(), closesAt: z.string(), timezone: z.string() }), simulated });
const rating = z.object({ value: z.number().min(1).max(5), count: z.number().int().nonnegative(), simulated });
const ratingDistribution = z.array(z.object({ stars: z.number().int().min(1).max(5), count: z.number().int().nonnegative() })).length(5);
const demoMetadata = z.object({ status: z.enum(["verified", "unknown"]), values: z.array(z.string()), note: z.string() });
const imagePath = z.string().regex(/^\/images\/[a-z0-9-]+\.png$/);

export const restaurantSchema = z.object({
  id, provider,
  brand: identifier.extend({ cuisine: z.string(), description: z.string() }),
  branch: identifier.extend({ address: z.string(), coordinates: coordinatesSchema, neighborhood: identifier, city: identifier.extend({ state: z.string() }) }),
  availability,
  pricing: z.object({ currency: z.literal("INR"), deliveryFeePaise: paise, deliveryPerKmPaise: paise, packagingFeePaise: paise, platformFeePaise: paise, taxRateBps: paise.max(10_000), minimumOrderPaise: paise }),
  etaMinutes: eta, rating, ratingDistribution, reviewCount: paise, distanceKm: distance, bannerImage: imagePath, simulated,
});
export const restaurantsSchema = z.object({ restaurants: z.array(restaurantSchema), total: paise });
export type MarketplaceRestaurant = z.infer<typeof restaurantSchema>;

const selection = z.object({ groupId: z.string().min(1).max(180), optionId: z.string().min(1).max(180) }).strict();
const selectedOptions = z.array(selection).max(10);
const quantity = z.number().int().min(1).max(20);
export const menuItemSchema = z.object({
  id, provider,
  restaurant: z.object({ listingId: id, branchId: id, brandId: id, name: z.string(), cuisine: z.string(), city: identifier, neighborhood: identifier, coordinates: coordinatesSchema, rating, reviewCount: paise }),
  name: z.string(), description: z.string(), category: z.string(), cuisine: z.string(), pricePaise: paise.positive(),
  availability: z.object({ available: z.boolean(), acceptingOrders: z.boolean(), simulated }),
  dietary: demoMetadata, allergens: demoMetadata,
  customization: z.array(z.object({ id, name: z.string(), required: z.boolean(), minSelect: paise, maxSelect: paise, choices: z.array(identifier.extend({ priceDeltaPaise: paise })) })),
  image: z.object({ url: imagePath, alt: z.string(), source: z.literal("original_generated"), simulated }),
  distanceKm: distance, simulated,
});
export const menuSchema = z.object({ menuItems: z.array(menuItemSchema), total: paise });
export type MarketplaceMenuItem = z.infer<typeof menuItemSchema>;

export const reviewQuerySchema = z.object({ branchId: id, stars: z.number().int().min(1).max(5).optional(), sort: z.enum(["newest", "highest", "lowest"]).optional(), limit: z.number().int().min(1).max(50).optional(), offset: paise.max(10_000).optional() });
export const reviewsSchema = z.object({
  summary: z.object({ rating, distribution: ratingDistribution, sampleReviewCount: paise, simulated }),
  reviews: z.array(z.object({ id, provider, branchId: id, listingId: id, authorName: z.string(), rating: z.number().int().min(1).max(5), comment: z.string(), orderContext: z.string().nullable(), createdAt: timestamp, simulated })),
  total: paise, limit: paise, offset: paise, sort: z.enum(["newest", "highest", "lowest"]),
  filters: z.object({ provider: foodProviderSchema, branchId: id, stars: z.number().int().min(1).max(5).nullable() }),
});
export type MarketplaceReviews = z.infer<typeof reviewsSchema>;

export const quoteInputSchema = z.object({
  branchId: id, city: z.string().min(1).max(80).optional(), neighborhoodId: z.string().min(1).max(120).optional(), coordinates: coordinatesSchema.optional(),
  items: z.array(z.object({ menuItemId: id, quantity, selectedOptions: selectedOptions.optional() }).strict()).min(1).max(30),
}).strict();
export type QuoteInput = z.infer<typeof quoteInputSchema>;

const quotePricing = z.object({
  currency: z.literal("INR"), subtotalPaise: paise, deliveryFeePaise: paise, packagingFeePaise: paise, platformFeePaise: paise, taxPaise: paise, discountPaise: paise, totalPaise: paise,
}).refine((price) => price.subtotalPaise + price.deliveryFeePaise + price.packagingFeePaise + price.platformFeePaise + price.taxPaise - price.discountPaise === price.totalPaise);
const quoteShape = {
  id: z.uuid(), provider, branchId: id, listingId: id,
  lineItems: z.array(z.object({ menuItemId: id, name: z.string(), quantity, unitPricePaise: paise, selectedOptions: z.array(selection.extend({ name: z.string(), priceDeltaPaise: paise })), lineTotalPaise: paise })).min(1),
  pricing: quotePricing, distanceKm: distance, etaMinutes: eta, availability, expiresAt: timestamp, simulated,
};
export const quoteSchema = z.object(quoteShape);
export type MarketplaceQuote = z.infer<typeof quoteSchema>;

const trackingSteps = ["confirmed", "preparing", "partner_assigned", "arriving_for_pickup", "picked_up", "out_for_delivery", "delivered"] as const;
const terminalStatuses = ["cancelled", "failed", "expired"] as const;
const lifecycle = z.enum([...trackingSteps, ...terminalStatuses]);
const tracking = z.object({
  currentStatus: lifecycle,
  steps: z.array(z.object({ id: z.enum(trackingSteps), label: z.string(), state: z.enum(["completed", "current", "upcoming"]), scheduledAt: timestamp, occurredAt: timestamp.nullable(), simulated })).length(trackingSteps.length).refine((steps) => steps.every(({ id }, index) => id === trackingSteps[index])),
  assignmentEtaAt: timestamp,
  assignmentWindowMinutes: z.object({ min: z.literal(5), max: z.literal(10) }),
  deliveryEtaAt: timestamp, lastUpdateAt: timestamp,
  partner: z.object({ name: z.string(), vehicle: z.string(), simulated }).nullable(),
  terminal: z.object({ status: z.enum(terminalStatuses), at: timestamp, reason: z.string().nullable() }).nullable(),
  pollingIntervalSeconds: z.number().int().min(5).max(10), simulated,
});
const paymentMethod = z.enum(["simulated_cash", "simulated_card"]);
const customer = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\+?[1-9]\d{9,14}$/) }).strict();
const deliveryAddress = z.object({ line1: z.string().trim().min(5).max(160), neighborhoodId: z.string().min(1).max(120), instructions: z.string().trim().max(200).nullable().optional() }).strict();
export const orderInputSchema = z.object({ quoteId: z.uuid(), customer, deliveryAddress, paymentMethod }).strict();
export type OrderInput = z.infer<typeof orderInputSchema>;
const orderShape = {
  ...quoteShape, status: z.literal("simulated_confirmed"), paymentMethod, customer, deliveryAddress, createdAt: timestamp,
  paymentStatus: z.literal("simulated_no_charge"), fulfillmentStatus: z.literal("simulated_no_dispatch"), reference: z.string().regex(/^(WIG|TOM)-[A-Z0-9]+$/), currentStatus: lifecycle, tracking,
};
export const orderSchema = z.object(orderShape).refine((order) => order.currentStatus === order.tracking.currentStatus);
export const receiptOrderSchema = z.object(orderShape).omit({ customer: true, deliveryAddress: true });
export const orderCreateSchema = z.object({ order: orderSchema, replayed: z.boolean(), simulated });
export type MarketplaceOrder = z.infer<typeof orderSchema>;
export const cancelInputSchema = z.object({ reason: z.string().trim().max(200).nullable().optional() }).strict();

const commonQuery = z.object({
  city: z.string().min(1).max(80).optional(), neighborhood: z.string().min(1).max(100).optional(),
  lat: coordinatesSchema.shape.latitude.optional(), lng: coordinatesSchema.shape.longitude.optional(), radiusKm: radiusSchema.optional(),
  q: z.string().max(120).optional(), cuisine: z.string().max(60).optional(), dietary: z.string().max(40).optional(),
  branchId: id.optional(), restaurantId: id.optional(), openNow: z.boolean().optional(), availableOnly: z.boolean().optional(),
  minRating: z.number().min(1).max(5).optional(), sort: z.enum(["relevance", "rating", "eta", "distance", "priceAsc", "priceDesc"]).optional(),
  limit: z.number().int().min(1).max(100).optional(), offset: paise.max(10_000).optional(),
});
function validQuery(query: z.infer<typeof commonQuery>) {
  return (query.lat === undefined) === (query.lng === undefined) && (query.radiusKm === undefined || query.lat !== undefined) && (query.city !== undefined || query.lat !== undefined);
}
export const restaurantQuerySchema = commonQuery.extend({ maxDeliveryFeePaise: paise.max(100_000).optional() }).strict().refine(validQuery);
export const menuQuerySchema = commonQuery.extend({ category: z.string().max(60).optional(), allergenFree: z.string().max(120).optional(), maxPricePaise: paise.positive().max(10_000_000).optional() }).strict().refine(validQuery);
