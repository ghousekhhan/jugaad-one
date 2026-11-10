"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Lock, ShieldCheck, Check, Info } from "lucide-react";
import { demoCode } from "@/lib/commerce/types";

export function SimulatedPaymentScreen({
  totalAmount = 487,
  dishName = "Chicken Biryani Combo",
  providerName = "Wiggy",
  onBack,
  onCompletePayment,
  isPending = false,
}: {
  totalAmount?: number;
  dishName?: string;
  providerName?: string;
  onBack?: () => void;
  onCompletePayment: () => void;
  isPending?: boolean;
}) {
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");

  function handleDigitChange(index: number, val: string) {
    if (val.length > 1) val = val.slice(-1);
    const updated = [...pinDigits];
    updated[index] = val;
    setPinDigits(updated);
    setError("");

    // Auto focus next input
    if (val && index < 3) {
      const nextInput = document.getElementById(`pin-box-${index + 1}`);
      nextInput?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`pin-box-${index - 1}`);
      prevInput?.focus();
    }
  }

  function fillDemoPin() {
    setPinDigits(["2", "4", "6", "8"]);
    setError("");
  }

  function handleSubmit() {
    const entered = pinDigits.join("");
    if (entered === demoCode) {
      onCompletePayment();
    } else {
      setError(`Please enter the demo confirmation code: ${demoCode}`);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-6">
      {/* 1. Header with Back Arrow */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#E5DDD0]/70">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to order customization"
            className="w-9 h-9 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#1F1F1F] hover:bg-[#F8F5EE] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
            Complete Payment
          </h1>
          <p className="text-xs text-[#5D5953]">
            Pay via simulated Jugaad Pay to place your order on {providerName}
          </p>
        </div>
      </div>

      {/* 2. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Simulated Payment Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E5DDD0] shadow-sm overflow-hidden">
          {/* Header Banner */}
          <div className="bg-[#FFF4EC] border-b border-[#FFE0CC] p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00]">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1F1F1F]">
                  Secure Simulated Payment
                </h3>
                <p className="text-xs text-[#5D5953]">
                  Jugaad Pay Demo • Sandbox environment
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fillDemoPin}
              className="text-xs font-bold text-[#FF7A00] bg-white border border-[#FFD2B3] px-3 py-1.5 rounded-full hover:bg-[#FFF8F3] transition-colors"
            >
              Autofill demo code (2468)
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Paying To Row */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
                Paying to
              </span>
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E5DDD0] bg-[#F8F5EE]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FF7A00] text-white font-black text-sm flex items-center justify-center">
                    {providerName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#1F1F1F]">{providerName}</div>
                    <div className="text-xs text-[#5D5953]">Food Order • Simulated Merchant</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#6F6B65] tracking-wider">UPI / DEMO</span>
              </div>
            </div>

            {/* UPI ID Field */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
                Your Demo Handle
              </span>
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E5DDD0] bg-white">
                <span className="text-sm font-medium text-[#1F1F1F]">@jugaadone@demo</span>
                <Check size={16} className="text-[#16866E] stroke-[3]" />
              </div>
            </div>

            {/* 4-Box PIN Code Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
                  Enter Demo Confirmation Code (Code: 2468)
                </span>
                <Info size={14} className="text-[#6F6B65]" />
              </div>

              <div className="flex items-center gap-3 justify-center py-2">
                {[0, 1, 2, 3].map((index) => (
                  <input
                    key={index}
                    id={`pin-box-${index}`}
                    type="password"
                    maxLength={1}
                    value={pinDigits[index]}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-14 h-14 text-center text-2xl font-black rounded-2xl border-2 border-[#DDD4C7] focus:border-[#FF7A00] bg-white text-[#1F1F1F] shadow-inner focus:outline-none transition-all"
                  />
                ))}
              </div>

              {error && (
                <p className="text-xs font-semibold text-[#E5483F] text-center" role="alert">
                  {error}
                </p>
              )}
            </div>

            {/* Payment Button */}
            <button
              type="button"
              disabled={isPending}
              onClick={handleSubmit}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E56A00] disabled:bg-[#DDD4C7] text-white py-4 rounded-2xl font-bold text-base transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <Lock size={18} />
              <span>{isPending ? "Confirming with provider…" : `Pay ₹${totalAmount}.00`}</span>
              <ArrowRight size={18} />
            </button>

            {/* Simulated Payment Notice */}
            <p className="text-[11px] text-[#6F6B65] text-center leading-relaxed">
              ⓘ This is a simulated payment for product demonstration purposes. No real bank accounts or funds are moved.
            </p>
          </div>
        </div>

        {/* Right Column: Order Summary & Trust Badge */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-5">
            <h2 className="font-extrabold text-base text-[#1F1F1F] font-display pb-3 border-b border-[#F0EBE2]">
              Order Summary
            </h2>

            {/* Merchant row */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#F0EBE2]">
              <div className="w-8 h-8 rounded-xl bg-[#FF7A00] text-white font-black text-sm flex items-center justify-center">
                {providerName.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-bold text-[#1F1F1F]">{providerName}</div>
                <div className="text-xs text-[#5D5953]">Food Delivery Order</div>
              </div>
            </div>

            {/* Item Preview */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4EC] flex items-center justify-center text-lg">
                  🍛
                </div>
                <div>
                  <div className="text-sm font-bold text-[#1F1F1F]">{dishName}</div>
                  <div className="text-xs text-[#5D5953]">1 × Combo Meal</div>
                </div>
              </div>
              <span className="text-sm font-extrabold text-[#1F1F1F]">₹{totalAmount - 38}.00</span>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 pt-3 border-t border-[#F0EBE2] text-xs text-[#5D5953]">
              <div className="flex justify-between">
                <span>Item Total</span>
                <span>₹{totalAmount - 38}.00</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span>₹29.00</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee</span>
                <span>₹9.00</span>
              </div>
            </div>

            {/* Total Dominant Amount */}
            <div className="flex items-baseline justify-between pt-4 border-t border-[#F0EBE2]">
              <span className="text-sm font-bold text-[#1F1F1F]">Total Amount</span>
              <span className="text-3xl font-black font-display text-[#FF7A00]">
                ₹{totalAmount}.00
              </span>
            </div>
          </div>

          {/* 100% Safe Badge Card */}
          <div className="bg-[#FFF8F3] border border-[#FFD2B3] rounded-3xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEAD8] flex items-center justify-center text-[#16866E] shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1F1F1F] mb-1">100% Safe &amp; Simulated</h3>
              <p className="text-xs text-[#5D5953] leading-relaxed">
                Your payment is sandbox-authorized with cryptographic verification and demo code protection.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
