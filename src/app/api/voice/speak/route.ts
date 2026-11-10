import type { NextRequest } from "next/server";
import { checkoutCookie, checkoutOwner, readTransaction } from "@/lib/marketplace/checkout";
import { apiFailure, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { transactionStorageConfigured } from "@/lib/marketplace/transaction-store";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { gnaniConfigured, speakVoice, streamVoice, timbreModel } from "@/lib/voice/gnani";
import { preferredVoice, voiceCatalog, voiceSamples } from "@/lib/voice/catalog";
import { readSession } from "@/lib/commerce/session";
import { readSpeechTicket } from "@/lib/voice/speech-ticket";
import { transactionSpeech } from "@/lib/voice/transaction-speech";
import { speechSourceSchema, type SpeechSource } from "@/lib/voice/types";

async function speechFor(input: SpeechSource, request: NextRequest) {
  if (input.kind === "preview") return { text: voiceSamples[input.language], language: input.language };
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
    const preview = input.data.kind === "preview" ? input.data : undefined;
    if (preview && !voiceCatalog[language].some(({ id }) => id === preview.voice)) throw new MarketplaceError("VOICE_SELECTION", 400);
    const owner = checkoutOwner(request.cookies.get(checkoutCookie)?.value);
    const preference = owner && !preview && transactionStorageConfigured()
      ? (await readSession(owner).catch((error: unknown) => {
        if (error instanceof MarketplaceError && error.code === "TRANSACTION_STORAGE_UNAVAILABLE") return undefined;
        throw error;
      }))?.voicePreference : undefined;
    const voice = preview?.voice ?? preferredVoice(language, preference);
    const headers = {
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "X-Voice-Text": Buffer.from(text, "utf8").toString("base64"), "X-Voice-Language": language, "X-Voice-Model": timbreModel,
    };
    async function synthesize(id: string, fallback = false) {
      const voiceHeaders = { ...headers, "X-Voice-Id": id, ...(fallback ? { "X-Voice-Fallback": "1" } : {}) };
      if (request.headers.get("accept") === "audio/x-pcm") {
        const stream = await streamVoice(text, language, request.signal, id);
        return new Response(stream.body, { headers: { ...voiceHeaders, "Content-Type": "audio/x-pcm", "Server-Timing": `timbre-first;dur=${stream.firstMs}` } });
      }
      const { audio, latencyMs } = await speakVoice(text, language, request.signal, id);
      return new Response(audio, { headers: { ...voiceHeaders, "Content-Type": "audio/wav", "Server-Timing": `timbre;dur=${latencyMs}` } });
    }
    try { return await synthesize(voice); }
    catch (error) {
      const fallback = voiceCatalog[language].find(({ id }) => id !== voice);
      if (preview || !fallback || request.signal.aborted || !(error instanceof MarketplaceError) ||
          !["VOICE_REJECTED", "VOICE_UNAVAILABLE", "VOICE_RESPONSE"].includes(error.code)) throw error;
      return await synthesize(fallback.id, true);
    }
  } catch (error) { return apiFailure(error); }
}
