import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkoutCookie, checkoutOwner } from "../marketplace/checkout";
import { MarketplaceError } from "../marketplace/provider";
import { transactionStore } from "../marketplace/transaction-store";
import type { SandboxState, Region } from "./types";
import type { VoicePreference } from "../voice/catalog";
import type { VoiceLocale } from "../voice/types";
import type { Dialogue } from "../dialogue/state";
import type { FoodIntent } from "../integrations/food-intent";
import type { FoodLocation } from "../marketplace/discovery-types";
import type { Preferences } from "../dialogue/preferences";

export type Profile = { name: string; language: VoiceLocale; region?: Region; location?: FoodLocation; locality?: string; preferences?: Preferences };
export type Session = SandboxState & { profile?: Profile; voicePreference?: VoicePreference; current?: FoodIntent; searchId?: string; seenTurns?: string[]; dialogue?: Dialogue; providerQuoteId?: string; lastTurn?: { id: string; result: import("../integrations/food-intent").FoodTurn }; expiresAt: number };
const retentionSeconds = 30 * 24 * 60 * 60;

export function commerceSession(request: NextRequest) {
  const cookie = request.cookies.get(checkoutCookie)?.value;
  const owner = checkoutOwner(cookie);
  const issued = owner ? undefined : randomUUID();
  return { owner: owner ?? checkoutOwner(issued)!, issued };
}

export function sessionResponse<T>(request: NextRequest, issued: string | undefined, data: T) {
  const response = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  if (issued) response.cookies.set(checkoutCookie, issued, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: retentionSeconds });
  return response;
}

const empty = (): Session => ({ offers: [], orders: [], expiresAt: Date.now() + retentionSeconds * 1000 });
const stateKey = (owner: string) => `commerce:${owner}`;
function decode(body?: string): Session {
  if (!body) return empty();
  const value = JSON.parse(body) as Session;
  return value.expiresAt > Date.now() ? value : empty();
}

export async function readSession(owner: string) {
  return decode((await (await transactionStore()).document(stateKey(owner)))?.body);
}

export async function updateSession(owner: string, transition: (session: Session) => Session) {
  const store = await transactionStore();
  const key = stateKey(owner);
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await store.document(key);
    const session = transition(decode(row?.body));
    if (await store.saveDocument(key, JSON.stringify(session), row?.version)) return session;
  }
  throw new MarketplaceError("COMMERCE_CONFLICT", 409);
}

export async function deleteProfile(owner: string) {
  await updateSession(owner, (session) => ({ ...session, profile: undefined, voicePreference: undefined, current: undefined, searchId: undefined, seenTurns: undefined, dialogue: undefined, lastTurn: undefined, providerQuoteId: undefined, offers: [], quote: undefined, orders: session.orders.map((order) => ({ ...order, destination: undefined })) }));
}
