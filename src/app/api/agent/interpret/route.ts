import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { commerceSession, sessionResponse, updateSession, type Session } from "@/lib/commerce/session";
import { orchestrate } from "@/lib/dialogue/controller";
import { interpretationInputSchema } from "@/lib/integrations/food-intent";
import { interpretFoodRequest } from "@/lib/integrations/gemini";
import { apiFailure, apiSuccess, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { transactionStorageConfigured } from "@/lib/marketplace/transaction-store";

export async function POST(request: NextRequest) {
  const start = performance.now();
  let turnId: string | undefined;
  try {
    assertSameOrigin(request);
    const parsed = interpretationInputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
    const input = parsed.data;
    const { owner, issued } = commerceSession(request);
    const requestId = turnId = input.turnId ?? randomUUID();
    const started = performance.now();
    const stored = transactionStorageConfigured() ? await updateSession(owner, (session) => {
      if (session.lastTurn?.id === requestId) return session;
      if (session.searchId === requestId || session.seenTurns?.includes(requestId)) throw new MarketplaceError("COMMERCE_CONFLICT", 409);
      return { ...session, searchId: requestId, seenTurns: [...(session.seenTurns ?? []), requestId].slice(-12) };
    }).catch((error: unknown) => {
      if (error instanceof MarketplaceError && error.code === "TRANSACTION_STORAGE_UNAVAILABLE") return undefined;
      throw error;
    }) : undefined;
    if (stored?.lastTurn?.id === requestId) return sessionResponse(request, issued, stored.lastTurn.result);
    const session: Session = stored ?? { offers: [], orders: [], expiresAt: 0 };
    const { result, state, timing } = await orchestrate(input, session, {
      signal: request.signal, owner, requestId, persisted: Boolean(stored),
      interpret: (turn, signal) => {
        enforceRateLimit("gemini-interpret", 12);
        return interpretFoodRequest(turn, signal);
      },
    });
    if (stored) {
      request.signal.throwIfAborted();
      await updateSession(owner, (latest) => {
        if (latest.searchId !== requestId) throw new MarketplaceError("COMMERCE_CONFLICT", 409);
        return { ...latest, current: state.current, dialogue: state.dialogue,
          offers: state.offers === session.offers ? latest.offers : state.offers,
          quote: state.quote === session.quote ? latest.quote : state.quote,
          providerQuoteId: state.providerQuoteId, lastTurn: { id: requestId, result } };
      });
    }
    const response = stored ? sessionResponse(request, issued, result) : apiSuccess(result);
    response.headers.set("X-Dialogue-Action", result.dialogueAction ?? "search");
    response.headers.set("X-Dialogue-Domain", result.domain ?? "other");
    response.headers.set("X-Dialogue-Transition", result.transition ?? "none");
    response.headers.set("X-Dialogue-Reasoning", result.trace?.reasoning ?? "deterministic");
    response.headers.set("X-Dialogue-Search", String(Boolean(result.trace?.searchAttempted)));
    if (result.searchFailure) response.headers.set("X-Dialogue-Failure", result.searchFailure);
    response.headers.set("X-Dialogue-Provider-Batches", String(timing.providerCalls));
    response.headers.set("Server-Timing", `gemini;dur=${Math.round(timing.reasonMs)}, turn;dur=${Math.round(timing.executionMs)}, catalog;dur=${Math.round(timing.catalog)}, quotes;dur=${Math.round(timing.quotes)}, agent;dur=${Math.round(performance.now() - started)}`);
    return response;
  } catch (error) {
    const response = apiFailure(error);
    if (turnId) response.headers.set("X-Dialogue-Turn", turnId);
    response.headers.set("X-Dialogue-Error", error instanceof MarketplaceError ? error.code : "UNEXPECTED_ERROR");
    response.headers.set("Server-Timing", `agent;dur=${Math.round(performance.now() - start)}`);
    return response;
  }
}
