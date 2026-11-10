import type { FoodTransaction } from "../marketplace/checkout-types";
import { foodProviderNames } from "../marketplace/schemas";
import { spokenPrice, voiceReplies } from "./replies";
import type { VoiceLocale } from "./types";

export function transactionSpeech(transaction: FoodTransaction, event: "approval" | "confirmation", language: VoiceLocale) {
  const copy = voiceReplies[language];
  if (event === "approval" && transaction.phase === "quoted" && Date.parse(transaction.quote.expiresAt) > Date.now()) {
    return copy.approval(foodProviderNames[transaction.provider], spokenPrice(transaction.quote.pricing.totalPaise, language));
  }
  const order = transaction.order;
  if (event === "confirmation" && transaction.phase === "confirmed" && order && transaction.providerOrderId === order.id && order.status === "simulated_confirmed" && !order.tracking.terminal && order.tracking.steps.some((step) => step.id === "confirmed" && Boolean(step.occurredAt))) {
    return copy.confirmation(foodProviderNames[transaction.provider], order.reference);
  }
}
