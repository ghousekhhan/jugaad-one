import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MarketplaceError } from "../marketplace/provider";
import { maxVoiceReplyLength } from "./gnani";
import { voiceLocale, type VoiceLocale } from "./types";

const ticketSchema = z.object({ text: z.string().min(1).max(maxVoiceReplyLength), language: voiceLocale, expires: z.number().int() }).strict();
const lifetime = 30 * 60 * 1000;

function signature(key: string, payload: string) {
  return createHmac("sha256", key).update("jugaad-timbre-ticket-v1:").update(payload).digest();
}

export function issueSpeechTicket(text: string, language: VoiceLocale) {
  const key = process.env.GNANI_API_KEY?.trim();
  if (!key || text.length > maxVoiceReplyLength) return;
  const payload = Buffer.from(JSON.stringify({ text, language, expires: Date.now() + lifetime }), "utf8").toString("base64url");
  return `${payload}.${signature(key, payload).toString("base64url")}`;
}

export function readSpeechTicket(ticket: string) {
  const key = process.env.GNANI_API_KEY?.trim();
  const [payload, encoded, extra] = ticket.split(".");
  if (!key || !payload || !encoded || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(encoded)) throw new MarketplaceError("VOICE_TICKET", 400);
  const actual = Buffer.from(encoded, "base64url");
  if (!timingSafeEqual(signature(key, payload), actual)) throw new MarketplaceError("VOICE_TICKET", 400);
  let data: unknown;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new MarketplaceError("VOICE_TICKET", 400); }
  const result = ticketSchema.safeParse(data);
  if (!result.success || result.data.expires <= Date.now()) throw new MarketplaceError("VOICE_TICKET", 400);
  return result.data;
}
