import "server-only";

import { applyFoodIntent, type FoodIntent, type FoodTurn, type Interpretation } from "../integrations/food-intent";
import { createOffers } from "./catalog";
import { regionSchema, type Region } from "./types";
import type { Session } from "./session";
import type { SearchFailure } from "../dialogue/routing";
import type { VoiceLocale } from "../voice/types";
import { spokenPrice } from "../voice/replies";

export function serviceRegion(intent: FoodIntent, session: Session, cityId?: string): Region | undefined {
  const name = intent.city ?? cityId ?? session.profile?.region;
  const normalized = name?.toLowerCase().trim();
  const region = regionSchema.safeParse(normalized === "bangalore" ? "bengaluru" : normalized === "new delhi" ? "delhi" : normalized);
  return region.success ? region.data : undefined;
}

const noOffers = {
  "en-IN": "I couldn’t find an eligible option with those requirements. Which detail can we change?",
  "hi-IN": "इन शर्तों के साथ कोई विकल्प नहीं मिला। किस शर्त को बदलें?",
  "hi-en": "In requirements ke saath koi option nahi mila. Kaunsi requirement change karein?",
  "te-IN": "ఈ షరతులకు సరిపోయే ఎంపిక దొరకలేదు. ఏ షరతు మార్చాలి?",
};
const cityPrompt = {
  "en-IN": "Which demo city should I use? Hyderabad, Bengaluru, Mumbai or Delhi?",
  "hi-IN": "कौन सा डेमो शहर चुनें? हैदराबाद, बेंगलुरु, मुंबई या दिल्ली?",
  "hi-en": "Kaunsi demo city use karoon? Hyderabad, Bengaluru, Mumbai ya Delhi?",
  "te-IN": "ఏ డెమో నగరాన్ని ఎంచుకోవాలి? హైదరాబాద్, బెంగళూరు, ముంబై లేదా ఢిల్లీ?",
};

export function discoverCommerce(session: Session, current: FoodIntent, plan: Interpretation, language: VoiceLocale, model: string, cityId?: string): { turn: FoodTurn; state: Session } {
  const constraints = applyFoodIntent(current, plan.patch);
  const region = serviceRegion(constraints, session, cityId);
  const offers = region && plan.action !== "clarify" ? createOffers(constraints, region) : [];
  let searchFailure: SearchFailure | undefined;
  if (!region) searchFailure = "LOCATION_REQUIRED";
  else if (!offers.length) {
    if (constraints.commerce?.unsupportedRequirements || constraints.radiusKm !== undefined) searchFailure = "UNSUPPORTED_CATEGORY";
    else if (constraints.allergens?.length || (constraints.dietaryRestrictions?.length &&
      createOffers({ ...constraints, dietaryRestrictions: undefined }, region).length)) searchFailure = "FILTERED_BY_DIET";
    else if (constraints.budgetPaise !== undefined && createOffers({ ...constraints, budgetPaise: undefined }, region).length) searchFailure = "FILTERED_BY_BUDGET";
    else if (constraints.minRating !== undefined && createOffers({ ...constraints, minRating: undefined }, region).length) searchFailure = "FILTERED_BY_RATING";
    else searchFailure = "NO_PRODUCT_MATCH";
  }
  const budgetPrompt = {
    "en-IN": "The options I found are over your full budget. Would you like to adjust it or look at something similar?",
    "hi-IN": "मिले हुए विकल्प बजट से ऊपर हैं। बजट बदलें या मिलता-जुलता सामान देखें?",
    "hi-en": "Options budget se upar hain. Budget badhayein ya similar product dekhein?",
    "te-IN": "దొరికిన ఎంపికలు బడ్జెట్ కంటే ఎక్కువ. బడ్జెట్ మార్చాలా లేదా ఇలాంటి వస్తువు చూడాలా?",
  };
  const best = offers[0];
  const price = best && spokenPrice(best.totalPaise, language);
  const fastest = offers.reduce((best, offer) => best && best.listing.etaMinutes <= offer.listing.etaMinutes ? best : offer, offers[0]);
  const fastOption = offers.indexOf(fastest) + 1;
  const reply = !region ? cityPrompt[language] : !best ? (searchFailure === "FILTERED_BY_BUDGET" ? budgetPrompt : noOffers)[language] : ({
    "en-IN": `I found ${offers.length} options. The first is ${best.listing.name} from ${best.listing.seller} for ${price}. Option ${fastOption} is fastest at about ${fastest.listing.etaMinutes} minutes. Which option would you like?`,
    "hi-IN": `${offers.length} डेमो विकल्प मिले। पहला ${best.listing.name} है, कुल ${price}। विकल्प ${fastOption} सबसे तेज़ है, लगभग ${fastest.listing.etaMinutes} मिनट। कौन सा विकल्प चुनें?`,
    "hi-en": `${offers.length} demo options mile. Pehla ${best.listing.name} hai, total ${price}. Option ${fastOption} fastest hai, lagbhag ${fastest.listing.etaMinutes} minute. Kaunsa chahiye?`,
    "te-IN": `${offers.length} డెమో ఎంపికలు దొరికాయి. మొదటి ఎంపిక ${best.listing.name}, మొత్తం ${price}. వేగమైన డెలివరీ సుమారు ${fastest.listing.etaMinutes} నిమిషాలు. ఏది కావాలి?`,
  })[language];
  const state = { ...session, current: constraints, offers, quote: undefined };
  return { state, turn: { model, intent: "sandbox_order", constraints, reply, searchFailure, replyLanguage: language, status: best ? "results" : region ? "no_match" : "clarification", sandbox: { offers, orders: session.orders } } };
}

