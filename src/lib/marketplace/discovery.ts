import "server-only";

import { getMarketplaceCities, MarketplaceError, marketplaceProvider } from "./provider";
import { foodProviders, type FoodProviderId, type MarketplaceMenuItem, type MarketplaceQuote, type QuoteInput } from "./schemas";
import type { FoodLocation, FoodSearch, FoodSearchResult, OfferExclusion, ProviderEvidence, ProviderIssue, QuotedOffer } from "./discovery-types";

const catalogPageSize = 16;
const quotesPerProvider = 2;
const maxCatalogItems = 100;
const quoteRejections = new Set(["ITEM_UNAVAILABLE", "RESTAURANT_UNAVAILABLE", "MINIMUM_ORDER_NOT_MET", "OUTSIDE_DELIVERY_AREA", "MENU_ITEM_NOT_FOUND"]);
const allergenAliases: Record<string, string> = { milk: "dairy", eggs: "egg", wheat: "gluten", cashew: "nuts", cashews: "nuts", almond: "nuts", almonds: "nuts", "tree nuts": "nuts", peanut: "peanuts" };
const catalogAllergens = new Set(["dairy", "egg", "gluten", "nuts", "peanuts", "sesame"]);

export function catalogExclusions(allergens: string[] = []) {
  const labels = [...new Set(allergens.map((name) => allergenAliases[name] ?? name))];
  if (labels.some((label) => !catalogAllergens.has(label))) throw new MarketplaceError("UNKNOWN_ALLERGEN_FILTER", 422);
  return labels;
}

export async function resolveFoodLocation(location: FoodLocation, signal?: AbortSignal) {
  if (location.source === "gps") return { coordinates: location.coordinates };
  const { data } = await getMarketplaceCities(signal);
  const city = data.cities.find(({ id }) => id === location.cityId);
  const neighborhood = city?.neighborhoods.find(({ id }) => id === location.neighborhoodId);
  if (!city || (location.neighborhoodId && !neighborhood)) throw new MarketplaceError("UNSUPPORTED_LOCATION", 400);
  return { coordinates: neighborhood?.coordinates ?? city.coordinates, city: city.id, neighborhoodId: neighborhood?.id };
}

export type ResolvedLocation = Awaited<ReturnType<typeof resolveFoodLocation>>;

const dishSynonyms: Record<string, string> = {
  biriyani: "biryani", biryaani: "biryani", biryanii: "biryani", biriani: "biryani",
  "బిర్యానీ": "biryani", "बिरयानी": "biryani",
  murgh: "chicken", murg: "chicken", "చికెన్": "chicken", "चिकन": "chicken",
  panir: "paneer", panner: "paneer", "పనీర్": "paneer", "पनीर": "paneer",
  dosai: "dosa", dhosa: "dosa", "దోశ": "dosa", "దోస": "dosa", "डोसा": "dosa",
  idly: "idli", "ఇడ్లీ": "idli", "इडली": "idli",
  chapati: "roti", chappati: "roti", chapathi: "roti", "రోటీ": "roti", "रोटी": "roti",
  nan: "naan", "నాన్": "naan", "नान": "naan",
  shwarma: "shawarma", "షవర్మా": "shawarma",
};

const optionalDescriptors = new Set(["dum", "hyderabadi", "hyderabad", "style", "wali", "special", "combo", "plate", "bowl", "best", "hot", "fresh"]);

function normalizeDishWord(word: string): string {
  const clean = word.toLowerCase().normalize("NFKC");
  return dishSynonyms[clean] ?? clean;
}

export function matchesDish(name: string, query: string) {
  const words = (text: string): string[] => text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const itemWords = words(name).map(normalizeDishWord);
  const queryWords = words(query).map(normalizeDishWord);
  if (queryWords.length === 0) return false;

  // 1. Direct word inclusion
  if (queryWords.every((word) => itemWords.includes(word))) return true;

  // 2. Inclusion after stripping optional descriptors (e.g. "dum", "hyderabadi")
  const essentialQueryWords = queryWords.filter((w) => !optionalDescriptors.has(w));
  if (essentialQueryWords.length > 0 && essentialQueryWords.every((w) => itemWords.includes(w))) {
    return true;
  }

  // 3. Single-word broad query (e.g. "biryani" matching any item with "biryani")
  if (queryWords.length === 1 && itemWords.includes(queryWords[0])) {
    return true;
  }

  return false;
}

function providerIssue(provider: FoodProviderId, error: unknown): ProviderIssue {
  return error instanceof MarketplaceError ? { provider, code: error.code, requestId: error.requestId } : { provider, code: "MARKETPLACE_UNREACHABLE" };
}

export function defaultQuoteOptions(item: MarketplaceMenuItem) {
  return item.customization.flatMap((group) => [...group.choices]
    .sort((a, b) => a.priceDeltaPaise - b.priceDeltaPaise)
    .slice(0, group.minSelect)
    .map((option) => ({ groupId: group.id, optionId: option.id })));
}

export function quoteRequestForItem(item: MarketplaceMenuItem, location: ResolvedLocation, selection?: Pick<QuoteInput["items"][number], "quantity" | "selectedOptions">): QuoteInput {
  return {
    branchId: item.restaurant.branchId,
    city: location.city ?? item.restaurant.city.id,
    neighborhoodId: location.neighborhoodId,
    coordinates: location.coordinates,
    items: [{ menuItemId: item.id, quantity: selection?.quantity ?? 1, selectedOptions: selection?.selectedOptions ?? defaultQuoteOptions(item) }],
  };
}

export function menuItemExclusion(item: MarketplaceMenuItem, input: FoodSearch): string | undefined {
  if (!item.availability.available || !item.availability.acceptingOrders) return "ITEM_UNAVAILABLE";
  if (item.distanceKm === null || item.distanceKm > input.radiusKm) return "OUTSIDE_SEARCH_RADIUS";
  if (input.minRating !== undefined && (item.restaurant.rating.value < input.minRating || (input.ratingExclusive && item.restaurant.rating.value === input.minRating))) return "BELOW_MINIMUM_RATING";
  if (input.restaurant && !matchesDish(item.restaurant.name, input.restaurant)) return "RESTAURANT_MISMATCH";
  const diets = input.dietaryRestrictions ?? (input.dietary ? [input.dietary] : []);
  if (diets.length && (item.dietary.status !== "verified" || !diets.every((diet) => item.dietary.values.includes(diet)))) return "DIETARY_UNVERIFIED";
  if (input.allergens?.length) {
    const exclusions = catalogExclusions(input.allergens);
    if (item.allergens.status !== "verified" || item.allergens.values.some((value) => exclusions.includes(value.toLowerCase()))) return "ALLERGEN_EXCLUDED";
  }
}

export function quoteExclusion(quote: MarketplaceQuote, input: FoodSearch): string | undefined {
  if (!quote.availability.acceptingOrders) return "RESTAURANT_UNAVAILABLE";
  if (quote.distanceKm === null || quote.distanceKm > input.radiusKm) return "OUTSIDE_SEARCH_RADIUS";
  const total = quote.pricing.totalPaise;
  if (input.budgetPaise !== undefined && (total > input.budgetPaise || (input.budgetExclusive && total === input.budgetPaise))) return "OVER_BUDGET";
  if (input.maxEtaMinutes !== undefined && quote.etaMinutes.max > input.maxEtaMinutes) return "OVER_DELIVERY_ESTIMATE";
}

export function queryFor(input: FoodSearch, location: ResolvedLocation) {
  return {
    city: location.city, lat: location.coordinates.latitude, lng: location.coordinates.longitude, radiusKm: input.radiusKm,
    q: input.mode === "menu" ? undefined : input.query,
    cuisine: input.cuisine || undefined, dietary: input.dietaryRestrictions?.[0] ?? input.dietary, minRating: input.minRating,
    availableOnly: true,
  };
}

export async function searchFood(input: FoodSearch, signal?: AbortSignal, timings?: (stage: "catalog" | "quotes", ms: number) => void, resolved?: ResolvedLocation): Promise<FoodSearchResult> {
  const excludedAllergens = catalogExclusions(input.allergens);
  const location = resolved ?? await resolveFoodLocation(input.location, signal);
  const query = queryFor(input, location);
  const providers = input.providerPreference?.mode === "only" ? [input.providerPreference.provider] : foodProviders;
  const evidence: ProviderEvidence[] = [];
  if (input.mode === "restaurant") {
    const pages = await Promise.allSettled(providers.map((id) => marketplaceProvider(id).searchRestaurants({
      ...query, limit: catalogPageSize, offset: input.page * catalogPageSize,
    }, signal)));
    const issues: ProviderIssue[] = [];
    const restaurants = pages.flatMap((page, index) => {
      const provider = providers[index];
      if (page.status === "fulfilled") {
        evidence.push({ provider, catalogRequestId: page.value.meta.requestId, quoteRequestIds: [] });
        return page.value.data.restaurants.filter(({ rating }) => !input.ratingExclusive || input.minRating === undefined || rating.value > input.minRating);
      }
      issues.push(providerIssue(provider, page.reason));
      return [];
    });
    const more = pages.some((page) => page.status === "fulfilled" && page.value.data.total > (input.page + 1) * catalogPageSize);
    return { kind: "restaurants", restaurants, issues, more, simulated: true, evidence };
  }

  const issues: ProviderIssue[] = [];
  const excluded: OfferExclusion[] = [];
  const pages = await Promise.allSettled(providers.map(async (provider) => {
    const adapter = marketplaceProvider(provider);
    const catalogStart = performance.now();
    const [menu, branch] = await Promise.all([
      adapter.searchMenuItems({ ...query, branchId: input.branchId, allergenFree: excludedAllergens.join(",") || undefined, limit: maxCatalogItems }, signal),
      input.mode === "menu" ? adapter.searchRestaurants({ ...query, branchId: input.branchId, limit: 1 }, signal) : undefined,
    ]);
    const { data } = menu;
    timings?.("catalog", performance.now() - catalogStart);
    const minimum = branch?.data.restaurants[0]?.pricing.minimumOrderPaise;
    const items = input.mode === "dish" ? data.menuItems.filter((item) => matchesDish(item.name, input.query)) : data.menuItems;
    const matching = items.filter((item) => {
      const exclusion = menuItemExclusion(item, input);
      if (exclusion) {
        if (input.page === 0) excluded.push({ provider, item: item.name, code: exclusion });
        return false;
      }
      const quantity = input.quantity ?? 1;
      if (minimum === undefined || item.pricePaise * quantity >= minimum) return true;
      const selected = defaultQuoteOptions(item);
      const optionTotal = item.customization.flatMap((group) => group.choices.filter((choice) => selected.some((option) => option.groupId === group.id && option.optionId === choice.id))).reduce((sum, choice) => sum + choice.priceDeltaPaise, 0);
      if ((item.pricePaise + optionTotal) * quantity >= minimum) return true;
      if (input.page === 0) excluded.push({ provider, item: item.name, code: "MINIMUM_ORDER_NOT_MET" });
      return false;
    }).sort((a, b) => input.priority === "lowest-price" ? a.pricePaise - b.pricePaise : b.restaurant.rating.value - a.restaurant.rating.value || a.pricePaise - b.pricePaise);
    const candidates = matching.slice(input.page * quotesPerProvider, (input.page + 1) * quotesPerProvider);
    const quoteRequestIds: string[] = [];
    const quoteStart = performance.now();
    const results = await Promise.allSettled(candidates.map(async (item) => ({ item, response: await adapter.createQuote(quoteRequestForItem(item, location, { quantity: input.quantity ?? 1 }), signal) })));
    timings?.("quotes", performance.now() - quoteStart);
    const offers = results.flatMap((result, index) => {
      if (result.status === "rejected") {
        const issue = providerIssue(provider, result.reason);
        if (quoteRejections.has(issue.code)) excluded.push({ provider, item: candidates[index].name, code: issue.code });
        else issues.push(issue);
        return [];
      }
      const { item, response: { data: quote, meta } } = result.value;
      quoteRequestIds.push(meta.requestId);
      const exclusion = quoteExclusion(quote, input);
      if (exclusion) excluded.push({ provider, item: item.name, code: exclusion });
      else return [{ item, quote } satisfies QuotedOffer];
      return [];
    });
    return { offers, more: matching.length > (input.page + 1) * quotesPerProvider, limited: data.total > maxCatalogItems, proof: { provider, catalogRequestId: menu.meta.requestId, quoteRequestIds } };
  }));
  const offers = pages.flatMap((page, index) => {
    if (page.status === "fulfilled") {
      evidence.push(page.value.proof);
      if (page.value.limited) issues.push({ provider: providers[index], code: "CATALOG_LIMIT" });
      return page.value.offers;
    }
    issues.push(providerIssue(providers[index], page.reason));
    return [];
  });
  offers.sort((a, b) => {
    const total = a.quote.pricing.totalPaise - b.quote.pricing.totalPaise;
    const rating = b.item.restaurant.rating.value - a.item.restaurant.rating.value;
    const preferred = input.providerPreference?.mode === "prefer" ? input.providerPreference.provider : undefined;
    const preference = Number(b.item.provider.id === preferred) - Number(a.item.provider.id === preferred);
    if (input.priority === "fastest") return a.quote.etaMinutes.max - b.quote.etaMinutes.max || preference || total || rating;
    if (input.priority === "lowest-price") return total || preference || rating;
    return preference || rating || total;
  });
  return { kind: "offers", offers, issues, excluded, more: input.page < 20 && pages.some((page) => page.status === "fulfilled" && page.value.more), simulated: true, evidence };
}
