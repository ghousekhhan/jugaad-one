import type { FoodIntent, FoodTurn } from "../integrations/food-intent";
import { formatPaise, type FoodSearch, type QuotedOffer } from "../marketplace/discovery-types";
import { foodProviderNames } from "../marketplace/schemas";
import type { SandboxState } from "../commerce/types";
import type { CheckoutSummary } from "../marketplace/checkout-types";

export type ContextualFocusPhase =
  | "listening"
  | "understanding"
  | "searching"
  | "comparing"
  | "decision"
  | "payment"
  | "confirmed";

export type FocusPhaseDef = {
  id: ContextualFocusPhase;
  step: string;
  label: string;
  desc: string;
};

export const FOCUS_PHASES: readonly FocusPhaseDef[] = [
  { id: "listening", step: "01", label: "Listening", desc: "Voice session and microphone controls" },
  { id: "understanding", step: "02", label: "Understanding", desc: "Reading your request and preferences" },
  { id: "searching", step: "03", label: "Searching", desc: "Checking available offers" },
  { id: "comparing", step: "04", label: "Comparing", desc: "Evaluating price, time, and rating trade-offs" },
  { id: "decision", step: "05", label: "Decision", desc: "Reviewing quote · Awaiting voice or touch approval" },
  { id: "payment", step: "06", label: "Payment", desc: "Jugaad Pay · Demo authorization" },
  { id: "confirmed", step: "07", label: "Tracking", desc: "Confirmed booking · Simulated delivery" },
];

export const phaseOrder: Record<ContextualFocusPhase, number> = {
  listening: 0,
  understanding: 1,
  searching: 2,
  comparing: 3,
  decision: 4,
  payment: 5,
  confirmed: 6,
};

export function deriveFocusPhase({
  activeReceipt,
  checkout,
  selectedOffer,
  interpretationPending,
  capturingVoice,
  latestTurn,
  sandbox,
}: {
  activeReceipt: string | null;
  checkout: CheckoutSummary | null;
  selectedOffer: { offer: QuotedOffer; search: FoodSearch } | null;
  interpretationPending: boolean;
  capturingVoice: boolean;
  latestTurn?: FoodTurn;
  sandbox?: SandboxState;
}): ContextualFocusPhase {
  if (interpretationPending) return "searching";
  if (sandbox?.quote) return sandbox.quote.approvedAt ? "payment" : "decision";
  if (sandbox?.orders.length && !sandbox.offers.length) return "confirmed";
  if (sandbox?.offers.length) return "comparing";
  if (activeReceipt) return "confirmed";
  const confirmedTx = checkout?.transactions.find((t) => t.phase === "confirmed");
  if (confirmedTx) return "confirmed";

  const approvedTx = checkout?.transactions.find(
    (t) => t.phase === "approved" || t.phase === "booking" || t.phase === "reconciliation"
  );
  if (approvedTx) return "payment";
  if (selectedOffer) return "decision";

  if (
    latestTurn?.comparison?.result.kind === "offers" &&
    latestTurn.comparison.result.offers.length > 0
  ) {
    return "comparing";
  }

  if (capturingVoice) return "listening";

  if (latestTurn?.constraints && Object.keys(latestTurn.constraints).length > 0) {
    return "understanding";
  }

  return "listening";
}

export type ChipItem = {
  key: keyof FoodIntent | "location";
  label: string;
  value: string;
};

export function extractConstraintChips(constraints?: FoodIntent, locationLabel?: string): ChipItem[] {
  if (!constraints) return [];
  const chips: ChipItem[] = [];

  if (constraints.commerce && !constraints.dish) chips.push({ key: "commerce", label: "Product", value: constraints.commerce.product });
  if (constraints.dish) {
    chips.push({ key: "dish", label: "Dish", value: constraints.dish });
  }
  if (constraints.restaurant) {
    chips.push({ key: "restaurant", label: "Restaurant", value: constraints.restaurant });
  }
  if (locationLabel || constraints.neighborhood || constraints.city) {
    const loc = locationLabel ?? [constraints.neighborhood, constraints.city].filter(Boolean).join(", ");
    if (loc) chips.push({ key: "location", label: "Location", value: loc });
  }
  if (constraints.budgetPaise !== undefined) {
    chips.push({
      key: "budgetPaise",
      label: "Budget",
      value: `${constraints.budgetExclusive ? "<" : "≤"} ${formatPaise(constraints.budgetPaise)}`,
    });
  }
  if (constraints.radiusKm !== undefined) {
    chips.push({ key: "radiusKm", label: "Radius", value: `${constraints.radiusKm} km` });
  }
  if (constraints.quantity !== undefined) {
    chips.push({ key: "quantity", label: "Qty", value: String(constraints.quantity) });
  }
  if (constraints.minRating !== undefined) {
    chips.push({
      key: "minRating",
      label: "Rating",
      value: `${constraints.ratingExclusive ? ">" : "≥"} ${constraints.minRating}★`,
    });
  }
  if (constraints.cuisine) {
    chips.push({ key: "cuisine", label: "Cuisine", value: constraints.cuisine });
  }
  if (constraints.dietaryRestrictions?.length) {
    chips.push({
      key: "dietaryRestrictions",
      label: "Dietary",
      value: constraints.dietaryRestrictions.join(", "),
    });
  }
  if (constraints.allergens?.length) {
    chips.push({
      key: "allergens",
      label: "Exclude",
      value: constraints.allergens.join(", "),
    });
  }
  if (constraints.priority) {
    chips.push({
      key: "priority",
      label: "Sort",
      value: constraints.priority === "fastest" ? "Fastest delivery" : "Lowest total",
    });
  }
  if (constraints.maxEtaMinutes !== undefined) {
    chips.push({
      key: "maxEtaMinutes",
      label: "ETA limit",
      value: `≤ ${constraints.maxEtaMinutes} min`,
    });
  }
  if (constraints.providerPreference) {
    chips.push({
      key: "providerPreference",
      label: "Provider",
      value: `${constraints.providerPreference.mode === "only" ? "Only" : "Prefer"} ${foodProviderNames[constraints.providerPreference.provider]}`,
    });
  }

  return chips;
}
