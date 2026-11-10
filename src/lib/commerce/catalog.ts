import "server-only";

import { createHash } from "node:crypto";
import type { FoodIntent } from "../integrations/food-intent";
import { transactionStore } from "../marketplace/transaction-store";
import type { Listing, Offer, Region } from "./types";

const catalog = {
  clothing: [
    ["Two-piece suit", 219_900, /(?:(?:navy|black|interview|formal|two-piece) )*suits?/iu],
    ["Formal shoes", 89_900, /(?:(?:formal|dress|interview) )?shoes/iu],
    ["T-shirt", 39_900, /t[ -]?shirts?|tee\b/iu],
    ["Shirt", 49_900, /\bshirts?\b/iu],
    ["Kurta", 59_900, /kurt[ai]/iu],
    ["Jeans", 79_900, /jeans|denim pants/iu],
    ["Joggers", 54_900, /joggers|track pants/iu],
    ["Sweatshirt", 64_900, /sweatshirts?/iu],
    ["Casual dress", 69_900, /casual dress|summer dress/iu],
  ],
  groceries: [
    ["Basmati rice, 1 kg", 12_900, /rice|basmati/iu],
    ["Toor dal, 500 g", 8_900, /toor dal|arhar/iu],
    ["Bananas, 6 pieces", 5_900, /bananas?/iu],
    ["Whole wheat atta, 1 kg", 7_900, /atta|wheat flour/iu],
    ["Tomatoes, 500 g", 4_900, /tomatoes|tomato/iu],
    ["Plain curd, 400 g", 6_900, /curd|dahi|plain yogurt/iu],
    ["Rolled oats, 500 g", 12_900, /oats/iu],
    ["Masoor dal, 500 g", 8_500, /masoor|red lentils/iu],
    ["Potatoes, 1 kg", 6_500, /potatoes|aloo/iu],
  ],
  electronics: [
    ["USB-C charging cable", 24_900, /cable/iu],
    ["Wired earphones", 39_900, /(?:wired )?(?:earphones?|earbuds?|headphones?)/iu],
    ["Wireless mouse", 59_900, /mouse/iu],
    ["20 W USB-C adapter", 69_900, /adapter|charger|charging adapter/iu],
    ["Compact wired keyboard", 69_900, /wired keyboard/iu],
    ["Adjustable phone stand", 19_900, /(?:adjustable )?phone stand|mobile stand/iu],
    ["USB-C hub, four ports", 89_900, /usb[ -]?c hub/iu],
  ],
  household: [
    ["Microfibre cloths, pack of 3", 15_900, /cloths?|microfib/iu],
    ["Stainless steel water bottle, 750 ml", 39_900, /bottle/iu],
    ["Storage containers, pack of 3", 29_900, /containers?/iu],
    ["Dishwashing liquid, 500 ml", 9_900, /dishwash/iu],
    ["Laundry basket, 25 L", 39_900, /laundry basket/iu],
    ["Kitchen towels, pack of 2", 16_900, /kitchen towel/iu],
  ],
  accessories: [
    ["Canvas tote bag", 24_900, /tote/iu],
    ["Canvas cap", 19_900, /cap/iu],
    ["Card wallet", 29_900, /wallet/iu],
    ["Foldable umbrella", 34_900, /umbrella/iu],
    ["Travel pouch", 25_900, /travel pouch/iu],
  ],
  food: [
    ["Chicken shawarma", 13_900, /(?:chicken )?shawarma/iu, "non_vegetarian", true],
    ["Paneer makhani", 18_900, /paneer makhani|butter paneer/iu, "vegetarian", false],
    ["Chilli paneer", 17_900, /chilli paneer|spicy vegetarian|spicy veg|spicy food/iu, "vegetarian", true],
    ["Masala dosa", 12_900, /dosa|breakfast/iu, "vegetarian", true],
    ["Idli sambar", 9_900, /idli|breakfast/iu, "vegetarian", false],
    ["Chicken dum biryani", 20_900, /(?:chicken|murgh).*biryani|biryani.*chicken/iu, "non_vegetarian", true],
    ["Vegetable biryani", 16_900, /(?:veg|vegetable).*biryani|^biryani$/iu, "vegetarian", true],
    ["Chole rice bowl", 13_900, /chole|spicy vegetarian|spicy veg|spicy food/iu, "vegetarian", true],
    ["Rajma rice bowl", 15_900, /rajma|veg lunch/iu, "vegetarian", false],
    ["Mysore masala dosa", 16_900, /mysore dosa|mysore masala dosa/iu, "vegetarian", true],
    ["Poha", 8_900, /poha|breakfast/iu, "vegetarian", false],
    ["Veg Hakka noodles", 15_900, /(?:veg(?:etable)?(?: hakka)?)? ?noodles|hakka noodles/iu, "vegetarian", true],
    ["Chicken tikka roll", 18_900, /chicken tikka roll/iu, "non_vegetarian", true],
    ["Chocolate truffle cake", 24_900, /(?:chocolate (?:truffle )?)?cake|pastr(?:y|ies)/iu, "vegetarian", false],
    ["Walnut brownie", 12_900, /brownie/iu, "vegetarian", false],
    ["Classic sweet pie", 15_900, /(?:sweet )?pie|pudding/iu, "vegetarian", false],
    ["Gulab jamun, 2 pieces", 7_900, /gulab jamun|dessert|sweet/iu, "vegetarian", false],
    ["Mango lassi", 10_900, /(?:mango )?lassi/iu, "vegetarian", false],
  ],
} as const;

const sellers = ["Mirchi Moon", "Paper Kite Market", "Copper Lane Shop", "Sunday Parcel"] as const;
const colorSet = new Set(["black", "white", "blue", "navy", "red", "green", "grey", "gray", "beige", "brown", "pink", "yellow"]);
const clothingMaterials = new Set(["cotton", "linen", "denim", "polyester"]);
const fits = new Set(["oversized", "regular", "relaxed", "slim"]);
const sizes = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl"]);

export const foodModifiers = [
  {
    id: "toppings",
    name: "Toppings & Add-ons",
    options: [
      { id: "cheese", name: "Extra cheese", pricePaise: 3_000 },
      { id: "choco_chips", name: "Chocolate drizzle", pricePaise: 2_500 },
      { id: "ice_cream", name: "Vanilla ice cream scoop", pricePaise: 4_000 },
    ],
  },
];

export const totalFor = (listing: Listing, quantity: number, selectedModifiers?: { pricePaise: number }[]) => {
  const modTotal = selectedModifiers?.reduce((sum, mod) => sum + mod.pricePaise, 0) ?? 0;
  const itemTotal = (listing.pricePaise + modTotal);
  const tax = Math.round(itemTotal * 0.05);
  return (itemTotal + tax) * quantity + listing.deliveryPaise;
};

function listingId(key: string) {
  const digest = createHash("sha256").update(key).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

export function createOffers(intent: FoodIntent, region: Region): Offer[] {
  const request = intent.commerce;
  if (!request || request.unsupportedRequirements || intent.allergens?.length || intent.restaurant || intent.cuisine ||
      intent.radiusKm !== undefined || intent.providerPreference?.mode === "only") return [];
  const { category, product } = request;
  const wanted = Object.entries(request.attributes ?? {}).map(([key, value]) => [key, String(value).toLowerCase()] as const).sort();
  if (wanted.some(([key, value]) => key === "spicy" ? category !== "food" :
    category !== "clothing" || !({ color: colorSet, material: clothingMaterials, fit: fits, size: sizes } as Record<string, Set<string>>)[key]?.has(value))) return [];

  const quantity = intent.quantity ?? 1;
  const isSweetSearch = /^(?:something )?(?:sweet|dessert)s?$/iu.test(product);
  const browseFood = category === "food" && product.toLowerCase() === "food";
  const matching = catalog[category].filter(([name, , alias, diet, spicy]) =>
    (browseFood || (isSweetSearch ? /cake|brownie|pie|pudding|gulab jamun|dessert|sweet/iu.test(name) : alias.test(product))) &&
    (intent.dietaryRestrictions ?? []).every((restriction) => restriction === diet) &&
    (request.attributes?.spicy === undefined || spicy === request.attributes.spicy));
  const templates = browseFood ? matching : matching.slice(0, category === "clothing" ? 1 : 2);
  const offers = templates.flatMap(([name, price, , diet, spicy]) => sellers.map((seller, index) => {
    const attributes: Record<string, string> = Object.fromEntries(wanted);
    if (category === "clothing") {
      attributes.material ??= name === "Jeans" ? "denim" : "cotton";
      attributes.fit ??= "regular";
      attributes.size ??= "m";
    }
    if (diet) attributes.diet = diet.replaceAll("_", " ");
    if (spicy !== undefined) attributes.spice = spicy ? "spicy" : "mild";
    attributes.finish = ["Standard", "Upgraded", "Premium", "Artisan"][index % 4];
    const pricePaise = price + (index % 3) * (category === "clothing" ? 7_000 : 2_500);
    const identity = JSON.stringify([1, category, name, region, seller, attributes]);
    const listing: Listing = {
      id: listingId(identity), name, category, seller, region, attributes,
      currency: "INR", available: true, origin: "jugaad_sandbox", rating: [4.8, 4.4, 4.2, 4.6][index % 4],
      etaMinutes: category === "food" ? [25, 45, 35, 30][index % 4] : [90, 180, 120, 150][index % 4],
      pricePaise, deliveryPaise: [2_900, 4_900, 3_900, 3_500][index % 4], taxPaise: Math.round(pricePaise * 0.05),
      modifiers: category === "food" ? foodModifiers : undefined,
      reviews: {
        rating: [4.8, 4.4, 4.2, 4.6][index % 4],
        count: [142, 98, 65, 87][index % 4],
        summary: "Customers praise the rich flavor, fresh texture and quick delivery.",
        positivePoints: ["Rich authentic taste", "Fresh ingredients", "Quick delivery"],
        complaints: ["Portion size is standard"],
      },
    };
    return { listing, quantity, totalPaise: totalFor(listing, quantity) };
  }));
  return offers.filter(({ listing, totalPaise }) =>
    (intent.budgetPaise === undefined || (intent.budgetExclusive ? totalPaise < intent.budgetPaise : totalPaise <= intent.budgetPaise)) &&
    (intent.minRating === undefined || (intent.ratingExclusive ? listing.rating > intent.minRating : listing.rating >= intent.minRating)) &&
    (intent.maxEtaMinutes === undefined || listing.etaMinutes <= intent.maxEtaMinutes))
    .sort((a, b) => intent.priority === "fastest" ? a.listing.etaMinutes - b.listing.etaMinutes :
      intent.qualityPriority && intent.priority !== "lowest-price" ? b.listing.rating - a.listing.rating || a.totalPaise - b.totalPaise : a.totalPaise - b.totalPaise)
    .filter((offer, index, ranked) => !browseFood || ranked.findIndex(({ listing }) => listing.name === offer.listing.name) === index)
    .slice(0, 3);
}


export async function persistListings(offers: Offer[]) {
  if (offers.length === 0) return;
  const store = await transactionStore();
  await Promise.all(offers.map(({ listing }) =>
    store.saveDocument(`listing:${listing.id}`, JSON.stringify(listing))));
}
