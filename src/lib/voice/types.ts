import { z } from "zod";

export const voiceLocale = z.enum(["en-IN", "hi-IN", "te-IN", "hi-en"]);
export type VoiceLocale = z.infer<typeof voiceLocale>;

export const voiceLanguages = {
  "en-IN": { label: "English", script: "en-IN", prisma: "en-IN", voice: "Kaveri" },
  "hi-IN": { label: "Hindi", script: "hi-IN", prisma: "hi-IN", voice: "Nalini" },
  "te-IN": { label: "Telugu", script: "te-IN", prisma: "te-IN", voice: "Varuni" },
  "hi-en": { label: "Hinglish", script: "hi-IN", prisma: "hi-IN", voice: "Poorvi" },
} as const;

export const speechSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reply"), ticket: z.string().min(1).max(3600) }).strict(),
  z.object({ kind: z.enum(["approval", "confirmation"]), transactionId: z.uuid(), language: voiceLocale }).strict(),
]);
export type SpeechSource = z.infer<typeof speechSourceSchema>;

export type VoiceTranscript = { text: string; language: VoiceLocale; latencyMs: number; model?: string; requestId?: string };
