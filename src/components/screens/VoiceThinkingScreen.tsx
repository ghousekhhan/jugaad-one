"use client";

import { Mic, MapPin, Tag, Navigation, Check, Layers, Bike, ShoppingBag } from "lucide-react";
import { BrandMark } from "@/components/brand";

export function VoiceThinkingScreen({
  utterance = "Chicken biryani under ₹450 near me",
  city = "Hyderabad",
  budget = "₹450",
  priority = "nearby",
  step = 2, // 1: Understanding, 2: Checking offers, 3: Comparing totals
}: {
  utterance?: string;
  city?: string;
  budget?: string;
  priority?: string;
  step?: 1 | 2 | 3;
}) {
  return (
    <div className="w-full min-h-[82vh] flex flex-col justify-between py-6 px-4 sm:px-8 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-6 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#1F1F1F]">
            Jugaad<span className="text-[#FF7A00]">One</span>
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] shadow-sm">
          <Layers size={14} className="text-[#FF7A00]" />
          <span>Simulated commerce</span>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-10 my-auto">
        {/* Left Column: Utterance & Constraint Chips */}
        <div className="lg:col-span-4 space-y-4 text-left">
          {/* Active Listening / Status Indicator */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFEAD8] text-xs font-bold text-[#C2410C]">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-ping" />
            <span className="flex items-center gap-0.5 text-[#FF7A00]">
              <span className="w-0.5 h-3 bg-[#FF7A00] rounded-full animate-bounce" />
              <span className="w-0.5 h-5 bg-[#FF7A00] rounded-full animate-bounce delay-75" />
              <span className="w-0.5 h-2 bg-[#FF7A00] rounded-full animate-bounce delay-150" />
            </span>
            <span>{step === 1 ? "Listening…" : step === 2 ? "Searching offers…" : "Evaluating trade-offs…"}</span>
          </div>

          {/* Quoted Utterance Pill */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-[#E5DDD0] shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00] shrink-0">
              <Mic size={16} />
            </div>
            <span className="text-sm font-semibold text-[#1F1F1F] italic">
              &ldquo;{utterance}&rdquo;
            </span>
          </div>

          {/* Extracted Constraint Chips */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {city && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] shadow-sm">
                <MapPin size={13} className="text-[#FF7A00]" />
                <span>{city}</span>
              </span>
            )}
            {budget && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] shadow-sm">
                <Tag size={13} className="text-[#16866E]" />
                <span>{budget}</span>
              </span>
            )}
            {priority && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] shadow-sm">
                <Navigation size={13} className="text-[#7C3AED]" />
                <span>{priority}</span>
              </span>
            )}
          </div>
        </div>

        {/* Center Column: Glowing Microphone with 3 Floating Orbital Items */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center relative py-12">
          {/* Concentric Subtle Rings */}
          <div className="absolute w-72 h-72 rounded-full border border-[#E5DDD0]/60 pointer-events-none" />
          <div className="absolute w-60 h-60 rounded-full border border-[#FF7A00]/25 pointer-events-none animate-pulse" />
          <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#FF7A00]/40 to-[#FF633A]/20 blur-2xl pointer-events-none" />

          {/* 1. Floating Bowl of Food (Top-Left) */}
          <div className="absolute -top-2 left-6 sm:left-10 w-14 h-14 rounded-2xl bg-white p-2 border border-[#E5DDD0] shadow-lg flex items-center justify-center transform -rotate-6 animate-bounce">
            <span className="text-2xl" role="img" aria-label="Bowl of biryani">🍲</span>
          </div>

          {/* 2. Floating Orange Scooter (Top-Right) */}
          <div className="absolute -top-4 right-6 sm:right-10 w-14 h-14 rounded-2xl bg-white p-2 border border-[#E5DDD0] shadow-lg flex items-center justify-center text-[#FF7A00] transform rotate-6 animate-pulse">
            <Bike size={26} />
          </div>

          {/* 3. Floating Takeout Paper Bag (Bottom-Right) */}
          <div className="absolute -bottom-2 right-10 sm:right-14 w-14 h-14 rounded-2xl bg-white p-2 border border-[#E5DDD0] shadow-lg flex items-center justify-center text-[#C2410C] transform rotate-3">
            <ShoppingBag size={26} />
          </div>

          {/* Central Metallic Glowing Mic Core */}
          <div className="relative z-10 w-36 h-36 rounded-full bg-gradient-to-b from-white via-[#FCFAF6] to-[#F1EDE4] border-2 border-white shadow-[0_12px_40px_rgba(255,122,0,0.28)] flex items-center justify-center text-[#FF7A00]">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#FF7A00] border-r-[#FF7A00] animate-spin" style={{ animationDuration: "3s" }} />
            <Mic size={42} className="stroke-[2.2] text-[#FF7A00]" />
          </div>
        </div>

        {/* Right Column: "Finding your best fit" + 3-Step Stepper */}
        <div className="lg:col-span-4 space-y-6 text-left">
          <h2 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#1F1F1F] leading-tight">
            Finding your<br />
            <span className="text-[#FF7A00]">best fit</span>
          </h2>

          {/* 3-Step Stepper */}
          <div className="space-y-4 pt-2">
            {/* Step 1: Understanding */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#FF7A00] text-white flex items-center justify-center shrink-0">
                <Check size={14} className="stroke-[3]" />
              </div>
              <span className="text-sm font-bold text-[#1F1F1F]">
                Understanding your request
              </span>
            </div>

            {/* Stepper Line */}
            <div className="w-0.5 h-4 bg-[#FF7A00] ml-3.5" />

            {/* Step 2: Checking offers */}
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                step >= 2 ? "bg-[#FF7A00] text-white ring-4 ring-[#FFEAD8]" : "bg-[#DDD4C7] text-white"
              }`}>
                {step > 2 ? <Check size={14} className="stroke-[3]" /> : <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />}
              </div>
              <span className={`text-sm font-bold ${step >= 2 ? "text-[#1F1F1F]" : "text-[#6F6B65]"}`}>
                Checking offers
              </span>
            </div>

            {/* Stepper Line */}
            <div className={`w-0.5 h-4 ml-3.5 ${step >= 3 ? "bg-[#FF7A00]" : "bg-[#E5DDD0]"}`} />

            {/* Step 3: Comparing full totals */}
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                step >= 3 ? "bg-[#FF7A00] text-white ring-4 ring-[#FFEAD8]" : "bg-[#E5DDD0] text-[#6F6B65]"
              }`}>
                <span className="w-2 h-2 rounded-full bg-[#5D5953]" />
              </div>
              <span className={`text-sm font-bold ${step >= 3 ? "text-[#1F1F1F]" : "text-[#6F6B65]"}`}>
                Comparing full totals
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Wave Lines at Bottom */}
      <div className="w-full h-10 border-t border-[#E5DDD0]/50 relative overflow-hidden pointer-events-none opacity-40">
        <svg className="w-full h-full" viewBox="0 0 1200 40" fill="none" preserveAspectRatio="none">
          <path d="M0 25C300 10 600 35 900 15C1050 5 1150 20 1200 25" stroke="#FF7A00" strokeWidth="1.5" />
          <path d="M0 32C350 20 650 40 950 25C1100 15 1180 28 1200 32" stroke="#E5DDD0" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
