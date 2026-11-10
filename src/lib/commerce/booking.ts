import "server-only";

import { randomUUID } from "node:crypto";
import { MarketplaceError } from "../marketplace/provider";
import { spokenPrice } from "../voice/replies";
import type { VoiceLocale } from "../voice/types";
import { readSession, updateSession } from "./session";
import { totalFor } from "./catalog";
import { appliedWelcomeDiscount, demoCode, trackingStage, type CommerceAction, type SandboxQuote, type SandboxOrder } from "./types";

export async function bookCommerce(owner: string, input: CommerceAction, expectedSearchId?: string, expectedTotalPaise?: number) {
  if (input.action === "status") return { session: await readSession(owner), order: undefined };
  const session = await updateSession(owner, (current) => {
    if (expectedSearchId && current.searchId !== expectedSearchId) throw new MarketplaceError("COMMERCE_CONFLICT", 409);
    if (input.action === "select") {
      const offer = current.offers.find(({ listing }) => listing.id === input.listingId);
      if (!offer) throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
      const discountPaise = Math.round(offer.listing.pricePaise * offer.quantity * 0.2);
      const welcomeOffer = current.orders.length === 0 && discountPaise > 0 && discountPaise < offer.totalPaise
        ? { status: "available" as const, discountPaise } : undefined;
      const quote = { id: randomUUID(), offer, expiresAt: Date.now() + 10 * 60_000, welcomeOffer };
      return { ...current, quote };
    }
    if (input.action === "pay" && current.orders.some(({ quote }) => quote.id === input.quoteId)) return current;
    const quote = current.quote;
    if (!quote || quote.id !== input.quoteId) throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
    if (input.action === "cancel") return { ...current, quote: undefined };
    if (quote.expiresAt <= Date.now()) throw new MarketplaceError("QUOTE_EXPIRED", 410);
    if (input.action === "welcome_offer") {
      const welcomeOffer = quote.welcomeOffer;
      if (current.orders.length || quote.approvedAt || welcomeOffer?.status !== "available") {
        throw new MarketplaceError("COMMERCE_CONFLICT", 409);
      }
      const next = {
        ...quote,
        id: randomUUID(),
        welcomeOffer: { ...welcomeOffer, status: input.accept ? "applied" as const : "declined" as const },
        offer: input.accept ? { ...quote.offer, totalPaise: quote.offer.totalPaise - welcomeOffer.discountPaise } : quote.offer,
      };
      return { ...current, quote: next, dialogue: current.dialogue && { ...current.dialogue, confirmation: undefined, awaitingApproval: next.id } };
    }
    if (input.action === "customize") {
      const modifier = quote.offer.listing.modifiers?.flatMap((g) => g.options).find((opt) => opt.id === input.modifierId || opt.name.toLowerCase() === input.modifierId.toLowerCase());
      if (!modifier) throw new MarketplaceError("ITEM_UNAVAILABLE", 400);
      const existing = quote.offer.selectedModifiers ?? [];
      if (existing.some(({ id }) => id === modifier.id)) return current;
      const updatedModifiers = [...existing, modifier];
      const newTotal = totalFor(quote.offer.listing, quote.offer.quantity, updatedModifiers) - appliedWelcomeDiscount(quote);
      const budget = current.current ?? current.dialogue?.task?.turn.constraints;
      if (budget?.budgetPaise !== undefined && (budget.budgetExclusive ? newTotal >= budget.budgetPaise : newTotal > budget.budgetPaise)) {
        throw new MarketplaceError("OVER_BUDGET", 409);
      }
      const updatedOffer = { ...quote.offer, selectedModifiers: updatedModifiers, totalPaise: newTotal };
      return { ...current, quote: { ...quote, offer: updatedOffer, approvedAt: undefined } };
    }
    if (input.action === "approve") {
      if (quote.offer.totalPaise !== input.totalPaise) throw new MarketplaceError("PRICE_CHANGED", 409);
      const welcomeOffer = quote.welcomeOffer?.status === "available"
        ? { ...quote.welcomeOffer, status: "declined" as const } : quote.welcomeOffer;
      return { ...current, quote: { ...quote, welcomeOffer, approvedAt: quote.approvedAt ?? Date.now() } };
    }
    const approvedTotal = expectedTotalPaise ?? input.totalPaise;
    if (approvedTotal !== undefined && quote.offer.totalPaise !== approvedTotal) throw new MarketplaceError("PRICE_CHANGED", 409);
    if (!quote.approvedAt || input.code !== demoCode) throw new MarketplaceError("COMMERCE_APPROVAL_REQUIRED", 409);
    const order = { reference: `JG-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`, quote, confirmedAt: Date.now(), destination: current.profile?.region === quote.offer.listing.region ? current.profile.locality : undefined, payment: "simulated_no_charge" as const };
    return { ...current, current: undefined, searchId: expectedSearchId, lastTurn: undefined, quote: undefined, offers: [],
      dialogue: current.dialogue && { ...current.dialogue, task: undefined, previous: [], awaitingApproval: undefined, confirmation: undefined, offerReply: undefined, topic: undefined, clarification: undefined, recentTurns: [] },
      orders: [order, ...current.orders].slice(0, 25) };
  });
  return { session, order: input.action === "pay" ? session.orders.find(({ quote }) => quote.id === input.quoteId) : undefined };
}

export function trackingSpeech(language: VoiceLocale, order?: SandboxOrder, providerStage?: string) {
  if (!order && !providerStage) return {
    "en-IN": "There are no confirmed simulated orders in this session.",
    "hi-IN": "इस सेशन में कोई स्वीकार किया गया डेमो ऑर्डर नहीं है।",
    "hi-en": "Is session mein koi confirmed demo order nahi hai.",
    "te-IN": "ఈ సెషన్‌లో నిర్ధారించిన డెమో ఆర్డర్లు లేవు.",
  }[language];
  if (providerStage === "cancelled" || providerStage === "failed" || providerStage === "expired") {
    return {
      "en-IN": `The provider reports that your latest demo order is ${providerStage}.`,
      "hi-IN": "प्रदाता के अनुसार आपका आख़िरी डेमो ऑर्डर सक्रिय नहीं है।",
      "hi-en": "Provider ke mutabik latest demo order active nahi hai.",
      "te-IN": "ప్రొవైడర్ ప్రకారం మీ చివరి డెమో ఆర్డర్ ప్రస్తుతం సక్రియంగా లేదు.",
    }[language];
  }
  const state = order ? trackingStage(order) :
    providerStage === "delivered" ? "Delivered" : providerStage === "out_for_delivery" || providerStage === "picked_up" ? "Out for delivery" :
      providerStage === "confirmed" ? "Confirmed" : "Preparing";
  const localized = {
    "en-IN": state,
    "hi-IN": { Confirmed: "स्वीकार हुआ", Preparing: "तैयार हो रहा है", "Out for delivery": "डिलीवरी के लिए निकल चुका है", Delivered: "डिलीवरी पूरी" }[state],
    "hi-en": state,
    "te-IN": { Confirmed: "నిర్ధారించబడింది", Preparing: "సిద్ధమవుతోంది", "Out for delivery": "డెలివరీకి బయలుదేరింది", Delivered: "డెలివరీ పూర్తయింది" }[state],
  }[language];
  return {
    "en-IN": `Your latest demo order is ${localized.toLowerCase()}.`,
    "hi-IN": `आपका आख़िरी डेमो ऑर्डर ${localized}।`,
    "hi-en": `Aapka latest demo order ${localized.toLowerCase()} hai.`,
    "te-IN": `మీ చివరి డెమో ఆర్డర్ ${localized}.`,
  }[language];
}

export function welcomeOfferSpeech(language: VoiceLocale, quote?: SandboxQuote) {
  if (quote?.welcomeOffer?.status !== "available") return;
  return {
    "en-IN": "The Jugaad Welcome Offer takes 20 percent off your item subtotal for this simulated order. Apply it?",
    "hi-IN": "जुगाड़ वेलकम ऑफ़र में इस डेमो ऑर्डर के सामान पर 20 प्रतिशत की छूट है। इसे लागू करूँ?",
    "hi-en": "Jugaad Welcome Offer se is demo order ke items par 20 percent off milega. Apply karoon?",
    "te-IN": "జుగాడ్ వెల్కమ్ ఆఫర్‌తో ఈ డెమో ఆర్డర్‌లో వస్తువులపై 20 శాతం తగ్గింపు. వర్తింపజేయాలా?",
  }[language];
}

export function commerceSpeech(language: VoiceLocale, quote?: SandboxQuote, order?: SandboxOrder) {
  if (order) return {
    "en-IN": `Your simulated order is confirmed. It should arrive in about ${order.quote.offer.listing.etaMinutes} minutes.`,
    "hi-IN": `आपका डेमो ऑर्डर स्वीकार हो गया है। अनुमानित समय ${order.quote.offer.listing.etaMinutes} मिनट है।`,
    "hi-en": `Aapka demo order confirm ho gaya. Delivery mein lagbhag ${order.quote.offer.listing.etaMinutes} minute lagenge.`,
    "te-IN": `మీ డెమో ఆర్డర్ నిర్ధారించబడింది. సుమారు ${order.quote.offer.listing.etaMinutes} నిమిషాల్లో వస్తుంది.`,
  }[language];
  if (!quote || quote.approvedAt) return;
  const total = spokenPrice(quote.offer.totalPaise, language);
  return {
    "en-IN": `The full total is ${total}. Would you like to approve it?`,
    "hi-IN": `कुल कीमत ${total} है। क्या आप इसे मंज़ूर करेंगे?`,
    "hi-en": `Total ${total} hai. Kya aap ise approve karenge?`,
    "te-IN": `మొత్తం ${total}. మీరు ఆమోదిస్తారా?`,
  }[language];
}
