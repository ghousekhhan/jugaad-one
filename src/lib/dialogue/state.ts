import type { FoodIntent, FoodTurn } from "../integrations/food-intent";
import type { Domain } from "./routing";
import type { VoiceLocale } from "../voice/types";
import type { Decision } from "./memory";

export type Task = { id: string; turn: FoodTurn; domain?: Domain; selectedId?: string };
export type Dialogue = {
  task?: Task;
  previous: Task[];
  last?: { text: string; language: VoiceLocale; ticket?: string };
  offerReply?: { text: string; language: VoiceLocale };
  recentTurns?: string[];
  history?: { user: string; reply: string }[];
  decisions?: Decision[];
  rejectedOfferIds?: string[];
  recommendation?: { id: string; criterion: "price" | "speed" | "rating" };
  lastLanguage?: VoiceLocale;
  awaitingApproval?: string;
  confirmation?: { type: "offer"; id: string; taskId: string } | { type: "payment"; id: string; totalPaise: number } | { type: "welcome_offer"; id: string };
  game?: { number: number };
  topic?: string;
  clarification?: string;
};

export function canonicalDish(name?: string) {
  if (!name) return;
  const normalized = name.normalize("NFKC").trim().toLowerCase();
  // Chicken Biryani variations (English, Hindi, Telugu, transliterations)
  if (/^(?:(?:hyderabadi |hyderabad style )?(?:(?:dum )?chicken(?: dum)?|murgh(?: dum)?|chicken wali) bir[iy]+a+n[iy]*|bir[iy]+a+n[iy]* chicken|चिकन(?: दम| वाली)? बिरयानी|हैदराबादी चिकन बिरयानी|చికెన్(?: దమ్)? బిర్యానీ|హైదరాబాదీ చికెన్ బిర్యానీ)$/iu.test(normalized)) {
    return "Chicken Dum Biryani";
  }
  // Generic Biryani variations
  if (/^(?:bir[iy]+a+n[iy]*|बिरयानी|బిర్యానీ)$/iu.test(normalized)) {
    return "Biryani";
  }
  // Paneer variations
  if (/^(?:paneer makhani|butter paneer|पनीर मखनी|పనీర్ మఖని)$/iu.test(normalized)) {
    return "Paneer Makhani";
  }
  // Dosa variations
  if (/^(?:(?:masala )?dosa|dosai|dhosa|మసాలా దోశ|దోశ|मसाला डोसा|डोसा)$/iu.test(normalized)) {
    return "Masala Dosa";
  }
  // Idli variations
  if (/^(?:idli(?: sambar)?|idly|ఇడ్లీ|इडली)$/iu.test(normalized)) {
    return "Idli Sambar";
  }
  // Shawarma
  if (/^(?:(?:chicken )?shawarma|shwarma|షవర్మా|शवारमा)$/iu.test(normalized)) {
    return "Chicken Shawarma";
  }
  // Sweet & Desserts
  if (/^(?:sweet|sweets|dessert|desserts|తీపి|స్వీట్|मीठा|मिठाई)$/iu.test(normalized)) {
    return "sweet";
  }
  return name.trim();
}

export function canonicalIntent(intent: FoodIntent): FoodIntent {
  const dish = canonicalDish(intent.dish);
  const product = intent.commerce?.category === "food" ? canonicalDish(intent.commerce.product) : undefined;
  return { ...intent, ...(dish ? { dish } : {}), ...(intent.commerce && product ? { commerce: { ...intent.commerce, product } } : {}) };
}

export function sameIntent(a: FoodIntent, b: FoodIntent) {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) :
    value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([x], [y]) => x.localeCompare(y)).map(([key, entry]) => [key, normalize(entry)])) :
      typeof value === "string" ? value.trim().toLowerCase() : value;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
