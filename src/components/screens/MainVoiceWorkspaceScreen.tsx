"use client";

import { useState, type FormEvent } from "react";
import { Send, Sparkles, Volume2, VolumeX, User, Package, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { VoiceControls } from "@/components/voice-controls";
import { ConstraintChips } from "@/components/constraint-chips";
import { FoodConversationLog, type ConversationEntry } from "@/components/food-conversation-log";
import type { VoiceLocale } from "@/lib/voice/types";
import { voiceLanguages } from "@/lib/voice/types";
import type { FoodIntent, FoodTurn } from "@/lib/integrations/food-intent";
import type { VoicePlayback } from "@/components/use-voice-playback";
import type { VoiceTranscript } from "@/lib/voice/types";

export function MainVoiceWorkspaceScreen({
  userName,
  cityName,
  voiceLanguage,
  onLanguageChange,
  onOpenProfile,
  onOpenOrders,
  ordersCount,
  onStartVoice,
  onSubmitVoice,
  onApplyTranscript,
  onInterpretText,
  playback,
  isInterpreting,
  capturingVoice,
  onCapturingChange,
  constraints,
  onRemoveConstraint,
  conversation,
  onSpeakReply,
  locationFeedback,
  onResetSession,
}: {
  userName: string;
  cityName: string;
  voiceLanguage: VoiceLocale;
  onLanguageChange: (lang: VoiceLocale) => void;
  onOpenProfile: () => void;
  onOpenOrders: () => void;
  ordersCount: number;
  onStartVoice: (signal: AbortSignal) => Promise<void>;
  onSubmitVoice: (text: string, language: VoiceLocale, signal: AbortSignal) => Promise<"stop" | "pause" | "mute" | void>;
  onApplyTranscript: (result: VoiceTranscript) => void;
  onInterpretText: (text: string) => Promise<void>;
  playback: VoicePlayback;
  isInterpreting: boolean;
  capturingVoice: boolean;
  onCapturingChange: (capturing: boolean) => void;
  constraints?: FoodIntent;
  onRemoveConstraint: (key: keyof FoodIntent | "location") => void;
  conversation: ConversationEntry[];
  onSpeakReply?: (result: FoodTurn) => void;
  locationFeedback?: string;
  onResetSession?: () => void;
}) {
  const [typedText, setTypedText] = useState("");
  const [showHistory, setShowHistory] = useState(conversation.length > 0);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = typedText.trim();
    if (clean) {
      void onInterpretText(clean);
      setTypedText("");
    }
  }

  const langConfig = voiceLanguages[voiceLanguage] ?? voiceLanguages["en-IN"];

  const suggestions = {
    "en-IN": [
      "Chicken biryani under ₹400",
      "Paneer butter masala for dinner",
      "What is biryani?",
      "Something sweet for dessert",
      "What can you do?",
    ],
    "hi-IN": [
      "चिकन बिरयानी ₹400 के अंदर",
      "पनीर बटर मसाला डिनर के लिए",
      "बिरयानी क्या है?",
      "कुछ मीठा चाहिए",
      "तुम क्या कर सकते हो?",
    ],
    "te-IN": [
      "చికెన్ బిర్యానీ ₹400 లోపు",
      "పనీర్ బటర్ మసాలా రాత్రి భోజనం కోసం",
      "బిర్యానీ అంటే ఏమిటి?",
      "తీపి లేదా డెసర్ట్ కావాలి",
      "నువ్వు ఏమి చేయగలవు?",
    ],
    "hi-en": [
      "Chicken biryani under 400",
      "Paneer butter masala dinner ke liye",
      "Biryani kya hai?",
      "Kuch meetha dessert chahiye",
      "What can you do?",
    ],
  }[voiceLanguage] ?? [
    "Chicken biryani under ₹400",
    "Paneer butter masala for dinner",
    "What is biryani?",
    "Something sweet for dessert",
    "What can you do?",
  ];

  const greetingHeading = {
    "en-IN": `Hey, ${userName}!`,
    "hi-IN": `नमस्ते, ${userName}!`,
    "te-IN": `నమస్తే, ${userName}!`,
    "hi-en": `Hey, ${userName}!`,
  }[voiceLanguage] ?? `Hey, ${userName}!`;

  const greetingSub = {
    "en-IN": "One conversation. From wanting it to getting it.",
    "hi-IN": "सिर्फ बोलिए, तुलना कीजिए और ऑर्डर पाइए।",
    "te-IN": "సహజంగా మాట్లాడండి, పోల్చండి మరియు ఆర్డర్ చేయండి.",
    "hi-en": "Say it, compare it, pay for it. All by voice.",
  }[voiceLanguage] ?? "One conversation. From wanting it to getting it.";

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-6">
      {/* 1. Header Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-3">
          <BrandMark size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#1F1F1F]">
            Jugaad<span className="text-[#FF7A00]">One</span>
          </span>
        </div>

        {/* Profile & Controls Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* User & City Pill */}
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={`Profile: ${userName}, ${cityName || "Choose a city"}. Click to edit.`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-bold text-[#1F1F1F] hover:border-[#FF7A00] transition-colors cursor-pointer shadow-sm"
          >
            <User size={13} className="text-[#FF7A00]" />
            <span>{userName}</span>
            <span className="text-[#DDD4C7]">·</span>
            <span className="text-[#5D5953]">{cityName || "Set city"}</span>
          </button>

          {/* Language Selector Pill */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-bold text-[#1F1F1F] hover:border-[#FF7A00] transition-colors cursor-pointer shadow-sm"
            >
              <span>🌐</span>
              <span>{langConfig.label}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-[#E5DDD0] rounded-xl shadow-lg p-1 z-30 min-w-[140px]">
              {(["en-IN", "hi-IN", "te-IN", "hi-en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLanguageChange(code)}
                  className={`px-3 py-1.5 rounded-lg text-left text-xs font-semibold cursor-pointer transition-colors ${
                    voiceLanguage === code ? "bg-[#FFEAD8] text-[#C2410C]" : "hover:bg-[#F8F5EE] text-[#1F1F1F]"
                  }`}
                >
                  {voiceLanguages[code].label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Pill */}
          <button
            type="button"
            onClick={onOpenOrders}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E5DDD0] text-xs font-bold text-[#5D5953] hover:text-[#1F1F1F] hover:border-[#FF7A00] transition-colors cursor-pointer shadow-sm"
          >
            <Package size={13} className="text-[#FF7A00]" />
            <span>Orders {ordersCount > 0 && `(${ordersCount})`}</span>
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => playback.toggleMute()}
            aria-label={playback.muted ? "Unmute audio" : "Mute audio"}
            className="w-8 h-8 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#5D5953] hover:text-[#1F1F1F] transition-colors cursor-pointer shadow-sm"
          >
            {playback.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Reset / New Session */}
          {onResetSession && (
            <button
              type="button"
              onClick={onResetSession}
              aria-label="Start fresh conversation"
              title="Start fresh conversation"
              className="w-8 h-8 rounded-full bg-white border border-[#E5DDD0] flex items-center justify-center text-[#5D5953] hover:text-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer shadow-sm"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Hero Voice Centerpiece */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#E5DDD0] shadow-sm text-center space-y-6 relative overflow-hidden">
        {/* Soft Ambient Radial Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-[#FF7A00]/15 via-[#FF633A]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Greeting & Headline */}
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF4EC] border border-[#FFE0CC] text-xs font-bold text-[#C2410C]">
            <Sparkles size={14} className="text-[#FF7A00]" />
            <span>Voice-first transaction assistant</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
            {greetingHeading}
          </h1>
          <p className="text-base text-[#5D5953] max-w-lg mx-auto leading-relaxed">
            {greetingSub}
          </p>
        </div>

        {/* Central Glowing Microphone */}
        <div className="py-4 relative z-10 max-w-md mx-auto space-y-2">
          <VoiceControls
            language={voiceLanguage}
            onLanguage={onLanguageChange}
            onTranscript={onApplyTranscript}
            onAutoSubmit={onSubmitVoice}
            onStarted={onStartVoice}
            onCapture={onCapturingChange}
            playback={playback}
            disabled={isInterpreting}
            agentResponding={isInterpreting}
          />
          {capturingVoice && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFEAD8] text-xs font-bold text-[#FF7A00] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
              <span>Listening to your voice…</span>
            </div>
          )}
        </div>

        {locationFeedback && (
          <p className="text-xs font-semibold text-[#5D5953] relative z-10" role="status">
            {locationFeedback}
          </p>
        )}

        {/* Quick Suggestion Chips */}
        <div className="pt-2 relative z-10 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F6B65]">
            Try saying or asking:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void onInterpretText(suggestion)}
                className="px-4 py-2 rounded-full bg-[#F8F5EE] hover:bg-[#FFEAD8] hover:text-[#C2410C] border border-[#E5DDD0] text-xs font-semibold text-[#1F1F1F] transition-all cursor-pointer shadow-sm active:scale-95"
              >
                &ldquo;{suggestion}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Active Constraints Chips Bar */}
      {constraints && Object.keys(constraints).length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-[#E5DDD0] shadow-sm">
          <ConstraintChips
            constraints={constraints}
            locationLabel={cityName || undefined}
            onRemove={onRemoveConstraint}
          />
        </div>
      )}

      {/* 4. Conversation History Drawer */}
      {conversation.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5DDD0] shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 bg-[#F8F5EE] text-left cursor-pointer hover:bg-[#F3ECE1] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#6F6B65]">
                Conversation
              </span>
              <span className="w-2 h-2 rounded-full bg-[#16866E]" />
              <span className="text-xs text-[#5D5953]">({conversation.length} turns)</span>
            </div>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHistory && (
            <div className="p-4 border-t border-[#E5DDD0]/70 max-h-80 overflow-y-auto">
              <FoodConversationLog
                entries={conversation}
                onSpeak={onSpeakReply}
              />
            </div>
          )}
        </div>
      )}

      {/* 5. Text Input Fallback Bar at Bottom */}
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder={`Type a request in ${langConfig.label} or English… (e.g. "What is biryani?" or "Order dosa under ₹200")`}
          className="w-full bg-white border border-[#E5DDD0] rounded-full py-4 pl-6 pr-14 text-sm font-medium text-[#1F1F1F] placeholder:text-[#6F6B65] focus:outline-none focus:border-[#FF7A00] shadow-sm transition-all"
        />
        <button
          type="submit"
          disabled={!typedText.trim() || isInterpreting}
          aria-label="Send message"
          className="absolute right-2.5 w-10 h-10 rounded-full bg-[#FF7A00] hover:bg-[#E56A00] disabled:bg-[#DDD4C7] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}