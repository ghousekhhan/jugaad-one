import { z } from "zod";
import { apiFailure, apiSuccess, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";
import { gnaniConfigured } from "@/lib/voice/gnani";
import { issueSpeechTicket } from "@/lib/voice/speech-ticket";
import { voiceLocale, type VoiceLocale } from "@/lib/voice/types";

const greetingInputSchema = z.union([z.object({
  name: z.string().trim().min(1).max(50),
  language: voiceLocale.default("en-IN"),
}).strict(), z.object({ wake: z.literal(true), language: voiceLocale }).strict(), z.object({
  prompt: z.enum(["name", "confirm_name", "confirm_language", "language_preference", "location", "confirm_region", "returning", "ready", "landmark", "intro_location"]),
  language: voiceLocale, name: z.string().trim().min(1).max(100).optional(),
}).strict().refine((value) => !["confirm_name", "confirm_language", "confirm_region", "returning", "landmark", "intro_location"].includes(value.prompt) || Boolean(value.name))]);

const wakePrompts: Record<VoiceLocale, string> = {
  "en-IN": "Hey! What can I get done for you today?",
  "hi-IN": "नमस्ते! आज मैं आपकी क्या मदद करूँ?",
  "te-IN": "నమస్తే! ఈరోజు మీకు ఏం కావాలి?",
  "hi-en": "Hey! Bataiye, aaj kya karna hai?",
};

const greetingPhrases: Record<VoiceLocale, (name: string) => string> = {
  "en-IN": (name) => `Hey ${name}! Welcome to Jugaad One. What would you like to get done today?`,
  "hi-IN": (name) => `नमस्ते ${name}! Jugaad One में आपका स्वागत है। आज मैं आपकी क्या मदद करूँ?`,
  "te-IN": (name) => `నమస్తే ${name}! Jugaad One కి స్వాగతం. ఈరోజు మీకు ఏం కావాలి?`,
  "hi-en": (name) => `Hey ${name}! Jugaad One mein aapka welcome hai. Aaj kya karna hai?`,
};

const onboardingPrompts = {
  name: {
    "en-IN": "Hey! I’m Jugaad. What should I call you?",
    "hi-IN": "नमस्ते! मैं Jugaad हूँ। मैं आपको किस नाम से बुलाऊँ?",
    "hi-en": "Hey! Main Jugaad hoon. Aapko kya bulaoon?",
    "te-IN": "నమస్తే! నేను Jugaad. మిమ్మల్ని ఏ పేరుతో పిలవాలి?",
  },
  language_preference: {
    "en-IN": "Which language are you most comfortable speaking? English, Hindi, Telugu, or Hinglish?",
    "hi-IN": "आप किस भाषा में बात करना पसंद करेंगे? अंग्रेज़ी, हिंदी, तेलुगु या दोनों का मिला-जुला?",
    "hi-en": "Aap kaunsi language mein comfortable hain? English, Hindi, Telugu ya mix?",
    "te-IN": "మీరు మాట్లాడటానికి ఏ భాష సౌకర్యంగా ఉంటుంది? ఇంగ్లీష్, హిందీ, తెలుగు, లేదా కలయికా?",
  },
  location: {
    "en-IN": "Can I access your location to find options nearby? Tap Allow device location, or say a demo city.",
    "hi-IN": "पास के विकल्पों के लिए क्या मैं आपकी लोकेशन इस्तेमाल करूँ? अनुमति दें या डेमो शहर बोलें।",
    "hi-en": "Nearby options ke liye location use karoon? Allow tap karein ya demo city bol dein.",
    "te-IN": "దగ్గరలోని ఎంపికల కోసం మీ లొకేషన్ వాడాలా? అనుమతి ఇవ్వండి లేదా డెమో నగరం చెప్పండి.",
  },
  ready: wakePrompts,
};

function onboardingText(prompt: "name" | "confirm_name" | "confirm_language" | "language_preference" | "location" | "confirm_region" | "returning" | "ready" | "landmark" | "intro_location", language: VoiceLocale, name?: string) {
  if (prompt === "name" || prompt === "location" || prompt === "ready" || prompt === "language_preference") return onboardingPrompts[prompt][language];
  if (prompt === "confirm_language") return `You selected ${name}. Is that correct?`;
  if (prompt === "intro_location") return {
    "en-IN": `Great to meet you, ${name}! Can I use your location to find nearby options? Tap Allow, or say a demo city.`,
    "hi-IN": `${name}, आपसे मिलकर अच्छा लगा! क्या मैं आपकी लोकेशन इस्तेमाल करूँ? अनुमति दें या डेमो शहर बोलें।`,
    "hi-en": `Great to meet you, ${name}! Nearby options ke liye location allow karein, ya demo city bol dein.`,
    "te-IN": `${name}, మిమ్మల్ని కలవడం ఆనందంగా ఉంది! లొకేషన్ అనుమతి ఇవ్వండి లేదా డెమో నగరం చెప్పండి.`,
  }[language];
  if (prompt === "returning") return {
    "en-IN": `Hey ${name}! Welcome back. What can I get done for you today?`,
    "hi-IN": `नमस्ते ${name}! आज मैं आपकी क्या मदद करूँ?`,
    "hi-en": `Hey ${name}! Welcome back. Aaj kya karna hai?`,
    "te-IN": `నమస్తే ${name}! ఈరోజు మీకు ఏం కావాలి?`,
  }[language];
  if (prompt === "landmark") return {
    "en-IN": `I’ve saved ${name} as your delivery landmark.`,
    "hi-IN": `${name} को डिलीवरी के लैंडमार्क के रूप में सहेजा है।`,
    "hi-en": `${name} aapke delivery landmark mein save ho gaya.`,
    "te-IN": `${name} మీ డెలివరీ గుర్తుగా సేవ్ చేశాను.`,
  }[language];
  if (prompt === "confirm_region") return {
    "en-IN": `Your device is near ${name}. Should I use this location for your demo orders?`,
    "hi-IN": `आप ${name} के पास हैं। क्या यही डेमो शहर चुनें?`,
    "hi-en": `Aap ${name} ke paas hain. Yahi demo city use karoon?`,
    "te-IN": `మీరు ${name} దగ్గర ఉన్నారు. ఈ డెమో నగరాన్ని ఎంచుకోవాలా?`,
  }[language];
  return {
    "en-IN": `Did you say ${name}?`, "hi-IN": `क्या आपने ${name} कहा?`,
    "hi-en": `Kya aapne ${name} kaha?`, "te-IN": `మీరు ${name} అన్నారా?`,
  }[language];
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = greetingInputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);

    const { language } = parsed.data;
    const text = "prompt" in parsed.data ? onboardingText(parsed.data.prompt, language, parsed.data.name) :
      "wake" in parsed.data ? wakePrompts[language] : greetingPhrases[language](parsed.data.name);

    enforceRateLimit("timbre-greeting", 10);

    const speechTicket = gnaniConfigured() ? issueSpeechTicket(text, language) : undefined;
    return apiSuccess({ text, language, speechTicket });
  } catch (error) {
    return apiFailure(error);
  }
}
