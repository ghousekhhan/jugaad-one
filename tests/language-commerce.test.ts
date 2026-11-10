import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { orchestrate } from "../src/lib/dialogue/controller";
import { bookCommerce } from "../src/lib/commerce/booking";
import { updateSession } from "../src/lib/commerce/session";
import type { Session } from "../src/lib/commerce/session";
import type { FoodTurn, Interpretation } from "../src/lib/integrations/food-intent";
import { readSpeechTicket } from "../src/lib/voice/speech-ticket";
import { voiceLanguages, type VoiceLocale } from "../src/lib/voice/types";

process.env.GNANI_API_KEY ??= "test-voice-key";

const location = { source: "manual" as const, cityId: "hyderabad" };

function createHarness(initialLanguage: VoiceLocale = "en-IN", initialName = "సురేష్") {
  const owner = `harness_${randomUUID()}`;
  const requestId = randomUUID();
  let state: Session = {
    offers: [],
    orders: [],
    searchId: requestId,
    expiresAt: Date.now() + 60_000,
    profile: { name: initialName, language: initialLanguage, region: "hyderabad", locality: "Banjara Hills" },
  };
  let modelCalls = 0;
  let searchCalls = 0;

  async function turn(text: string, planned?: Interpretation, persisted = true, voiceLanguage?: VoiceLocale, paymentPage = false) {
    const lang = voiceLanguage ?? state.dialogue?.lastLanguage ?? state.profile?.language ?? "en-IN";
    await updateSession(owner, (s) => ({ ...s, searchId: requestId, ...state }));
    const result = await orchestrate(
      { text, current: {}, location, recentRequests: [], voiceLanguage: lang, paymentPage },
      state,
      {
        signal: new AbortController().signal,
        owner,
        requestId,
        persisted,
        interpret: async () => {
          modelCalls++;
          assert.ok(planned, `Unexpected model call for "${text}"`);
          return { model: "fixture", plan: planned };
        },
        search: async (input, model) => {
          searchCalls++;
          return {
            model,
            intent: "food_order",
            status: "results",
            reply: "Two food offers.",
            replyLanguage: input.voiceLanguage,
            constraints: input.current,
            comparison: {
              input: { query: input.current.dish ?? "Food", mode: "dish", location, radiusKm: 5, page: 0 },
              result: { kind: "offers", simulated: true, excluded: [], issues: [], more: false, offers: [] },
            },
          } as FoodTurn;
        },
      }
    );
    state = result.state;
    await updateSession(owner, (s) => ({ ...s, searchId: requestId, ...state }));
    return { turn: result.result, state };
  }

  return {
    turn,
    stats: () => ({ searchCalls, modelCalls }),
    session: () => state,
    owner,
  };
}

// Scenario A: User provides a name by voice, chooses Telugu and receives a Telugu greeting.
test("Scenario A: User provides name, chooses Telugu and receives a Telugu greeting with verified Timbre voice", async () => {
  assert.equal(voiceLanguages["te-IN"].voice, "Varuni");
  assert.equal(voiceLanguages["te-IN"].prisma, "te-IN");

  const app = createHarness("te-IN", "సురేష్");
  const { turn } = await app.turn("నమస్కారం", {
    action: "greeting",
    domain: "general",
    intent: "other",
    language: "te-IN",
    answer: "నమస్తే సురేష్! Jugaad One కి స్వాగతం. ఈరోజు మీకు ఏం కావాలి?",
    patch: {},
  });

  assert.equal(turn.replyLanguage, "te-IN");
  assert.match(turn.reply, /నమస్కారం|నమస్తే/iu);
  assert.ok(turn.speechTicket);
  const ticket = readSpeechTicket(turn.speechTicket);
  assert.equal(ticket.language, "te-IN");
});

// Scenario B: Telugu user makes a food request, receives Telugu clarification, sees localized options and hears Telugu Timbre speech.
test("Scenario B: Telugu food request receives localized Telugu response, options and valid Telugu speech ticket", async () => {
  const app = createHarness("te-IN");
  const { turn } = await app.turn("నాకు బిర్యానీ కావాలి", {
    action: "search",
    domain: "food",
    intent: "sandbox_order",
    language: "en-IN",
    patch: { commerce: { category: "food", product: "biryani" } },
  });

  assert.equal(turn.replyLanguage, "te-IN");
  assert.equal(turn.status, "results");
  assert.match(turn.reply, /డెమో ఎంపికలు దొరికాయి|రూపాయలు/iu);
  assert.ok(turn.speechTicket);
  const ticket = readSpeechTicket(turn.speechTicket);
  assert.equal(ticket.language, "te-IN");
});

// Scenario C: User says "I want something sweet, maybe cake." Jugaad treats cake as tentative rather than mandatory.
test("Scenario C: 'I want something sweet, maybe cake' treats cake as tentative dessert search", async () => {
  const app = createHarness("en-IN");
  const { turn } = await app.turn("I want something sweet, maybe cake");

  assert.equal(turn.dialogueAction, "search");
  assert.equal(turn.constraints.commerce?.category, "food");
  assert.equal(turn.constraints.commerce?.product, "sweet");
  assert.equal(turn.status, "results");
  assert.ok(turn.sandbox?.offers && turn.sandbox.offers.length > 0);
  assert.equal(app.stats().modelCalls, 0); // Deterministic preference understanding
});

// Scenario D: User says "It doesn't have to be cake." Jugaad explores related desserts without retaining a cake-only filter.
test("Scenario D: 'It doesn't have to be cake' explores related desserts without retaining cake-only filter", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  const { turn } = await app.turn("It doesn't have to be cake.");

  assert.equal(turn.dialogueAction, "refine");
  assert.equal(turn.constraints.commerce?.category, "food");
  assert.equal(turn.constraints.commerce?.product, "sweet");
  assert.equal(turn.status, "results");
  const names = turn.sandbox?.offers.map((o) => o.listing.name) ?? [];
  assert.ok(names.length >= 2);
});

// Scenario E: User asks "What would make this better?" Jugaad recognizes a customization/complement question rather than launching a new search.
test("Scenario E: 'What would make this better?' recognizes complement question without launching search", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  const initialSearchCalls = app.stats().searchCalls;

  const { turn } = await app.turn("What would make this better?");
  assert.equal(turn.dialogueAction, "suggest_complement");
  assert.match(turn.reply, /toppings and add-ons|Extra cheese|Chocolate drizzle|ice cream/iu);
  assert.equal(app.stats().searchCalls, initialSearchCalls);
});

// Scenario F: User names a displayed seller, Mirchi Moon, and the correct offer is selected.
test("Scenario F: User says 'Mirchi Moon' and the Mirchi Moon offer is selected", async () => {
  const app = createHarness("en-IN");
  const { turn: searchTurn } = await app.turn("I want something sweet, maybe cake");
  const mirchiMoonOffer = searchTurn.sandbox?.offers.find((o) => o.listing.seller === "Mirchi Moon");
  assert.ok(mirchiMoonOffer, "Mirchi Moon offer should be in displayed sandbox offers");

  const { turn: selectTurn } = await app.turn("I'll take the one from Mirchi Moon");
  assert.equal(selectTurn.dialogueAction, "select");
  assert.equal(selectTurn.selectedOfferId, mirchiMoonOffer.listing.id);
  assert.equal(app.session().quote?.offer.listing.seller, "Mirchi Moon");
});

// Scenario G: User asks whether Mirchi Moon supports toppings. Jugaad checks actual stored modifier availability.
test("Scenario G: 'Does Mirchi Moon support toppings?' verifies stored modifiers", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  await app.turn("Mirchi Moon");

  const { turn } = await app.turn("Does Mirchi Moon support toppings?");
  assert.equal(turn.dialogueAction, "suggest_complement");
  assert.match(turn.reply, /Mirchi Moon offers toppings and add-ons/iu);
  assert.match(turn.reply, /Extra cheese/iu);
  assert.match(turn.reply, /Chocolate drizzle/iu);
});

// Scenario H: User accepts one modifier. Jugaad recalculates the total and budget eligibility.
test("Scenario H: User accepts a modifier ('Add extra cheese'); total and budget recalculated", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  await app.turn("Mirchi Moon");
  await app.turn("Prepare checkout", { action: "prepare", domain: "transaction", intent: "sandbox_order", patch: {} });

  const { turn } = await app.turn("Add extra cheese");
  assert.equal(turn.dialogueAction, "customize_item");
  assert.match(turn.reply, /Added Extra cheese/iu);
  assert.ok(app.session().quote?.offer.selectedModifiers?.some((m) => m.name === "Extra cheese"));
  const before = app.session().quote!;
  assert.equal(app.session().dialogue?.confirmation?.type, "welcome_offer");
  const { state } = await app.turn("Yes");
  assert.equal(state.quote?.offer.totalPaise, before.offer.totalPaise - before.welcomeOffer!.discountPaise);
  assert.notEqual(state.quote?.id, before.id);
  assert.equal(state.quote?.approvedAt, undefined);
  assert.equal(state.orders.length, 0);
});

// Scenario I: User asks why one option is more expensive. Jugaad explains stored cost differences without a new catalog search.
test("Scenario I: 'Why is the second one more expensive?' explains stored cost differences without new search", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  const searchCallsBefore = app.stats().searchCalls;

  const { turn } = await app.turn("Why is the second one more expensive?");
  assert.equal(turn.dialogueAction, "explain");
  assert.match(turn.reply, /totals|difference/iu);
  assert.equal(app.stats().searchCalls, searchCallsBefore);
});

// Scenario J: User asks for reviews. Jugaad uses stored review evidence and correctly identifies simulated provenance.
test("Scenario J: 'What do people like about this?' uses stored review evidence and identifies simulated sandbox provenance", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");

  const { turn } = await app.turn("What do people like about this?");
  assert.equal(turn.dialogueAction, "ask_reviews");
  assert.match(turn.reply, /simulated reviews/iu);
  assert.match(turn.reply, /Customers praise/iu);
});

// Scenario K: User changes language mid-conversation. Jugaad changes response language without losing shopping context.
test("Scenario K: User says 'Speak Telugu' mid-conversation; language updates to te-IN preserving context", async () => {
  const app = createHarness("en-IN");
  const { turn: initialTurn } = await app.turn("I want something sweet, maybe cake");
  assert.equal(initialTurn.replyLanguage, "en-IN");

  const { turn: langTurn } = await app.turn("Speak Telugu");
  assert.equal(langTurn.dialogueAction, "change_language");
  assert.equal(langTurn.replyLanguage, "te-IN");
  assert.match(langTurn.reply, /ఖచ్చితంగా.*తెలుగులో/iu);
  assert.equal(app.session().dialogue?.task?.id, initialTurn.taskId);
});

// Scenario L: User switches from dessert to clothing. Old dessert-specific constraints do not carry over.
test("Scenario L: Switching from dessert to clothing clears dessert constraints and resets budget", async () => {
  const app = createHarness("en-IN");
  const { turn: dessertTurn } = await app.turn("I want something sweet, maybe cake");
  assert.equal(dessertTurn.constraints.commerce?.category, "food");

  const { turn: suitTurn } = await app.turn("Find a formal suit under ₹3,000", {
    action: "search",
    domain: "fashion",
    intent: "sandbox_order",
    patch: { commerce: { category: "clothing", product: "Two-piece suit" }, budgetPaise: 300000 },
  });

  assert.notEqual(suitTurn.taskId, dessertTurn.taskId);
  assert.equal(suitTurn.constraints.commerce?.category, "clothing");
  assert.equal(suitTurn.constraints.commerce?.product, "Two-piece suit");
  assert.equal(suitTurn.constraints.dish, undefined);
  assert.equal(suitTurn.transition, "switch");
});

// Scenario M: User asks to repeat previous comparison. Jugaad repeats stored response without generating new inventory.
test("Scenario M: Repeating previous comparison resolves stored response without new inventory", async () => {
  const app = createHarness("en-IN");
  const { turn: initialTurn } = await app.turn("I want something sweet, maybe cake");
  const { turn: repeatTurn } = await app.turn("Repeat the options");

  assert.equal(repeatTurn.dialogueAction, "redisplay");
  assert.equal(repeatTurn.reply, initialTurn.reply);
  assert.deepEqual(repeatTurn.sandbox?.offers, initialTurn.sandbox?.offers);
});

// Scenario N: User approves the final configured quote. Demonstration payment and backend booking proceed with explicit authorization and idempotency.
test("Scenario N: Explicit approval and demo payment book simulated order idempotently", async () => {
  const app = createHarness("en-IN");
  await app.turn("I want something sweet, maybe cake");
  await app.turn("Mirchi Moon");
  await app.turn("Prepare checkout", { action: "prepare", domain: "transaction", intent: "sandbox_order", patch: {} });

  const { turn: approveTurn } = await app.turn("Yes, I approve the total");
  assert.equal(approveTurn.dialogueAction, "approve");
  assert.match(approveTurn.reply, /authorize this simulated payment/iu);

  const quoteId = app.session().quote?.id;
  assert.ok(quoteId);

  assert.equal(app.session().orders.length, 0);
  const { state: paid } = await app.turn("Yes, proceed");
  const booked = { order: paid.orders[0] };
  assert.ok(booked.order);
  assert.match(booked.order.reference, /^JG-/);
  assert.equal(booked.order.payment, "simulated_no_charge");

  // Idempotent retry of same payment returns existing order
  const retry = await bookCommerce(app.owner, { action: "pay", quoteId, code: "2468" });
  assert.equal(retry.session.orders[0].reference, booked.order.reference);
});

test("natural yes and no are interpreted only against the current confirmation", async () => {
  const { confirmationAnswer } = await import("../src/lib/dialogue/confirmation");
  for (const answer of ["Yes", "Yeah", "Haan ji", "Bilkul", "Correct, go ahead", "Avunu", "అవును"]) assert.equal(confirmationAnswer(answer), "yes");
  for (const answer of ["No, Telugu", "Nahi, English", "Kaadu", "Not that one"]) assert.equal(confirmationAnswer(answer), "no");
  assert.equal(confirmationAnswer("Yes, but I’m not sure"), undefined);

  const app = createHarness();
  const { turn: initial } = await app.turn("I want something sweet, maybe cake");
  const { state: proposed } = await app.turn("Which one is best?", { action: "recommend", intent: "other", criterion: "price", patch: {} });
  const expected = proposed.dialogue?.confirmation;
  assert.equal(expected?.type, "offer");
  const { turn: selected } = await app.turn("Bilkul");
  assert.equal(selected.selectedOfferId, expected?.id);
  assert.equal(selected.trace?.searchAttempted, false);
  await app.turn("Yeah");
  assert.equal(app.session().dialogue?.confirmation?.type, "payment");
  await app.turn("Wait");
  await app.turn("Yes, proceed");
  assert.equal(app.session().orders.length, 0);
  await app.turn("Which one is best?", { action: "recommend", intent: "other", criterion: "price", patch: {} });
  const { turn: corrected } = await app.turn("No, the second one");
  assert.equal(corrected.selectedOfferId, initial.sandbox?.offers[1].listing.id);
  await app.turn("Correct");
  await app.turn("No");
  await app.turn("Yes");
  assert.equal(app.session().orders.length, 0);
});

test("an expired or changed quote cannot use a previous voice authorization", async () => {
  const app = createHarness();
  await app.turn("I want something sweet, maybe cake");
  await app.turn("Mirchi Moon");
  await app.turn("Yes");
  assert.equal(app.session().dialogue?.confirmation?.type, "payment");
  const quote = app.session().quote;
  assert.ok(quote);
  quote.expiresAt = Date.now() - 1;
  const expired = await app.turn("Yes, proceed");
  assert.match(expired.turn.reply, /expired/);
  assert.equal(expired.state.orders.length, 0);
  assert.equal(expired.state.dialogue?.confirmation, undefined);
  await app.turn("Mirchi Moon");
  await app.turn("Yes");
  await app.turn("Make it two");
  await app.turn("Wait");
  await app.turn("Yes, proceed");
  assert.equal(app.session().orders.length, 0);
});

test("a number game keeps its answer on the server and never calls commerce", async () => {
  const app = createHarness("en-IN");
  const started = await app.turn("Jugaad, let's play a game.");
  const number = started.state.dialogue?.game?.number;
  assert.ok(number && number >= 1 && number <= 10);
  assert.equal("game" in started.turn, false);
  const guess = await app.turn(number === 10 ? "one" : "ten");
  assert.match(guess.turn.reply, /Try a (?:higher|lower) number/);
  assert.equal(guess.state.dialogue?.game?.number, number);
  const won = await app.turn(String(number));
  assert.equal(won.turn.reply, "You got it!");
  assert.equal(won.state.dialogue?.game, undefined);
  assert.equal(app.stats().searchCalls, 0);
  assert.equal(app.stats().modelCalls, 0);
  assert.equal(won.state.orders.length, 0);
});

test("workspace voice approval opens the exact payment page without placing an order", async () => {
  const app = createHarness("en-IN");
  const workspaceTurn = (text: string) => app.turn(text, undefined, true, "en-IN", true);
  await workspaceTurn("I want something sweet, maybe cake");
  const selected = await workspaceTurn("Mirchi Moon");
  assert.equal(selected.state.dialogue?.confirmation?.type, "welcome_offer");
  await workspaceTurn("No");
  const approved = await workspaceTurn("Yes");
  assert.ok(approved.state.quote?.approvedAt);
  assert.equal(approved.turn.paymentPath, `/payment?source=jugaad&id=${approved.state.quote.id}`);
  assert.equal(approved.state.dialogue?.confirmation, undefined);
  assert.equal(approved.state.orders.length, 0);
});
