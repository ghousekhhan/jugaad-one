"use client";

import { playSound } from "@/lib/sound/engine";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { CategoryIcon } from "./category-icon";
import { postJson, requestJson } from "@/lib/client-request";
import type { ConversationSearch } from "@/lib/integrations/food-intent";
import { formatPaise, marketplaceImage, searchInputSchema, type FoodLocation, type FoodSearch, type FoodSearchResult, type QuotedOffer } from "@/lib/marketplace/discovery-types";
import { foodProviderNames, type FoodProviderId, type MarketplaceQuote, type MarketplaceResult, type MarketplaceReviews } from "@/lib/marketplace/schemas";

export type FoodFilters = { mode: "dish" | "restaurant"; query: string; cuisine: string; dietary: string; allergens: string; minRating: string };
export const emptyFoodFilters: FoodFilters = { mode: "dish", query: "", cuisine: "", dietary: "", allergens: "", minRating: "" };
export type SelectedFoodOffer = { offer: QuotedOffer; search: FoodSearch };

type Props = {
  filters: FoodFilters;
  onFilters: (filters: FoodFilters) => void;
  location: FoodLocation | null;
  budget: string;
  radius: string;
  priority: string;
  conversationComparison?: ConversationSearch;
  showFilters?: boolean;
  onSelect: (offer: SelectedFoodOffer | null) => void;
};

type SearchContext = { key: string; comparison?: ConversationSearch };
type SearchState = { kind: "idle" } | (SearchContext & ({ kind: "loading" } | { kind: "error"; message: string } | { kind: "result"; input: FoodSearch; result: FoodSearchResult }));

const exclusionMessages: Record<string, string> = {
  OVER_BUDGET: "Final total exceeds your budget", OUTSIDE_SEARCH_RADIUS: "Outside your search radius", OUTSIDE_DELIVERY_AREA: "Outside the provider’s delivery area",
  MINIMUM_ORDER_NOT_MET: "Below the provider’s order minimum", RESTAURANT_UNAVAILABLE: "Restaurant is unavailable", ITEM_UNAVAILABLE: "Item is unavailable",
  OVER_DELIVERY_ESTIMATE: "Delivery estimate exceeds your time limit",
};

export function QuoteFees({ quote }: { quote: MarketplaceQuote }) {
  const price = quote.pricing;
  return <dl className="checkout-preview__fees marketplace-fees">
    <div><dt>Items</dt><dd>{formatPaise(price.subtotalPaise)}</dd></div>
    <div><dt>Delivery</dt><dd>{formatPaise(price.deliveryFeePaise)}</dd></div>
    <div><dt>Packaging</dt><dd>{formatPaise(price.packagingFeePaise)}</dd></div>
    <div><dt>Platform fee</dt><dd>{formatPaise(price.platformFeePaise)}</dd></div>
    <div><dt>Tax</dt><dd>{formatPaise(price.taxPaise)}</dd></div>
    {price.discountPaise > 0 && <div><dt>Discount</dt><dd>−{formatPaise(price.discountPaise)}</dd></div>}
    <div><dt>Final total</dt><dd>{formatPaise(price.totalPaise)}</dd></div>
  </dl>;
}

function ReviewSummary({ provider, branchId }: { provider: FoodProviderId; branchId: string }) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<MarketplaceReviews>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (reviews || loading) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ provider, branchId });
      const { data } = await requestJson<MarketplaceResult<MarketplaceReviews>>(`/api/marketplace/reviews?${query}`, { signal: controller.signal });
      if (!controller.signal.aborted) setReviews(data);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Reviews are unavailable.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <div>
    <Button variant="quiet" onClick={toggle} aria-expanded={open}>{open ? "Hide simulated reviews" : "Read simulated reviews"}</Button>
    {open && <div className="marketplace-reviews">
      {loading && <p role="status">Loading simulated reviews…</p>}
      {error && <p className="field-error" role="alert">{error} Close and reopen to retry.</p>}
      {reviews && <>
        <p><strong>{reviews.summary.rating.value.toFixed(1)} / 5</strong> from {reviews.summary.rating.count} simulated ratings. {reviews.total} fictional written reviews.</p>
        {reviews.reviews.length > 0 && <ul>{reviews.reviews.map((review) => <li key={review.id}><strong>{review.rating} / 5</strong> <span>{review.comment}</span></li>)}</ul>}
      </>}
    </div>}
  </div>;
}

function FoodOffer({ offer, onSelect, featured = false }: { offer: QuotedOffer; onSelect: () => void; featured?: boolean }) {
  const { item, quote } = offer;
  return <li className="marketplace-result offer-card">
    <button className="approved-offer-select" type="button" onClick={onSelect} aria-label={`Review ${item.name} from ${item.restaurant.name} on ${item.provider.name}`}>
      <span className="offer-visual approved-provider-image"><Image src={marketplaceImage(item.image.url)} alt={item.image.alt} width={400} height={180} sizes="(max-width: 760px) 90vw, 30vw" /></span>
      <span className="offer-provider">{featured ? `Best from ${item.provider.name}` : item.provider.name} / {item.restaurant.name}</span>
      <span className="offer-name">{item.name}</span>
      <span className="offer-price-line"><strong className="offer-price">{formatPaise(quote.pricing.totalPaise)}</strong><span className="offer-eta">{quote.etaMinutes.min}–{quote.etaMinutes.max} min ↗</span></span>
    </button>
    <p className="meta">{quote.lineItems[0].quantity} × · {quote.distanceKm} km · {item.restaurant.rating.value.toFixed(1)} / 5 simulated rating</p>
    {item.customization.length > 0 && <p className="meta">Options: {item.customization.map(({ name }) => name).join(", ")}</p>}
    <details><summary>Price breakdown</summary><QuoteFees quote={quote} /></details>
    <ReviewSummary provider={item.provider.id} branchId={item.restaurant.branchId} />
  </li>;
}

export function FoodDiscovery({ filters, onFilters, location, budget, radius, priority, conversationComparison, showFilters = true, onSelect }: Props) {
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const request = useRef<AbortController | null>(null);
  const key = JSON.stringify([filters, location, budget, radius, priority]);
  const local = state.kind !== "idle" && state.key === key && state.comparison === conversationComparison ? state : null;
  const visible = local ?? (conversationComparison ? { kind: "result" as const, ...conversationComparison } : null);
  const offers = visible?.kind === "result" && visible.result.kind === "offers" ? visible.result.offers : [];
  const featured = offers.filter((offer, index) => offers.findIndex(({ item }) => item.provider.id === offer.item.provider.id) === index);
  const additional = offers.filter((offer) => !featured.includes(offer));
  useEffect(() => () => request.current?.abort(), [key]);

  async function runSearch(mode: FoodSearch["mode"] = filters.mode, branchId?: string, page = 0, previous?: FoodSearch) {
    request.current?.abort();
    onSelect(null);
    const context = { key, comparison: conversationComparison };
    const input = searchInputSchema.safeParse(previous ? { ...previous, mode, branchId, page } : {
      mode, query: mode === "menu" ? "" : filters.query, branchId, location,
      radiusKm: radius ? Number(radius) : 5,
      budgetPaise: budget ? (/^\d+(?:\.\d{1,2})?$/.test(budget.trim()) ? Math.round(Number(budget) * 100) : NaN) : undefined,
      cuisine: filters.cuisine || undefined, dietary: filters.dietary || undefined,
      allergens: filters.allergens ? filters.allergens.split(",").map((value) => value.trim()).filter(Boolean) : undefined,
      minRating: filters.minRating ? Number(filters.minRating) : undefined, priority: priority || undefined, page,
    });
    if (!input.success) {
      const field = input.error.issues[0].path[0];
      const message = !location ? "Choose a food delivery location before searching."
        : field === "budgetPaise" ? "Enter a budget between ₹0.01 and ₹100,000."
        : field === "radiusKm" ? "Enter a search radius above 0 and up to 50 km."
        : field === "minRating" ? "Enter a minimum rating between 1 and 5."
        : field === "allergens" ? "Enter up to five short allergen names separated by commas."
        : "Enter a dish or restaurant name of up to 120 characters.";
      setState({ kind: "error", ...context, message });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setState({ kind: "loading", ...context });
    try {
      const result = await postJson<FoodSearchResult>("/api/marketplace/search", input.data, controller.signal);
      if (!controller.signal.aborted) {
        setState({ kind: "result", ...context, result, input: input.data });
        if (result.kind === "offers" ? result.offers.length : result.restaurants.length) void playSound("search.results");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        void playSound("action.error");
        setState({ kind: "error", ...context, message: error instanceof Error ? error.message : "Food search is unavailable." });
      }
    }
  }

  return <div className="food-discovery">
    {showFilters && <>
    <p className="workspace-help">Search Wiggy and Tomato’s fictional catalogs. Dish comparisons use provider quotes with fees and taxes.</p>
    <div className="workspace-field">
      <label htmlFor="food-mode">Search by</label>
      <select id="food-mode" value={filters.mode} onChange={(event) => onFilters({ ...filters, mode: event.target.value === "restaurant" ? "restaurant" : "dish" })}><option value="dish">Dish name</option><option value="restaurant">Restaurant name</option></select>
    </div>
    <div className="workspace-field">
      <label htmlFor="food-query">{filters.mode === "dish" ? "Dish name" : "Restaurant name"}</label>
      <input id="food-query" maxLength={120} value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void runSearch(); } }} placeholder={filters.mode === "dish" ? "e.g. Chicken Dum Biryani" : "e.g. Mirchi Moon"} />
    </div>
    <details className="marketplace-filter-details">
      <summary>Food filters</summary>
      <div className="workspace-field"><label htmlFor="food-cuisine">Cuisine</label><input id="food-cuisine" maxLength={60} value={filters.cuisine} onChange={(event) => onFilters({ ...filters, cuisine: event.target.value })} placeholder="e.g. Biryani" /></div>
      <div className="workspace-field"><label htmlFor="food-dietary">Dietary preference</label><select id="food-dietary" value={filters.dietary} onChange={(event) => onFilters({ ...filters, dietary: event.target.value })}><option value="">Any</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="gluten-free">Gluten-free</option><option value="halal">Halal</option></select></div>
      <div className="workspace-field"><label htmlFor="food-allergens">Exclude allergens</label><input id="food-allergens" maxLength={120} value={filters.allergens} onChange={(event) => onFilters({ ...filters, allergens: event.target.value })} placeholder="e.g. dairy, gluten" /></div>
      <p className="workspace-help">Allergen tags describe fictional recipes.</p>
      <div className="workspace-field"><label htmlFor="food-rating">Minimum simulated rating (1–5)</label><input id="food-rating" type="number" min="1" max="5" step="0.1" value={filters.minRating} onChange={(event) => onFilters({ ...filters, minRating: event.target.value })} /></div>
    </details>
    <Button onClick={() => void runSearch()} disabled={visible?.kind === "loading"}>{visible?.kind === "loading" ? "Checking both providers…" : "Search food providers"}</Button>
    </>}
    {visible?.kind === "error" && <p className="field-error marketplace-feedback" role="alert">{visible.message}</p>}
    {visible?.kind === "loading" && <p className="workspace-help" role="status">Loading catalogs and provider totals…</p>}
    {!visible && <div className="comparison-empty marketplace-feedback"><CategoryIcon kind="food" /><h3>No offers yet</h3><p>Set a delivery location and search for a dish or restaurant.</p></div>}
    {visible?.kind === "result" && <div className="marketplace-feedback" aria-live="polite">
      {!local && conversationComparison && <p className="meta">Latest conversation search</p>}
      {visible.result.issues.length > 0 && <p className="field-error">Some results could not be checked for {[...new Set(visible.result.issues.map(({ provider }) => foodProviderNames[provider]))].join(" and ")}. Try again to complete the comparison.</p>}
      {visible.result.kind === "restaurants" ? <>
        <h3>{visible.result.restaurants.length ? "Matching restaurants" : "No restaurants found"}</h3>
        <p className="workspace-help">Open a branch’s menu to check items and exact totals.</p>
        <ul className="marketplace-results">{visible.result.restaurants.map((restaurant) => <li className="marketplace-result" key={restaurant.id}>
          <div className="marketplace-result-heading"><Image src={marketplaceImage(restaurant.bannerImage)} alt="" width={72} height={72} sizes="72px" /><div><h4>{restaurant.branch.name}</h4><p className="meta">{restaurant.provider.name} · {restaurant.brand.cuisine}</p><p className="meta">{restaurant.distanceKm} km · {restaurant.rating.value.toFixed(1)} / 5 simulated rating</p></div></div>
          <div className="marketplace-actions"><Button variant="secondary" onClick={() => void runSearch("menu", restaurant.branch.id)}>View menu</Button><ReviewSummary provider={restaurant.provider.id} branchId={restaurant.branch.id} /></div>
        </li>)}</ul>
      </> : <>
        <h3>{visible.result.offers.length ? "Quoted offers" : "No eligible quotes on this page"}</h3>
        <p className="workspace-help">The totals include required options, fees and tax.</p>
        {!visible.result.offers.length && visible.input.location.source === "gps" && <p className="workspace-help">If you’re outside the service area, try selecting one of the supported cities manually.</p>}
        {featured.length === 1 && visible.input.providerPreference?.mode !== "only" && visible.input.mode === "dish" &&
          <p className="workspace-help">Only {featured[0].item.provider.name} has an eligible quote among the offers checked.</p>}
        <ul className="marketplace-results provider-comparison">{featured.map((offer) =>
          <FoodOffer offer={offer} featured onSelect={() => onSelect({ offer, search: visible.input })} key={offer.quote.id} />,
        )}</ul>
        {additional.length > 0 && <details><summary>More eligible offers</summary><ul className="marketplace-results">
          {additional.map((offer) => <FoodOffer offer={offer} onSelect={() => onSelect({ offer, search: visible.input })} key={offer.quote.id} />)}
        </ul></details>}
        {visible.result.excluded.length > 0 && <details><summary>Why offers were excluded</summary><ul className="marketplace-exclusions">{visible.result.excluded.map(({ provider, item, code }, index) => <li key={`${provider}-${item}-${index}`}>{foodProviderNames[provider]} · {item}: {exclusionMessages[code] ?? "Provider could not quote this offer"}.</li>)}</ul></details>}
      </>}
      <div className="marketplace-actions">
        {visible.input.page > 0 && <Button variant="quiet" onClick={() => void runSearch(visible.input.mode, visible.input.branchId, visible.input.page - 1, visible.input)}>Previous results</Button>}
        {visible.result.more && <Button variant="secondary" onClick={() => void runSearch(visible.input.mode, visible.input.branchId, visible.input.page + 1, visible.input)}>Next results</Button>}
      </div>
    </div>}
  </div>;
}
