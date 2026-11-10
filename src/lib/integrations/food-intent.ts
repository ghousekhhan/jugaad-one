import { z } from "zod";
import { domainSchema, type Domain, type SearchFailure, type TaskTransition } from "../dialogue/routing";
import { dialogueActionSchema, offerReferenceSchema, type DialogueAction } from "../dialogue/actions";
import type { FoodTransaction } from "../marketplace/checkout-types";
import { commerceProduct, type SandboxState } from "../commerce/types";
import { voiceLocale, type VoiceLocale } from "../voice/types";
import { dietaryRestrictionsSchema, locationSchema, providerPreferenceSchema, searchInputSchema, type FoodLocation, type FoodSearch, type FoodSearchResult } from "../marketplace/discovery-types";

const name = z.string().trim().min(1).max(120);
const search = searchInputSchema.shape;
export const foodIntentSchema = z.object({
  commerce: commerceProduct.optional(), dish: name.optional(), restaurant: name.optional(), city: name.optional(), neighborhood: name.optional(),
  budgetPaise: search.budgetPaise, budgetExclusive: search.budgetExclusive,
  radiusKm: search.radiusKm.optional(), quantity: search.quantity,
  cuisine: name.max(60).optional(), dietaryRestrictions: dietaryRestrictionsSchema.optional(), allergens: search.allergens,
  minRating: search.minRating, ratingExclusive: search.ratingExclusive,
  priority: search.priority, qualityPriority: z.boolean().optional(), maxEtaMinutes: search.maxEtaMinutes, providerPreference: providerPreferenceSchema.optional(),
}).strict();

const patchSchema = foodIntentSchema.extend({
  addAllergens: search.allergens, removeAllergens: search.allergens,
  clear: z.array(foodIntentSchema.keyof()).max(18).optional(),
}).strict();

export const interpretationSchema = z.object({
  intent: z.enum(["food_order", "sandbox_order", "other"]),
  action: dialogueActionSchema,
  domain: domainSchema.optional(),
  topic: z.string().trim().min(1).max(80).optional(),
  reference: offerReferenceSchema.optional(),
  criterion: z.enum(["price", "speed", "rating"]).optional(),
  offerId: z.string().trim().min(1).max(100).optional(),
  seller: z.string().trim().min(1).max(80).optional(),
  modifierId: z.string().trim().min(1).max(80).optional(),
  answer: z.string().trim().min(1).max(360).optional(),
  language: voiceLocale.optional(),
  patch: patchSchema,
}).strict();

export const interpretationInputSchema = z.object({
  text: z.string().trim().min(1).max(1000), current: foodIntentSchema,
  recentRequests: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  location: locationSchema.optional(),
  voiceLanguage: voiceLocale.optional(),
  turnId: z.uuid().optional(),
  paymentPage: z.boolean().optional(),
}).strict();

export type FoodIntent = z.infer<typeof foodIntentSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
export type InterpretationInput = z.infer<typeof interpretationInputSchema>;
export type ReasoningInput = InterpretationInput & {
  context?: {
    topic?: string; lastReply?: string; clarification?: string; taskDomain?: Domain;
    offers?: { id: string; seller: string; name: string; provider: string; total: number; eta: number; rating: number }[];
    selectedOfferId?: string;
    recommendation?: { id: string; criterion: "price" | "speed" | "rating" };
    transactionStage?: string;
    history?: { user: string; reply: string }[];
  };
};
export type ConversationSearch = { input: FoodSearch; result: FoodSearchResult };
export type FoodTurn = {
  model: string;
  intent: Interpretation["intent"];
  status: "clarification" | "unsupported" | "results" | "no_match" | "incomplete" | "selected" | "provider_error";
  reply: string;
  replyLanguage?: VoiceLocale;
  speechTicket?: string;
  constraints: FoodIntent;
  location?: { selection: FoodLocation; label: string };
  comparison?: ConversationSearch;
  selectedQuoteId?: string;
  sandbox?: SandboxState;
  dialogueAction?: DialogueAction;
  domain?: Domain;
  transition?: TaskTransition;
  searchFailure?: SearchFailure;
  responseView?: "conversation" | "comparison" | "checkout";
  trace?: { turnId: string; reasoning: "deterministic" | "gemini_plan" | "gemini_reply"; tools: string[]; searchAttempted: boolean; speechAvailable: boolean; totalMs: number };
  taskId?: string;
  keepSelection?: boolean;
  providerTransaction?: FoodTransaction;
  paymentPath?: string;
  voiceControl?: "stop" | "stop_speech" | "pause" | "mute";
  selectedOfferId?: string;
};

export function applyFoodIntent(current: FoodIntent, patch: Interpretation["patch"]): FoodIntent {
  const { addAllergens, removeAllergens, clear, ...changes } = patch;
  const next = { ...current };
  if ((clear?.includes("city") || changes.city !== undefined && changes.city.toLowerCase() !== current.city?.toLowerCase()) && changes.neighborhood === undefined) delete next.neighborhood;
  if (changes.budgetPaise !== undefined && changes.budgetPaise !== current.budgetPaise) delete next.budgetExclusive;
  if (changes.minRating !== undefined && changes.minRating !== current.minRating) delete next.ratingExclusive;
  for (const key of clear ?? []) delete next[key];
  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) Object.assign(next, { [key]: value });
  }
  if (next.budgetPaise === undefined) delete next.budgetExclusive;
  if (next.minRating === undefined) delete next.ratingExclusive;
  if (addAllergens?.length || removeAllergens?.length) {
    next.allergens = [...new Set([...(next.allergens ?? []), ...(addAllergens ?? [])])].filter((allergen) => !removeAllergens?.includes(allergen));
  }
  return foodIntentSchema.parse(next);
}
