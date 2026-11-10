import type { NextRequest } from "next/server";
import { checkoutCookie, checkoutOwner, readTransaction } from "@/lib/marketplace/checkout";
import { apiFailure, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { gnaniConfigured, speakVoice, streamVoice, timbreModel } from "@/lib/voice/gnani";
import { readSpeechTicket } from "@/lib/voice/speech-ticket";
import { transactionSpeech } from "@/lib/voice/transaction-speech";
import { speechSourceSchema, type SpeechSource } from "@/lib/voice/types";

async function speechFor(input: SpeechSource, request: NextRequest) {
  if (input.kind === "reply") return readSpeechTicket(input.ticket);
  const owner = checkoutOwner(request.cookies.get(checkoutCookie)?.value);
  if (!owner) throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
  const transaction = await readTransaction(owner, input.transactionId, request.signal);
  const text = transactionSpeech(transaction, input.kind, input.language);
  if (!text) throw new MarketplaceError("VOICE_TRANSACTION_STATE", 409);
  return { text, language: input.language };
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!gnaniConfigured()) throw new MarketplaceError("VOICE_NOT_CONFIGURED", 503);
    const input = speechSourceSchema.safeParse(await readJson(request));
    if (!input.success) throw new MarketplaceError("VOICE_TICKET", 400);
    enforceRateLimit("timbre-speech", 22);
    const { text, language } = await speechFor(input.data, request);
    const headers = {
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "X-Voice-Text": Buffer.from(text, "utf8").toString("base64"), "X-Voice-Language": language, "X-Voice-Model": timbreModel,
    };
    if (request.headers.get("accept") === "audio/x-pcm") {
      const stream = await streamVoice(text, language, request.signal);
      return new Response(stream.body, { headers: { ...headers, "Content-Type": "audio/x-pcm", "Server-Timing": `timbre-first;dur=${stream.firstMs}` } });
    }
    const { audio, latencyMs } = await speakVoice(text, language, request.signal);
    return new Response(audio, { headers: { ...headers, "Content-Type": "audio/wav", "Server-Timing": `timbre;dur=${latencyMs}` } });
  } catch (error) { return apiFailure(error); }
}
