import type { NextRequest } from "next/server";
import { z } from "zod";
import { commerceSession, deleteProfile, readSession, sessionResponse, updateSession } from "@/lib/commerce/session";
import { bookCommerce, commerceSpeech, trackingSpeech } from "@/lib/commerce/booking";
import { commerceAction, regionSchema } from "@/lib/commerce/types";
import { matchGpsToDemoCity } from "@/lib/marketplace/demo-cities";
import { locationSchema } from "@/lib/marketplace/discovery-types";
import { apiFailure, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { issueSpeechTicket } from "@/lib/voice/speech-ticket";
import { voiceLocale } from "@/lib/voice/types";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(40), language: voiceLocale, region: regionSchema.optional(), location: locationSchema.optional(), locality: z.string().trim().min(1).max(100).optional(),
}).strict().refine(({ region, location }) => {
  if (!location) return true;
  if (!region) return false;
  if (location.source === "manual") return location.cityId === region;
  const result = matchGpsToDemoCity(location.coordinates);
  return result.isWithinSupportedRegion && result.matchedCity.id === region;
});
const profileAction = z.object({ action: z.literal("profile"), profile: profileSchema }).strict();
const command = z.object({ input: commerceAction, language: voiceLocale }).strict();

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { owner, issued } = commerceSession(request);
    const { current, profile, offers, quote, orders, providerQuoteId, dialogue, expiresAt } = await readSession(owner);
    return sessionResponse(request, issued, { current, profile, offers, quote, orders, providerQuoteId, expiresAt,
      dialogue: dialogue ? { task: dialogue.task, lastLanguage: dialogue.lastLanguage } : undefined });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    enforceRateLimit("commerce-actions", 32);
    const { owner, issued } = commerceSession(request);
    const body = await readJson(request);
    const profile = profileAction.safeParse(body);
    if (profile.success) {
      const next = await updateSession(owner, (state) => {
        const changed = JSON.stringify(state.profile?.location) !== JSON.stringify(profile.data.profile.location) ||
          state.profile?.region !== profile.data.profile.region;
        if (!changed) return { ...state, profile: profile.data.profile };
        const dialogue = state.dialogue;
        const task = dialogue?.task;
        const current = state.current ? { ...state.current, city: undefined, neighborhood: undefined } : undefined;
        return { ...state, profile: profile.data.profile, searchId: undefined, lastTurn: undefined, current,
          offers: [], quote: undefined, providerQuoteId: undefined, dialogue: dialogue && { ...dialogue, awaitingApproval: undefined, offerReply: undefined,
            task: task ? { id: task.id, turn: { ...task.turn, constraints: current ?? {}, comparison: undefined, sandbox: undefined, selectedQuoteId: undefined } } : undefined } };
      });
      return sessionResponse(request, issued, { profile: next.profile });
    }
    const parsed = command.safeParse(body);
    if (!parsed.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
    const { input, language } = parsed.data;
    const { session, order } = await bookCommerce(owner, input);
    const { offers, quote, orders } = session;
    const speech = input.action === "status" ? trackingSpeech(language, orders[0]) : commerceSpeech(language, quote, order);
    const speechTicket = speech ? issueSpeechTicket(speech, language) : undefined;
    if (speech && input.action !== "status") {
      await updateSession(owner, (latest) => {
        const dialogue = latest.dialogue ?? { previous: [] };
        const task = quote && dialogue.task ? { ...dialogue.task, selectedId: quote.offer.listing.id } : dialogue.task;
        return { ...latest, dialogue: { ...dialogue, task, awaitingApproval: quote && !quote.approvedAt ? quote.id : undefined,
          last: { text: speech, language, ticket: speechTicket } } };
      });
    }
    return sessionResponse(request, issued, { offers, quote, orders, order, speech, speechTicket });
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { owner } = commerceSession(request);
    await deleteProfile(owner);
    return sessionResponse(request, undefined, { deleted: true });
  } catch (error) { return apiFailure(error); }
}
