import "server-only";

import { catalogExclusions, searchFood, type ResolvedLocation } from "../marketplace/discovery";
import { formatPaise, type FoodLocation, type FoodSearch, type FoodSearchResult } from "../marketplace/discovery-types";
import { enforceRateLimit } from "../marketplace/http";
import { getMarketplaceCities, MarketplaceError } from "../marketplace/provider";
import { foodProviderNames } from "../marketplace/schemas";
import { spokenPrice, voiceReplies } from "../voice/replies";
import { applyFoodIntent, type FoodIntent, type FoodTurn, type Interpretation, type InterpretationInput } from "./food-intent";

const providerDeliveryRadiusKm = 12;
const comparisonPages = 3;
const normalize = (value?: string) => value?.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{M}\p{N}]/gu, "");

const dishAliases = new Map([
  ["murgh biryani", "chicken biryani"],
  ["biryani chicken", "chicken biryani"],
  ["biryani paneer", "paneer biryani"],
  ["dum chicken biryani", "chicken dum biryani"],
  ["paneer makhani gravy", "paneer makhani"],
]);

type TurnLocation = NonNullable<FoodTurn["location"]>;

async function conversationLocation(constraints: FoodIntent, fallback: FoodLocation | undefined, signal: AbortSignal): Promise<{ location: TurnLocation; resolved: ResolvedLocation } | undefined> {
  if (!constraints.city && !constraints.neighborhood && fallback?.source === "gps") return { location: { selection: fallback, label: "Device location" }, resolved: { coordinates: fallback.coordinates } };
  if (!constraints.city && !constraints.neighborhood && !fallback) return undefined;
  const { data: { cities } } = await getMarketplaceCities(signal);
  const cityName = normalize(constraints.city);
  const neighborhoodName = normalize(constraints.neighborhood);
  const manual = fallback?.source === "manual" ? fallback : undefined;
  const matches = cities.flatMap((city) => {
    if (cityName && cityName !== normalize(city.id) && cityName !== normalize(city.name)) return [];
    if (!cityName && !neighborhoodName && city.id !== manual?.cityId) return [];
    const neighborhood = city.neighborhoods.find(({ id, name }) => neighborhoodName
      ? neighborhoodName === normalize(id) || neighborhoodName === normalize(name)
      : !cityName && id === manual?.neighborhoodId);
    if ((neighborhoodName || (!cityName && manual?.neighborhoodId)) && !neighborhood) return [];
    const selection: FoodLocation = neighborhood ? { source: "manual", cityId: city.id, neighborhoodId: neighborhood.id } : { source: "manual", cityId: city.id };
    return [{ location: { selection, label: neighborhood ? `${neighborhood.name}, ${city.name}` : `${city.name} city centre` },
      resolved: { coordinates: neighborhood?.coordinates ?? city.coordinates, city: city.id, neighborhoodId: neighborhood?.id } }];
  });
  return matches.length === 1 ? matches[0] : undefined;
}

type Offers = Extract<FoodSearchResult, { kind: "offers" }>;
type SearchTimings = Parameters<typeof searchFood>[2];
async function compare(input: FoodSearch, choose: boolean, signal: AbortSignal, resolved: ResolvedLocation, timings?: SearchTimings): Promise<Offers> {
  const aggregate: Offers = { kind: "offers", simulated: true, offers: [], issues: [], excluded: [], evidence: [], more: false };
  for (let page = 0; page < (choose ? comparisonPages : 1); page += 1) {
    enforceRateLimit("marketplace-search", 6);
    const result = await searchFood({ ...input, page }, signal, timings, resolved);
    if (result.kind !== "offers") throw new MarketplaceError("MARKETPLACE_UNREACHABLE", 502);
    aggregate.offers.push(...result.offers);
    aggregate.issues.push(...result.issues);
    aggregate.excluded.push(...result.excluded);
    aggregate.evidence?.push(...(result.evidence ?? []));
    aggregate.more = result.more;
    if (!result.more || result.issues.length) break;
  }
  if (choose) aggregate.offers.sort((a, b) => a.quote.pricing.totalPaise - b.quote.pricing.totalPaise);
  return aggregate;
}

export async function runFoodTurn(input: InterpretationInput, model: string, plan: Interpretation, signal: AbortSignal, timings?: SearchTimings): Promise<FoodTurn> {
  const replyLanguage = input.voiceLanguage ?? "en-IN";
  const copy = voiceReplies[replyLanguage];
  if (plan.intent !== "food_order") return { model, replyLanguage, intent: plan.intent, status: "unsupported", constraints: input.current, reply: copy.unsupported };
  let constraints: FoodIntent;
  try { constraints = applyFoodIntent(input.current, plan.patch); }
  catch { throw new MarketplaceError("GEMINI_INVALID_RESPONSE", 502); }
  const base = { model, replyLanguage, intent: plan.intent, constraints };
  if (!constraints.dish) return { ...base, status: "clarification", reply: copy.dish(constraints.restaurant) };
  if (plan.action === "clarify") return { ...base, status: "clarification", reply: copy.clarify };
  let location: TurnLocation | undefined;
  try {
    const destination = await conversationLocation(constraints, input.location, signal);
    if (!destination) return { ...base, status: "clarification", reply: copy.location(Boolean(constraints.city || constraints.neighborhood)) };
    location = destination.location;
    catalogExclusions(constraints.allergens);
    const choose = plan.action === "choose_cheapest";
    let search: FoodSearch = {
      mode: "dish", query: constraints.dish, restaurant: constraints.restaurant, location: location.selection, page: 0,
      radiusKm: constraints.radiusKm ?? providerDeliveryRadiusKm, budgetPaise: constraints.budgetPaise, budgetExclusive: constraints.budgetExclusive,
      quantity: constraints.quantity ?? 1, cuisine: constraints.cuisine, dietaryRestrictions: constraints.dietaryRestrictions,
      allergens: constraints.allergens, minRating: constraints.minRating, ratingExclusive: constraints.ratingExclusive,
      priority: choose ? "lowest-price" : constraints.priority, maxEtaMinutes: constraints.maxEtaMinutes, providerPreference: constraints.providerPreference,
    };
    let result = await compare(search, choose, signal, destination.resolved, timings);
    // An alias is a second catalog lookup, never a reason to relax eligibility.
    const alias = dishAliases.get(search.query.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "));
    if (alias && !result.offers.length && !result.excluded.length && !result.issues.length && !result.more) {
      search = { ...search, query: alias };
      const expanded = await compare(search, choose, signal, destination.resolved, timings);
      result = { ...expanded, evidence: [...(result.evidence ?? []), ...(expanded.evidence ?? [])] };
    }
    const found = { ...base, location, comparison: { input: search, result } };
    const count = result.offers.length;
    if (result.issues.length || result.more) {
      const providers = [...new Set(result.issues.map(({ provider }) => foodProviderNames[provider]))].join(" and ");
      return { ...found, status: "incomplete", reply: copy.incomplete(count, result.more, providers, choose) };
    }
    if (!count) return { ...found, status: "no_match", reply: copy.noMatch(constraints.dish, location.label) };
    const offer = result.offers[0];
    if (choose) {
      const total = input.voiceLanguage ? spokenPrice(offer.quote.pricing.totalPaise, replyLanguage) : formatPaise(offer.quote.pricing.totalPaise);
      return { ...found, status: "selected", selectedQuoteId: offer.quote.id, reply: copy.selected(offer.item.name, offer.item.restaurant.name, offer.item.provider.name, total) };
    }
    return { ...found, status: "results", reply: copy.results(count, constraints.dish, location.label) };
  } catch (error) {
    if (signal.aborted) throw error;
    if (!(error instanceof MarketplaceError)) throw error;
    if (error.code === "UNKNOWN_ALLERGEN_FILTER") return { ...base, location, status: "clarification", reply: copy.allergen };
    return { ...base, location, status: "provider_error", reply: copy.provider(error.status === 429) };
  }
}
