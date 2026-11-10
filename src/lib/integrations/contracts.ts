import type { SavedRequest } from "@/lib/request";

export type Language = SavedRequest["language"];
export type Category = Exclude<SavedRequest["category"], "">;
export type ProviderId = "wiggy" | "tomato" | "frapido" | "suber";
export type Integration<Adapter> =
  | { status: "not_connected" }
  | { status: "connected"; adapter: Adapter };

export interface Location {
  label: string;
  latitude: number;
  longitude: number;
}

export interface IntentConstraints {
  category: Category;
  query: string;
  maxBudgetPaise?: number;
  maxDistanceKm?: number;
  priority?: "fastest" | "lowest-price";
  origin?: Location;
  destination?: Location;
  exclusions?: string[];
}

export type GeminiReply =
  | { kind: "clarification"; text: string; language: Language }
  | { kind: "search"; text: string; language: Language; constraints: IntentConstraints };

export interface GeminiAdapter {
  interpret(input: {
    request: SavedRequest;
    history: ReadonlyArray<{ role: "user" | "assistant"; text: string }>;
    previousConstraints?: IntentConstraints;
  }, signal?: AbortSignal): Promise<GeminiReply>;
}

export interface GnaniPrismaAdapter {
  transcribe(input: { audio: Blob; language: Language }, signal?: AbortSignal): Promise<{ text: string; language: Language }>;
}

export interface GnaniTimbreAdapter {
  synthesize(input: { text: string; language: Language }, signal?: AbortSignal): Promise<{ audio: ReadableStream<Uint8Array>; contentType: string }>;
}

export interface ProviderOffer {
  id: string;
  providerId: ProviderId;
  name: string;
  etaMinutes: number;
  distanceKm?: number;
}

export interface ProviderQuote {
  id: string;
  offer: ProviderOffer;
  currency: "INR";
  fees: ReadonlyArray<{ label: string; amountPaise: number }>;
  totalPaise: number;
  expiresAt: string;
}

export interface ProviderBooking {
  id: string;
  quoteId: string;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  environment: "sandbox";
}

export interface ProviderAdapter {
  search(constraints: IntentConstraints, signal?: AbortSignal): Promise<ProviderOffer[]>;
  getAvailability(offerId: string, signal?: AbortSignal): Promise<{ available: boolean }>;
  getQuote(offerId: string, signal?: AbortSignal): Promise<ProviderQuote>;
  validateQuote(quoteId: string, signal?: AbortSignal): Promise<{ valid: boolean }>;
  createBooking(input: { quoteId: string; sandboxPaymentId: string; idempotencyKey: string }, signal?: AbortSignal): Promise<ProviderBooking>;
  getBooking(bookingId: string, signal?: AbortSignal): Promise<ProviderBooking>;
  cancelBooking?(bookingId: string, signal?: AbortSignal): Promise<ProviderBooking>;
}
