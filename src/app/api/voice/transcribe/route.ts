import { apiFailure, apiSuccess, assertSameOrigin, enforceRateLimit } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { gnaniConfigured, readAudioBytes, transcribeVoice } from "@/lib/voice/gnani";
import { voiceLocale } from "@/lib/voice/types";
import { inspectVoiceWave, maxRecordingSeconds, maxWaveBytes } from "@/lib/voice/wave";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!gnaniConfigured()) throw new MarketplaceError("VOICE_NOT_CONFIGURED", 503);
    const locale = voiceLocale.safeParse(new URL(request.url).searchParams.get("language"));
    if (!locale.success) throw new MarketplaceError("VOICE_LANGUAGE", 400);
    if (request.headers.get("content-type")?.split(";")[0] !== "audio/wav") throw new MarketplaceError("VOICE_FORMAT", 415);
    if (Number(request.headers.get("content-length")) > maxWaveBytes) throw new MarketplaceError("VOICE_SIZE", 413);
    enforceRateLimit("prisma-capture", 18);
    const start = performance.now();
    const audio = await readAudioBytes(request.body, maxWaveBytes);
    const upload = performance.now() - start;
    const wave = inspectVoiceWave(audio);
    if (!wave || wave.seconds > maxRecordingSeconds) throw new MarketplaceError("VOICE_FORMAT", 415);
    if (wave.seconds < 0.3 || !wave.hasSignal) throw new MarketplaceError("VOICE_SILENCE", 422);
    const result = await transcribeVoice(audio, locale.data, request.signal);
    const response = apiSuccess(result);
    response.headers.set("Server-Timing", `upload;dur=${Math.round(upload)}, prisma;dur=${result.latencyMs}`);
    return response;
  } catch (error) { return apiFailure(error); }
}
