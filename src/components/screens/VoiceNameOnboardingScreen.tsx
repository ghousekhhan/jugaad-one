"use client";

import { useState, useRef, type FormEvent } from "react";
import { Mic, ArrowRight, User, MapPin, Globe, Layers, Send, Utensils, ShoppingBag, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { voiceLanguages, type VoiceLocale } from "@/lib/voice/types";

export function VoiceNameOnboardingScreen({
  userName,
  selectedLanguage,
  onNameSubmit,
  onNextStep,
  onMicClick,
  isListening = true,
}: {
  userName: string;
  selectedLanguage: VoiceLocale;
  onNameSubmit: (name: string) => void;
  onNextStep: () => void;
  onMicClick?: () => void;
  isListening?: boolean;
}) {
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = inputText.trim();
    if (clean) {
      onNameSubmit(clean);
      setInputText("");
    }
  }

  const langLabel = voiceLanguages[selectedLanguage]?.label ?? "English";

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-8">
      {/* 1. Header Navigation Bar with Tabs */}
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
            <Utensils size={14} />
            <span>Food Order</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5D5953] hover:text-[#1F1F1F]">
            <ShoppingBag size={14} />
            <span>My Orders</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[#5D5953] hover:text-[#1F1F1F]">
            <Settings size={14} />
            <span>Settings</span>
          </div>
        </div>

        {/* User Pill */}
        <div className="w-9 h-9 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#5D5953]">
          <User size={18} />
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Primary Voice Stage */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#6F6B65]">
              — ORDER FOOD BY VOICE —
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-[#1F1F1F] leading-[1.12]">
              Hi, I&apos;m <span className="text-[#FF7A00]">Jugaad.</span>
              <br />
              What should I call you?
            </h1>
            <p className="text-base text-[#5D5953] leading-relaxed max-w-lg">
              Let&apos;s get you set up to order food on Wiggy and Tomato — just a few quick things, by voice.
            </p>
          </div>

          {/* Central Glowing Microphone with Flanking Waveforms */}
          <div className="flex flex-col items-center justify-center py-6 relative">
            {/* Ambient Background Glow */}
            <div className="absolute w-52 h-52 rounded-full bg-gradient-to-tr from-[#FF7A00]/30 to-[#FF633A]/15 blur-2xl pointer-events-none" />

            <div className="flex items-center gap-6 relative z-10">
              {/* Left Waveform */}
              <div className="flex items-center gap-1 text-[#FF7A00]" aria-hidden="true">
                <span className="w-1 h-3 bg-[#FF7A00] rounded-full animate-pulse" />
                <span className="w-1 h-6 bg-[#FF7A00] rounded-full animate-pulse delay-75" />
                <span className="w-1 h-9 bg-[#FF7A00] rounded-full animate-pulse delay-150" />
                <span className="w-1 h-5 bg-[#FF7A00] rounded-full animate-pulse delay-100" />
                <span className="w-1 h-2 bg-[#FF7A00] rounded-full animate-pulse" />
              </div>

              {/* Central Glowing Mic Button */}
              <button
                type="button"
                onClick={onMicClick}
                aria-label="Speak your name"
                className="w-24 h-24 rounded-full bg-gradient-to-b from-[#FF7A00] to-[#E5483F] shadow-[0_8px_28px_rgba(255,122,0,0.35)] flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200"
              >
                <Mic size={36} className="text-white" />
              </button>

              {/* Right Waveform */}
              <div className="flex items-center gap-1 text-[#FF7A00]" aria-hidden="true">
                <span className="w-1 h-2 bg-[#FF7A00] rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-[#FF7A00] rounded-full animate-pulse delay-100" />
                <span className="w-1 h-9 bg-[#FF7A00] rounded-full animate-pulse delay-150" />
                <span className="w-1 h-6 bg-[#FF7A00] rounded-full animate-pulse delay-75" />
                <span className="w-1 h-3 bg-[#FF7A00] rounded-full animate-pulse" />
              </div>
            </div>

            {/* Listening Pill Below Mic */}
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFEAD8] text-xs font-bold text-[#C2410C]">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-ping" />
              <span>{isListening ? "Listening…" : "Tap mic to speak"}</span>
            </div>
          </div>

          {/* Next Info Pill Button */}
          <button
            type="button"
            onClick={onNextStep}
            className="w-full max-w-lg mx-auto flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-[#E5DDD0] text-xs font-semibold text-[#5D5953] hover:border-[#FF7A00] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-[#FF7A00]" />
              <span>Next: We&apos;ll detect your <strong>location</strong> and confirm language</span>
            </div>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Typing Fallback Pill */}
          <form onSubmit={handleFormSubmit} className="w-full max-w-lg mx-auto relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or type here (e.g., &ldquo;Call me Arjun&rdquo;)"
              className="w-full px-5 py-3.5 pr-12 rounded-full bg-white border border-[#E5DDD0] text-sm text-[#1F1F1F] placeholder:text-[#6F6B65] focus:outline-none focus:border-[#FF7A00] shadow-sm"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-2 top-2 w-8 h-8 rounded-full bg-[#FF7A00] disabled:bg-[#DDD4C7] text-white flex items-center justify-center transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* Right Column: "Getting you ready" Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-5">
            {/* Header with Circular Progress Ring */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-display text-[#1F1F1F]">
                  Getting you ready
                </h2>
                <p className="text-xs text-[#5D5953] mt-0.5">
                  Live setup for food ordering
                </p>
              </div>
              <div className="w-11 h-11 rounded-full border-2 border-[#FF7A00] flex items-center justify-center text-xs font-black text-[#FF7A00]">
                1 of 4
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
              {/* Item 1: Name (Active) */}
              <div className="p-3.5 rounded-2xl bg-[#FFF8F3] border border-[#FFD2B3] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00]">
                    <User size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1F1F1F]">Your Name</div>
                    <div className="text-[11px] text-[#5D5953]">
                      {userName ? userName : "Not set yet"}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#FFEAD8] text-[10px] font-bold text-[#C2410C]">
                  ● Listening…
                </span>
              </div>

              {/* Item 2: Language Preference */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DDD0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F0EBE2] flex items-center justify-center text-[#5D5953]">
                    <Globe size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1F1F1F]">Language Preference</div>
                    <div className="text-[11px] text-[#5D5953]">{langLabel}</div>
                  </div>
                </div>
                <span className="w-5 h-5 rounded-full border-2 border-[#16866E] flex items-center justify-center text-[#16866E] text-[10px] font-bold">
                  ✓
                </span>
              </div>

              {/* Item 3: Location Access */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DDD0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F0EBE2] flex items-center justify-center text-[#5D5953]">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1F1F1F]">Location Access</div>
                    <div className="text-[11px] text-[#5D5953]">Will detect your location</div>
                  </div>
                </div>
                <span className="text-xs text-[#6F6B65]">🔒</span>
              </div>

              {/* Item 4: Food Providers */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E5DDD0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#F0EBE2] flex items-center justify-center text-[#5D5953]">
                    <Layers size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1F1F1F]">Food Providers</div>
                    <div className="text-[11px] text-[#5D5953]">Order from Wiggy &amp; Tomato</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-md bg-[#FF7A00] text-white text-[9px] font-black flex items-center justify-center">
                    W
                  </span>
                  <span className="w-5 h-5 rounded-md bg-[#E5483F] text-white text-[9px] font-black flex items-center justify-center">
                    T
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Tip Card */}
          <div className="bg-[#FFF8F3] border border-[#FFD2B3] rounded-3xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00] shrink-0">
              <Utensils size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1F1F1F] mb-1">Food ordering, your way</h3>
              <p className="text-xs text-[#5D5953] leading-relaxed">
                Search, reorder, and get great food from Wiggy and Tomato — all by voice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
