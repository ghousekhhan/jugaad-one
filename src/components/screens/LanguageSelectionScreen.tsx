"use client";

import { ArrowRight, Mic, Layers } from "lucide-react";
import { BrandMark } from "@/components/brand";
import type { VoiceLocale } from "@/lib/voice/types";

const languageCards: Array<{
  id: VoiceLocale;
  label: string;
  native: string;
  sub: string;
}> = [
  { id: "en-IN", label: "English", native: "English", sub: "Indian English" },
  { id: "hi-IN", label: "हिन्दी", native: "Hindi", sub: "सहज और स्पष्ट" },
  { id: "te-IN", label: "తెలుగు", native: "Telugu", sub: "సహజమైన సంభాషణ" },
  { id: "hi-en", label: "Hinglish", native: "Hinglish", sub: "Hindi + English blend" },
];

export function LanguageSelectionScreen({
  selectedLanguage,
  onSelectLanguage,
  onMicClick,
  isListening = false,
}: {
  selectedLanguage: VoiceLocale;
  onSelectLanguage: (lang: VoiceLocale) => void;
  onMicClick?: () => void;
  isListening?: boolean;
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

      {/* Main 3-Column Center Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-10 my-auto">
        {/* Left Column: Heading */}
        <div className="lg:col-span-4 space-y-4 text-center lg:text-left">
          <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-[#1F1F1F] leading-[1.12]">
            Which language feels like <span className="text-[#FF7A00]">home?</span>
          </h1>
          <p className="text-base text-[#5D5953] leading-relaxed max-w-sm mx-auto lg:mx-0">
            Talk to Jugaad One in the language you&apos;re most comfortable with. You can change it anytime.
          </p>
        </div>

        {/* Center Column: Radiant Glowing Microphone */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center relative py-6">
          {/* Subtle Outer Concentric Rings */}
          <div className="absolute w-72 h-72 rounded-full border border-[#E5DDD0]/50 pointer-events-none" />
          <div className="absolute w-60 h-60 rounded-full border border-[#FF7A00]/20 pointer-events-none animate-pulse" />

          {/* Radial Orange Backlight Glow */}
          <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#FF7A00]/40 to-[#FF633A]/20 blur-2xl pointer-events-none" />

          {/* Main Metallic/White Mic Button */}
          <button
            type="button"
            onClick={onMicClick}
            aria-label="Activate microphone to choose language"
            className="relative z-10 w-36 h-36 rounded-full bg-gradient-to-b from-white via-[#FCFAF6] to-[#F1EDE4] border-2 border-white shadow-[0_12px_36px_rgba(255,122,0,0.22),0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-center text-[#FF7A00] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
          >
            {/* Glowing Accent Arc */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#FF7A00] border-r-[#FF7A00]/80 group-hover:rotate-45 transition-transform duration-500" />
            <Mic size={40} className="stroke-[2.2] text-[#1F1F1F] group-hover:text-[#FF7A00] transition-colors" />
          </button>

          {/* Status Label Below Mic */}
          <div className="flex items-center gap-2 mt-6 text-sm font-semibold text-[#1F1F1F]">
            <span className="flex items-center gap-0.5 text-[#FF7A00]">
              <span className="w-1 h-3 bg-[#FF7A00] rounded-full animate-bounce" />
              <span className="w-1 h-4 bg-[#FF7A00] rounded-full animate-bounce delay-100" />
              <span className="w-1 h-2 bg-[#FF7A00] rounded-full animate-bounce delay-200" />
            </span>
            <span>{isListening ? "Listening to your voice…" : "Listening for your choice"}</span>
          </div>
        </div>

        {/* Right Column: 4 Rounded Pill Buttons with Arrows */}
        <div className="lg:col-span-4 flex flex-col gap-3.5 max-w-sm mx-auto lg:mx-0 w-full">
          {languageCards.map((lang) => {
            const isSelected = selectedLanguage === lang.id;
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => onSelectLanguage(lang.id)}
                className={`w-full flex items-center justify-between px-6 py-4 rounded-full border transition-all duration-150 text-left cursor-pointer group ${
                  isSelected
                    ? "bg-white border-[#FF7A00] shadow-[0_4px_16px_rgba(255,122,0,0.14)]"
                    : "bg-white/80 hover:bg-white border-[#E5DDD0] hover:border-[#1F1F1F]"
                }`}
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="text-lg font-bold text-[#1F1F1F] font-display">
                    {lang.label}
                  </span>
                  <span className="text-xs text-[#6F6B65] font-medium">
                    {lang.sub}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#5D5953] group-hover:text-[#FF7A00] group-hover:translate-x-1 transition-all">
                  <ArrowRight size={18} />
                </div>
              </button>
            );
          })}
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
