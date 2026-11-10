import { z } from "zod";
import type { DialogueAction } from "./actions";
import type { FoodIntent, Interpretation } from "../integrations/food-intent";

export const domainSchema = z.enum(["general", "shopping", "food", "fashion", "groceries", "electronics", "household", "accessories", "transaction", "profile", "location", "travel", "software", "other"]);
export type Domain = z.infer<typeof domainSchema>;
export type TaskTransition = "keep" | "refine" | "correct" | "switch" | "pause" | "resume" | "end" | "none";
export type SearchFailure = "NO_PRODUCT_MATCH" | "FILTERED_BY_BUDGET" | "FILTERED_BY_DISTANCE" | "FILTERED_BY_DIET" | "FILTERED_BY_RATING" | "PROVIDER_ERROR" | "LOCATION_REQUIRED" | "UNSUPPORTED_CATEGORY" | "AMBIGUOUS_REQUEST" | "DYNAMIC_SANDBOX_GENERATION_ERROR";

const discovery = new Set<DialogueAction>(["search", "choose_cheapest", "new_task", "refine", "correct"]);
const categories = { food: "food", clothing: "fashion", groceries: "groceries", electronics: "electronics", household: "household", accessories: "accessories" } as const;
const marketDomains = new Set<Domain>(["shopping", ...Object.values(categories)]);

export function taskDomain(intent: FoodIntent): Domain {
  return intent.commerce ? categories[intent.commerce.category] : intent.dish ? "food" : "shopping";
}

export function isInformationalQuestion(text: string) {
  const question = /(?:^|[.!?]\s+)(?:what (?:is|are|does|should|would|could|kinds? of)|what['’]s|who (?:is|was)|how (?:does|do|is)|why (?:is|are|does)|explain)\b/iu;
  const availability = /\b(?:near me|offers?|delivery|available|in stock|menu|restaurants?|(?:best|hottest|cheapest) deals?|(?:find|search|order|show me)\b)/iu;
  return question.test(text) && !availability.test(text);

}

export function canDiscover(plan: Interpretation) {
  if (!discovery.has(plan.action) || plan.intent === "other" || (plan.domain && !marketDomains.has(plan.domain))) return false;
  if (plan.intent === "food_order" && plan.domain && plan.domain !== "food" && plan.domain !== "shopping") return false;
  const category = plan.patch.commerce?.category;
  return !category || !plan.domain || plan.domain === "shopping" || plan.domain === categories[category];
}

export function actDomain(plan: Interpretation, current: FoodIntent): Domain {
  if (plan.domain) return plan.domain;
  if (["answer", "advice", "greeting", "help", "pause_task", "end_task", "change_language", "suggest_complement", "ask_reviews"].includes(plan.action)) return "general";
  if (["prepare", "approve", "cancel", "reject", "order_status", "customize_item"].includes(plan.action)) return "transaction";
  if (plan.intent === "other") return "general";
  return taskDomain(plan.patch.commerce || plan.patch.dish ? plan.patch : current);
}
