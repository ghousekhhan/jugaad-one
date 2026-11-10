import { voiceLanguages, type VoiceLocale } from "./types";

export const timbreModel = "timbre-v2.5";

type VoiceOption = { id: string; description: string };

export const voiceCatalog: Record<VoiceLocale, readonly VoiceOption[]> = {
  "en-IN": [
    { id: "Kaveri", description: "Professional, clear delivery" },
    { id: "Pranav", description: "Friendly, approachable delivery" },
    { id: "Devika", description: "Composed, authoritative delivery" },
    { id: "Shlok", description: "Warm, conversational delivery" },
    { id: "Trupti", description: "English voice for everyday conversation" },
  ],
  "hi-IN": [
    { id: "Nalini", description: "Friendly, conversational delivery" },
    { id: "Bhavna", description: "Warm, approachable delivery" },
    { id: "Deepak", description: "Measured, professional delivery" },
    { id: "Yashvi", description: "Hindi voice for conversation" },
    { id: "Urmila", description: "Hindi voice for spoken replies" },
  ],
  "te-IN": [
    { id: "Varuni", description: "Expressive Telugu delivery" },
    { id: "Suhana", description: "Calm, confident delivery" },
    { id: "Lehara", description: "Gentle, reassuring delivery" },
    { id: "Lavanya", description: "Soft, empathetic delivery" },
    { id: "Yukti", description: "Telugu voice for conversation" },
  ],
  "hi-en": [{ id: "Poorvi", description: "Conversational Hindi and English" }],
};

export type VoicePreference = { language: VoiceLocale; voice: string; model: typeof timbreModel };

export function preferredVoice(language: VoiceLocale, preference?: VoicePreference) {
  if (preference?.language === language && preference.model === timbreModel &&
      voiceCatalog[language].some(({ id }) => id === preference.voice)) return preference.voice;
  return voiceLanguages[language].voice;
}

export const voiceSamples: Record<VoiceLocale, string> = {
  "en-IN": "Hello! I’m Jugaad. Tell me what you need, and I’ll help you find it.",
  "hi-IN": "नमस्ते! मैं जुगाड़ हूँ। बताइए आपको क्या चाहिए, मैं उसे ढूँढने में मदद करूँगा।",
  "te-IN": "నమస్కారం! నేను జుగాడ్. మీకు ఏం కావాలో చెప్పండి, అది వెతకడంలో సహాయం చేస్తాను.",
  "hi-en": "Hello! Main Jugaad hoon. Aapko kya chahiye bataiye, main dhoondhne mein help karunga.",
};
