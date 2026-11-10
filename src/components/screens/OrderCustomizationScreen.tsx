"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Check, ShoppingCart, Bike, Info } from "lucide-react";

export type ModifierItem = {
  id: string;
  name: string;
  subtext: string;
  priceDelta: number;
  icon: string;
  selected: boolean;
};

export function OrderCustomizationScreen({
  dishName = "Paneer Butter Masala Combo",
  restaurantName = "The Good Bowl",
  cuisine = "North Indian",
  rating = 4.4,
  reviewCount = "12K+",
  distanceKm = 2.8,
  basePrice = 349,
  deliveryFee = 0,
  taxes = 32,
  provider = "wiggy",
  initialModifiers,
  onToggleModifier,
  onBack,
  onProceedToPayment,
}: {
  dishName?: string;
  restaurantName?: string;
  cuisine?: string;
  rating?: number;
  reviewCount?: string;
  distanceKm?: number;
  basePrice?: number;
  deliveryFee?: number;
  taxes?: number;
  provider?: "wiggy" | "tomato";
  initialModifiers?: ModifierItem[];
  onToggleModifier?: (id: string) => void;
  onBack?: () => void;
  onProceedToPayment: (total: number, selectedModifiers: string[]) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState<"wiggy" | "tomato">(provider);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [modifiers, setModifiers] = useState<ModifierItem[]>(
    initialModifiers && initialModifiers.length > 0
      ? initialModifiers
      : [
          { id: "cheese", name: "Extra Cheese", subtext: "Make it richer and creamier", priceDelta: 40, icon: "🧀", selected: true },
          { id: "dip", name: "Spicy Dip", subtext: "A tangy, spicy side kick", priceDelta: 25, icon: "🥫", selected: false },
          { id: "onions", name: "Extra Onions", subtext: "Freshly sliced", priceDelta: 10, icon: "🧅", selected: false },
          { id: "cutlery", name: "Add Cutlery", subtext: "Fork, spoon and tissue", priceDelta: 0, icon: "🍴", selected: true },
        ]
  );

  function toggleModifier(id: string) {
    setModifiers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m))
    );
    onToggleModifier?.(id);
  }

  const addonsTotal = modifiers
    .filter((m) => m.selected)
    .reduce((sum, m) => sum + m.priceDelta, 0);
  const totalPayable = basePrice + addonsTotal + taxes + deliveryFee;

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-6">
      {/* 1. Top Header with Back Button & Provider Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to comparison"
              className="w-9 h-9 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#1F1F1F] hover:bg-[#F8F5EE] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
              Selected Order Review &amp; Customization
            </h1>
            <p className="text-xs text-[#5D5953]">
              Review your recommended order, customize it your way, and place it on {selectedProvider === "wiggy" ? "Wiggy" : "Tomato"}.
            </p>
          </div>
        </div>

        {/* Provider Toggle Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedProvider("wiggy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              selectedProvider === "wiggy"
                ? "bg-white border-2 border-[#FF7A00] text-[#1F1F1F] shadow-sm"
                : "bg-white/80 border border-[#E5DDD0] text-[#5D5953]"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-[#FF7A00] text-white text-[10px] font-black flex items-center justify-center">
              W
            </span>
            <span>Wiggy</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedProvider("tomato")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              selectedProvider === "tomato"
                ? "bg-white border-2 border-[#E5483F] text-[#1F1F1F] shadow-sm"
                : "bg-white/80 border border-[#E5DDD0] text-[#5D5953]"
            }`}
          >
            <span className="w-5 h-5 rounded-md bg-[#E5483F] text-white text-[10px] font-black flex items-center justify-center">
              T
            </span>
            <span>Tomato</span>
          </button>
        </div>
      </div>

      {/* 2. AI Recommendation Banner */}
      <div className="bg-[#FFF4EC] border border-[#FFE0CC] rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="w-8 h-8 rounded-xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00] shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-xs sm:text-sm text-[#1F1F1F] leading-relaxed">
          <strong className="text-[#FF7A00] uppercase tracking-wider text-xs block sm:inline mr-2">
            AI Recommendation
          </strong>
          Picked for you: Paneer Butter Masala Combo — a top-rated, value-for-money choice at nearby restaurants, loved for its rich taste and consistent quality.
        </div>
      </div>

      {/* 3. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Customizations & Payment Method */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customization Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-4">
            <div>
              <h2 className="font-extrabold text-lg text-[#1F1F1F] font-display">
                Customize Your Order
              </h2>
              <p className="text-xs text-[#5D5953]">Make it just right for you.</p>
            </div>

            <div className="space-y-3 pt-2">
              {modifiers.map((mod) => (
                <div
                  key={mod.id}
                  onClick={() => toggleModifier(mod.id)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    mod.selected
                      ? "bg-[#FFF8F3] border-[#FFD2B3]"
                      : "bg-white border-[#E5DDD0] hover:border-[#1F1F1F]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" role="img" aria-hidden="true">{mod.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-[#1F1F1F]">{mod.name}</div>
                      <div className="text-xs text-[#5D5953]">{mod.subtext}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#1F1F1F]">
                      {mod.priceDelta > 0 ? `+ ₹${mod.priceDelta}` : "Free"}
                    </span>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      mod.selected ? "bg-[#FF7A00] border-[#FF7A00] text-white" : "border-[#DDD4C7] bg-white"
                    }`}>
                      {mod.selected && <Check size={12} className="stroke-[3]" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selection Card */}
          <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-4">
            <h2 className="font-extrabold text-lg text-[#1F1F1F] font-display">
              Payment Method
            </h2>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-[#FF7A00] bg-[#FFF8F3] cursor-pointer">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "upi"}
                    onChange={() => setPaymentMethod("upi")}
                    className="accent-[#FF7A00]"
                  />
                  <span className="text-sm font-bold text-[#1F1F1F]">UPI (Demo / Simulated Jugaad Pay)</span>
                </div>
                <span className="text-xs text-[#16866E] font-bold">Instant demo code</span>
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E5DDD0] bg-white cursor-pointer opacity-60">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                    disabled
                  />
                  <span className="text-sm font-medium text-[#1F1F1F]">Debit / Credit Card (Simulated)</span>
                </div>
                <span className="text-xs text-[#6F6B65]">Simulated</span>
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E5DDD0] bg-white cursor-pointer opacity-60">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "netbanking"}
                    onChange={() => setPaymentMethod("netbanking")}
                    disabled
                  />
                  <span className="text-sm font-medium text-[#1F1F1F]">Net Banking (Simulated)</span>
                </div>
                <span className="text-xs text-[#6F6B65]">Simulated</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Pricing Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-5">
            {/* Restaurant Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE2]">
              <div>
                <h3 className="font-extrabold text-base text-[#1F1F1F] font-display flex items-center gap-1.5">
                  <span>{restaurantName}</span>
                  <Check size={14} className="text-[#16866E] stroke-[3]" />
                </h3>
                <p className="text-xs text-[#5D5953]">
                  {cuisine} • {rating} ★ ({reviewCount}) • {distanceKm} km
                </p>
              </div>
              <span className="text-xs text-[#6F6B65]">›</span>
            </div>

            {/* Dish Card Preview */}
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FFEAD8] to-[#FFF8F3] border border-[#FFD2B3] flex items-center justify-center text-2xl shrink-0">
                🍛
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#1F1F1F]">
                    {dishName}
                  </h4>
                  <span className="text-sm font-extrabold text-[#1F1F1F]">
                    ₹{basePrice}
                  </span>
                </div>
                <p className="text-xs text-[#5D5953]">
                  Recommended portion with selected sides
                </p>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-[#C2410C] bg-[#FFEAD8] px-2 py-0.5 rounded-full">
                    ✦ Recommended by Jugaad
                  </span>
                  {modifiers.filter((m) => m.selected).map((m) => (
                    <span key={m.id} className="text-[10px] font-bold text-[#1F1F1F] bg-[#F8F5EE] px-2 py-0.5 rounded-full">
                      {m.icon} {m.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Price Line Items Breakdown */}
            <div className="space-y-2 pt-4 border-t border-[#F0EBE2] text-xs text-[#5D5953]">
              <div className="flex justify-between">
                <span>Item Total</span>
                <span>₹{basePrice}</span>
              </div>
              {addonsTotal > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons</span>
                  <span>₹{addonsTotal}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <span>Taxes &amp; Charges</span>
                  <Info size={11} className="text-[#6F6B65]" />
                </span>
                <span>₹{taxes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Delivery Fee</span>
                <span className="flex items-center gap-1.5">
                  <span className="line-through text-[#6F6B65]">₹49</span>
                  <span className="text-[#16866E] font-bold">₹0</span>
                </span>
              </div>
            </div>

            {/* Total Payable Dominant Line */}
            <div className="flex items-baseline justify-between pt-4 border-t border-[#F0EBE2]">
              <span className="text-sm font-bold text-[#1F1F1F]">Total Payable</span>
              <span className="text-3xl font-black font-display text-[#1F1F1F]">
                ₹{totalPayable}
              </span>
            </div>

            {/* Delivery Estimate Banner */}
            <div className="p-3 rounded-2xl bg-[#F8F5EE] border border-[#E5DDD0] flex items-center justify-between text-xs font-semibold text-[#1F1F1F]">
              <div className="flex items-center gap-2">
                <Bike size={16} className="text-[#FF7A00]" />
                <span>Delivery Estimate: <strong>25 - 30 mins</strong></span>
              </div>
              <span className="text-[#16866E] font-bold">Best ETA</span>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => onProceedToPayment(totalPayable, modifiers.filter((m) => m.selected).map((m) => m.name))}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E56A00] text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <ShoppingCart size={18} />
              <span>Proceed to Simulated Checkout</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
