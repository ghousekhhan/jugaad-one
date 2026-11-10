import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkoutConfigured, checkoutCookie, checkoutOwner, listTransactions, runCheckout } from "@/lib/marketplace/checkout";
import { checkoutActionSchema } from "@/lib/marketplace/checkout-types";
import { apiFailure, apiSuccess, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { updateSession } from "@/lib/commerce/session";
import { issueSpeechTicket } from "@/lib/voice/speech-ticket";
import { transactionSpeech } from "@/lib/voice/transaction-speech";
import { MarketplaceError } from "@/lib/marketplace/provider";

export async function GET(request: NextRequest) {
  try {
    enforceRateLimit("marketplace-receipts", 45);
    const owner = checkoutOwner(request.cookies.get(checkoutCookie)?.value);
    return apiSuccess({ configured: checkoutConfigured(), transactions: await listTransactions(owner) });
  } catch (error) { return apiFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = checkoutActionSchema.safeParse(await readJson(request));
    if (!input.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
    enforceRateLimit(input.data.action === "quote" ? "marketplace-checkout-quote" : "marketplace-checkout", input.data.action === "quote" ? 5 : 24);
    const existing = checkoutOwner(request.cookies.get(checkoutCookie)?.value);
    if (!existing && input.data.action !== "quote") throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
    const newCookie = existing ? undefined : randomUUID();
    const owner = existing ?? checkoutOwner(newCookie)!;
    const transaction = await runCheckout(owner, input.data, request.signal);
    if (transaction.phase === "quoted" || transaction.phase === "approved" || transaction.phase === "confirmed") {
      await updateSession(owner, (state) => {
        const dialogue = state.dialogue;
        const comparison = dialogue?.task?.turn.comparison;
        if (!dialogue?.task || comparison?.result.kind !== "offers") return state;
        const selected = comparison.result.offers.find(({ item }) => item.provider.id === transaction.provider &&
          item.restaurant.branchId === transaction.quote.branchId && item.id === transaction.quote.lineItems[0].menuItemId);
        if (!selected) return state;
        const language = dialogue.lastLanguage ?? state.profile?.language ?? "en-IN";
        const speech = transaction.phase === "quoted" ? transactionSpeech(transaction, "approval", language) :
          transaction.phase === "confirmed" ? transactionSpeech(transaction, "confirmation", language) : undefined;
        if (transaction.phase === "confirmed") {
          if (state.providerQuoteId !== transaction.id) return state;
          return { ...state, providerQuoteId: undefined, current: undefined, searchId: undefined, lastTurn: undefined, dialogue: {
            previous: [], lastLanguage: language,
            last: speech ? { text: speech, language, ticket: issueSpeechTicket(speech, language) } : dialogue.last,
          } };
        }
        return { ...state, providerQuoteId: transaction.id, dialogue: {
          ...dialogue, task: { ...dialogue.task, selectedId: selected.quote.id },
          awaitingApproval: transaction.phase === "quoted" ? transaction.id : undefined,
          last: speech ? { text: speech, language, ticket: issueSpeechTicket(speech, language) } : dialogue.last,
        } };
      }).catch(() => undefined);
    }
    const response = NextResponse.json(transaction, { headers: { "Cache-Control": "no-store" } });
    if (newCookie) response.cookies.set(checkoutCookie, newCookie, {
      httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (error) { return apiFailure(error); }
}
