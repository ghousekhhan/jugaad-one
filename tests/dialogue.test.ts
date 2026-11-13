import assert from "node:assert/strict";
import { test } from "node:test";
import { orchestrate } from "../src/lib/dialogue/controller";
import type { Session } from "../src/lib/commerce/session";
import type { FoodTurn, Interpretation, ReasoningInput } from "../src/lib/integrations/food-intent";

const id = "00000000-0000-4000-8000-000000000001";
const location = { source: "manual" as const, cityId: "hyderabad" };
const fresh = (): Session => ({ offers: [], orders: [], expiresAt: Date.now() + 60_000 });
const fixtureOffers = [{ item: { name: "Chicken Dum Biryani", id: "dish-1", provider: { id: "wiggy", name: "Wiggy" }, restaurant: { name: "First Kitchen", branchId: "one", rating: { value: 4.4 } } },
  quote: { id, pricing: { totalPaise: 40245, subtotalPaise: 33000 }, etaMinutes: { max: 40 }, expiresAt: new Date(Date.now() + 60_000).toISOString() } },
{ item: { name: "Chicken Dum Biryani", id: "dish-2", provider: { id: "tomato", name: "Tomato" }, restaurant: { name: "Second Kitchen", branchId: "two", rating: { value: 4.2 } } },
  quote: { id: "00000000-0000-4000-8000-000000000002", pricing: { totalPaise: 42335, subtotalPaise: 35000 }, etaMinutes: { max: 30 }, expiresAt: new Date(Date.now() + 60_000).toISOString() } }];

const paraphrases = [
  ["I want chicken biryani.", "chicken biryani"],
  ["Can you get me some chicken dum biryani?", "chicken dum biryani"],
  ["Bhai chicken wali biryani mangwani hai.", "Chicken Biryani"],
  ["Show me a good Hyderabadi chicken biryani.", "Hyderabadi Chicken Biryani"],
  ["चिकन वाली बिरयानी चाहिए।", "चिकन वाली बिरयानी"],
  ["Hyderabad style chicken biryani please.", "Hyderabad Style Chicken Biryani"],
  ["Get me murgh biryani.", "Murgh Biryani"],
  ["Order dum chicken biryani.", "Dum Chicken Biryani"],
  ["Biryani with chicken, please.", "biryani chicken"],
  ["हैदराबादी चिकन बिरयानी दिखाओ।", "हैदराबादी चिकन बिरयानी"],
] as const;

test("recommendation survives explanation and repetition, then yes selects without payment", async () => {
  const app = harness();
  await app.turn("Find chicken biryani", { action: "search", intent: "food_order", patch: { dish: "Chicken Biryani" } });
  await app.turn("Which one is best?", { action: "recommend", intent: "other", criterion: "price", patch: {} });
  const pending = app.session().dialogue?.confirmation;
  await app.turn("Why that one?");
  assert.deepEqual(app.session().dialogue?.confirmation, pending);
  const previous = app.session().dialogue?.last?.text;
  assert.equal((await app.turn("Repeat what you just said")).reply, previous);
  assert.deepEqual(app.session().dialogue?.confirmation, pending);
  const selected = await app.turn("Yes", undefined, true);
  assert.equal(selected.selectedOfferId, fixtureOffers[0].quote.id);
  assert.deepEqual(app.session().orders, []);
  assert.equal(app.stats().searchCalls, 1);
});

test("simplification uses generation but exact repetition does not", async () => {
  const app = harness();
  const initial = await app.turn("Explain gravity", { action: "answer", intent: "other", answer: "Objects attract one another.", patch: {} });
  const simple = await app.turn("Say it more simply");
  assert.notEqual(simple.reply, initial.reply);
  assert.deepEqual(simple.trace?.tools, ["rewrite_response"]);
  const repeated = await app.turn("Repeat what you just said");
  assert.equal(repeated.reply, simple.reply);
  assert.deepEqual(repeated.trace?.tools, ["saved_reply"]);
  assert.equal(app.stats().searchCalls, 0);
});

test("declined recommendations are remembered within the task", async () => {
  const app = harness();
  await app.turn("Find chicken biryani", { action: "search", intent: "food_order", patch: { dish: "Chicken Biryani" } });
  const plan: Interpretation = { action: "recommend", intent: "other", criterion: "price", patch: {} };
  await app.turn("Which one?", plan);
  await app.turn("No", undefined, true);
  assert.deepEqual(app.session().dialogue?.rejectedOfferIds, [fixtureOffers[0].quote.id]);
  await app.turn("Which one?", plan);
  assert.equal(app.session().dialogue?.recommendation?.id, fixtureOffers[1].quote.id);
  await app.turn("Cancel task");
  assert.deepEqual(app.session().dialogue?.rejectedOfferIds, []);
});

function harness(firstSearchFailure = false, offers = fixtureOffers) {
  let state = fresh();
  let modelCalls = 0;
  let searchCalls = 0;
  let reasoning: ReasoningInput | undefined;
  async function turn(text: string, planned?: Interpretation, persisted = false) {
    const result = await orchestrate({ text, current: {}, location, recentRequests: [] }, state, {
      signal: new AbortController().signal, owner: "fixture", requestId: id, persisted,
      interpret: async (input) => { reasoning = input; modelCalls++; assert.ok(planned, `Unexpected model call for ${text}`); return { model: "fixture", plan: planned }; },
      rewrite: async ({ text, language }) => language === "hi-IN" || language === "hi-en" ? text.replaceAll("rupees and", "रुपये").replaceAll("paise", "पैसे") : `In simpler words: ${text}`,
      search: async (input, model) => {
        searchCalls++;
        if (firstSearchFailure && searchCalls === 1) return { model, intent: "food_order", status: "provider_error", reply: "The provider did not respond.", constraints: input.current };
        return { model, intent: "food_order", status: "results", reply: "Two saved offers.", replyLanguage: input.voiceLanguage,
          constraints: input.current, comparison: { input: { query: input.current.dish!, mode: "dish", location, radiusKm: 5, page: 0 },
            result: { kind: "offers", simulated: true, excluded: [], issues: [], more: false, offers } } } as FoodTurn;
      },
    });
    state = result.state;
    return result.result;
  }
  return { turn, stats: () => ({ searchCalls, modelCalls }), session: () => state, reasoning: () => reasoning };
}

test("ten fixture paraphrases resolve to one canonical task and one provider lookup", async () => {
  const app = harness();
  let taskId: string | undefined;
  for (const [text, dish] of paraphrases) {
    const turn = await app.turn(text, { intent: "food_order", action: "search", patch: { dish, budgetPaise: 45_000 } });
    assert.equal(turn.constraints.dish, "Chicken Dum Biryani");
    taskId ??= turn.taskId;
    assert.equal(turn.taskId, taskId);
  }
  assert.deepEqual(app.stats(), { searchCalls: 1, modelCalls: 10 });
});

test("repeat, redisplay, explain, selection and rephrasing resolve stored data without a lookup", async () => {
  const app = harness();
  const first = await app.turn("Find chicken biryani", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani", budgetPaise: 45000 } });
  const repeated = await app.turn("Repeat what you just said");
  assert.equal(repeated.reply, first.reply);
  assert.deepEqual((await app.turn("Wahi biryani dobara dikhao")).comparison, first.comparison);
  const selected = await app.turn("The second one", undefined, true);
  assert.equal(selected.selectedOfferId, fixtureOffers[1].quote.id);
  assert.match((await app.turn("Wait, repeat the price")).reply, /423 rupees and 35 paise/);
  assert.match((await app.turn("Why is the other one more expensive?")).reply, /First Kitchen/);
  assert.match((await app.turn("I didn't understand")).reply, /423 rupees and 35 paise/);
  assert.equal((await app.turn("stop listening")).voiceControl, "stop");
  assert.equal((await app.turn("pause mic")).voiceControl, "pause");
  assert.equal((await app.turn("mute")).voiceControl, "mute");
  assert.deepEqual(app.stats(), { searchCalls: 1, modelCalls: 1 });
});

test("corrections and ambiguous amounts preserve unrelated constraints and task identity", async () => {
  const app = harness();
  const initial = await app.turn("Mutton biryani under ₹450", { intent: "food_order", action: "search", patch: { dish: "Mutton Dum Biryani", budgetPaise: 45000 } });
  const corrected = await app.turn("Actually, I meant chicken, not mutton.");
  assert.equal(corrected.taskId, initial.taskId);
  assert.equal(corrected.constraints.budgetPaise, 45000);
  assert.equal(corrected.constraints.dish, "Chicken Dum Biryani");
  const ambiguous = await app.turn("400 or 4,000");
  assert.equal(ambiguous.status, "clarification");
  assert.equal(ambiguous.constraints.budgetPaise, 45000);
  const budget = await app.turn("Actually make the budget 500", { intent: "food_order", action: "refine", patch: { budgetPaise: 50000 } });
  assert.equal(budget.constraints.dish, "Chicken Dum Biryani");
  assert.equal(budget.constraints.budgetPaise, 50000);
  const explanation = await app.turn("What is an oversized shirt?", { intent: "other", action: "answer", patch: {}, answer: "It is cut looser than a regular fit." });
  assert.equal(explanation.taskId, initial.taskId);
  assert.equal(app.session().dialogue?.task?.turn.constraints.budgetPaise, 50000);
  assert.equal(app.stats().searchCalls, 3);
});

test("model-proposed approval cannot authorize a quote", async () => {
  const app = harness();
  const result = await app.turn("Tell me what approval means", { intent: "food_order", action: "approve", patch: {} }, true);
  assert.equal(result.status, "clarification");
  assert.equal(result.providerTransaction, undefined);
  assert.equal(app.stats().searchCalls, 0);
});

test("new tasks can be left and restored without reopening previous quotes", async () => {
  const app = harness();
  const first = await app.turn("Find chicken biryani under 450", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani", budgetPaise: 45000 } });
  const second = await app.turn("New task: get paneer makhani", { intent: "food_order", action: "new_task", patch: { dish: "Paneer Makhani" } });
  assert.notEqual(first.taskId, second.taskId);
  assert.equal(second.constraints.budgetPaise, undefined);
  const restored = await app.turn("Go back");
  assert.equal(restored.taskId, first.taskId);
  assert.equal(restored.constraints.budgetPaise, 45000);
  assert.deepEqual(restored.comparison, first.comparison);
  assert.equal(app.stats().searchCalls, 2);
});

test("a Gemini category switch can replace a budget without applying redundant model clears", async () => {
  const { parseGeminiPlan } = await import("../src/lib/integrations/gemini");
  const plan = parseGeminiPlan([{ name: "plan_food_turn", args: {
    action: "new_task", intent: "sandbox_order",
    patch: { commerce: { category: "clothing", product: "shirt" }, budgetPaise: 80000, clear: ["dish", "budgetPaise"] },
  } }]);
  assert.equal(plan.patch.clear, undefined);
  assert.equal(plan.patch.budgetPaise, 80000);
  assert.throws(() => parseGeminiPlan([{ name: "plan_food_turn", args: { ...plan, action: "refine", patch: { ...plan.patch, clear: ["budgetPaise"] } } }]), { code: "GEMINI_INVALID_RESPONSE" });
});

test("a contradictory or misinterpreted numeric budget cannot trigger a new search", async () => {
  const app = harness();
  const plan = { intent: "food_order", action: "search", patch: { dish: "Chicken Dum Biryani", budgetPaise: 400_000 } } as const;
  assert.equal((await app.turn("Find biryani under ₹400", plan)).status, "clarification");
  assert.equal((await app.turn("Find biryani under ₹300 and at least ₹500", { ...plan, patch: { ...plan.patch, budgetPaise: 30000 } })).status, "clarification");
  assert.equal(app.stats().searchCalls, 0);
});

test("a requested Hindi or Hinglish rephrasing uses the saved total and leaves the task intact", async () => {
  const app = harness();
  const first = await app.turn("Find chicken biryani", { intent: "food_order", action: "search", patch: { dish: "Chicken Dum Biryani" } });
  const hindi = await app.turn("Can you say that in Hindi?", { intent: "other", action: "rephrase", language: "hi-IN", patch: {} });
  assert.equal(hindi.taskId, first.taskId);
  assert.equal(hindi.replyLanguage, "hi-IN");
  assert.match(hindi.reply, /402 रुपये 45 पैसे/);
  const hinglish = await app.turn("Hinglish mein batao", { intent: "other", action: "rephrase", language: "hi-en", patch: {} });
  assert.equal(hinglish.taskId, first.taskId);
  assert.equal(hinglish.replyLanguage, "hi-en");
  assert.match(hinglish.reply, /402 रुपये 45 पैसे/);
  assert.equal(app.stats().searchCalls, 1);
});

test("Gemini can answer directly but direct text cannot encode discovery or payment", async () => {
  const { parseGeminiResponse } = await import("../src/lib/integrations/gemini");
  const plan = parseGeminiResponse(undefined, JSON.stringify({ action: "advice", domain: "fashion", answer: "Navy is a versatile interview colour." }));
  assert.deepEqual(plan, { action: "advice", domain: "fashion", answer: "Navy is a versatile interview colour.", intent: "other", patch: {} });
  for (const action of ["search", "approve", "prepare", "cancel"]) {
    assert.throws(() => parseGeminiResponse([], JSON.stringify({ action, domain: "fashion", answer: "Try this." })), { code: "GEMINI_INVALID_RESPONSE" });
  }
});

test("conversational acts and clarification stay out of search even when they mention products", async () => {
  const app = harness();
  const rows = [
    ["Hello", undefined, "greeting", "general"],
    ["What can you do?", undefined, "help", "general"],
    ["What is the difference between formal and casual shoes?", { action: "answer", domain: "fashion", answer: "Formal shoes use cleaner shapes." }, "answer", "fashion"],
    ["What should I wear to an interview?", { action: "advice", domain: "fashion", answer: "A navy suit works well." }, "advice", "fashion"],
    ["How does the payment process work?", { action: "answer", domain: "transaction", answer: "Review the full quote before approval." }, "answer", "transaction"],
    ["Show options available in suite", { action: "clarify", domain: "general", answer: "Clothing suit, hotel suite or software?" }, "clarify", "general"],
    ["I mean a suit for an interview", { action: "clarification_answer", domain: "fashion", answer: "A navy suit is a flexible choice." }, "clarification_answer", "fashion"],
    ["Show me a suite", { action: "clarify", domain: "general", answer: "Which kind of suite?" }, "clarify", "general"],
    ["I mean a hotel suite", { action: "clarification_answer", domain: "travel", answer: "Hotel suites usually have a separate living area." }, "clarification_answer", "travel"],
    ["Where is my order?", undefined, "order_status", "transaction"],
    ["Why is the sky blue?", { action: "answer", domain: "general", answer: "Air scatters blue light strongly." }, "answer", "general"],
  ] as const;
  for (const [text, plan, action, domain] of rows) {
    const turn = await app.turn(text, plan ? { ...plan, intent: "other", patch: {} } : undefined);
    assert.equal(turn.dialogueAction, action);
    assert.equal(turn.domain, domain);
    assert.equal(turn.transition, "none");
    assert.equal(turn.trace?.searchAttempted, false);
    assert.ok(!turn.trace?.tools.includes("provider_discovery"));
    assert.equal(turn.taskId, undefined);
  }
  assert.equal(app.stats().searchCalls, 0);
});

test("the discovery gate rejects incompatible or non-commerce domains", async () => {
  const app = harness();
  for (const domain of ["general", "travel", "software", "transaction", "fashion"] as const) {
    const turn = await app.turn("Find a suite", { action: "search", domain, intent: "food_order", patch: { dish: "Chicken Dum Biryani" } });
    assert.equal(turn.searchFailure, "UNSUPPORTED_CATEGORY");
    assert.equal(turn.trace?.searchAttempted, false);
  }
  assert.equal(app.stats().searchCalls, 0);
});

test("asking for unrelated advice can end a task without carrying its shopping filters", async () => {
  const app = harness();
  await app.turn("Find chicken biryani under ₹450", { intent: "food_order", domain: "food", action: "search", patch: { dish: "Chicken Biryani", budgetPaise: 45000, city: "Delhi" } });
  const end = await app.turn("Forget that, tell me about interview suits.", { intent: "other", action: "end_task", domain: "fashion", patch: {}, answer: "A navy or charcoal suit is a versatile choice." });
  assert.equal(end.transition, "end");
  assert.equal(end.taskId, undefined);
  assert.deepEqual(end.constraints, {});
  assert.equal(end.trace?.searchAttempted, false);
  assert.equal(app.stats().searchCalls, 1);
});

test("paused search can be resumed and preserves its original budget", async () => {
  const app = harness();
  const initial = await app.turn("Find chicken biryani under ₹450", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani", budgetPaise: 45000 } });
  const paused = await app.turn("Pause this search");
  assert.equal(paused.transition, "pause");
  assert.equal(paused.taskId, undefined);
  const resumed = await app.turn("Go back");
  assert.equal(resumed.transition, "resume");
  assert.equal(resumed.taskId, initial.taskId);
  assert.equal(resumed.constraints.budgetPaise, 45000);
  assert.equal(app.stats().searchCalls, 1);
});

test("a provider outage preserves its task but an unrelated question cannot restart discovery", async () => {
  const app = harness(true);
  const failed = await app.turn("Find biryani under ₹300 in Delhi", {
    intent: "food_order", action: "search", domain: "food", patch: { dish: "Chicken Biryani", budgetPaise: 30000, city: "Delhi" },
  });
  assert.equal(failed.searchFailure, "PROVIDER_ERROR");
  assert.equal(failed.trace?.searchAttempted, true);
  const advice = await app.turn("What is the difference between formal and casual shoes?", {
    intent: "other", action: "answer", domain: "fashion", answer: "Formal shoes typically have a cleaner silhouette.", patch: {},
  });
  assert.equal(advice.taskId, failed.taskId);
  assert.equal(advice.trace?.searchAttempted, false);
  assert.equal(advice.transition, "keep");
  assert.equal(app.stats().searchCalls, 1);
  const again = await app.turn("Find a paneer dish instead", {
    intent: "food_order", action: "new_task", domain: "food", patch: { dish: "Paneer makhani" },
  });
  assert.equal(again.transition, "switch");
  assert.notEqual(again.taskId, failed.taskId);
  assert.equal(again.constraints.budgetPaise, undefined);
  assert.equal(again.constraints.city, undefined);
  assert.equal(app.session().dialogue?.previous[0].id, failed.taskId);
});

test("an explicit numeric refinement preserves the task and needs no model call", async () => {
  const app = harness();
  const original = await app.turn("Find chicken dum biryani", { intent: "food_order", domain: "food", action: "search", patch: { dish: "Chicken Dum Biryani" } });
  const refined = await app.turn("Anything under ₹3,000?");
  assert.equal(refined.taskId, original.taskId);
  assert.equal(refined.constraints.budgetPaise, 300000);
  assert.equal(refined.constraints.budgetExclusive, true);
  assert.equal(refined.transition, "refine");
  assert.equal(refined.trace?.reasoning, "deterministic");
  assert.equal(app.stats().modelCalls, 1);
});

test("an ended task cannot be restored by stale client constraints", async () => {
  const ended: Session = { ...fresh(), dialogue: { previous: [], topic: "interview advice" } };
  const turn = await orchestrate({ text: "What color should I wear?", current: { dish: "Biryani", budgetPaise: 30000 }, recentRequests: [] }, ended, {
    owner: "fixture", requestId: id, signal: new AbortController().signal, persisted: false,
    interpret: async (input) => {
      assert.deepEqual(input.current, {});
      assert.equal(input.context?.topic, "interview advice");
      return { model: "fixture", source: "gemini_reply", plan: { intent: "other", action: "advice", domain: "fashion", answer: "Navy is a versatile choice.", patch: {} } };
    },
    search: async () => { assert.fail("Advice must not use discovery"); },
  });
  assert.equal(turn.result.taskId, undefined);
  assert.equal(turn.result.trace?.searchAttempted, false);
});

test("hotel suite requests resolve to immediate travel clarification without model or search calls", async () => {
  const app = harness();
  const turn = await app.turn("No, I meant a hotel suite.");
  assert.equal(turn.dialogueAction, "clarification_answer");
  assert.equal(turn.domain, "travel");
  assert.match(turn.reply, /does not support hotel bookings/iu);
  assert.equal(turn.trace?.searchAttempted, false);
  assert.equal(app.stats().modelCalls, 0);
  assert.equal(app.stats().searchCalls, 0);
});

test("switching tasks drops the previous category budget and constraints", async () => {
  const app = harness();
  const suit = await app.turn("Find a formal suit under ₹3,000", {
    intent: "sandbox_order", domain: "fashion", action: "search",
    patch: { commerce: { category: "clothing", product: "Two-piece suit" }, budgetPaise: 300000 },
  }, true);
  assert.equal(suit.constraints.budgetPaise, 300000);

  const biryani = await app.turn("Forget that, find me biryani", {
    intent: "food_order", domain: "food", action: "search",
    patch: { dish: "Chicken Dum Biryani" },
  }, true);
  assert.notEqual(biryani.taskId, suit.taskId);
  assert.equal(biryani.constraints.budgetPaise, undefined);
  assert.equal(biryani.constraints.dish, "Chicken Dum Biryani");
  assert.equal(biryani.transition, "switch");
});

test("why is the second one better explains the second offer against the alternative", async () => {
  const app = harness();
  await app.turn("Find chicken biryani", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani" } });
  const explanation = await app.turn("Why is the second one better?");
  assert.equal(explanation.dialogueAction, "explain");
  assert.match(explanation.reply, /Second Kitchen/);
  assert.match(explanation.reply, /First Kitchen/);
  assert.equal(app.stats().searchCalls, 1);
  assert.equal(app.stats().modelCalls, 1);
});

test("multilingual Hindi direct actions resolve selection, price repetition and explanation without lookup", async () => {
  const app = harness();
  await app.turn("Find chicken biryani", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani" } });
  const selected = await app.turn("दूसरा वाला", undefined, true);
  assert.equal(selected.selectedOfferId, fixtureOffers[1].quote.id);
  const price = await app.turn("रकम फिर से बोलो");
  assert.match(price.reply, /423 rupees and 35 paise/);
  const hindiExplain = await app.turn("दूसरा वाला क्यों बेहतर है?");
  assert.equal(hindiExplain.dialogueAction, "explain");
  assert.match(hindiExplain.reply, /Second Kitchen/);
  assert.equal(app.stats().searchCalls, 1);
  assert.equal(app.stats().modelCalls, 1);
});

test("generalized quantity refinement adjusts portion counts deterministically", async () => {
  const app = harness();
  await app.turn("Find chicken biryani", { intent: "food_order", action: "search", patch: { dish: "Chicken Biryani" } });
  await app.turn("The first one", undefined, true);
  const refined = await app.turn("Make it 3");
  assert.equal(refined.constraints.quantity, 3);
  assert.equal(refined.dialogueAction, "refine");
  assert.equal(app.stats().modelCalls, 1);
});

test("asking why a search failed references previous failure reply without search call", async () => {
  const app = harness(true);
  const failed = await app.turn("Find biryani in Delhi", {
    intent: "food_order", action: "search", domain: "food", patch: { dish: "Chicken Biryani", city: "Delhi" },
  });
  assert.equal(failed.status, "provider_error");
  const explanation = await app.turn("Why didn't you find any?");
  assert.equal(explanation.dialogueAction, "explain");
  assert.match(explanation.reply, /The provider did not respond/);
  assert.equal(app.stats().searchCalls, 1);
  assert.equal(app.stats().modelCalls, 1);
});

test("Gemini plain natural language reply is handled gracefully as direct answer", async () => {
  const { parseGeminiResponse } = await import("../src/lib/integrations/gemini");
  const plan = parseGeminiResponse(undefined, "A formal suit typically includes matching trousers and a jacket tailored for business or official events.");
  assert.equal(plan.action, "answer");
  assert.equal(plan.domain, "general");
  assert.match(plan.answer ?? "", /formal suit typically includes/);
});

test("submission regression covers 30 finalized utterances in one interrupted session", async () => {
  const app = harness(false, [
    ...fixtureOffers,
    { ...fixtureOffers[0], item: { ...fixtureOffers[0].item, restaurant: { ...fixtureOffers[0].item.restaurant, name: "Third Kitchen", rating: { value: 4.8 } } },
      quote: { ...fixtureOffers[0].quote, id: "00000000-0000-4000-8000-000000000003", pricing: { totalPaise: 44800, subtotalPaise: 35000 } } },
  ]);
  const answer = (answer: string): Interpretation => ({ action: "answer", intent: "other", domain: "general", patch: {}, answer });
  const search = (dish: string, action: Interpretation["action"] = "search", budgetPaise?: number): Interpretation =>
    ({ action, intent: "food_order", domain: "food", patch: { dish, budgetPaise } });
  const rows: [string, FoodTurn["dialogueAction"], boolean, Interpretation?][] = [
    ["Hi", "greeting", false],
    ["Why is the sky blue?", "answer", false, answer("Air scatters blue light more strongly.")],
    ["Find mutton biryani under ₹450", "search", true, search("Mutton Biryani", "search", 45000)],
    ["Summarize the three offers", "summarize", false],
    ["Compare these offers", "compare", false],
    ["The third one", "select", false],
    ["Why is the second one more expensive?", "explain", false],
    ["What is compound interest?", "answer", false, answer("It is interest calculated on principal and earlier interest.")],
    ["Repeat what you just said", "repeat", false],
    ["Actually, I meant chicken, not mutton", "correct", true],
    ["Can you make the rating above four?", "refine", true, { action: "refine", intent: "food_order", patch: { minRating: 4, ratingExclusive: true } }],
    ["The faster option", "select", false],
    ["Show the options again", "redisplay", false],
    ["Switch to Telugu", "change_language", false],
    ["మళ్ళీ చెప్పు", "repeat", false],
    ["Pause mic", "pause", false],
    ["What is the capital of France?", "answer", false, answer("Paris.")],
    ["Cancel the task", "end_task", false],
    ["Find paneer makhani", "search", true, search("Paneer Makhani")],
    ["The second one", "select", false],
    ["What is a prime number?", "answer", false, answer("A prime has exactly two positive divisors.")],
    ["Instead find masala dosa", "new_task", true, search("Masala Dosa", "new_task")],
    ["Speak Hindi", "change_language", false],
    ["फिर से बोलो", "repeat", false],
    ["What does photosynthesis do?", "clarify", false, search("Paneer Makhani")],
    ["End this conversation", "stop", false],
    ["Goodbye", "stop", false],
    ["Find idli", "search", true, search("Idli")],
    ["Cancel that", "end_task", false],
    ["What is 2 plus 2?", "answer", false, answer("Four.")],
  ];
  assert.equal(rows.length, 30);
  for (const [index, [text, action, searched, plan]] of rows.entries()) {
    const result = await app.turn(text, plan, action === "select");
    assert.equal(result.dialogueAction, action, text);
    assert.equal(result.trace?.searchAttempted, searched, text);
    if (index === 2 || index === 3) {
      assert.match(result.reply, /First Kitchen.*Second Kitchen.*Third Kitchen/s);
      assert.match(result.reply, /What matters most to you/);
    }
    if (index === 5) assert.equal(result.selectedOfferId, "00000000-0000-4000-8000-000000000003");
    if (index === 9) assert.equal(result.constraints.budgetPaise, 45000);
    if ([17, 25, 26, 28].includes(index)) {
      assert.equal(result.taskId, undefined);
      assert.equal(app.session().quote, undefined);
      assert.equal(app.session().providerQuoteId, undefined);
      assert.deepEqual(app.session().orders, []);
    }
    if (index === 25) {
      assert.equal(result.voiceControl, "stop");
      assert.equal(result.speechTicket, undefined);
    }
    if ([18, 21, 27].includes(index)) assert.equal(result.constraints.budgetPaise, undefined);
  }
});

test("a recommendation, a bare why, and a change of criterion reuse verified offer data", async () => {
  const app = harness();
  const first = await app.turn("Find biryani under ₹450", { intent: "food_order", action: "search", patch: { dish: "Biryani", budgetPaise: 45000 } });
  const plan = (action: Interpretation["action"], extra?: Partial<Interpretation>): Interpretation => ({ intent: "other", action, patch: {}, ...extra });
  const recommend = await app.turn("Which one is better if I’m in a rush?", plan("recommend", { criterion: "speed" }));
  assert.match(recommend.reply, /Second Kitchen/);
  assert.match(recommend.reply, /30 minutes/);
  assert.equal(recommend.selectedOfferId, undefined);
  assert.deepEqual(app.reasoning()?.context?.offers?.map(({ total, eta, rating }) => [total, eta, rating]), [[40245, 40, 4.4], [42335, 30, 4.2]]);
  const why = await app.turn("Why?", plan("explain", { answer: "Unsupported claim about popularity" }));
  assert.match(why.reply, /^Chicken Dum Biryani from Second Kitchen/);
  assert.doesNotMatch(why.reply, /popularity/);
  assert.equal(app.reasoning()?.context?.recommendation?.id, fixtureOffers[1].quote.id);
  assert.equal(app.reasoning()?.context?.history?.at(-1)?.reply, recommend.reply);
  const price = await app.turn("What if I don’t care about delivery speed?", plan("refine", { intent: "food_order", patch: { clear: ["priority"] } }));
  assert.equal(price.dialogueAction, "recommend");
  assert.match(price.reply, /total price.*First Kitchen/);
  assert.equal(price.constraints.budgetPaise, 45000);
  assert.equal(price.taskId, first.taskId);
  assert.equal(app.stats().searchCalls, 1);

  for (const [question, answer] of [
    ["What dietary options are there generally?", "Vegetarian and vegan are different dietary categories."],
    ["I’m exhausted. What should I eat?", "A light rice bowl or soup could be a good choice."],
    ["What’s the difference between biryani and pulao?", "Biryani is often layered, while pulao is usually cooked together."],
    ["Tell me a joke", "Why did the rice blush? It saw the salad dressing."],
  ]) {
    const result = await app.turn(question, plan("answer", { answer }));
    assert.equal(result.reply, answer);
    assert.equal(result.taskId, first.taskId);
    assert.equal(result.trace?.searchAttempted, false);
  }
  const misclassifiedAdvice = await app.turn("I’m tired. What would be good to eat?", {
    intent: "food_order", domain: "food", action: "search", patch: { dish: "Idli" },
  });
  assert.equal(misclassifiedAdvice.trace?.searchAttempted, false);
  assert.equal(misclassifiedAdvice.taskId, first.taskId);
  assert.equal((await app.turn("Stop talking")).voiceControl, "stop_speech");
  assert.equal(app.session().dialogue?.task?.id, first.taskId);
  assert.equal((await app.turn("Actually, never mind")).dialogueAction, "end_task");
  assert.equal(app.session().dialogue?.task, undefined);
  assert.equal((await app.turn("Can we end this conversation?")).voiceControl, "stop");
  assert.equal(app.stats().searchCalls, 1);
});
