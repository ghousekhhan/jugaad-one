import "server-only";

import { randomUUID } from "node:crypto";
import { persistListings, totalFor } from "../commerce/catalog";
import { discoverCommerce, serviceRegion } from "../commerce/discovery";
import { bookCommerce, commerceSpeech, trackingSpeech } from "../commerce/booking";
import { updateSession, type Session } from "../commerce/session";
import { applyFoodIntent, type FoodIntent, type FoodTurn, type Interpretation, type InterpretationInput, type ReasoningInput } from "../integrations/food-intent";
import { runFoodTurn } from "../integrations/food-conversation";
import { listTransactions, readTransaction, runCheckout } from "../marketplace/checkout";
import { enforceRateLimit } from "../marketplace/http";
import { MarketplaceError } from "../marketplace/provider";
import { transactionStore } from "../marketplace/transaction-store";
import { spokenPrice } from "../voice/replies";
import { issueSpeechTicket, readSpeechTicket } from "../voice/speech-ticket";
import type { VoiceLocale } from "../voice/types";
import { demoCode } from "../commerce/types";
import { transactionSpeech } from "../voice/transaction-speech";
import { confirmationAnswer } from "./confirmation";
import { directAction } from "./actions";
import { actDomain, canDiscover, isInformationalQuestion, taskDomain, type SearchFailure, type TaskTransition } from "./routing";
import { canonicalDish, canonicalIntent, sameIntent, type Dialogue, type Task } from "./state";

type Services = { signal: AbortSignal; owner: string; persisted: boolean; requestId: string; interpret: (input: ReasoningInput, signal: AbortSignal) => Promise<{ model: string; plan: Interpretation; source?: "gemini_plan" | "gemini_reply" }>; search?: typeof runFoodTurn };
type Reference = Interpretation["reference"];

function facts(task?: Task) {
  if (task?.turn.comparison?.result.kind === "offers") return task.turn.comparison.result.offers.map(({ item, quote }) => ({
    id: quote.id, name: item.name, seller: item.restaurant.name, provider: item.provider.name,
    total: quote.pricing.totalPaise, eta: quote.etaMinutes.max, rating: item.restaurant.rating.value, subtotal: quote.pricing.subtotalPaise,
    listing: undefined, selectedModifiers: undefined,
  }));
  return (task?.turn.sandbox?.offers ?? []).map(({ listing, quantity, totalPaise, selectedModifiers }) => ({
    id: listing.id, name: listing.name, seller: listing.seller, provider: "Jugaad Sandbox", total: totalPaise,
    eta: listing.etaMinutes, rating: listing.rating, subtotal: listing.pricePaise * quantity,
    listing, selectedModifiers,
  }));
}

function referenced(task?: Task, reference?: Reference, seller?: string) {
  const rows = facts(task);
  if (seller) {
    const name = seller.toLowerCase();
    const matches = rows.filter((row) => row.provider.toLowerCase() === name || row.seller.toLowerCase().includes(name));
    return matches.length === 1 ? matches[0] : undefined;
  }
  if (reference === "cheapest") return [...rows].sort((a, b) => a.total - b.total)[0];
  if (reference === "fastest") return [...rows].sort((a, b) => a.eta - b.eta)[0];
  if (reference === "other") return rows.length === 2 && task?.selectedId ? rows.find((row) => row.id !== task.selectedId) : undefined;
  if (reference === "first" || reference === "second" || reference === "third") return rows[["first", "second", "third"].indexOf(reference)];
  return rows.find((row) => row.id === task?.selectedId) ?? (reference === "selected" && rows.length !== 1 ? undefined : rows[0]);
}

const missing = {
  "en-IN": "Which offer do you mean? You can say its option number.",
  "hi-IN": "आप किस विकल्प की बात कर रहे हैं? उसका नंबर बताइए।",
  "hi-en": "Kaunsa option? Uska number bataiye.",
  "te-IN": "ఏ ఎంపిక కావాలి? దాని నంబర్ చెప్పండి.",
};
const help = {
  "en-IN": "Ask me to find and compare something, explain an offer, or review your sandbox checkout. To change location, open your profile.",
  "hi-IN": "आप मुझसे विकल्प ढूँढने, तुलना करने या डेमो चेकआउट की समीक्षा करने को कह सकते हैं। पता बदलने के लिए प्रोफ़ाइल खोलें।",
  "hi-en": "Mujhse options dhoondhne, compare karne ya demo checkout review karne ko kahiye. Location ke liye profile kholiye.",
  "te-IN": "ఎంపికలు వెతకడం, పోల్చడం లేదా డెమో చెక్అవుట్ చూడమని అడగండి. ప్రదేశం మార్చడానికి ప్రొఫైల్ తెరవండి.",
};

function priceLine(row: NonNullable<ReturnType<typeof referenced>>, language: VoiceLocale, detail = false) {
  const price = spokenPrice(row.total, language);
  const name = row.name.slice(0, 52);
  const seller = row.seller.slice(0, 52);
  const fees = spokenPrice(Math.abs(row.total - row.subtotal), language);
  const hasFees = row.total >= row.subtotal;
  if (language === "hi-IN") return `${seller} पर ${name} का कुल ${price} है।${detail ? ` कुल और सामान की कीमत में ${fees} का अंतर है। समय ${row.eta} मिनट तक है, रेटिंग ${row.rating} है।` : ""}`;
  if (language === "hi-en") return `${seller} ka ${name}, total ${price}.${detail ? ` Items aur total mein ${fees} ka difference hai. Delivery ${row.eta} minute tak, rating ${row.rating} hai.` : ""}`;
  if (language === "te-IN") return `${seller} వారి ${name} మొత్తం ${price}.${detail ? ` వస్తువుల ధర, మొత్తానికి మధ్య తేడా ${fees}. డెలివరీ ${row.eta} నిమిషాల వరకు, రేటింగ్ ${row.rating}.` : ""}`;
  return `${name} from ${seller} totals ${price}.${detail ? ` The total is ${fees} ${hasFees ? "above" : "below"} the item subtotal. Delivery is up to ${row.eta} minutes and the rating is ${row.rating}.` : ""}`;
}

function offerSummary(task: Task | undefined, language: VoiceLocale, limit = 3, ask = true) {
  const rows = facts(task).slice(0, limit).map((row) => ({ ...row, seller: row.seller.slice(0, 28) }));
  if (!rows.length) return;
  const low = [...rows].sort((a, b) => a.total - b.total)[0];
  const fast = [...rows].sort((a, b) => a.eta - b.eta)[0];
  const high = [...rows].sort((a, b) => b.rating - a.rating)[0];
  const lowIndex = rows.indexOf(low) + 1;
  const fastIndex = rows.indexOf(fast) + 1;
  const highIndex = rows.indexOf(high) + 1;
  const recommendation = {
    "en-IN": `For price, consider option ${lowIndex}. For speed, option ${fastIndex}. For rating, option ${highIndex}.`,
    "hi-IN": `कम कीमत के लिए ${lowIndex}, जल्दी के लिए ${fastIndex}, और रेटिंग के लिए ${highIndex} विकल्प देखें।`,
    "hi-en": `Price ke liye ${lowIndex}, speed ke liye ${fastIndex}, rating ke liye ${highIndex}.`,
    "te-IN": `తక్కువ ధరకు ${lowIndex}, త్వరగా రావడానికి ${fastIndex}, రేటింగ్ కోసం ${highIndex} ఎంపికలను చూడండి.`,
  }[language];
  const distinctItems = new Set(rows.map(({ name }) => name)).size > 1;
  const details = rows.map(({ seller, name, total, eta, rating }) => {
    const label = distinctItems ? `${name.slice(0, 25)} · ${seller.slice(0, 18)}` : seller;
    const price = spokenPrice(total, language);
    return {
      "en-IN": `${label}: ${price}, up to ${eta} minutes, rating ${rating}.`,
      "hi-IN": `${label}: ${price}, ${eta} मिनट तक, रेटिंग ${rating}।`,
      "hi-en": `${label}: ${price}, ${eta} minute tak, rating ${rating}.`,
      "te-IN": `${label}: ${price}, ${eta} నిమిషాల వరకు, రేటింగ్ ${rating}.`,
    }[language];
  });
  const intro = { "en-IN": `I found ${rows.length} options.`, "hi-IN": `${rows.length} विकल्प मिले।`, "hi-en": `${rows.length} options mile.`, "te-IN": `${rows.length} ఎంపికలు దొరికాయి.` }[language];
  const question = { "en-IN": "What matters most to you?", "hi-IN": "आपके लिए क्या ज़्यादा ज़रूरी है?", "hi-en": "Aapke liye kya important hai?", "te-IN": "మీకు ఏది ముఖ్యం?" }[language];
  return [intro, ...details, recommendation, ...(ask ? [question] : [])].join(" ");
}

function localPlan(input: InterpretationInput, task?: Task): Partial<Interpretation> | undefined {
  const value = input.text.trim();
  const requestedOption = value.match(/^(?:add|include) (.{1,80}?)[.!?]?$/iu)?.[1].toLowerCase();
  const providerResult = task?.turn.comparison?.result;
  if (requestedOption && task?.selectedId && providerResult?.kind === "offers") {
    const offer = providerResult.offers.find(({ quote }) => quote.id === task?.selectedId);
    const choices = offer?.item.customization?.flatMap(({ choices }) => choices) ?? [];
    if (choices.some(({ name }) => name.toLowerCase() === requestedOption)) return { action: "customize_item", modifierId: requestedOption };
  }
  const explicit = directAction(input.text);
  if (explicit) return explicit;

  if (/\b(?:craving something sweet|want something sweet|something sweet)[,\s]+maybe (?:a )?cake\b/iu.test(value) ||
      /\b(?:తీపి కావాలి|స్వీట్ కావాలి)[,\s]*(?:కేక్ కావచ్చు)?\b/iu.test(value)) {
    return {
      action: "search",
      domain: "food",
      intent: "sandbox_order",
      patch: {
        commerce: { category: "food", product: "sweet" },
      },
    };
  }

  if (/\b(?:it doesn'?t have to be cake|not necessarily cake|anything sweet|any dessert|కేక్ మాత్రమే కాదు)\b/iu.test(value)) {
    return {
      action: "refine",
      domain: "food",
      intent: "sandbox_order",
      patch: {
        commerce: { category: "food", product: "sweet" },
      },
    };
  }

  if (!isInformationalQuestion(value) &&
      (/\b(?:hotel suite|hotel room|hotel booking|book a hotel|room in a hotel)\b/iu.test(value) ||
      (/\bhotel\b/iu.test(value) && /\bsuite\b/iu.test(value)))) {
    return {
      action: "clarification_answer",
      domain: "travel",
      answer: "Jugaad One handles food ordering and local shopping, but does not support hotel bookings or hotel suites.",
    };
  }

  if (/\b(?:why (?:didn'?t you|did not|were no|aren'?t there|no)|why nothing|kyu(?:n)? nahi mila|enduku dorakaledu)\b/iu.test(value) &&
      (task?.turn.status === "no_match" || task?.turn.status === "provider_error")) {
    return {
      action: "explain",
      answer: task.turn.reply ?? "The previous search did not match any available items within your constraints.",
    };
  }

  if (task?.turn.constraints.commerce?.category === "food" && /^(?:actually,? )?make it (?:something )?spicy[.!?]?$/iu.test(value)) {
    const commerce = task.turn.constraints.commerce;
    return { action: "refine", patch: { commerce: { ...commerce, attributes: { ...commerce.attributes, spicy: true } } } };
  }
  if (task && /^(?:anything|something|options) (?:under|below|up to) ₹?\s*[\d,]+(?:\.\d{1,2})?[.!?]?$/iu.test(value)) return { action: "refine" };
  if (/(?:₹?\s*\d[\d,.]*)\s+(?:or|या|లేదా)\s+₹?\s*\d[\d,.]*/iu.test(value)) return { action: "clarify" };

  const wordToNum: Record<string, number> = {
    one: 1, ek: 1, "एक": 1, "ఒకటి": 1,
    two: 2, do: 2, "दो": 2, "రెండు": 2,
    three: 3, teen: 3, "तीन": 3, "మూడు": 3,
    four: 4, chaar: 4, "चार": 4, "నాలుగు": 4,
    five: 5, paanch: 5, "पाँच": 5, "पांच": 5, "ఐదు": 5,
    six: 6, chhah: 6, "छह": 6, "ఆరు": 6,
    seven: 7, saat: 7, "सात": 7, "ఏడు": 7,
    eight: 8, aath: 8, "आठ": 8, "ఎనిమిది": 8,
    nine: 9, nau: 9, "नौ": 9, "తొమ్మిది": 9,
    ten: 10, das: 10, "दस": 10, "పది": 10,
  };
  const qtyMatch = value.match(/\b(?:make it|change (?:it|the quantity) to)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|paanch|दो|तीन|चार|पांच)\b/iu) ||
    value.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|paanch|दो|तीन|चार|पांच)\s+(?:portions?|plates?|items?|orders?|pieces?|प्लेट)\b/iu);
  if (qtyMatch) {
    const raw = qtyMatch[1]?.toLowerCase();
    const qty = raw ? (Number(raw) || wordToNum[raw] || 0) : 0;
    if (qty >= 1 && qty <= 10) {
      if (!task || (!task.selectedId && facts(task).length > 1)) return { action: "clarify" };
      return { action: "refine", patch: { quantity: qty } };
    }
  }

  if (task?.turn.constraints.dish && /\b(?:meant|said) chicken,? not mutton\b/iu.test(value)) {
    const dish = canonicalDish(task.turn.constraints.dish.replace(/mutton|lamb/iu, "chicken"))!;
    return { action: "correct", patch: { dish, commerce: { category: "food", product: dish } } };
  }

  const correctionMatch = value.match(/\b(?:actually,? )?(?:i )?(?:meant|said)\s+([a-zA-Z\s]+?)(?:,?\s+not\s+([a-zA-Z\s]+))?[.!?]?$/iu);
  if (correctionMatch && task?.turn.constraints) {
    const target = correctionMatch[1]?.trim();
    if (target && !/^(?:that|this|it|yes|no)$/iu.test(target)) {
      const category = task.turn.constraints.commerce?.category ?? "food";
      let dishName = target;
      if (category === "food" && task.turn.constraints.dish && correctionMatch[2]) {
        const negated = correctionMatch[2].trim();
        dishName = task.turn.constraints.dish.replace(new RegExp(negated, "iu"), target);
      }
      const canonical = canonicalDish(dishName) ?? dishName;
      return {
        action: "correct",
        patch: {
          dish: category === "food" ? canonical : undefined,
          commerce: { category, product: canonical },
        },
      };
    }
  }
}

function freshTask(plan: Interpretation, current: FoodIntent, userText?: string) {
  if (plan.action === "correct") return false;
  if (plan.action === "new_task") return true;
  const oldCategory = current.commerce?.category ?? (current.dish ? "food" : undefined);
  const nextCategory = plan.patch.commerce?.category ?? (plan.patch.dish ? "food" : undefined);
  if (oldCategory && nextCategory && oldCategory !== nextCategory) return true;
  if (userText && /\b(?:forget that|cancel that|start over|instead|scratch that|chhor do|bhool jao|vadilesey)\b/iu.test(userText)) {
    return true;
  }
  const oldProduct = canonicalDish(current.dish ?? current.commerce?.product)?.toLowerCase();
  const newProduct = canonicalDish(plan.patch.dish ?? plan.patch.commerce?.product)?.toLowerCase();
  return Boolean(oldProduct && newProduct && oldProduct !== newProduct && plan.action !== "refine");
}

export async function orchestrate(input: InterpretationInput, session: Session, services: Services) {
  const dialogue: Dialogue = session.dialogue ?? { previous: [] };
  let task = dialogue.task;
  const current = task?.turn.constraints ?? session.current ?? (session.dialogue ? {} : input.current);
  const language = input.voiceLanguage ?? dialogue.lastLanguage ?? session.profile?.language ?? "en-IN";
  let resultLanguage = language;
  const answer = confirmationAnswer(input.text);
  const pending = dialogue.confirmation;
  const pendingOffer = pending?.type === "offer" && pending.taskId === task?.id ? pending : undefined;
  const pendingPayment = pending?.type === "payment" && pending.id === (session.quote?.id ?? session.providerQuoteId) ? pending : undefined;
  const correctedReference = input.text.replace(/^(?:(?:no|nope|nahin?|kaadu)[, ]+|actually[,]?\s+(?:i meant|make it)\s+)/iu, "");
  const correction = task && correctedReference !== input.text ? directAction(correctedReference) : undefined;
  const direct = answer === "yes" && pendingOffer ? { action: "select" as const, offerId: pendingOffer.id }
    : answer === "yes" && (pendingPayment || dialogue.awaitingApproval) ? { action: "approve" as const }
    : correction?.action === "select" ? correction
    : answer === "no" && (pendingOffer || pendingPayment || dialogue.awaitingApproval) ? { action: "reject" as const }
    : localPlan(input, task);
  const intent = task?.turn.intent ?? (current.commerce && current.commerce.category !== "food" ? "sandbox_order" : "food_order");
  const started = performance.now();
  const providerStage = !direct && session.providerQuoteId && services.persisted
    ? (await (await transactionStore()).get(services.owner, session.providerQuoteId))?.transaction.phase
    : undefined;
  const asksForCurrentDeals = /\bdeals?\b/iu.test(input.text) && /\b(?:right now|today|currently|find|show|available)\b/iu.test(input.text) &&
    !/\b(?:among|these|those|of the options)\b/iu.test(input.text);
  const asksForBudgetSurprise = /\bsurprise me\b/iu.test(input.text) && /\b(?:under|below|up to|budget)\s*₹?\s*\d/iu.test(input.text);
  const interpreted = direct ? { model: "local", source: "deterministic" as const, plan: { intent, patch: {}, ...direct } as Interpretation } :
    await services.interpret({ ...input, voiceLanguage: language, current, recentRequests: dialogue.recentTurns ?? input.recentRequests,
      context: { topic: dialogue.topic, lastReply: dialogue.last?.text, clarification: dialogue.clarification, taskDomain: task?.domain ?? (task ? taskDomain(current) : undefined), offers: facts(task).slice(0, 3).map(({ id, seller, name, provider, total, eta, rating }) => ({ id, seller, name, provider, total, eta, rating })),
        selectedOfferId: task?.selectedId, recommendation: dialogue.recommendation, history: dialogue.history,
        transactionStage: providerStage ?? (session.quote ? session.quote.approvedAt ? "approved" : "quoted" : undefined) },
    }, services.signal).catch((error: unknown) => {
      if (!(asksForCurrentDeals || asksForBudgetSurprise) || !(error instanceof MarketplaceError) || error.code !== "GEMINI_INVALID_RESPONSE") throw error;
      services.signal.throwIfAborted();
      const plan: Interpretation = { action: "search", intent: "sandbox_order", domain: "food",
        patch: { commerce: { category: "food", product: "food" }, priority: "lowest-price" } };
      return { model: "local", source: "deterministic" as const, plan };
    });
  services.signal.throwIfAborted();
  const reasonMs = performance.now() - started;
  const { model } = interpreted;
  let { plan } = interpreted;
  const openFoodRequest = (asksForCurrentDeals || asksForBudgetSurprise) && !plan.patch.dish &&
    (!plan.patch.commerce || plan.patch.commerce.category === "food") &&
    !/\bdeals? (?:on|for)\b/iu.test(input.text);
  if (openFoodRequest && (canDiscover(plan) || ["answer", "advice", "recommend", "clarify"].includes(plan.action))) {
    const patch = canDiscover(plan) ? plan.patch : {};
    plan = { action: plan.action === "new_task" ? "new_task" : "search", intent: "sandbox_order", domain: "food",
      patch: { ...patch, commerce: { category: "food", product: "food" }, priority: "lowest-price" } };
  }
  const comparisonOnly = plan.action === "refine" && facts(task).length > 0 &&
    Object.keys(plan.patch).every((key) => ["priority", "qualityPriority", "clear"].includes(key)) &&
    (plan.patch.clear ?? []).every((key) => key === "priority" || key === "qualityPriority");
  const deprioritizesSpeed = /\b(?:don['’]t care|doesn['’]t matter|not important|ignore)\b/iu.test(input.text) &&
    /\b(?:speed|fastest|how fast)\b/iu.test(input.text);
  if (comparisonOnly && deprioritizesSpeed) {
    plan = { action: "recommend", intent: "other", patch: {}, criterion: current.qualityPriority ? "rating" : "price" };
  }
  const explicitCap = input.text.match(/(?:under|below|up to|less than|max(?:imum)?(?: budget)?|budget(?: of| is)?)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?=\s|[.!?]|$)/iu)?.[1];
  const capPaise = explicitCap === undefined ? undefined : Math.round(Number(explicitCap.replaceAll(",", "")) * 100);
  const contradictory = capPaise !== undefined && (() => {
    const floor = input.text.match(/(?:at least|minimum)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/iu)?.[1];
    return floor !== undefined && Math.round(Number(floor.replaceAll(",", "")) * 100) >= capPaise;
  })();
  const badBudget = capPaise !== undefined && plan.patch.budgetPaise !== undefined && capPaise !== plan.patch.budgetPaise;
  const action = badBudget || contradictory || (isInformationalQuestion(input.text) && canDiscover(plan) && !(asksForCurrentDeals || asksForBudgetSurprise)) ? "clarify" : plan.action;
  const domain = actDomain({ ...plan, action }, current);
  let transition: TaskTransition = task ? "keep" : "none";
  let failure: SearchFailure | undefined;
  const tools = new Set<string>();
  let searchAttempted = false;
  const languageAction = action === "change_language" || action === "rephrase" || action === "repeat";
  resultLanguage = input.voiceLanguage && !languageAction ? input.voiceLanguage : plan.language ?? language;
  const executionStart = performance.now();
  let providerCalls = 0;
  const timings = { catalog: 0, quotes: 0 };
  let state = session;
  let awaitingApproval = dialogue.awaitingApproval;
  let confirmation: Dialogue["confirmation"] = action === "repeat" ? pending : undefined;
  let previous = dialogue.previous;
  let recommendation = dialogue.recommendation;
  const asTurn = (reply: string, status: FoodTurn["status"] = "results"): FoodTurn => ({
    ...(task?.turn ?? { constraints: current, intent: plan.intent }),
    model, status, reply, replyLanguage: resultLanguage, keepSelection: true, speechTicket: undefined, providerTransaction: undefined,
    selectedQuoteId: undefined, voiceControl: undefined, selectedOfferId: task?.selectedId,
  });
  let turn: FoodTurn;
  const referenceId = plan.offerId ?? (action === "explain" && !plan.reference && !plan.seller ? recommendation?.id : undefined);
  const relevant = referenceId ? facts(task).find(({ id }) => id === referenceId) : referenced(task, plan.reference ?? (action === "prepare" || action === "select" ? "selected" : undefined), plan.seller);
  const historical = task?.turn.sandbox?.offers ?? state.offers;
  const rememberOffer = () => { if (task) task = { ...task, selectedId: relevant?.id }; };
  const quote = state.quote;
  if (action === "repeat" || action === "rephrase") {
    tools.add("saved_reply");
    const last = dialogue.last;
    if (action === "repeat" && last && (!plan.language || plan.language === last.language)) {
      resultLanguage = last.language;
      let ticket: string | undefined;
      if (last.ticket) { try { readSpeechTicket(last.ticket); ticket = last.ticket; } catch { /* Re-sign saved text after expiry. */ } }
      turn = { ...asTurn(last.text), speechTicket: ticket ?? issueSpeechTicket(last.text, last.language) };
    } else if (plan.answer && !relevant) turn = asTurn(plan.answer);
    else if (action === "rephrase" && last?.language === resultLanguage) turn = asTurn(last.text);
    else if (relevant) turn = asTurn(priceLine(relevant, resultLanguage));
    else turn = asTurn(plan.answer ?? last?.text ?? help[resultLanguage]);
  } else if (action === "change_language") {
    resultLanguage = plan.language ?? language;
    const ack = {
      "en-IN": "Sure, I'll speak English.",
      "hi-IN": "ज़रूर, अब मैं हिंदी में बात करूँगी।",
      "hi-en": "Sure, ab Hinglish mein baat karte hain.",
      "te-IN": "ఖచ్చితంగా, ఇకపై నేను తెలుగులో మాట్లాడతాను.",
    }[resultLanguage];
    turn = asTurn(relevant ? `${ack} ${priceLine(relevant, resultLanguage)}` : ack, task?.turn.status ?? "results");
  } else if (action === "ask_reviews") {
    tools.add("saved_comparison");
    const listing = relevant?.listing ?? task?.turn.sandbox?.offers[0]?.listing;
    const rev = listing?.reviews;
    if (rev) {
      const reply = {
        "en-IN": `In simulated sandbox reviews for ${relevant?.name ?? "this item"} from ${relevant?.seller ?? "Mirchi Moon"} (${rev.rating}★ from ${rev.count} demo ratings): ${rev.summary} Feedback highlights: ${rev.positivePoints?.join(", ")}. Note: ${rev.complaints?.join(", ")}.`,
        "hi-IN": `${relevant?.seller ?? "Mirchi Moon"} के ${relevant?.name ?? "इस सामान"} के डेमो रिव्यूज (${rev.rating}★, ${rev.count} रेटिंग): ${rev.summary} मुख्य बातें: ${rev.positivePoints?.join(", ")}।`,
        "hi-en": `${relevant?.seller ?? "Mirchi Moon"} ke ${relevant?.name ?? "item"} ke demo reviews (${rev.rating}★): ${rev.summary} Highlights: ${rev.positivePoints?.join(", ")}.`,
        "te-IN": `${relevant?.seller ?? "Mirchi Moon"} వారి ${relevant?.name ?? "ఈ వస్తువు"} డెమో సమీక్షల్లో (${rev.rating}★, ${rev.count} రేటింగ్‌లు): ${rev.summary} ముఖ్య అంశాలు: ${rev.positivePoints?.join(", ")}.`,
      }[resultLanguage];
      turn = asTurn(reply);
    } else {
      turn = asTurn({
        "en-IN": "This item has no recorded review evidence in the simulated sandbox.",
        "hi-IN": "इस डेमो सामान के लिए कोई समीक्षा दर्ज नहीं है।",
        "hi-en": "Is demo item ke liye koi recorded reviews nahi hain.",
        "te-IN": "ఈ డెమో వస్తువుకు నమోదైన సమీక్షలు లేవు.",
      }[resultLanguage]);
    }
  } else if (action === "suggest_complement") {
    tools.add("saved_comparison");
    const listing = relevant?.listing ?? task?.turn.sandbox?.offers[0]?.listing;
    const comparison = task?.turn.comparison;
    const providerOffer = comparison?.result.kind === "offers" ? comparison.result.offers.find(({ quote }) => quote.id === relevant?.id) : undefined;
    const providerOptions = comparison?.input;
    const providerMods = providerOptions && !providerOptions.dietary && !providerOptions.dietaryRestrictions?.length && !providerOptions.allergens?.length
      ? providerOffer?.item.customization.flatMap(({ choices }) => choices.map(({ name, priceDeltaPaise }) => ({ name, pricePaise: priceDeltaPaise })))
      : undefined;
    const mods = listing?.modifiers?.flatMap(({ options }) => options) ?? providerMods;
    if (mods?.length) {
      const modDetails = mods.map((m) => `${m.name} (${spokenPrice(m.pricePaise, resultLanguage)})`).join(", ");
      const reply = {
        "en-IN": `${relevant?.seller ?? "Mirchi Moon"} offers toppings and add-ons including: ${modDetails}. Would you like to add one?`,
        "hi-IN": `${relevant?.seller ?? "Mirchi Moon"} पर टॉपिंग्स उपलब्ध हैं: ${modDetails}। क्या आप इनमें से कुछ जोड़ना चाहेंगे?`,
        "hi-en": `${relevant?.seller ?? "Mirchi Moon"} par ye toppings available hain: ${modDetails}. Koi add karna chahenge?`,
        "te-IN": `${relevant?.seller ?? "Mirchi Moon"} లో టాపింగ్స్ అందుబాటులో ఉన్నాయి: ${modDetails}. ఏదైనా జతచేయాలా?`,
      }[resultLanguage];
      turn = asTurn(reply);
    } else {
      turn = asTurn({
        "en-IN": "No additional add-ons or toppings are available for this item.",
        "hi-IN": "इस सामान के लिए कोई अतिरिक्त टॉपिंग उपलब्ध नहीं है।",
        "hi-en": "Is item ke liye koi extra toppings available nahi hain.",
        "te-IN": "ఈ వస్తువుకు అదనపు టాపింగ్స్ అందుబాటులో లేవు.",
      }[resultLanguage]);
    }
  } else if (action === "customize_item") {
    tools.add("saved_comparison");
    const comparison = task?.turn.comparison;
    const providerOffer = task?.selectedId && comparison?.result.kind === "offers"
      ? comparison.result.offers.find(({ quote }) => quote.id === task?.selectedId)
      : undefined;
    if (services.persisted && providerOffer && comparison && plan.modifierId) {
      const { item } = providerOffer;
      const modifier = plan.modifierId.toLowerCase().replace(/^extra /u, "");
      const matches = item.customization.flatMap((group) => group.choices
        .filter((choice) => choice.id === modifier || choice.name.toLowerCase() === modifier || choice.name.toLowerCase() === `extra ${modifier}`)
        .map((choice) => ({ group, choice })));
      const option = matches.length === 1 ? matches[0] : undefined;
      const search = comparison.input;
      if (!option || search.dietary || search.dietaryRestrictions?.length || search.allergens?.length) {
        turn = asTurn({
          "en-IN": "I can’t verify that add-on for this item and its requirements. The quote is unchanged.",
          "hi-IN": "इस सामान और उसकी शर्तों के लिए यह विकल्प सत्यापित नहीं हुआ। कीमत में बदलाव नहीं है।",
          "hi-en": "Is item ki requirements ke saath add-on verify nahi hua. Quote same hai.",
          "te-IN": "ఈ ఐటమ్‌కు, మీ నియమాలకు ఈ అదనపు ఎంపికను నిర్ధారించలేకపోయాను. ధర మారలేదు.",
        }[resultLanguage], "clarification");
      } else {
        const existing = state.providerQuoteId ? await readTransaction(services.owner, state.providerQuoteId, services.signal) : undefined;
        const line = (existing?.quote ?? providerOffer.quote).lineItems[0];
        const options = line.selectedOptions.map(({ groupId, optionId }) => ({ groupId, optionId }));
        const selected = options.some(({ groupId, optionId }) => groupId === option.group.id && optionId === option.choice.id);
        const otherOptions = option.group.maxSelect === 1 ? options.filter(({ groupId }) => groupId !== option.group.id) : options;
        try {
          enforceRateLimit("marketplace-checkout-quote", 5);
          const tx = await runCheckout(services.owner, { action: "quote", provider: item.provider.id, branchId: item.restaurant.branchId, search,
            item: { menuItemId: item.id, quantity: line.quantity, selectedOptions: selected ? options : [...otherOptions, { groupId: option.group.id, optionId: option.choice.id }] } }, services.signal);
          tools.add("prepare_quote");
          state = { ...state, providerQuoteId: tx.id };
          awaitingApproval = tx.id;
          turn = { ...asTurn(quoteReply(tx.quote.pricing.totalPaise, resultLanguage), "selected"), providerTransaction: tx };
        } catch (error) {
          if (!(error instanceof MarketplaceError) || error.code !== "OVER_BUDGET") throw error;
          turn = asTurn(searchRepair(["OVER_BUDGET"], resultLanguage) ?? missing[resultLanguage], "clarification");
        }
      }
    } else if (!services.persisted) {
      turn = asTurn(missing[resultLanguage], "clarification");
    } else {
      let currentQuote = quote;
      if (!currentQuote && relevant && historical.some(({ listing }) => listing.id === relevant.id)) {
        const updated = await bookCommerce(services.owner, { action: "select", listingId: relevant.id }, services.requestId);
        state = { ...state, quote: updated.session.quote };
        currentQuote = updated.session.quote;
      }
      if (!currentQuote) {
        turn = asTurn(missing[resultLanguage], "clarification");
      } else {
        const targetId = plan.modifierId?.toLowerCase();
        const mod = targetId && currentQuote.offer.listing.modifiers?.flatMap((g) => g.options).find((opt) => opt.id === targetId || opt.name.toLowerCase().includes(targetId));
        if (!mod) {
          turn = asTurn({
            "en-IN": "That modifier is not available for this item.",
            "hi-IN": "यह विकल्प इस सामान के लिए उपलब्ध नहीं है।",
            "hi-en": "Ye option is item ke liye available nahi hai.",
            "te-IN": "ఈ ఎంపిక అందుబాటులో లేదు.",
          }[resultLanguage]);
        } else {
          const existing = currentQuote.offer.selectedModifiers ?? [];
          const nextModifiers = existing.some(({ id }) => id === mod.id) ? existing : [...existing, mod];
          const newTotal = totalFor(currentQuote.offer.listing, currentQuote.offer.quantity, nextModifiers);
          const budgetPaise = current.budgetPaise;
          if (budgetPaise !== undefined && (current.budgetExclusive ? newTotal >= budgetPaise : newTotal > budgetPaise)) {
            const overrun = spokenPrice(newTotal - budgetPaise, resultLanguage);
            const budStr = spokenPrice(budgetPaise, resultLanguage);
            const totStr = spokenPrice(newTotal, resultLanguage);
            const reply = {
              "en-IN": `Adding ${mod.name} brings the total to ${totStr}, which is ${overrun} over your budget of ${budStr}. Would you like to raise your budget or proceed without it?`,
              "hi-IN": `${mod.name} जोड़ने पर कुल कीमत ${totStr} हो जाती है, जो आपके ${budStr} के बजट से ${overrun} अधिक है। क्या बजट बढ़ाएँ या इसके बिना आगे बढ़ें?`,
              "hi-en": `${mod.name} add karne par total ${totStr} ho jayega, jo budget ${budStr} se ${overrun} zyada hai. Budget badhayein ya bina topping ke proceed karein?`,
              "te-IN": `${mod.name} జతచేస్తే మొత్తం ధర ${totStr} అవుతుంది, ఇది మీ బడ్జెట్ ${budStr} కంటే ${overrun} ఎక్కువ. బడ్జెట్ పెంచుతారా లేదా దీని లేకుండా కొనసాగిస్తారా?`,
            }[resultLanguage];
            turn = asTurn(reply, "clarification");
          } else {
            const updated = await bookCommerce(services.owner, { action: "customize", quoteId: currentQuote.id, modifierId: mod.id }, services.requestId);
            state = { ...state, quote: updated.session.quote };
            awaitingApproval = state.quote?.id;
            const totStr = spokenPrice(state.quote?.offer.totalPaise ?? newTotal, resultLanguage);
            const reply = {
              "en-IN": `Added ${mod.name}. The updated total is ${totStr}. Would you like to approve it?`,
              "hi-IN": `${mod.name} जोड़ दिया गया। नया कुल ${totStr} है। क्या आप इसे मंज़ूर करेंगे?`,
              "hi-en": `${mod.name} add ho gaya. Updated total ${totStr} hai. Kya aap ise approve karenge?`,
              "te-IN": `${mod.name} జతచేయబడింది. నవీకరించిన మొత్తం ${totStr}. ఆమోదిస్తారా?`,
            }[resultLanguage];
            turn = asTurn(reply, "selected");
          }
        }
      }
    }
  } else if (action === "repeat_price" || action === "explain" || action === "compare" || action === "summarize" || action === "recommend") {
    tools.add("saved_comparison");
    const rows = facts(task);
    if (action === "recommend") {
      const criterion = plan.criterion ?? (current.priority === "fastest" ? "speed" : current.qualityPriority ? "rating" : "price");
      const best = [...rows].sort((a, b) => (criterion === "speed" ? a.eta - b.eta : criterion === "rating" ? b.rating - a.rating : 0) || a.total - b.total)[0];
      if (best) {
        recommendation = { id: best.id, criterion };
        const basis = {
          "en-IN": { price: "If total price matters most", speed: "If delivery speed matters most", rating: "If rating matters most" },
          "hi-IN": { price: "अगर कुल कीमत सबसे ज़रूरी है", speed: "अगर जल्दी डिलीवरी सबसे ज़रूरी है", rating: "अगर रेटिंग सबसे ज़रूरी है" },
          "hi-en": { price: "Agar total price sabse important hai", speed: "Agar delivery speed sabse important hai", rating: "Agar rating sabse important hai" },
          "te-IN": { price: "మొత్తం ధర ముఖ్యం అయితే", speed: "డెలివరీ వేగం ముఖ్యం అయితే", rating: "రేటింగ్ ముఖ్యం అయితే" },
        }[resultLanguage][criterion];
        if (task && offersStillValid(task)) confirmation = { type: "offer", id: best.id, taskId: task.id };
        const question = { "en-IN": "Would you like this option?", "hi-IN": "क्या आप यह विकल्प चाहेंगे?", "hi-en": "Kya aap yeh option lenge?", "te-IN": "ఈ ఎంపిక కావాలా?" }[resultLanguage];
        turn = asTurn(`${basis}: ${priceLine(best, resultLanguage, true)}${confirmation ? ` ${question}` : ""}`);
      } else turn = asTurn(help[resultLanguage], "clarification");
    } else if (action === "compare" || action === "summarize") turn = asTurn(offerSummary(task, resultLanguage, 3, action === "summarize") ?? missing[resultLanguage]);
    else if (action === "explain" && !plan.reference && !plan.offerId && !plan.seller && !recommendation && rows.length > 1) {
      turn = asTurn(offerSummary(task, resultLanguage, 3, false) ?? help[resultLanguage]);
    } else if (relevant && action === "explain") {
      const other = rows.find((row) => row.id !== relevant.id);
      turn = asTurn([priceLine(relevant, resultLanguage, true), other && priceLine(other, resultLanguage, true)].filter(Boolean).join(" "));
    } else {
      const exact = state.providerQuoteId && services.persisted ?
        (await (await transactionStore()).get(services.owner, state.providerQuoteId))?.transaction : undefined;
      const price = quote?.offer.totalPaise ?? (exact?.phase === "quoted" || exact?.phase === "approved" ? exact.quote.pricing.totalPaise : undefined);
      const previousFailure = action === "explain" && task && (!task.turn.replyLanguage || task.turn.replyLanguage === resultLanguage) &&
        (task.turn.status === "no_match" || task.turn.status === "provider_error") ? task.turn.reply : undefined;
      turn = asTurn(previousFailure ?? (price !== undefined ? totalReply(price, resultLanguage) : relevant ? priceLine(relevant, resultLanguage) : missing[resultLanguage]));
    }
  } else if (action === "redisplay") {
    tools.add("saved_comparison");
    turn = asTurn(dialogue.offerReply?.language === resultLanguage ? dialogue.offerReply.text : relevant ? priceLine(relevant, resultLanguage) : missing[resultLanguage], task?.turn.status ?? "clarification");
  } else if (action === "back") {
    const old = previous[0];
    if (!old) turn = asTurn(missing[resultLanguage], "clarification");
    else {
      previous = task && task.id !== old.id ? [task, ...previous.slice(1)].slice(0, 3) : previous.slice(1);
      task = old;
      transition = "resume";
      tools.add("task_history");
      state = { ...state, current: old.turn.constraints, offers: old.turn.sandbox?.offers ?? [], quote: undefined, providerQuoteId: undefined };
      turn = { ...old.turn, model, replyLanguage: resultLanguage, keepSelection: false, selectedOfferId: old.selectedId,
        reply: referenced(old) ? priceLine(referenced(old)!, resultLanguage) : old.turn.replyLanguage === resultLanguage ? old.turn.reply : missing[resultLanguage] };
    }
  } else if (action === "pause_task" || action === "end_task" || action === "stop" ||
      (action === "correct" && !canDiscover({ ...plan, action }) && task && domain !== (task.domain ?? taskDomain(current)))) {
    if (task && action === "pause_task") previous = [task, ...previous].slice(0, 3);
    transition = action === "end_task" || action === "stop" ? "end" : "pause";
    if (transition === "end") previous = [];
    task = undefined;
    state = { ...state, current: undefined, offers: [], quote: undefined, providerQuoteId: undefined };
    awaitingApproval = undefined;
    turn = { ...asTurn(plan.answer ?? ({ "en-IN": "Stopped.", "hi-IN": "रोक दिया।", "hi-en": "Rok diya.", "te-IN": "ఆపేశాను." })[resultLanguage]), intent: "other", constraints: {}, keepSelection: false,
      ...(action === "stop" ? { voiceControl: "stop" as const } : {}) };
  } else if (action === "answer" || action === "advice" || action === "help" || action === "greeting" || action === "clarification_answer") {
    const greeting = { "en-IN": "Hey! What can I get done for you?", "hi-IN": "नमस्ते! मैं आपकी क्या मदद करूँ?", "hi-en": "Hi! Aaj kis cheez mein help chahiye?", "te-IN": "నమస్కారం! మీకు ఏ సహాయం కావాలి?" };
    turn = { ...asTurn(plan.answer ?? (action === "greeting" ? greeting[resultLanguage] : help[resultLanguage])), intent: "other" };
  } else if (action === "order_status") {
    tools.add("order_tracking");
    const provider = services.persisted && (await listTransactions(services.owner)).find(({ phase }) => phase === "confirmed");
    if (provider && (!session.orders[0] || Date.parse(provider.createdAt) > session.orders[0].confirmedAt)) {
      const latest = await readTransaction(services.owner, provider.id, services.signal);
      const order = latest.order;
      turn = asTurn(order ? trackingSpeech(resultLanguage, undefined, order.currentStatus) : trackingSpeech(resultLanguage));
    } else turn = asTurn(trackingSpeech(resultLanguage, session.orders[0]));

  } else if (action === "pause" || action === "mute" || action === "stop_speech") {
    turn = { ...asTurn(action === "stop_speech" ? ({ "en-IN": "I’ll wait.", "hi-IN": "मैं रुकती हूँ।", "hi-en": "Main rukti hoon.", "te-IN": "నేను ఆగుతాను." })[resultLanguage] : help[resultLanguage]), voiceControl: action };
  } else if (action === "select" || action === "prepare" || action === "approve" || action === "cancel" || action === "reject") {
    if (!services.persisted || (action === "approve" && direct?.action !== "approve") ||
        ((action === "cancel" || action === "reject") && direct?.action !== "cancel" && direct?.action !== "reject")) {
      turn = asTurn(missing[resultLanguage], "clarification");
    } else if (action === "reject" && pendingOffer) {
      turn = asTurn({ "en-IN": "I’ll keep the other options open.", "hi-IN": "बाकी विकल्प खुले हैं।", "hi-en": "Baaki options khule hain.", "te-IN": "మిగతా ఎంపికలు ఉన్నాయి." }[resultLanguage]);
    } else if (action === "select" && pendingOffer && answer === "yes" && task && !offersStillValid(task)) {
      turn = asTurn({ "en-IN": "Those offers have expired. Ask me to check fresh prices.", "hi-IN": "ऑफ़र की अवधि खत्म हो गई है। नई कीमतें पूछें।", "hi-en": "Offers expire ho gaye. Fresh prices check karwa sakte hain.", "te-IN": "ఆఫర్ల గడువు ముగిసింది. కొత్త ధరలు అడగండి." }[resultLanguage], "clarification");
    } else if (action === "approve" && quote && quote.expiresAt <= Date.now()) {
      awaitingApproval = undefined;
      turn = asTurn({ "en-IN": "The quote expired. Ask me for a fresh quote.", "hi-IN": "कोट की अवधि खत्म हो गई। नया कोट माँगें।", "hi-en": "Quote expire ho gaya. Fresh quote maangiye.", "te-IN": "కోట్ గడువు ముగిసింది. కొత్త కోట్ అడగండి." }[resultLanguage], "clarification");
    } else if (action === "approve" && answer === "yes" && pendingPayment) {
      services.signal.throwIfAborted();
      tools.add("authorize_simulated_payment");
      awaitingApproval = undefined;
      if (quote) {
        const updated = await bookCommerce(services.owner, { action: "pay", quoteId: quote.id, code: demoCode }, services.requestId, pendingPayment.totalPaise);
        state = updated.session;
        turn = asTurn(commerceSpeech(resultLanguage, undefined, updated.order) ?? paymentReply(resultLanguage));
        if (updated.order) { task = undefined; previous = []; transition = "end"; turn = { ...turn, constraints: {}, comparison: undefined, keepSelection: false, sandbox: { offers: [], orders: state.orders } }; }
      } else {
        const exact = await readTransaction(services.owner, pendingPayment.id, services.signal);
        if (exact.phase !== "approved" || exact.quote.pricing.totalPaise !== pendingPayment.totalPaise) throw new MarketplaceError("COMMERCE_APPROVAL_REQUIRED", 409);
        await updateSession(services.owner, (latest) => {
          const authorization = latest.dialogue?.confirmation;
          if (latest.searchId !== services.requestId || latest.providerQuoteId !== exact.id ||
              authorization?.type !== "payment" || authorization.id !== exact.id || authorization.totalPaise !== pendingPayment.totalPaise) {
            throw new MarketplaceError("COMMERCE_CONFLICT", 409);
          }
          return { ...latest, dialogue: latest.dialogue && { ...latest.dialogue, confirmation: undefined } };
        });
        services.signal.throwIfAborted();
        const tx = await runCheckout(services.owner, { action: "pay", id: exact.id, demoUpi: "jugaad@demo", confirmed: true }, services.signal);
        const confirmed = tx.phase === "confirmed" && Boolean(tx.order);
        turn = { ...asTurn(confirmed ? transactionSpeech(tx, "confirmation", resultLanguage) ?? paymentReply(resultLanguage) :
          { "en-IN": "The provider has not confirmed this booking. Check Orders for its status.", "hi-IN": "बुकिंग की पुष्टि नहीं हुई। ऑर्डर में स्थिति देखें।", "hi-en": "Booking confirm nahi hui. Orders mein status dekhein.", "te-IN": "బుకింగ్ నిర్ధారణ కాలేదు. ఆర్డర్లలో స్థితి చూడండి." }[resultLanguage]), providerTransaction: tx };
        if (confirmed) { task = undefined; previous = []; transition = "end"; state = { ...state, current: undefined, providerQuoteId: undefined }; turn = { ...turn, constraints: {}, comparison: undefined, keepSelection: false }; }
      }
    } else if (action === "cancel" || action === "reject") {
      tools.add("cancel_quote");
      if (state.providerQuoteId) await runCheckout(services.owner, { action: "cancel", id: state.providerQuoteId }, services.signal);
      if (quote) await bookCommerce(services.owner, { action: "cancel", quoteId: quote.id }, services.requestId);
      state = { ...state, quote: undefined, providerQuoteId: undefined };
      turn = asTurn({ "en-IN": "I’ve closed the quote.", "hi-IN": "मैंने कोट बंद कर दिया।", "hi-en": "Quote close kar diya.", "te-IN": "కోట్ మూసేశాను." }[resultLanguage]);
    } else if (action === "approve" && (!awaitingApproval || awaitingApproval !== (quote?.id ?? state.providerQuoteId))) {
      turn = asTurn({ "en-IN": "There’s nothing pending to approve.", "hi-IN": "मंज़ूरी के लिए कुछ लंबित नहीं है।", "hi-en": "Approve karne ke liye kuch pending nahi hai.", "te-IN": "ఆమోదించాల్సింది ఏదీ లేదు." }[resultLanguage], "clarification");
    } else if (action === "approve" && quote) {
      tools.add("verify_approval");
      const updated = await bookCommerce(services.owner, { action: "approve", quoteId: quote.id, totalPaise: quote.offer.totalPaise }, services.requestId);
      state = { ...state, quote: updated.session.quote };
      awaitingApproval = undefined;
      confirmation = { type: "payment", id: quote.id, totalPaise: quote.offer.totalPaise };
      turn = asTurn(paymentAuthorization(quote.offer.totalPaise, resultLanguage));
    } else if (action === "approve" && state.providerQuoteId) {
      tools.add("verify_approval");
      const currentQuote = await readTransaction(services.owner, state.providerQuoteId, services.signal);
      if (currentQuote.phase !== "quoted") throw new MarketplaceError("INVALID_TRANSACTION_STATE", 409);
      const tx = await runCheckout(services.owner, { action: "approve", id: currentQuote.id, totalPaise: currentQuote.quote.pricing.totalPaise }, services.signal);
      awaitingApproval = undefined;
      confirmation = { type: "payment", id: tx.id, totalPaise: tx.quote.pricing.totalPaise };
      turn = { ...asTurn(paymentAuthorization(tx.quote.pricing.totalPaise, resultLanguage)), providerTransaction: tx };
    } else if (!relevant) turn = asTurn(missing[resultLanguage], "clarification");
    else if (historical.some(({ listing }) => listing.id === relevant.id)) {
      rememberOffer();
      tools.add("saved_comparison");
      if (quote && quote.offer.listing.id === relevant.id && quote.expiresAt > Date.now()) {
        awaitingApproval = quote.approvedAt ? undefined : quote.id;
        turn = asTurn(commerceSpeech(resultLanguage, quote) ?? paymentReply(resultLanguage), "selected");
      }
      else {
        tools.add("prepare_quote");
        const updated = await bookCommerce(services.owner, { action: "select", listingId: relevant.id }, services.requestId);
        state = { ...state, quote: updated.session.quote };
        awaitingApproval = state.quote?.id;
        turn = asTurn(commerceSpeech(resultLanguage, state.quote) ?? priceLine(relevant, resultLanguage), "selected");
      }
    } else {
      rememberOffer();
      tools.add("saved_comparison");
      const comparison = task?.turn.comparison;
      const offer = comparison?.result.kind === "offers" ? comparison.result.offers.find(({ quote }) => quote.id === relevant.id) : undefined;
      if (action === "prepare" && offer && comparison) {
        services.signal.throwIfAborted();
        tools.add("prepare_quote");
        const stored = state.providerQuoteId && dialogue.task?.selectedId === relevant.id
          ? await readTransaction(services.owner, state.providerQuoteId, services.signal) : undefined;
        const current = stored && (stored.phase === "quoted" || stored.phase === "approved") && Date.parse(stored.quote.expiresAt) > Date.now() ? stored : undefined;
        let tx = current;
        if (!tx) {
          enforceRateLimit("marketplace-checkout-quote", 5);
          const line = (stored?.quote ?? offer.quote).lineItems[0];
          tx = await runCheckout(services.owner, { action: "quote", provider: offer.item.provider.id, branchId: offer.item.restaurant.branchId, search: comparison.input,
            item: { menuItemId: offer.item.id, quantity: line.quantity, selectedOptions: line.selectedOptions.map(({ groupId, optionId }) => ({ groupId, optionId })) } }, services.signal);
        }
        state = { ...state, providerQuoteId: tx.id };
        awaitingApproval = tx.phase === "quoted" ? tx.id : undefined;
        turn = { ...asTurn(tx.phase === "approved" ? paymentReply(resultLanguage) : quoteReply(tx.quote.pricing.totalPaise, resultLanguage), "selected"), providerTransaction: tx };
      } else {
        if (task?.selectedId !== dialogue.task?.selectedId) state = { ...state, providerQuoteId: undefined };
        turn = asTurn(priceLine(relevant, resultLanguage), "selected");
      }
    }
  } else if (!canDiscover({ ...plan, action })) {
    failure = action === "clarify" ? "AMBIGUOUS_REQUEST" : "UNSUPPORTED_CATEGORY";
    turn = asTurn((!badBudget && !contradictory ? plan.answer : undefined) ?? (plan.intent === "other" ? help[resultLanguage] : clarification(resultLanguage)), "clarification");
  } else {
    const isNew = freshTask(plan, current, input.text);
    transition = !task || isNew ? "switch" : action === "correct" ? "correct" : action === "refine" ? "refine" : "keep";
    const base = isNew ? {} : current;
    const safePatch = { ...plan.patch };
    if (capPaise !== undefined && capPaise > 0 && capPaise <= 10_000_000) {
      safePatch.budgetPaise = capPaise;
      if (/\b(?:under|below|less than)\b/iu.test(input.text)) safePatch.budgetExclusive = true;
      if (/\bup to\b/iu.test(input.text)) safePatch.budgetExclusive = false;
    }
    if (!/\b(?:remove|forget|drop|ignore|no longer|without|any budget|any price)\b|हटा|मत|తొలగి/iu.test(input.text)) delete safePatch.clear;
    let next = canonicalIntent(applyFoodIntent(base, safePatch));
    if (next.dish && plan.intent === "food_order" && (!next.commerce || next.commerce.category === "food")) {
      next = { ...next, commerce: { ...next.commerce, category: "food", product: next.dish } };
    }
    const repeatLookup = !isNew && task && sameIntent(next, current) && facts(task).length > 0 && offersStillValid(task);
    if (repeatLookup) {
      const saved = task!.turn;
      turn = asTurn(saved.replyLanguage === resultLanguage || !relevant ? saved.reply : priceLine(relevant, resultLanguage), saved.status);
    }
    else {
      if (task && (isNew || facts(task).length > 0)) previous = [task, ...previous].slice(0, 3);
      const planned = { ...plan, patch: {}, action: action === "choose_cheapest" ? "choose_cheapest" : "search" } as const;
      const explicitSpice = next.commerce?.category === "food" && next.commerce.attributes?.spicy !== undefined;
      const savedRegion = session.profile?.region;
      const nextInput: InterpretationInput = { ...input, current: next, location: input.location ?? session.profile?.location ??
        (savedRegion ? { source: "manual", cityId: savedRegion } : undefined), voiceLanguage: resultLanguage };
      let found: FoodTurn | undefined;
      if (plan.intent === "food_order" && !explicitSpice) {
        tools.add("provider_discovery");
        searchAttempted = Boolean(next.dish && (nextInput.location || next.city || next.neighborhood));
        found = await (services.search ?? runFoodTurn)(nextInput, model, planned, services.signal, (stage, ms) => {
          timings[stage] = Math.max(timings[stage], ms);
          if (stage === "catalog") providerCalls++;
        });
      }
      const fallback = !found || (found.status === "no_match" && next.commerce && !next.providerPreference?.mode);
      if (fallback && services.persisted) {
        const cityId = nextInput.location?.source === "manual" ? nextInput.location.cityId : undefined;
        tools.add("sandbox_discovery");
        searchAttempted ||= Boolean(serviceRegion(next, session, cityId));
        const discovered = discoverCommerce(session, next, planned, resultLanguage, model, cityId);
        if (!serviceRegion(next, session, cityId)) failure = "LOCATION_REQUIRED";
        if (!found || discovered.state.offers.length) {
          services.signal.throwIfAborted();
          try {
            await persistListings(discovered.state.offers);
            state = { ...state, offers: discovered.state.offers };
            found = discovered.turn;
            failure = discovered.turn.searchFailure;
          } catch {
            services.signal.throwIfAborted();
            failure = "DYNAMIC_SANDBOX_GENERATION_ERROR";
            found = { ...asTurn(sandboxFailure(resultLanguage), "provider_error"), constraints: next, comparison: undefined, sandbox: undefined, keepSelection: false };
            state = { ...state, offers: [] };
          }
        }
      }
      if (!found) throw new MarketplaceError("TRANSACTION_STORAGE_UNAVAILABLE", 503);
      if (found.intent === "food_order") state = { ...state, offers: [] };
      state = { ...state, current: next, quote: undefined, providerQuoteId: undefined };
      if (found.status === "no_match" && found.comparison?.result.kind === "offers") {
        const reasons = found.comparison.result.excluded.map(({ code }) => code);
        failure = reasons.includes("OVER_BUDGET") ? "FILTERED_BY_BUDGET" :
          reasons.includes("OUTSIDE_SEARCH_RADIUS") ? "FILTERED_BY_DISTANCE" :
          reasons.some((code) => code === "DIETARY_UNVERIFIED" || code === "ALLERGEN_EXCLUDED") ? "FILTERED_BY_DIET" :
          reasons.includes("BELOW_MINIMUM_RATING") ? "FILTERED_BY_RATING" : "NO_PRODUCT_MATCH";
        const diagnostic = searchRepair(reasons, resultLanguage);
        if (diagnostic) found = { ...found, reply: diagnostic };
      }
      const previousSelection = referenced(task, "selected");
      const oldItem = previousSelection && task?.turn.comparison?.result.kind === "offers" ?
        task.turn.comparison.result.offers.find(({ quote }) => quote.id === previousSelection.id)?.item : undefined;
      if (!isNew && task?.selectedId && safePatch.quantity) {
        const updated = found.comparison?.result.kind === "offers" && oldItem ?
          found.comparison.result.offers.find(({ item }) => item.id === oldItem.id && item.provider.id === oldItem.provider.id && item.restaurant.branchId === oldItem.restaurant.branchId)?.quote.id :
          found.sandbox?.offers.find(({ listing }) => listing.id === task?.selectedId)?.listing.id;
        if (updated) found = { ...found, selectedOfferId: updated };
      }
      if (!failure) {
        if (found.status === "provider_error" || found.status === "incomplete") failure = "PROVIDER_ERROR";
        else if (found.status === "clarification") failure = !nextInput.location && !next.city ? "LOCATION_REQUIRED" : "AMBIGUOUS_REQUEST";
        else if (found.status === "no_match") failure = next.commerce?.unsupportedRequirements ? "UNSUPPORTED_CATEGORY" : "NO_PRODUCT_MATCH";
      }
      const snapshot = found.sandbox ? { ...found, sandbox: { offers: found.sandbox.offers, orders: [] } } : found;
      task = { id: !isNew && task ? task.id : randomUUID(), turn: snapshot, domain: taskDomain(next), selectedId: found.selectedOfferId ?? found.selectedQuoteId };
      const summary = facts(task).length >= 3 && !task.selectedId ? offerSummary(task, resultLanguage) : undefined;
      if (summary) task = { ...task, turn: { ...task.turn, reply: summary } };
      turn = summary ? { ...found, reply: summary, speechTicket: undefined } : found;
    }
  }
  if (awaitingApproval && awaitingApproval !== (state.quote?.id ?? state.providerQuoteId)) awaitingApproval = undefined;
  if (["answer", "advice", "help", "greeting", "clarification_answer", "explain", "compare", "clarify", "stop_speech", "pause"].includes(action)) awaitingApproval = undefined;
  const responseView = tools.has("prepare_quote") || tools.has("verify_approval") || (action === "prepare" && state.quote) ? "checkout" :
    canDiscover({ ...plan, action }) || ["select", "redisplay", "compare", "summarize", "recommend", "back"].includes(action) ? "comparison" : "conversation";
  const result: FoodTurn = { ...turn, replyLanguage: resultLanguage, dialogueAction: action, domain, transition, searchFailure: failure, responseView, taskId: task?.id,
    ...(task?.turn.sandbox || turn.sandbox ? { sandbox: { offers: state.offers, quote: state.quote, orders: state.orders } } : {}),
    speechTicket: turn.voiceControl ? undefined : turn.speechTicket ?? issueSpeechTicket(turn.reply, resultLanguage) };
  const last = action === "stop" ? undefined : action === "repeat" || result.voiceControl ? dialogue.last : { text: result.reply, language: resultLanguage, ticket: result.speechTicket };
  result.trace = { turnId: services.requestId, reasoning: interpreted.source ?? "gemini_plan", tools: [...tools], searchAttempted, speechAvailable: Boolean(result.speechTicket), totalMs: Math.round(performance.now() - started) };
  const offerReply = transition === "end" ? undefined : result.keepSelection ? dialogue.offerReply : { text: result.reply, language: resultLanguage };
  if (process.env.NODE_ENV === "development" && process.env.JUGAAD_DEBUG_DIALOGUE === "1") {
    console.debug("jugaad_dialogue", { turnId: services.requestId, hadTask: Boolean(session.dialogue?.task),
      pendingType: pending?.type ?? (dialogue.awaitingApproval ? "quote" : undefined), pendingId: pending?.id ?? dialogue.awaitingApproval,
      action, transition, tools: [...tools], nextPendingType: confirmation?.type, hasTask: Boolean(task) });
  }
  return { result, state: { ...state, dialogue: { task, previous, last, offerReply, awaitingApproval, confirmation, lastLanguage: resultLanguage,
    recommendation: transition !== "switch" && facts(task).some(({ id }) => id === recommendation?.id) ? recommendation : undefined,
    history: transition === "end" ? [] : [...(transition === "switch" ? [] : dialogue.history ?? []),
      { user: input.text.slice(0, 240), reply: result.reply.slice(0, 550) }].slice(-4),
    topic: transition === "end" ? undefined : plan.topic ?? (transition === "switch" ? task?.turn.constraints.commerce?.product ?? task?.turn.constraints.dish : dialogue.topic),
    clarification: result.status === "clarification" ? result.reply : undefined,
    recentTurns: transition === "end" ? [] : ["switch", "pause", "resume"].includes(transition) ? [input.text.slice(0, 180)] : [...(dialogue.recentTurns ?? []), input.text.slice(0, 180)].slice(-3) } }, timing: { reasonMs, executionMs: performance.now() - executionStart, providerCalls, ...timings } };
}

function sandboxFailure(language: VoiceLocale) {
  return {
    "en-IN": "The simulated marketplace couldn’t save those options. Try again in a moment.",
    "hi-IN": "डेमो बाज़ार ये विकल्प सहेज नहीं पाया। थोड़ी देर में फिर कोशिश करें।",
    "hi-en": "Demo marketplace options save nahi kar paya. Thodi der mein phir try karein.",
    "te-IN": "డెమో మార్కెట్ ఎంపికలను సేవ్ చేయలేకపోయింది. కాసేపటికి మళ్లీ ప్రయత్నించండి.",
  }[language];
}

function clarification(language: VoiceLocale) {
  return {
    "en-IN": "I didn’t catch the exact requirement. Could you confirm it before I change the search?",
    "hi-IN": "ज़रूरत साफ़ नहीं हुई। खोज बदलने से पहले क्या आप पुष्टि करेंगे?",
    "hi-en": "Requirement clear nahi hui. Search change karne se pehle confirm karenge?",
    "te-IN": "అవసరం స్పష్టంగా వినిపించలేదు. శోధన మార్చే ముందు నిర్ధారిస్తారా?",
  }[language];
}

function searchRepair(codes: string[], language: VoiceLocale) {
  if (codes.includes("OVER_BUDGET")) return {
    "en-IN": "I found the product, but the full totals exceeded your budget. Would you like to raise it or compare a similar item?",
    "hi-IN": "सामान मिला, लेकिन पूरी कीमत बजट से ज़्यादा है। बजट बढ़ाएँ या मिलता-जुलता विकल्प देखें?",
    "hi-en": "Product mila, lekin total budget se zyada hai. Budget badhayein ya similar option dekhein?",
    "te-IN": "వస్తువు దొరికింది, కానీ మొత్తం ధర బడ్జెట్ దాటింది. బడ్జెట్ పెంచాలా లేదా ఇలాంటి ఎంపిక చూడాలా?",
  }[language];
  if (codes.includes("OUTSIDE_SEARCH_RADIUS")) return {
    "en-IN": "I found a match outside your distance limit. Would you like to widen the search area?",
    "hi-IN": "एक विकल्प दूरी की सीमा के बाहर मिला। क्या खोज का इलाका बढ़ाएँ?",
    "hi-en": "Ek match distance limit ke bahar mila. Search area badhayein?",
    "te-IN": "దూర పరిమితికి బయట ఒక ఎంపిక దొరికింది. శోధన పరిధి పెంచాలా?",
  }[language];
  if (codes.includes("DIETARY_UNVERIFIED") || codes.includes("ALLERGEN_EXCLUDED")) return {
    "en-IN": "I couldn’t verify a match for your dietary or allergen requirement. Would you like to try another product?",
    "hi-IN": "खाने या एलर्जी की शर्त के लिए कोई सत्यापित विकल्प नहीं मिला। कोई दूसरा सामान देखें?",
    "hi-en": "Diet ya allergy ke liye verified option nahi mila. Koi doosra product dekhein?",
    "te-IN": "ఆహార లేదా అలర్జీ అవసరానికి సరిపోయే ఎంపిక నిర్ధారించలేకపోయాను. మరో వస్తువు చూడాలా?",
  }[language];
  if (codes.includes("BELOW_MINIMUM_RATING") && language === "en-IN") return "The matches I checked were below your rating threshold. Would you like to adjust it?";
}

function offersStillValid(task: Task) {
  const result = task.turn.comparison?.result;
  return result?.kind !== "offers" || result.offers.every(({ quote }) => Date.parse(quote.expiresAt) > Date.now());
}

function totalReply(total: number, language: VoiceLocale) {
  const price = spokenPrice(total, language);
  return {
    "en-IN": `The saved quote total is ${price}.`,
    "hi-IN": `सहेजे गए कोट की कुल कीमत ${price} है।`,
    "hi-en": `Saved quote ka total ${price} hai.`,
    "te-IN": `సేవ్ చేసిన కోట్ మొత్తం ${price}.`,
  }[language];
}

function quoteReply(total: number, language: VoiceLocale) {
  const price = spokenPrice(total, language);
  return {
    "en-IN": `Your current total is ${price}. Do you approve that amount?`,
    "hi-IN": `अभी कुल ${price} है। क्या आप इस रकम को मंज़ूरी देते हैं?`,
    "hi-en": `Current total ${price} hai. Kya aap approve karenge?`,
    "te-IN": `ప్రస్తుత మొత్తం ${price}. ఈ మొత్తాన్ని ఆమోదిస్తారా?`,
  }[language];
}
function paymentAuthorization(total: number, language: VoiceLocale) {
  const amount = spokenPrice(total, language);
  return {
    "en-IN": `The total is ${amount}. Should I authorize this simulated payment? No money will be charged.`,
    "hi-IN": `कुल ${amount} है। क्या मैं यह डेमो भुगतान करूँ? असली पैसे नहीं कटेंगे।`,
    "hi-en": `Total ${amount} hai. Kya main demo payment authorize karoon? Real paise nahi katenge.`,
    "te-IN": `మొత్తం ${amount}. ఈ డెమో చెల్లింపు చేయాలా? నిజమైన డబ్బు తీసుకోము.`,
  }[language];
}

function paymentReply(language: VoiceLocale) {
  return {
    "en-IN": "The quote is approved. Enter the demo code to confirm the simulated payment.",
    "hi-IN": "रकम मंज़ूर है। डेमो भुगतान की पुष्टि के लिए डेमो कोड डालें।",
    "hi-en": "Amount approve ho gaya. Demo payment ke liye demo code daalein.",
    "te-IN": "మొత్తం ఆమోదించారు. డెమో చెల్లింపు కోసం డెమో కోడ్ నమోదు చేయండి.",
  }[language];
}
