import "server-only";

import { z } from "zod";
import {
  cancelInputSchema, citiesSchema, coordinatesSchema, foodProviderSchema, menuQuerySchema, menuSchema,
  metadataSchema, orderCreateSchema, orderInputSchema, orderSchema, providerErrorSchema, quoteInputSchema,
  quoteSchema, restaurantQuerySchema, restaurantsSchema, reviewQuerySchema, reviewsSchema,
  type FoodProviderId, type MarketplaceResult, type OrderInput, type QuoteInput,
} from "./schemas";

export const marketplaceProductionUrl = "https://jugaad-food-marketplace.vercel.app";
const requestTimeoutMs = 8_000;

type RestaurantQuery = z.infer<typeof restaurantQuerySchema>;
type MenuQuery = z.infer<typeof menuQuerySchema>;
type ReviewQuery = z.infer<typeof reviewQuerySchema>;
type CancelInput = z.infer<typeof cancelInputSchema>;

export interface MarketplaceProvider {
  searchRestaurants(query: RestaurantQuery, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof restaurantsSchema>>>;
  searchMenuItems(query: MenuQuery, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof menuSchema>>>;
  getReviews(query: ReviewQuery, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof reviewsSchema>>>;
  createQuote(input: QuoteInput, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof quoteSchema>>>;
  createSimulatedOrder(input: OrderInput, idempotencyKey: string, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof orderCreateSchema>>>;
  getSimulatedOrder(id: string, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof orderSchema>>>;
  cancelSimulatedOrder(id: string, input?: CancelInput, signal?: AbortSignal): Promise<MarketplaceResult<z.infer<typeof orderSchema>>>;
}

export class MarketplaceError extends Error {
  constructor(readonly code: string, readonly status: number, readonly requestId?: string) {
    super(code);
    this.name = "MarketplaceError";
  }
}

export function marketplaceUrl(path: string) {
  const base = URL.parse(process.env.MARKETPLACE_API_BASE_URL?.trim() || marketplaceProductionUrl);
  const local = base && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (!base || base.username || base.password || base.pathname !== "/" || base.search || base.hash || (base.protocol !== "https:" && !(local && base.protocol === "http:"))) {
    throw new MarketplaceError("INVALID_MARKETPLACE_CONFIG", 503);
  }
  return new URL(path, base);
}

export function marketplaceOrderConfigured() {
  return Boolean(process.env.MARKETPLACE_AGENT_API_KEY?.trim());
}

function verifiedInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
  return result.data;
}

function signals(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(requestTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

type Query = Record<string, string | number | boolean | undefined>;

async function request<T>(path: string, schema: z.ZodType<T>, options: {
  provider?: FoodProviderId;
  query?: Query;
  body?: object;
  authenticated?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
} = {}): Promise<MarketplaceResult<T>> {
  const url = marketplaceUrl(path);
  const headers = new Headers({ Accept: "application/json" });
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (options.authenticated) {
    const key = process.env.MARKETPLACE_AGENT_API_KEY?.trim();
    if (!key) throw new MarketplaceError("MARKETPLACE_ORDER_KEY_REQUIRED", 503);
    headers.set("Authorization", `Bearer ${key}`);
  }
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  if (options.body) headers.set("Content-Type", "application/json");
  const signal = signals(options.signal);
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(url, {
      method: options.body ? "POST" : "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store", redirect: "error", signal,
    });
    body = await response.json();
  } catch (error) {
    if (options.signal?.aborted) throw options.signal.reason;
    if (signal.aborted) throw new MarketplaceError("MARKETPLACE_TIMEOUT", 504);
    if (error instanceof SyntaxError) throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502);
    throw new MarketplaceError("MARKETPLACE_UNREACHABLE", 502);
  }
  if (!response.ok) {
    const parsed = providerErrorSchema.safeParse(body);
    throw new MarketplaceError(parsed.success ? parsed.data.error.code : "MARKETPLACE_HTTP_ERROR", response.status, parsed.success ? parsed.data.meta.requestId : undefined);
  }
  const result = z.object({ data: schema, meta: metadataSchema }).safeParse(body);
  if (!result.success || (options.provider && result.data.meta.provider !== null && result.data.meta.provider !== options.provider)) {
    throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502);
  }
  return result.data;
}

export function getMarketplaceCities(signal?: AbortSignal) {
  return request("/api/cities", citiesSchema, { signal });
}

export async function getMarketplaceImage(file: string, signal?: AbortSignal) {
  if (!/^(dish|banner)-[a-z0-9-]+\.png$/.test(file)) throw new MarketplaceError("IMAGE_NOT_FOUND", 404);
  const response = await fetch(marketplaceUrl(`/images/${file}`), { redirect: "error", signal: signals(signal), cache: "no-store" });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/png") throw new MarketplaceError("IMAGE_NOT_FOUND", 404);
  return response.body;
}

function verifyProvider(provider: FoodProviderId, actual: FoodProviderId, requestId: string) {
  if (provider !== actual) throw new MarketplaceError("MARKETPLACE_PROVIDER_MISMATCH", 502, requestId);
}

export function marketplaceProvider(id: FoodProviderId): MarketplaceProvider {
  const provider = verifiedInput(foodProviderSchema, id);
  return {
    async searchRestaurants(query, signal) {
      const result = await request("/api/restaurants", restaurantsSchema, { provider, query: { ...verifiedInput(restaurantQuerySchema, query), provider }, signal });
      for (const item of result.data.restaurants) verifyProvider(provider, item.provider.id, result.meta.requestId);
      return result;
    },
    async searchMenuItems(query, signal) {
      const result = await request("/api/menu-items", menuSchema, { provider, query: { ...verifiedInput(menuQuerySchema, query), provider }, signal });
      for (const item of result.data.menuItems) verifyProvider(provider, item.provider.id, result.meta.requestId);
      return result;
    },
    async getReviews(query, signal) {
      const result = await request("/api/reviews", reviewsSchema, { provider, query: { ...verifiedInput(reviewQuerySchema, query), provider }, signal });
      verifyProvider(provider, result.data.filters.provider, result.meta.requestId);
      if (result.data.filters.branchId !== query.branchId || result.data.reviews.some((review) => review.branchId !== query.branchId || review.provider.id !== provider)) {
        throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502, result.meta.requestId);
      }
      return result;
    },
    async createQuote(input, signal) {
      const result = await request("/api/quotes", quoteSchema, { provider, body: { ...verifiedInput(quoteInputSchema, input), provider }, signal });
      verifyProvider(provider, result.data.provider.id, result.meta.requestId);
      if (result.data.branchId !== input.branchId || result.data.lineItems.length !== input.items.length || result.data.lineItems.some((line, index) => {
        const item = input.items[index];
        return line.menuItemId !== item.menuItemId || line.quantity !== item.quantity || line.selectedOptions.length !== (item.selectedOptions?.length ?? 0) || line.selectedOptions.some((option) => !item.selectedOptions?.some((selected) => selected.groupId === option.groupId && selected.optionId === option.optionId));
      })) throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502, result.meta.requestId);
      return result;
    },
    async createSimulatedOrder(input, idempotencyKey, signal) {
      const key = verifiedInput(z.string().regex(/^[A-Za-z0-9_.:-]{8,128}$/), idempotencyKey);
      const result = await request("/api/simulated-orders", orderCreateSchema, { provider, body: { ...verifiedInput(orderInputSchema, input), provider }, authenticated: true, idempotencyKey: key, signal });
      verifyProvider(provider, result.data.order.provider.id, result.meta.requestId);
      return result;
    },
    async getSimulatedOrder(id, signal) {
      const result = await request(`/api/simulated-orders/${verifiedInput(z.uuid(), id)}`, orderSchema, { provider, authenticated: true, signal });
      verifyProvider(provider, result.data.provider.id, result.meta.requestId);
      if (result.data.id !== id) throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502, result.meta.requestId);
      return result;
    },
    async cancelSimulatedOrder(id, input = {}, signal) {
      const result = await request(`/api/simulated-orders/${verifiedInput(z.uuid(), id)}/cancel`, orderSchema, { provider, body: verifiedInput(cancelInputSchema, input), authenticated: true, signal });
      verifyProvider(provider, result.data.provider.id, result.meta.requestId);
      if (result.data.id !== id) throw new MarketplaceError("INVALID_MARKETPLACE_RESPONSE", 502, result.meta.requestId);
      return result;
    },
  };
}

export type MarketplaceCoordinates = z.infer<typeof coordinatesSchema>;
