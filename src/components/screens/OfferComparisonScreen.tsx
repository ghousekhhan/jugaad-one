"use client";

import { Star, Clock, ArrowUpRight, Check, Lightbulb, ChevronDown, BarChart3, Bookmark, RotateCcw } from "lucide-react";
import { BrandMark } from "@/components/brand";

export type ComparisonOfferItem = {
  id: string;
  provider: "wiggy" | "tomato";
  providerName: string;
  restaurantName: string;
  dishName: string;
  cuisine: string;
  distanceKm: number;
  rating: number;
  reviewCount: string;
  totalPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  etaMinutes: number;
  deliveryFee: number;
  platformFee: number;
  isRecommended?: boolean;
};

export function OfferComparisonScreen({
  dishQuery = "Paneer Butter Masala with Garlic Naan",
  offers,
  onSelectOffer,
  onOpenHistory,
  onOpenProfile,
  onOpenWorkspace,
}: {
  dishQuery?: string;
  offers?: ComparisonOfferItem[];
  onSelectOffer: (offerId: string) => void;
  onOpenHistory?: () => void;
  onOpenProfile?: () => void;
  onOpenWorkspace?: () => void;
}) {
  // Default mock offers matching the exact visual specification if none provided
  const activeOffers: ComparisonOfferItem[] = offers && offers.length >= 2 ? offers : [
    {
      id: "wiggy-offer-1",
      provider: "wiggy",
      providerName: "Wiggy",
      restaurantName: "Punjabi Tadka",
      dishName: "Paneer Butter Masala Combo",
      cuisine: "North Indian",
      distanceKm: 2.8,
      rating: 4.4,
      reviewCount: "12.3K",
      totalPrice: 428,
      originalPrice: 510,
      discountPercent: 16,
      etaMinutes: 28,
      deliveryFee: 38,
      platformFee: 0,
      isRecommended: true,
    },
    {
      id: "tomato-offer-2",
      provider: "tomato",
      providerName: "Tomato",
      restaurantName: "Royal Curries",
      dishName: "Paneer Butter Masala Combo",
      cuisine: "North Indian",
      distanceKm: 3.1,
      rating: 4.3,
      reviewCount: "9.6K",
      totalPrice: 510,
      etaMinutes: 35,
      deliveryFee: 28,
      platformFee: 20,
      isRecommended: false,
    },
  ];

  const wiggy = activeOffers.find((o) => o.provider === "wiggy") ?? activeOffers[0];
  const tomato = activeOffers.find((o) => o.provider === "tomato") ?? activeOffers[1];
  const priceDiff = Math.abs(wiggy.totalPrice - tomato.totalPrice);
  const timeDiff = Math.abs(wiggy.etaMinutes - tomato.etaMinutes);
  const cheaperProvider = wiggy.totalPrice < tomato.totalPrice ? wiggy.providerName : tomato.providerName;
  const fasterProvider = wiggy.etaMinutes < tomato.etaMinutes ? wiggy.providerName : tomato.providerName;

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-6">
      {/* 1. Header with Compare / History / Saved Tabs */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#1F1F1F]">
            Jugaad<span className="text-[#FF7A00]">One</span>
          </span>
        </div>

        {/* Center Tabs */}
        <div className="hidden md:flex items-center gap-2 bg-white/70 border border-[#E5DDD0] p-1 rounded-full text-xs font-semibold">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFEAD8] text-[#C2410C]">
            <BarChart3 size={14} />
            <span>Compare</span>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5D5953] hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>History</span>
          </button>
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5D5953] hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <Bookmark size={14} />
            <span>New Search</span>
          </button>
        </div>

        {/* Profile Button */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Edit Profile & Location"
          className="w-9 h-9 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#5D5953] hover:bg-[#F8F5EE] transition-colors cursor-pointer"
        >
          👤
        </button>
      </div>

      {/* 2. Headline with Audio Wave Accent */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 text-[#FF7A00]">
            <span className="w-1 h-3 bg-[#FF7A00] rounded-full" />
            <span className="w-1 h-6 bg-[#FF7A00] rounded-full" />
            <span className="w-1 h-4 bg-[#FF7A00] rounded-full" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
            Two strong options found
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-[#5D5953] pl-6">
          <span>{dishQuery}</span>
          <ChevronDown size={14} />
        </div>
      </div>

      {/* 3. Jugaad Recommends Banner */}
      <div className="bg-[#FFF4EC] border border-[#FFE0CC] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 flex-wrap z-10">
          <div className="flex items-center gap-1.5 bg-[#FF7A00] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
            <span>★</span>
            <span>Jugaad Recommends</span>
          </div>
          <div className="hidden sm:block w-px h-5 bg-[#FFD2B3]" />
          <p className="text-sm font-semibold text-[#1F1F1F]">
            Choose <strong className="text-[#FF7A00]">{cheaperProvider}</strong> — it&apos;s <strong>₹{priceDiff} cheaper</strong> and arrives <strong>{timeDiff} min faster</strong>.
          </p>
        </div>
        {/* Subtle orange wave flourish in corner */}
        <div className="absolute right-0 bottom-0 w-32 h-16 bg-gradient-to-l from-[#FF7A00]/20 to-transparent pointer-events-none rounded-tl-full" />
      </div>

      {/* 4. Side-by-Side Comparison Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Card A: Wiggy (Recommended) */}
        <div className="bg-white rounded-3xl p-6 border-2 border-[#FF7A00] shadow-md flex flex-col justify-between space-y-5 relative">
          <div>
            {/* Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE2]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#FF7A00] flex items-center justify-center text-white text-xs font-black">
                  W
                </div>
                <span className="font-extrabold text-base text-[#1F1F1F]">Wiggy</span>
              </div>
              <span className="text-[11px] font-bold text-[#C2410C] bg-[#FFEAD8] px-2.5 py-0.5 rounded-full border border-[#FFD2B3]">
                ★ Recommended
              </span>
            </div>

            {/* Restaurant & Dish Details */}
            <div className="grid grid-cols-12 gap-4 items-center pt-4">
              {/* Dish Photo / Visual */}
              <div className="col-span-4 w-full h-24 rounded-2xl bg-gradient-to-tr from-[#FFEAD8] to-[#FFF8F3] border border-[#FFD2B3] flex items-center justify-center text-3xl shadow-inner">
                🍛
              </div>

              {/* Info */}
              <div className="col-span-8 space-y-1">
                <h3 className="font-extrabold text-lg text-[#1F1F1F] font-display">
                  {wiggy.restaurantName}
                </h3>
                <p className="text-xs text-[#5D5953]">
                  {wiggy.cuisine} • {wiggy.distanceKm} km
                </p>
                <div className="flex items-center gap-1 text-xs font-bold text-[#1F1F1F] pt-0.5">
                  <Star size={13} className="text-[#FF7A00] fill-[#FF7A00]" />
                  <span>{wiggy.rating} ({wiggy.reviewCount})</span>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline justify-between pt-4 border-t border-[#F0EBE2] mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
                Total Price
              </span>
              <div className="flex items-baseline gap-2">
                {wiggy.originalPrice && (
                  <span className="text-xs text-[#6F6B65] line-through">
                    ₹{wiggy.originalPrice}
                  </span>
                )}
                <span className="text-3xl font-black font-display text-[#1F1F1F]">
                  ₹{wiggy.totalPrice}
                </span>
                {wiggy.discountPercent && (
                  <span className="text-xs font-bold text-[#16866E]">
                    {wiggy.discountPercent}% off
                  </span>
                )}
              </div>
            </div>

            {/* Delivery & Fee Telemetry Row */}
            <div className="grid grid-cols-3 gap-2 pt-4 text-center">
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-[#1F1F1F]">
                  <Clock size={13} className="text-[#FF7A00]" />
                  <span>{wiggy.etaMinutes} min</span>
                </div>
                <span className="text-[10px] text-[#6F6B65]">Delivery time</span>
              </div>
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="text-xs font-bold text-[#1F1F1F]">
                  ₹{wiggy.deliveryFee}
                </div>
                <span className="text-[10px] text-[#6F6B65]">Delivery fee</span>
              </div>
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="text-xs font-bold text-[#16866E]">
                  ₹{wiggy.platformFee}
                </div>
                <span className="text-[10px] text-[#6F6B65]">Platform fee</span>
              </div>
            </div>
          </div>

          {/* Action CTA Button */}
          <button
            type="button"
            onClick={() => onSelectOffer(wiggy.id)}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E56A00] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>Order on Wiggy</span>
            <ArrowUpRight size={16} />
          </button>
        </div>

        {/* Card B: Tomato */}
        <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm flex flex-col justify-between space-y-5">
          <div>
            {/* Top Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE2]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#E5483F] flex items-center justify-center text-white text-xs font-black">
                  T
                </div>
                <span className="font-extrabold text-base text-[#1F1F1F]">Tomato</span>
              </div>
            </div>

            {/* Restaurant & Dish Details */}
            <div className="grid grid-cols-12 gap-4 items-center pt-4">
              {/* Dish Photo / Visual */}
              <div className="col-span-4 w-full h-24 rounded-2xl bg-gradient-to-tr from-[#FDE8E8] to-[#FFF5F5] border border-[#FCD2D2] flex items-center justify-center text-3xl shadow-inner">
                🍲
              </div>

              {/* Info */}
              <div className="col-span-8 space-y-1">
                <h3 className="font-extrabold text-lg text-[#1F1F1F] font-display">
                  {tomato.restaurantName}
                </h3>
                <p className="text-xs text-[#5D5953]">
                  {tomato.cuisine} • {tomato.distanceKm} km
                </p>
                <div className="flex items-center gap-1 text-xs font-bold text-[#1F1F1F] pt-0.5">
                  <Star size={13} className="text-[#FF7A00] fill-[#FF7A00]" />
                  <span>{tomato.rating} ({tomato.reviewCount})</span>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline justify-between pt-4 border-t border-[#F0EBE2] mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
                Total Price
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-display text-[#1F1F1F]">
                  ₹{tomato.totalPrice}
                </span>
              </div>
            </div>

            {/* Delivery & Fee Telemetry Row */}
            <div className="grid grid-cols-3 gap-2 pt-4 text-center">
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-[#1F1F1F]">
                  <Clock size={13} className="text-[#5D5953]" />
                  <span>{tomato.etaMinutes} min</span>
                </div>
                <span className="text-[10px] text-[#6F6B65]">Delivery time</span>
              </div>
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="text-xs font-bold text-[#1F1F1F]">
                  ₹{tomato.deliveryFee}
                </div>
                <span className="text-[10px] text-[#6F6B65]">Delivery fee</span>
              </div>
              <div className="bg-[#F8F5EE] rounded-xl p-2.5">
                <div className="text-xs font-bold text-[#1F1F1F]">
                  ₹{tomato.platformFee}
                </div>
                <span className="text-[10px] text-[#6F6B65]">Platform fee</span>
              </div>
            </div>
          </div>

          {/* Action CTA Button */}
          <button
            type="button"
            onClick={() => onSelectOffer(tomato.id)}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#E5483F] hover:bg-[#D4382F] text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <span>Order on Tomato</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* 5. "Why this recommendation?" Explanation Card */}
      <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm flex flex-col sm:flex-row items-start gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF4EC] flex items-center justify-center text-[#FF7A00]">
            <Lightbulb size={20} />
          </div>
          <span className="font-bold text-base text-[#1F1F1F] font-display">
            Why this<br />recommendation?
          </span>
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-[#5D5953] flex-1">
          <div className="flex items-start gap-2">
            <Check size={16} className="text-[#16866E] stroke-[3] shrink-0 mt-0.5" />
            <span><strong>Lower total price:</strong> {cheaperProvider} is ₹{priceDiff} cheaper (₹{wiggy.totalPrice} vs ₹{tomato.totalPrice}).</span>
          </div>
          <div className="flex items-start gap-2">
            <Check size={16} className="text-[#16866E] stroke-[3] shrink-0 mt-0.5" />
            <span><strong>Faster delivery:</strong> {fasterProvider} delivers in {wiggy.etaMinutes} min, which is {timeDiff} min faster than {tomato.providerName} ({tomato.etaMinutes} min).</span>
          </div>
          <div className="flex items-start gap-2">
            <Check size={16} className="text-[#16866E] stroke-[3] shrink-0 mt-0.5" />
            <span><strong>Similar quality:</strong> Both are highly rated ({wiggy.rating} vs {tomato.rating}) with thousands of verified customer reviews.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
