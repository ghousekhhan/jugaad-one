"use client";

import { useState } from "react";
import { MapPin, ArrowRight, Soup, Train, ShoppingBag, CreditCard, ChevronDown, Send } from "lucide-react";
import { BrandMark } from "@/components/brand";

export function LocationConfirmationScreen({
  detectedCityName = "Hyderabad",
  detectedLocality = "Banjara Hills",
  detectedAddress = "Banjara Hills, Hyderabad, Telangana 500034",
  onConfirmLocation,
  onChangeLocation,
  onMicClick,
  isListening = true,
}: {
  detectedCityName?: string;
  detectedLocality?: string;
  detectedAddress?: string;
  onConfirmLocation: () => void;
  onChangeLocation?: () => void;
  onMicClick?: () => void;
  isListening?: boolean;
}) {
  const [isConversationOpen, setIsConversationOpen] = useState(false);

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-6">
      {/* 1. Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#1F1F1F]">
            Jugaad<span className="text-[#FF7A00]">One</span>
          </span>
        </div>
        <div className="w-9 h-9 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#5D5953]">
          <span className="text-sm font-bold">👤</span>
        </div>
      </div>

      {/* 2. Headline with Audio Wave Accent */}
      <div className="text-center space-y-2 pt-4">
        <div className="flex items-center justify-center gap-0.5 text-[#FF7A00]">
          <span className="w-1 h-3 bg-[#FF7A00] rounded-full" />
          <span className="w-1 h-5 bg-[#FF7A00] rounded-full" />
          <span className="w-1 h-7 bg-[#FF7A00] rounded-full" />
          <span className="w-1 h-4 bg-[#FF7A00] rounded-full" />
          <span className="w-1 h-2 bg-[#FF7A00] rounded-full" />
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold font-display tracking-tight text-[#1F1F1F]">
          Can I access your location so I can<br />find options near you?
        </h1>
      </div>

      {/* 3. Center Stage with Orbiting Category Tiles */}
      <div className="relative max-w-2xl mx-auto py-12 flex items-center justify-center">
        {/* Orbiting Category Tiles */}
        {/* Top-Left: Food */}
        <div className="absolute top-2 left-6 sm:left-12 bg-[#FFF4EC] border border-[#FFE0CC] rounded-2xl p-3.5 flex flex-col items-center shadow-sm w-24">
          <Soup size={22} className="text-[#FF7A00] mb-1" />
          <span className="text-xs font-bold text-[#1F1F1F]">Food</span>
        </div>

        {/* Bottom-Left: Travel */}
        <div className="absolute bottom-4 left-6 sm:left-12 bg-[#EBF7F5] border border-[#C5EDE6] rounded-2xl p-3.5 flex flex-col items-center shadow-sm w-24">
          <Train size={22} className="text-[#16866E] mb-1" />
          <span className="text-xs font-bold text-[#1F1F1F]">Travel</span>
        </div>

        {/* Top-Right: Shopping */}
        <div className="absolute top-2 right-6 sm:right-12 bg-[#F3F0FA] border border-[#E0D8F3] rounded-2xl p-3.5 flex flex-col items-center shadow-sm w-24">
          <ShoppingBag size={22} className="text-[#7C3AED] mb-1" />
          <span className="text-xs font-bold text-[#1F1F1F]">Shopping</span>
        </div>

        {/* Bottom-Right: Payments */}
        <div className="absolute bottom-4 right-6 sm:right-12 bg-[#FFF9E6] border border-[#FDECB2] rounded-2xl p-3.5 flex flex-col items-center shadow-sm w-24">
          <CreditCard size={22} className="text-[#D97706] mb-1" />
          <span className="text-xs font-bold text-[#1F1F1F]">Payments</span>
        </div>

        {/* Central Glowing Mic */}
        <div className="flex flex-col items-center relative">
          <div className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-[#FF7A00]/30 to-[#FF633A]/15 blur-2xl pointer-events-none" />
          <div className="absolute w-40 h-40 rounded-full border border-[#FF7A00]/30 animate-ping pointer-events-none" />

          <button
            type="button"
            onClick={onMicClick}
            aria-label="Confirm location by voice"
            className="w-24 h-24 rounded-full bg-gradient-to-b from-[#FF7A00] to-[#E5483F] shadow-[0_8px_30px_rgba(255,122,0,0.35)] flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
          >
            <span className="text-2xl">🎙️</span>
          </button>

          <div className="mt-4 px-3.5 py-1 rounded-full bg-white border border-[#E5DDD0] text-xs font-bold text-[#5D5953] flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#16866E]" />
            <span>{isListening ? "Listening…" : "Say \"Yes, use this location\""}</span>
          </div>
        </div>
      </div>

      {/* 4. Detected Location Card with Mini Map */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-5 sm:p-6 border border-[#E5DDD0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00] shrink-0 mt-0.5">
            <MapPin size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="font-extrabold text-lg text-[#1F1F1F] font-display">
              Detected near {detectedLocality}, {detectedCityName}
            </h2>
            <p className="text-xs text-[#5D5953]">
              {detectedAddress}
            </p>
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={onConfirmLocation}
                className="inline-flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E56A00] text-white px-5 py-2.5 rounded-full font-bold text-xs shadow-sm hover:shadow transition-all"
              >
                <span>Use this location</span>
                <ArrowRight size={14} />
              </button>
              {onChangeLocation && (
                <button
                  type="button"
                  onClick={onChangeLocation}
                  className="px-4 py-2.5 rounded-full border border-[#DDD4C7] bg-white hover:bg-[#F8F5EE] text-xs font-semibold text-[#1F1F1F] transition-colors"
                >
                  Change
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stylized Mini Map Thumbnail with Pin */}
        <div className="w-full sm:w-44 h-28 rounded-2xl bg-[#EBE5DB] border border-[#DDD4C7] overflow-hidden relative shrink-0 flex items-center justify-center">
          {/* Stylized Street Lines */}
          <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 160 100" fill="none">
            <path d="M-10 30L170 30" stroke="#FFFFFF" strokeWidth="6" />
            <path d="M40 -10L40 110" stroke="#FFFFFF" strokeWidth="6" />
            <path d="M120 -10L120 110" stroke="#FFFFFF" strokeWidth="4" />
            <path d="M-10 75L170 75" stroke="#FFFFFF" strokeWidth="4" />
            <path d="M20 20L140 85" stroke="#FFFFFF" strokeWidth="5" />
          </svg>
          {/* Pin in center */}
          <div className="relative z-10 w-8 h-8 rounded-full bg-[#FF7A00] text-white flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
            <MapPin size={16} />
          </div>
        </div>
      </div>

      {/* 5. Bottom Conversation Drawer & Fallback Input */}
      <div className="max-w-3xl mx-auto space-y-3 pt-4">
        <button
          type="button"
          onClick={() => setIsConversationOpen(!isConversationOpen)}
          className="w-full flex items-center justify-between px-5 py-2.5 rounded-2xl bg-white/80 border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] cursor-pointer hover:bg-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[#FF7A00]">
              <span className="w-0.5 h-3 bg-[#FF7A00] rounded-full" />
              <span className="w-0.5 h-4 bg-[#FF7A00] rounded-full" />
              <span className="w-0.5 h-2 bg-[#FF7A00] rounded-full" />
            </span>
            <span className="font-bold text-[#1F1F1F]">Conversation</span>
            <span className="text-[10px] text-[#16866E] font-bold bg-[#EBF7F5] px-2 py-0.5 rounded-full">
              ● Live
            </span>
          </div>
          <ChevronDown size={14} className={`transform transition-transform ${isConversationOpen ? "rotate-180" : ""}`} />
        </button>

        {isConversationOpen && (
          <div className="p-4 rounded-2xl bg-white border border-[#E5DDD0] text-xs text-[#5D5953] space-y-2">
            <p><strong>Jugaad:</strong> Can I access your location so I can find options near you?</p>
            <p><strong>You:</strong> (Awaiting voice response or location consent)</p>
          </div>
        )}

        {/* Text Input Pill */}
        <div className="relative">
          <input
            type="text"
            placeholder="Or type a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmLocation();
            }}
            className="w-full px-5 py-3 pr-12 rounded-full bg-white border border-[#E5DDD0] text-sm text-[#1F1F1F] placeholder:text-[#6F6B65] focus:outline-none focus:border-[#FF7A00] shadow-sm"
          />
          <button
            type="button"
            onClick={onConfirmLocation}
            className="absolute right-2 top-2 w-8 h-8 rounded-full bg-[#FF7A00] text-white flex items-center justify-center"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
