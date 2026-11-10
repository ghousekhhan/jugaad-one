import "server-only";

import { MarketplaceError } from "./provider";

const messages: Record<string, string> = {
  COMMERCE_CONFLICT: "This session changed. Try again with the latest offer.",
  COMMERCE_APPROVAL_REQUIRED: "Approve the current quote before entering the demo code.",
  INVALID_MARKETPLACE_INPUT: "Check the request fields and try again.",
  UNSUPPORTED_LOCATION: "Choose a supported city and neighborhood.",
  INVALID_MARKETPLACE_CONFIG: "Marketplace configuration needs attention.",
  MARKETPLACE_ORDER_KEY_REQUIRED: "Sandbox ordering needs a server-side marketplace agent key.",
  MARKETPLACE_TIMEOUT: "The marketplace took too long to respond. Try again.",
  RATE_LIMITED: "Too many marketplace requests. Try again in a minute.",
  PRICE_CHANGED: "The provider changed this price. Request a fresh quote and approve the new total.",
  QUOTE_EXPIRED: "This quote expired. Request a fresh quote before paying.",
  INVALID_ORIGIN: "Open Jugaad One to make this request.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNAUTHORIZED: "The marketplace agent key was rejected.",
  CHECKOUT_NOT_CONFIGURED: "Sandbox checkout needs a marketplace agent key and transaction storage.",
  TRANSACTION_STORAGE_UNAVAILABLE: "Transaction history is temporarily unavailable.",
  TRANSACTION_NOT_FOUND: "This transaction is unavailable in this browser.",
  APPROVAL_TOTAL_MISMATCH: "The total does not match the saved quote. Review the quote again.",
  INVALID_TRANSACTION_STATE: "Review and approve an active quote before continuing.",
  OPTION_METADATA_UNVERIFIED: "Use the default options with dietary or allergen restrictions.",
  INVALID_OPTION_SELECTION: "Check the provider’s option selection limits.",
  ITEM_UNAVAILABLE: "This item is no longer available. Search again.",
  MINIMUM_ORDER_NOT_MET: "The selected items do not meet the provider’s order minimum.",
  OUTSIDE_DELIVERY_AREA: "The provider does not deliver to this location.",
  OUTSIDE_SEARCH_RADIUS: "This item is outside your search radius.",
  OVER_BUDGET: "The final quoted total exceeds your budget.",
  UNKNOWN_ALLERGEN_FILTER: "The fictional catalog can check dairy, egg, gluten, nuts, peanuts and sesame. Other exclusions cannot be verified.",
  GEMINI_NOT_CONFIGURED: "Gemini is not configured. You can search manually.",
  GEMINI_UNAVAILABLE: "Gemini could not interpret this request. Try again or use the food filters.",
  GEMINI_INVALID_RESPONSE: "Gemini returned an invalid food request. Your previous constraints are intact. Try rephrasing the message.",
  GEMINI_AUTH_REJECTED: "Google rejected the server’s Gemini key. Check the key privately or use the manual food filters.",
  GEMINI_MODEL_UNAVAILABLE: "The configured Gemini model is unavailable for this account.",
  GEMINI_RATE_LIMITED: "Gemini is limiting requests. Try again in a minute.",
  VOICE_NOT_CONFIGURED: "Gnani voice is unavailable. You can continue by typing.",
  VOICE_AUTH: "Gnani rejected the server credential. You can continue by typing.",
  VOICE_RATE_LIMIT: "Gnani is limiting voice requests. Try again in a minute or continue by typing.",
  VOICE_LANGUAGE: "That speech language is unavailable. Choose English, Hindi, Telugu, or Hinglish.",
  VOICE_FORMAT: "This recording format could not be read. Try recording again or type your request.",
  VOICE_SIZE: "This recording or reply is too long. Try a shorter request.",
  VOICE_SILENCE: "No speech was detected. Try recording again or type your request.",
  VOICE_REJECTED: "Gnani could not process this voice request or language. Try another language or continue by typing.",
  VOICE_TIMEOUT: "Gnani took too long to respond. Try again or continue by typing.",
  VOICE_UNAVAILABLE: "Gnani voice is temporarily unavailable. You can continue by typing.",
  VOICE_RESPONSE: "Gnani did not return a usable voice response. Try again or continue by typing.",
  VOICE_TICKET: "This voice reply is unavailable or has expired. Send a new message to hear a reply.",
  VOICE_TRANSACTION_STATE: "This transaction is not ready for that announcement. Check the current quote or receipt.",
  OVER_DELIVERY_ESTIMATE: "The provider’s delivery estimate exceeds your time limit.",
  BELOW_MINIMUM_RATING: "This provider’s restaurant rating no longer meets your threshold.",
  RESTAURANT_MISMATCH: "This offer does not come from the requested restaurant.",
  PROVIDER_MISMATCH: "This offer does not come from the requested provider.",
};

export function apiFailure(error: unknown) {
  const failure = error instanceof MarketplaceError ? error : new MarketplaceError("MARKETPLACE_UNREACHABLE", 502);
  return Response.json({ error: { code: failure.code, message: messages[failure.code] ?? "The marketplace request could not be completed.", requestId: failure.requestId } }, {
    status: failure.status, headers: { "Cache-Control": "no-store", ...(failure.status === 429 ? { "Retry-After": "60" } : {}) },
  });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if ((origin && origin !== `${url.protocol}//${host}`) || (site && site !== "same-origin" && site !== "none")) throw new MarketplaceError("INVALID_ORIGIN", 403);
}

export async function readJson(request: Request, maxBytes = 8192): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new MarketplaceError("PAYLOAD_TOO_LARGE", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); }
  catch { throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400); }
}

const runtime = globalThis as typeof globalThis & { jugaadRateLimits?: Map<string, { window: number; count: number }> };
const limits = runtime.jugaadRateLimits ??= new Map();

export function enforceRateLimit(bucket: string, maximum: number) {
  const window = Math.floor(Date.now() / 60_000);
  const limit = limits.get(bucket);
  if (limit?.window === window) {
    if (limit.count >= maximum) throw new MarketplaceError("RATE_LIMITED", 429);
    limit.count += 1;
  } else {
    limits.set(bucket, { window, count: 1 });
  }
}
