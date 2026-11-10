import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveFocusPhase,
  extractConstraintChips,
  FOCUS_PHASES,
  phaseOrder,
  type ContextualFocusPhase,
} from "../src/lib/focus/focus-state";
import type { FoodTurn } from "../src/lib/integrations/food-intent";
import type { CheckoutSummary } from "../src/lib/marketplace/checkout-types";
import type { FoodSearch, QuotedOffer } from "../src/lib/marketplace/discovery-types";

test("contextual focus phases contain all 7 stages in sequential order", () => {
  const expectedPhases: ContextualFocusPhase[] = [
    "listening",
    "understanding",
    "searching",
    "comparing",
    "decision",
    "payment",
    "confirmed",
  ];

  assert.equal(FOCUS_PHASES.length, 7);
  for (let i = 0; i < expectedPhases.length; i++) {
    assert.equal(FOCUS_PHASES[i].id, expectedPhases[i]);
    assert.equal(FOCUS_PHASES[i].step, `0${i + 1}`);
    assert.equal(phaseOrder[expectedPhases[i]], i);
  }
});

test("deriveFocusPhase cleanly transitions across conversation states", () => {
  // 1. Initial idle/ready state
  const idlePhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: null,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: undefined,
  });
  assert.equal(idlePhase, "listening");

  // 2. Active voice capture
  const listeningPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: null,
    interpretationPending: false,
    capturingVoice: true,
    latestTurn: undefined,
  });
  assert.equal(listeningPhase, "listening");

  // 3. Extracted constraints (understanding)
  const turnWithConstraints: FoodTurn = {
    model: "gemini-2.5-flash",
    intent: "food_order",
    status: "clarification",
    reply: "Which restaurant in Bengaluru?",
    constraints: { dish: "Biryani" },
  };
  const understandingPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: null,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: turnWithConstraints,
  });
  assert.equal(understandingPhase, "understanding");

  // 4. In-flight search
  const searchingPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: null,
    interpretationPending: true,
    capturingVoice: false,
    latestTurn: turnWithConstraints,
  });
  assert.equal(searchingPhase, "searching");

  // 5. Comparison offers returned
  const turnWithOffers: FoodTurn = {
    ...turnWithConstraints,
    status: "results",
    comparison: {
      input: { mode: "dish", query: "Biryani", location: { source: "manual", cityId: "bengaluru" } },
      result: {
        kind: "offers",
        offers: [
          {
            item: {
              id: "item-1",
              name: "Dum Biryani",
              pricePaise: 35000,
              provider: { id: "wiggy", name: "Wiggy" },
              restaurant: { id: "r1", name: "Paradise", branchId: "b1", cuisine: "Biryani", rating: { value: 4.5, count: 100 } },
              image: { url: "b.jpg", alt: "Biryani" },
              customization: [],
            },
            quote: {
              id: "q-1",
              provider: "wiggy",
              lineItems: [{ menuItemId: "item-1", name: "Dum Biryani", quantity: 1, basePricePaise: 35000, selectedOptions: [] }],
              pricing: { subtotalPaise: 35000, deliveryFeePaise: 4000, packagingFeePaise: 1000, platformFeePaise: 500, taxPaise: 1800, discountPaise: 0, totalPaise: 42300 },
              etaMinutes: { min: 25, max: 35 },
              distanceKm: 3.2,
              expiresAt: new Date(Date.now() + 600000).toISOString(),
            },
          },
        ],
        excluded: [],
        issues: [],
        more: false,
      },
    },
  };
  const comparingPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: null,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: turnWithOffers,
  });
  assert.equal(comparingPhase, "comparing");

  // 6. Selected offer (decision)
  const offersResult = turnWithOffers.comparison?.result;
  assert.ok(offersResult && offersResult.kind === "offers");
  const dummySelectedOffer: { offer: QuotedOffer; search: FoodSearch } = {
    offer: offersResult.offers[0],
    search: turnWithOffers.comparison!.input,
  };
  const decisionPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: null,
    selectedOffer: dummySelectedOffer,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: turnWithOffers,
  });
  assert.equal(decisionPhase, "decision");

  // 7. Approved transaction (payment)
  const checkoutSummaryApproved: CheckoutSummary = {
    configured: true,
    transactions: [
      {
        id: "tx-1",
        ownerId: "owner-1",
        phase: "approved",
        provider: "wiggy",
        restaurant: "Paradise",
        quote: dummySelectedOffer.offer.quote,
        quotedAt: new Date().toISOString(),
        expiresAt: dummySelectedOffer.offer.quote.expiresAt,
        version: 1,
      },
    ],
  };
  const paymentPhase = deriveFocusPhase({
    activeReceipt: null,
    checkout: checkoutSummaryApproved,
    selectedOffer: dummySelectedOffer,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: turnWithOffers,
  });
  assert.equal(paymentPhase, "payment");

  // 8. Confirmed transaction (tracking)
  const confirmedPhase = deriveFocusPhase({
    activeReceipt: "tx-1",
    checkout: checkoutSummaryApproved,
    selectedOffer: dummySelectedOffer,
    interpretationPending: false,
    capturingVoice: false,
    latestTurn: turnWithOffers,
  });
  assert.equal(confirmedPhase, "confirmed");
});

test("extractConstraintChips correctly formats all recognized constraints", () => {
  const chips = extractConstraintChips(
    {
      dish: "Paneer Makhani",
      restaurant: "Spice Route",
      budgetPaise: 40000,
      budgetExclusive: false,
      radiusKm: 7,
      quantity: 2,
      minRating: 4.2,
      ratingExclusive: true,
      cuisine: "North Indian",
      dietaryRestrictions: ["vegetarian"],
      allergens: ["peanuts"],
      priority: "fastest",
      maxEtaMinutes: 30,
      providerPreference: { provider: "wiggy", mode: "only" },
    },
    "Indiranagar, Bengaluru"
  );

  const keyMap = Object.fromEntries(chips.map((c) => [c.key, c.value]));
  assert.equal(keyMap.dish, "Paneer Makhani");
  assert.equal(keyMap.restaurant, "Spice Route");
  assert.equal(keyMap.location, "Indiranagar, Bengaluru");
  assert.equal(keyMap.budgetPaise, "≤ ₹400.00");
  assert.equal(keyMap.radiusKm, "7 km");
  assert.equal(keyMap.quantity, "2");
  assert.equal(keyMap.minRating, "> 4.2★");
  assert.equal(keyMap.cuisine, "North Indian");
  assert.equal(keyMap.dietaryRestrictions, "vegetarian");
  assert.equal(keyMap.allergens, "peanuts");
  assert.equal(keyMap.priority, "Fastest delivery");
  assert.equal(keyMap.maxEtaMinutes, "≤ 30 min");
  assert.equal(keyMap.providerPreference, "Only Wiggy");
});
