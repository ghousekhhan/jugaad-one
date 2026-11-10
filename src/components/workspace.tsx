"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, CircleMinus, Globe, MapPin, Plus, ReceiptText, Search, SlidersHorizontal } from "lucide-react";
import { CategoryIcon } from "./category-icon";
import { Button, Panel } from "./ui";
import { FoodDiscovery, emptyFoodFilters, type FoodFilters, type SelectedFoodOffer } from "./food-discovery";
import { FoodLocationFields } from "./food-location";
import { FoodCheckout, OrderHistory } from "./food-checkout";
import { FoodConversationLog, type ConversationEntry } from "./food-conversation-log";
import { SandboxCommerce } from "./sandbox-commerce";
import type { CommerceAction, SandboxState } from "@/lib/commerce/types";
import type { Profile, Session } from "@/lib/commerce/session";
import { calculateDistanceKm, demoCities, matchGpsToDemoCity } from "@/lib/marketplace/demo-cities";
import { confirmationAnswer } from "@/lib/dialogue/confirmation";
import { exitAction } from "@/lib/dialogue/actions";
import { VoiceControls } from "./voice-controls";
import { useVoicePlayback } from "./use-voice-playback";
import { ApprovedShell, ApprovedWordmark, type WorkspaceTab } from "./approved-shell";
import { ApprovedOrders, ApprovedProfile } from "./approved-settings";
import { ConstraintChips } from "./constraint-chips";
import { postJson, requestJson } from "@/lib/client-request";
import type { FoodIntent, FoodTurn } from "@/lib/integrations/food-intent";
import { exampleRequest, requestLanguages, requestSchema, type RequestDraft, type SavedRequest } from "@/lib/request";
import type { CheckoutSummary, FoodTransaction } from "@/lib/marketplace/checkout-types";
import type { MarketplaceCity, MarketplaceResult } from "@/lib/marketplace/schemas";
import type { FoodLocation } from "@/lib/marketplace/discovery-types";
import type { providerDirectory } from "@/lib/integrations/registry";
import { transactionSpeech } from "@/lib/voice/transaction-speech";
import { voiceLanguages, voiceLocale, type VoiceLocale, type VoiceTranscript } from "@/lib/voice/types";


type FieldErrors = Partial<Record<keyof RequestDraft, string>>;
type WorkspaceProps = {
  initialDraft: RequestDraft;
  providers: typeof providerDirectory;
  geminiAvailable: boolean;
  voiceAvailable: boolean;
};

const transactionStages = ["Provider quote", "User approval", "Simulated payment", "Provider booking", "Receipt"];

function WorkspacePanel({ index, title, children, className }: { index: string; title: string; children: ReactNode; className: string }) {
  return <Panel className={`workspace-panel ${className}`}><div className="workspace-panel__header"><span className="workspace-panel__index" aria-hidden="true">{index}</span><h2>{title}</h2></div><div className="workspace-panel__body">{children}</div></Panel>;
}

export function Workspace({ initialDraft, providers, geminiAvailable, voiceAvailable }: WorkspaceProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [history, setHistory] = useState<Array<{ id: number; request: SavedRequest }>>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [foodLocation, setFoodLocation] = useState<FoodLocation | null>(null);
  const [foodFilters, setFoodFilters] = useState<FoodFilters>({ ...emptyFoodFilters, query: initialDraft.text === exampleRequest.text ? "Paneer makhani" : "" });
  const [selectedOffer, setSelectedOffer] = useState<SelectedFoodOffer | null>(null);
  const [voiceQuote, setVoiceQuote] = useState<FoodTransaction>();
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [historyReload, setHistoryReload] = useState(0);
  const [activeReceipt, setActiveReceipt] = useState<string | null>(null);
  const [justConfirmedProvider, setJustConfirmedProvider] = useState<string>();
  const [finalTranscript, setFinalTranscript] = useState("");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [interpretationPending, setInterpretationPending] = useState(false);
  const [interpretationError, setInterpretationError] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLocale>("en-IN");
  const [voiceEpoch, setVoiceEpoch] = useState(0);
  const [capturingVoice, setCapturingVoice] = useState(false);
  const [sandbox, setSandbox] = useState<SandboxState>({ offers: [], orders: [] });
  const [currentSandboxOrder, setCurrentSandboxOrder] = useState<string>();
  const [commercePending, setCommercePending] = useState(false);
  const commerceBusy = useRef(false);
  const [restoredTurn, setRestoredTurn] = useState<FoodTurn>();
  const [restoredIntent, setRestoredIntent] = useState<FoodIntent>();
  const [profile, setProfile] = useState<Profile>();
  const [onboardingStage, setOnboardingStage] = useState<"ready" | "permission" | "name" | "confirm-name" | "language" | "confirm-language" | "region" | "confirm-region">("ready");
  const [candidateLanguage, setCandidateLanguage] = useState<VoiceLocale>();
  const [candidateName, setCandidateName] = useState("");
  const [candidateLocation, setCandidateLocation] = useState<{ location: FoodLocation; accuracy: number; label: string; locality?: string }>();
  const [candidateRegion, setCandidateRegion] = useState<Profile["region"]>();
  const [locationFeedback, setLocationFeedback] = useState("");
  const [userName, setUserName] = useState("");
  const [cityName, setCityName] = useState("");
  const onboardingCommit = useRef(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingCity, setOnboardingCity] = useState<NonNullable<Profile["region"]>>("hyderabad");
  const [sessionError, setSessionError] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const params = useSearchParams();
  const requestedTab = params.get("tab");
  const tab: WorkspaceTab = requestedTab === "orders" || requestedTab === "profile" ? requestedTab : "jugaad";
  const transcriptLanguage = useRef<VoiceLocale | null>(null);
  const voiceSession = useRef(false);
  const announced = useRef(new Set<string>());
  const playback = useVoicePlayback();
  const { stop: stopPlayback } = playback;
  const interpretationRequest = useRef<AbortController | null>(null);
  const pendingText = useRef<string | undefined>(undefined);
  const transcriptRegion = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const quoteHeading = useRef<HTMLHeadingElement>(null);
  const nextRequestId = useRef(1);
  const latestTurn = conversation.at(-1)?.response ?? restoredTurn;
  const saved = history[0]?.request;
  const category = draft.category || saved?.category;
  const relevantProviders = category ? providers.filter((provider) => provider.category === category) : providers;
  const foodActive = category !== "rides";

  useEffect(() => {
    const controller = new AbortController();
    requestJson<Session>("/api/commerce", { signal: controller.signal }).then((session) => {
      if (controller.signal.aborted) return;
      setSandbox({ offers: session.offers, quote: session.quote, orders: session.orders });
      setRestoredIntent(session.current);
      const restored = session.dialogue?.task;
      if (restored) {
        setRestoredTurn(restored.turn);
        const comparison = restored.turn.comparison;
        const selected = comparison?.result.kind === "offers" ? comparison.result.offers.find(({ quote }) => quote.id === restored.selectedId) : undefined;
        if (selected && comparison) setSelectedOffer({ offer: selected, search: comparison.input });
        if (session.providerQuoteId) {
          void requestJson<FoodTransaction>(`/api/marketplace/transactions/${session.providerQuoteId}`, { signal: controller.signal })
            .then((transaction) => { if (!controller.signal.aborted) setVoiceQuote(transaction); }, () => {});
        }
      }
      if (session.profile) {
        setProfile(session.profile);
        setUserName(session.profile.name);
        setVoiceLanguage(session.profile.language);
        const savedLanguage = session.profile.language;
        setDraft((value) => ({ ...value, language: savedLanguage === "hi-en" ? "hi-IN" : savedLanguage }));
        setFoodLocation(session.profile.location ?? null);
        setCityName(session.profile.region ? demoCities[session.profile.region].name : "");
        setOnboardingStage(session.profile.region ? "ready" : "region");
      } else {
        const language = voiceLocale.safeParse(sessionStorage.getItem("jugaad-onboarding-locale"));
        if (language.success) {
          setVoiceLanguage(language.data);
          setOnboardingStage("name");
        } else setOnboardingStage("permission");
      }
      setSessionLoaded(true);
    }, (error: Error) => {
      if (!controller.signal.aborted) {
        setSessionError(error.message);
        setOnboardingStage("permission");
        setSessionLoaded(true);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const region = transcriptRegion.current;
    if (region) region.scrollTop = region.scrollHeight;
  }, [conversation, finalTranscript]);
  useEffect(() => { if (selectedOffer) quoteHeading.current?.focus(); }, [selectedOffer]);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<CheckoutSummary>("/api/marketplace/transactions", { signal: controller.signal }).then(
      (summary) => { setCheckout(summary); setCheckoutError(""); },
      (error: Error) => { if (!controller.signal.aborted) setCheckoutError(error.message); },
    );
    return () => controller.abort();
  }, [historyReload]);
  useEffect(() => () => interpretationRequest.current?.abort(), []);

  async function saveProfile(value: Profile, signal?: AbortSignal) {
    await postJson("/api/commerce", { action: "profile", profile: value }, signal);
    if (signal?.aborted) return;
    sessionStorage.removeItem("jugaad-onboarding-locale");
    setProfile(value);
    setUserName(value.name);
    setFoodLocation(value.location ?? null);
    setCityName(value.region ? demoCities[value.region].name : "");
  }

  async function sayPrompt(prompt: string, language: VoiceLocale, signal?: AbortSignal, name?: string, waitForEnd = false) {
    const reply = await postJson<{ text: string; speechTicket?: string }>("/api/voice/greeting", { prompt, language, ...(name ? { name } : {}) }, signal);
    setLocationFeedback(reply.text);
    if (reply.speechTicket && !playback.muted) {
      await playback.play({ kind: "reply", ticket: reply.speechTicket }, { text: reply.text, language }, signal);
      if (waitForEnd) await playback.waitForEnd(signal);
    }
  }

  async function chooseRegion(region: NonNullable<Profile["region"]>, signal?: AbortSignal, language = voiceLanguage, location?: FoodLocation, locality?: string) {
    if (!profile || signal?.aborted || onboardingCommit.current) return;
    onboardingCommit.current = true;
    try {
      await saveProfile({ ...profile, region, location: location ?? { source: "manual", cityId: region }, locality });
    } finally {
      onboardingCommit.current = false;
    }
    transcriptLanguage.current = null;
    setOnboardingStage("ready");
    setCapturingVoice(false);
    setSelectedOffer(null);
    setVoiceQuote(undefined);
    setRestoredTurn(undefined);
    setRestoredIntent(undefined);
    setConversation([]);
    setCandidateLocation(undefined);
    await sayPrompt("ready", language, signal, undefined, Boolean(signal));
  }

  function locateRegion() {
    if (!navigator.geolocation) { setLocationFeedback("Choose a demo city to continue."); return; }
    setLocationFeedback("Checking your device location…");
    navigator.geolocation.getCurrentPosition(async ({ coords, timestamp }) => {
      if (coords.accuracy > 2500 || Date.now() - timestamp > 60_000) {
        setLocationFeedback("The device location was too approximate. Choose a demo city.");
        return;
      }
      const match = matchGpsToDemoCity(coords);
      if (!match.isWithinSupportedRegion) {
        setLocationFeedback("You are outside the demo regions. Choose Hyderabad, Bengaluru, Mumbai or Delhi.");
        return;
      }
      const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
      let locality: string | undefined;
      try {
        const catalog = await requestJson<MarketplaceResult<{ cities: MarketplaceCity[] }>>("/api/marketplace/cities", { signal: AbortSignal.timeout(5_000) });
        const city = catalog.data.cities.find(({ id }) => id === match.matchedCity.id);
        const nearest = city?.neighborhoods.map((entry) => ({ entry, km: calculateDistanceKm(coords.latitude, coords.longitude, entry.coordinates.latitude, entry.coordinates.longitude) })).sort((a, b) => a.km - b.km)[0];
        if (nearest && nearest.km + coords.accuracy / 1000 <= 4) locality = nearest.entry.name;
      } catch { /* A city can still be confirmed when the neighborhood directory is unavailable. */ }
      const label = locality ? `${locality}, ${match.matchedCity.name}` : match.matchedCity.name;
      setCandidateRegion(match.matchedCity.id);
      setCandidateLocation({ location: { source: "gps", coordinates }, accuracy: Math.round(coords.accuracy), label, locality });
      setOnboardingStage("confirm-region");
      void sayPrompt("confirm_region", voiceLanguage, undefined, label).catch(() => setLocationFeedback(`Use the location near ${label}?`));
    }, () => setLocationFeedback("Location access was unavailable. Choose a demo city."), { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });
  }

  const updateTransaction = useCallback((transaction: FoodTransaction) => {
    setCheckout((current) => {
      const records = current?.transactions ?? [];
      const alreadyListed = records.some(({ id }) => id === transaction.id);
      return { configured: current?.configured ?? true, transactions: alreadyListed
        ? records.map((record) => record.id === transaction.id ? transaction : record)
        : [transaction, ...records] };
    });
  }, []);

  function update(field: keyof RequestDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "budget" || field === "distance" || field === "priority" || field === "category") setSelectedOffer(null);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  }

  function loadExample() {
    transcriptLanguage.current = null;
    setDraft(exampleRequest);
    setFoodFilters({ ...emptyFoodFilters, query: "Paneer makhani" });
    setSelectedOffer(null);
    setErrors({});
    setFeedback("Example loaded. Edit it or save it to this session.");
    formRef.current?.querySelector("textarea")?.focus();
  }

  function applyTranscript(result: VoiceTranscript) {
    setFinalTranscript(result.text);
    transcriptLanguage.current = result.language;
    setDraft((value) => ({ ...value, text: result.text, language: result.language === "hi-en" ? "hi-IN" : result.language }));
    setErrors((value) => ({ ...value, text: undefined }));
    setInterpretationError("");
    formRef.current?.querySelector("textarea")?.focus();
  }

  function speakReply(result: FoodTurn) {
    if (!result.speechTicket || capturingVoice) return;
    voiceSession.current = true;
    void playback.play({ kind: "reply", ticket: result.speechTicket }, { text: result.reply, language: result.replyLanguage ?? "en-IN" });
  }

  function speakTransaction(transaction: FoodTransaction, event: "approval" | "confirmation") {
    if (!voiceAvailable) return;
    const text = transactionSpeech(transaction, event, voiceLanguage);
    if (!text) return;
    voiceSession.current = true;
    void playback.play({ kind: event, transactionId: transaction.id, language: voiceLanguage }, { text, language: voiceLanguage });
  }

  function announceTransaction(transaction: FoodTransaction) {
    if (!voiceSession.current || playback.muted) return;
    const event = transaction.phase === "quoted" ? "approval" : transaction.phase === "confirmed" ? "confirmation" : null;
    if (!event) return;
    const key = `${event}:${transaction.id}`;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    speakTransaction(transaction, event);
  }

  async function actOnCommerce(input: CommerceAction, language = voiceLanguage, signal?: AbortSignal) {
    if (commerceBusy.current || interpretationRequest.current) return;
    commerceBusy.current = true;
    setCommercePending(true);
    setInterpretationError("");
    try {
      const result = await postJson<SandboxState & { speech?: string; speechTicket?: string }>("/api/commerce", { input, language }, signal);
      if (signal?.aborted) return;
      if (input.action === "pay" && result.orders[0] && !sandbox.orders.some(({ reference }) => reference === result.orders[0].reference)) setCurrentSandboxOrder(result.orders[0].reference);
      setSandbox(result);
      if (result.speechTicket && result.speech && voiceAvailable && !playback.muted) {
        await playback.play({ kind: "reply", ticket: result.speechTicket }, { text: result.speech, language }, signal);
      }
    } catch (error) {
      if (!signal?.aborted) setInterpretationError(error instanceof Error ? error.message : "The sandbox checkout could not continue.");
    } finally {
      commerceBusy.current = false;
      setCommercePending(false);
    }
  }

  async function startVoice(signal: AbortSignal) {
    if (onboardingStage === "permission" || onboardingStage === "language" || onboardingStage === "confirm-language") {
      if (onboardingStage === "confirm-language" && candidateLanguage) {
        await sayPrompt("confirm_language", "en-IN", signal, voiceLanguages[candidateLanguage].label, true);
      } else {
        setOnboardingStage("language");
        await sayPrompt("language_preference", "en-IN", signal, undefined, true);
      }
    } else if (profile) {
      setOnboardingStage(profile.region ? "ready" : "region");
      await sayPrompt(profile.region ? "returning" : "location", voiceLanguage, signal, profile.region ? profile.name : undefined, true);
    } else if (onboardingStage === "name" || onboardingStage === "confirm-name") {
      await sayPrompt(onboardingStage === "name" ? "name" : "confirm_name", voiceLanguage, signal, candidateName || undefined, true);
    }
  }

  async function acceptOnboardingLanguage(language: VoiceLocale, signal?: AbortSignal) {
    if (signal?.aborted) return;
    transcriptLanguage.current = null;
    changeLanguage(language);
    sessionStorage.setItem("jugaad-onboarding-locale", language);
    setCandidateLanguage(undefined);
    setOnboardingStage("name");
    setDraft((value) => ({ ...value, text: "" }));
    await sayPrompt("name", language, signal, undefined, Boolean(signal));
  }

  async function submitVoice(text: string, language: VoiceLocale, signal: AbortSignal) {
    try {
      const trimmed = text.trim().replace(/[.!?।]+$/u, "");
      if (exitAction(trimmed)) return await interpretRequest(trimmed, language);
      const answer = confirmationAnswer(trimmed);
      const yes = answer === "yes";
      const rename = trimmed.match(/^call me (.+?)(?: instead)?$/iu);
      if (onboardingStage === "language" || onboardingStage === "confirm-language") {
        const chosen: VoiceLocale | undefined = /hinglish|mix|दोनों|రెండు/iu.test(trimmed) ? "hi-en"
          : /telugu|తెలుగు|तेलुगु/iu.test(trimmed) ? "te-IN"
          : /hindi|हिंदी|हिन्दी/iu.test(trimmed) ? "hi-IN"
          : /english|ఇంగ్లీష్|अंग्रेज़ी/iu.test(trimmed) ? "en-IN" : undefined;
        if (onboardingStage === "confirm-language" && yes && candidateLanguage) {
          await acceptOnboardingLanguage(candidateLanguage, signal);
        } else if (chosen) {
          setCandidateLanguage(chosen);
          setOnboardingStage("confirm-language");
          await sayPrompt("confirm_language", "en-IN", signal, voiceLanguages[chosen].label, true);
        } else if (answer === "no") {
          setCandidateLanguage(undefined);
          setOnboardingStage("language");
          await sayPrompt("language_preference", "en-IN", signal, undefined, true);
        } else if (candidateLanguage) {
          await sayPrompt("confirm_language", "en-IN", signal, voiceLanguages[candidateLanguage].label, true);
        } else {
          await sayPrompt("language_preference", "en-IN", signal, undefined, true);
        }
        return;
      }
      if (rename || onboardingStage === "name") {
        if (!rename && answer) { await sayPrompt("name", language, signal, undefined, true); return; }
        const name = (rename?.[1] ?? trimmed.replace(/^(?:my name is|i am|i'm|call me|నా పేరు|मेरा नाम)\s+/iu, "")).trim();
        if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]{0,39}$/u.test(name) || name.split(/\s+/).length > 4) {
          await sayPrompt("name", language, signal, undefined, true);
          return;
        }
        setCandidateName(name);
        setDraft((value) => ({ ...value, text: "" }));
        setOnboardingStage("confirm-name");
        await sayPrompt("confirm_name", language, signal, name, true);
        return;
      }
      if (onboardingStage === "confirm-name") {
        if (!yes) {
          if (answer === "no") { setOnboardingStage("name"); setCandidateName(""); await sayPrompt("name", language, signal, undefined, true); }
          else await sayPrompt("confirm_name", language, signal, candidateName, true);
          return;
        }
        if (signal.aborted || onboardingCommit.current) return;
        onboardingCommit.current = true;
        try {
          await saveProfile({ ...profile, name: candidateName, language: voiceLanguage });
        } finally {
          onboardingCommit.current = false;
        }
        setOnboardingStage(profile?.region ? "ready" : "region");
        await sayPrompt(profile?.region ? "returning" : "intro_location", voiceLanguage, signal, candidateName, true);
        setDraft((value) => ({ ...value, text: "" }));
        return;
      }
      if (onboardingStage === "region" || onboardingStage === "confirm-region") {
        const region = /hyderabad|हैदराबाद|హైదరాబాద్/iu.test(trimmed) ? "hyderabad"
          : /bengaluru|bangalore|बेंगलुरु|బెంగళూరు/iu.test(trimmed) ? "bengaluru"
          : /mumbai|मुंबई|ముంబై/iu.test(trimmed) ? "mumbai"
          : /delhi|दिल्ली|ఢిల్లీ/iu.test(trimmed) ? "delhi" : yes ? candidateRegion : undefined;
        if (region) { await chooseRegion(region, signal, language, yes ? candidateLocation?.location : undefined, yes ? candidateLocation?.locality : undefined); setDraft((value) => ({ ...value, text: "" })); }
        else {
          if (answer === "no") { setCandidateRegion(undefined); setCandidateLocation(undefined); setOnboardingStage("region"); }
          await sayPrompt("location", language, signal, undefined, true);
        }
        return;
      }
      const landmark = trimmed.match(/^(?:save|use|add) (?:the )?(?:delivery )?landmark (.{2,100})$/iu);
      if (profile?.region && landmark) {
        await saveProfile({ ...profile, locality: landmark[1].trim() }, signal);
        setDraft((value) => ({ ...value, text: "" }));
        await sayPrompt("landmark", language, signal, landmark[1].trim());
        return;
      }

      return await interpretRequest(text, language, signal);
    } catch (error) {
      if (!signal.aborted) setInterpretationError(error instanceof Error ? error.message : "The voice step could not complete.");
    }
  }

  async function interpretRequest(overrideText?: string, overrideVoiceLanguage?: VoiceLocale, sessionSignal?: AbortSignal, silent = false) {
    const request = (overrideText ?? draft.text).trim();
    const wake = overrideVoiceLanguage && request.match(/^(?:hey|hi|हे|हेय|हाय|హే|హాయ్)[\s,]+(?:jugaad|jugad|जुगाड़|जुगाड|జుగాడ్)(?=$|[\s,.!?:।])[\s,.!?:।]*/iu);
    const text = wake ? request.slice(wake[0].length) || "hello" : request;
    if (!text || text.length > 1000) {
      setInterpretationError("Enter a request of up to 1,000 characters.");
      return;
    }
    const exit = exitAction(text);
    if ((commerceBusy.current && !exit) || (!sessionSignal && pendingText.current === text)) return;
    interpretationRequest.current?.abort();
    playback.stop();
    if (exit === "stop") {
      setVoiceEpoch((value) => value + 1);
      setCapturingVoice(false);
      voiceSession.current = false;
      setOnboardingStage(profile ? (profile.region ? "ready" : "region") : "language");
      setConversation([]);
      setFinalTranscript("");
      setRestoredTurn(undefined);
      setRestoredIntent(undefined);
      setSelectedOffer(null);
      setVoiceQuote(undefined);
      setSandbox((value) => ({ orders: value.orders, offers: [] }));
    }
    const controller = new AbortController();
    const signal = sessionSignal && !exit ? AbortSignal.any([sessionSignal, controller.signal]) : controller.signal;
    const spoken = overrideVoiceLanguage ?? transcriptLanguage.current;
    interpretationRequest.current = controller;
    pendingText.current = text;
    setInterpretationError("");
    setInterpretationPending(true);
    try {
      const turnId = crypto.randomUUID();
      const started = performance.now();
      const result = await postJson<FoodTurn>("/api/agent/interpret", {
        text, turnId, current: justConfirmedProvider || currentSandboxOrder ? {} : latestTurn?.constraints ?? restoredIntent ?? {}, location: foodLocation ?? undefined,
        voiceLanguage: spoken ?? voiceLanguage,
        recentRequests: conversation.filter(({ response }) => response.intent !== "other").slice(-4).map((entry) => entry.text.slice(0, 300)),
      }, signal);
      if (signal.aborted) return;
      transcriptLanguage.current = null;
      if (spoken && !exit) voiceSession.current = true;
      if (result.voiceControl === "stop" && exit !== "stop") {
        setVoiceEpoch((value) => value + 1);
        setCapturingVoice(false);
        voiceSession.current = false;
        playback.stop();
      }
      if (result.dialogueAction === "change_language" && result.replyLanguage) changeLanguage(result.replyLanguage);
      const activeScript = spoken && spoken in voiceLanguages ? voiceLanguages[spoken].script : requestLanguages[draft.language as SavedRequest["language"]]?.script ?? "en-IN";
      const entry = { id: nextRequestId.current++, text, response: result, lang: activeScript };
      if (!silent) setConversation((current) => [...current.slice(-7), entry]);
      setDraft((value) => ({ ...value, text: value.text.trim() === request ? "" : value.text, category: result.intent === "food_order" ? "food" : value.category }));
      setErrors((value) => ({ ...value, text: undefined }));
      if (result.transition === "switch") { setCurrentSandboxOrder(undefined); setJustConfirmedProvider(undefined); setActiveReceipt(null); }
      if (result.sandbox) {
        const newOrder = result.sandbox.orders.find(({ reference }) => !sandbox.orders.some((order) => order.reference === reference));
        if (newOrder) setCurrentSandboxOrder(newOrder.reference);
        setSandbox(result.sandbox);
      }
      else if (!result.keepSelection && (result.intent === "food_order" || result.transition === "pause" || result.transition === "end")) setSandbox((value) => ({ orders: value.orders, offers: [] }));
      if (!result.keepSelection || result.dialogueAction === "select" || result.dialogueAction === "cancel") {
        if (!result.keepSelection || result.dialogueAction === "cancel") setVoiceQuote(undefined);
        const chosen = result.selectedOfferId ?? result.selectedQuoteId;
        const comparison = result.comparison;
        const offer = comparison?.result.kind === "offers" ? comparison.result.offers.find(({ quote }) => quote.id === chosen) : undefined;
        if (offer && comparison) {
          if (offer.quote.id !== selectedOffer?.offer.quote.id) setVoiceQuote(undefined);
          setSelectedOffer({ offer, search: comparison.input });
        }
        else if (!result.keepSelection || result.sandbox) setSelectedOffer(null);
      }
      if (result.providerTransaction) {
        setVoiceQuote(result.providerTransaction);
        if (result.providerTransaction.phase === "confirmed") setJustConfirmedProvider(result.providerTransaction.id);
        updateTransaction(result.providerTransaction);
      }
      const speechRequested = Boolean(!exit && spoken && !playback.muted && result.speechTicket);
      if (speechRequested && result.speechTicket) {
        void playback.play({ kind: "reply", ticket: result.speechTicket }, { text: result.reply, language: result.replyLanguage ?? "en-IN" }, signal);
      }
      performance.measure("jugaad-dialogue", { start: started, end: performance.now(), detail: {
        ...result.trace, turnId, action: result.dialogueAction, domain: result.domain, transition: result.transition, speechRequested,
      } });
      return result.voiceControl;
    } catch (error) {
      if (!signal.aborted) setInterpretationError(error instanceof Error ? error.message : "Gemini could not interpret this request.");
    } finally {
      if (interpretationRequest.current === controller) {
        interpretationRequest.current = null;
        pendingText.current = undefined;
        setInterpretationPending(false);
      }
    }
  }

  function saveRequest(event: { preventDefault: () => void }) {
    event.preventDefault();
    const result = requestSchema.safeParse(draft);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof RequestDraft;
        fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors);
      setFeedback("");
      const firstInvalidField = formRef.current?.elements.namedItem(Object.keys(fieldErrors)[0]);
      if (firstInvalidField instanceof HTMLElement) firstInvalidField.focus();
      return;
    }
    const id = nextRequestId.current++;
    setHistory((current) => [{ id, request: result.data }, ...current]);
    setErrors({});
    setFeedback(result.data.category === "rides" ? "Request saved in this session. Ride discovery is pending." : "Request saved in this session. Enter a dish or restaurant to search Wiggy and Tomato.");
  }

  function handleRemoveConstraint(key: keyof FoodIntent | "location") {
    if (key === "location") {
      setFoodLocation(null);
      return;
    }
    const label = key === "dish" ? "dish" : key === "budgetPaise" ? "budget" : key === "minRating" ? "rating" : key;
    void interpretRequest(`Remove the ${label} filter.`);
  }

  const fieldState = (field: keyof RequestDraft) => ({
    id: field,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });

  const fieldError = (field: keyof RequestDraft) => errors[field] && <p className="field-error" role="alert" id={`${field}-error`}>{errors[field]}</p>;

  function changeLanguage(language: VoiceLocale) {
    setVoiceLanguage(language);
    setDraft((value) => ({ ...value, language: language === "hi-en" ? "hi-IN" : language }));
    if (profile) void saveProfile({ ...profile, language }).catch(() => setLocationFeedback("The language preference could not be saved."));
  }

  const telugu = voiceLanguage === "te-IN";


  function submitDraft() {
    if (!sessionLoaded || onboardingStage === "language" || !draft.text.trim()) return;
    return onboardingStage === "ready" || exitAction(draft.text) ? interpretRequest() : submitVoice(draft.text, voiceLanguage, new AbortController().signal);
  }

  const leaveVoiceTab = useCallback(() => {
    interpretationRequest.current?.abort();
    stopPlayback();
    setVoiceEpoch((value) => value + 1);
    setCapturingVoice(false);
    voiceSession.current = false;
  }, [stopPlayback]);

  useEffect(() => {
    function onPopState() {
      const destination = new URL(window.location.href).searchParams.get("tab");
      if (destination === "orders" || destination === "profile") leaveVoiceTab();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [leaveVoiceTab]);

  function switchTab(next: WorkspaceTab) {
    if (next === tab) return;
    if (next !== "jugaad") leaveVoiceTab();
    const url = new URL(window.location.href);
    if (next === "jugaad") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
    window.scrollTo(0, 0);
  }

  async function savePreferences(value: Profile) {
    const locationChanged = value.region !== profile?.region || JSON.stringify(value.location) !== JSON.stringify(profile?.location);
    await saveProfile(value);
    setVoiceLanguage(value.language);
    setDraft((previous) => ({ ...previous, language: value.language === "hi-en" ? "hi-IN" : value.language }));
    if (locationChanged) {
      setSandbox((previous) => ({ offers: [], orders: previous.orders }));
      setSelectedOffer(null);
      setVoiceQuote(undefined);
      setRestoredTurn(undefined);
      setRestoredIntent(undefined);
      setConversation([]);
    }
  }

  async function resetConversation() {
    const result = await interpretRequest("End this conversation", undefined, undefined, true);
    if (result === "stop") {
      setConversation([]);
      setDraft(initialDraft);
      setManualOpen(false);
      setCurrentSandboxOrder(undefined);
      setJustConfirmedProvider(undefined);
    }
  }

  const voice = voiceAvailable && <VoiceControls
    key={voiceEpoch}
    language={voiceLanguage}
    onLanguage={changeLanguage}
    onTranscript={applyTranscript}
    onAutoSubmit={submitVoice}
    onStarted={startVoice}
    onCapture={setCapturingVoice}
    playback={playback}
    disabled={false}
    agentResponding={interpretationPending}
    compact={onboardingStage !== "ready"}
    compactPrompt={onboardingStage === "permission" ? "Enable your microphone" : onboardingStage === "language" || onboardingStage === "confirm-language" ? "Say your language" : onboardingStage === "region" || onboardingStage === "confirm-region" ? "Say your city" : "Say your name"}
  />;

  if (!sessionLoaded || sessionError) return <main id="main" className="shell-width approved-loading">
    <ApprovedWordmark />
    {sessionError ? <><p role="alert">{sessionError}</p><button className="btn btn-dark" type="button" onClick={() => window.location.reload()}>Retry</button></> : <p role="status">Loading your workspace…</p>}
  </main>;

  if (onboardingStage !== "ready") {
    const step = ["permission", "language", "confirm-language"].includes(onboardingStage) ? 1 : onboardingStage === "name" || onboardingStage === "confirm-name" ? 2 : 3;
    return <main id="main" className="onboarding">
      <header className="onboard-header"><ApprovedWordmark /><span className="small-tag">Getting to know you</span></header>
      <div className="onboard-content">
        <div className="onboard-progress" aria-hidden="true">{[1, 2, 3].map((item) => <span key={item} className={step >= item ? "progress-on" : ""} />)}</div>
        <div className="onboard-step">
          <div className="eyebrow"><span className="eyebrow-line" /> Step 0{step} / 03</div>
          {onboardingStage === "permission" ? <>
            <h2>Enable your<br /><em>microphone.</em></h2><p>Allow microphone access to speak with Jugaad. You can also continue with text.</p>
            <button className="btn btn-dark btn-wide" type="button" onClick={() => setOnboardingStage("language")}>Continue with text <span>→</span></button>
          </> : step === 1 ? <>
            <h2>Let’s speak<br /><em>your language.</em></h2><p>Pick the language that feels most natural. You can change it later.</p>
            <div className="language-grid">{Object.entries(voiceLanguages).map(([id, { label, script }], index) => <button
              key={id} type="button" className={(candidateLanguage ?? voiceLanguage) === id ? "language-card selected" : "language-card"}
              aria-pressed={(candidateLanguage ?? voiceLanguage) === id} onClick={() => setCandidateLanguage(id as VoiceLocale)}>
              <span className="lang-script" lang={script}>{["Aa", "अ", "అ", "Hi"][index]}</span><span>{label}</span><ArrowUpRight className="lang-arrow" size={14} aria-hidden="true" />
            </button>)}</div>
            <button className="btn btn-dark btn-wide" type="button" onClick={() => {
              playback.prime();
              void acceptOnboardingLanguage(candidateLanguage ?? voiceLanguage).catch(() => setLocationFeedback("The voice prompt is unavailable. You can type your name."));
            }}>Continue <span>→</span></button>
          </> : step === 2 ? <>
            <h2>What should<br /><em>I call you?</em></h2><p>Say your name or type it below. No account is needed.</p>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (onboardingBusy) return;
              setOnboardingBusy(true);
              const name = (onboardingStage === "confirm-name" ? candidateName : draft.text).trim();
              void saveProfile({ name, language: voiceLanguage }).then(() => {
                setOnboardingStage("region");
                setDraft((value) => ({ ...value, text: "" }));
                void sayPrompt("intro_location", voiceLanguage, undefined, name).catch(() => {});
              }).catch((error: Error) => setLocationFeedback(error.message)).finally(() => setOnboardingBusy(false));
            }}>
              <label className="field-label" htmlFor="onboard-name">{onboardingStage === "confirm-name" ? "Confirm your name" : "Your name"}</label>
              <input className="onboard-input" id="onboard-name" placeholder="Your first name" autoComplete="given-name" maxLength={40} required value={onboardingStage === "confirm-name" ? candidateName : draft.text} onChange={(event) => {
                if (onboardingStage === "confirm-name") setCandidateName(event.target.value);
                else update("text", event.target.value);
              }} />
              <button className="btn btn-dark btn-wide" disabled={onboardingBusy} type="submit">Continue <span>→</span></button>
            </form>
          </> : <>
            <h2>Where should<br /><em>we look?</em></h2><p>Choose a sandbox service city. Device location is optional.</p>
            <label className="field-label" htmlFor="onboard-city">Sandbox service city</label>
            <select className="onboard-input" id="onboard-city" value={onboardingCity} onChange={(event) => { setOnboardingCity(event.target.value as typeof onboardingCity); setCandidateLocation(undefined); setCandidateRegion(undefined); setOnboardingStage("region"); }}>
              {Object.values(demoCities).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button className="location-optional" type="button" onClick={locateRegion}><MapPin size={16} /> Use device location (optional)</button>
            <button className="btn btn-orange btn-wide" disabled={onboardingBusy} type="button" onClick={() => {
              setOnboardingBusy(true);
              void chooseRegion(candidateLocation && candidateRegion ? candidateRegion : onboardingCity, undefined, voiceLanguage, candidateLocation?.location, candidateLocation?.locality)
                .catch((error: Error) => setLocationFeedback(error.message)).finally(() => setOnboardingBusy(false));
            }}>{candidateLocation ? `Use ${candidateLocation.label}` : "Start with Jugaad"} <span>↗</span></button>
          </>}
          {voice}
          {locationFeedback && <p className="geo-message" role="status">{locationFeedback}</p>}
          {interpretationError && <p className="field-error" role="alert">{interpretationError}</p>}
        </div>
      </div>
      <div className="onboard-aside" aria-hidden="true"><div className="onboard-aside-top">A better way to get things done</div><div className="onboard-aside-orb"><div className="onboard-orb-center" /></div><div className="onboard-aside-bottom">Say it.<br />Find it.<br /><span>Pay for it.</span></div></div>
    </main>;
  }

  return (
    <ApprovedShell tab={tab} onTab={switchTab} name={userName}>
      <section className="tab-screen jugaad-viewport" hidden={tab !== "jugaad"}>
        <div className="screen-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> Your AI transaction workspace</div>
            <h1 lang={telugu ? "te" : undefined}>{telugu ? `నమస్కారం, ${userName}` : `Good to have you here, ${userName}`}<span className="orange-period">.</span></h1>
            <p>Ask naturally. I’ll help you make sense of the options.</p></div>
          <button className="outline-action" type="button" disabled={commercePending} onClick={() => void resetConversation()}><Plus size={15} aria-hidden="true" /> New conversation</button>
        </div>
        <div className="jugaad-stage">
        <div className="agent-layout">
          <div className="agent-main-card">{voice || <div className="approved-order-status"><h2>Voice unavailable</h2><p>You can still type below.</p></div>}</div>
          <div className="agent-side">
            <div className="side-card context-card">
              <div className="side-card-heading"><span>Your context</span><ArrowUpRight size={13} aria-hidden="true" /></div>
              <div className="context-item"><span className="context-icon"><MapPin size={15} /></span><div><small>Search location</small><strong>{cityName}</strong></div></div>
              <div className="context-item"><span className="context-icon"><Globe size={16} /></span><div><small>Conversation language</small><strong>{voiceLanguages[voiceLanguage].label}</strong></div></div>
              <button className="inline-link" type="button" onClick={() => switchTab("profile")}>Edit preferences ↗</button>
            </div>
            <div className="side-card providers-card">
              <div className="side-card-heading"><span>Connected providers</span><span className="small-sandbox">Sandbox</span></div>
              {["Wiggy", "Tomato"].map((name) => <div key={name} className="provider-row"><span className={`provider-symbol ${name === "Wiggy" ? "wiggy-symbol" : "tomato-symbol"}`} aria-hidden="true">{name === "Wiggy" ? "◒" : "◉"}</span><span>{name}</span><span className="provider-note">Fictional</span></div>)}
              <p className="side-footnote">Quotes and orders are simulated.</p>
            </div>
            <div className="side-card prompt-card"><span className="side-card-heading">Need an idea?</span><p>Try a simple request to see how Jugaad compares options.</p><button className="suggestion-link" type="button" disabled={!geminiAvailable} onClick={() => { update("text", "Find biryani under ₹300"); formRef.current?.querySelector("textarea")?.focus(); }}>Find biryani under ₹300 <span>↗</span></button></div>
          </div>
        </div>
        <div className="conversation-panel" aria-live="polite">
          <div className="conversation-header"><span>Conversation</span><span>{conversation.length * 2} messages</span></div>
          <div className="conversation-messages" ref={transcriptRegion}>
            {capturingVoice && <p className="workspace-help">Microphone active · finalized speech appears here</p>}
            {finalTranscript && <p className="approved-final-transcript"><strong>Latest transcript</strong> {finalTranscript}</p>}
            {conversation.length ? <FoodConversationLog entries={conversation} onSpeak={voiceAvailable && !capturingVoice ? speakReply : undefined} /> : <p className="conversation-empty">Your conversation starts here. Ask a question, or try a sandbox comparison.</p>}
          </div>
        </div>
          <div id="offer-comparison" className="recovery-scenes" hidden={!manualOpen && !selectedOffer && !sandbox.quote && !sandbox.offers.length && !currentSandboxOrder && !justConfirmedProvider && !latestTurn?.comparison}>
          <WorkspacePanel index="02" title={currentSandboxOrder || justConfirmedProvider ? "Simulated order" : "Compare offers"} className="comparison-panel">
            <ConstraintChips
              constraints={justConfirmedProvider || currentSandboxOrder ? undefined : latestTurn?.constraints}
              locationLabel={cityName || undefined}
              onRemove={handleRemoveConstraint}
            />
            {justConfirmedProvider && <div className="approved-local-receipt">
              <strong>Provider confirmed the simulated order.</strong>
              <Button variant="secondary" onClick={() => { setActiveReceipt(justConfirmedProvider); switchTab("orders"); }}>View receipt</Button>
            </div>}
            {(sandbox.offers.length > 0 || sandbox.quote || sandbox.orders.some(({ reference }) => reference === currentSandboxOrder)) && <SandboxCommerce state={{ ...sandbox, orders: sandbox.orders.filter(({ reference }) => reference === currentSandboxOrder) }} onAction={actOnCommerce} pending={commercePending || interpretationPending} />}
            {foodActive && !sandbox.offers.length && (manualOpen || (latestTurn?.comparison && !justConfirmedProvider)) ? <FoodDiscovery filters={foodFilters} onFilters={(filters) => { setFoodFilters(filters); setSelectedOffer(null); }} location={foodLocation} budget={draft.budget} radius={draft.distance} priority={draft.priority} showFilters={manualOpen} conversationComparison={justConfirmedProvider ? undefined : latestTurn?.comparison} onSelect={(offer) => { setVoiceQuote(undefined); setSelectedOffer(offer); }} /> :
              !foodActive && <div className="comparison-empty"><CategoryIcon kind="rides" /><h3>No ride offers yet</h3><p>Ride providers are not connected.</p></div>}
            {manualOpen && <><h3 className="comparison-label">{category === "food" ? "Food providers" : category === "rides" ? "Ride providers" : "Sandbox providers"}</h3>
            <ul className="workspace-provider-list" aria-label="Provider connections">
              {relevantProviders.map(({ id, name, status }) => <li key={id}>
                <div><strong>{name}</strong><p>Fictional sandbox provider</p></div>
                <span className="connection-status">{status === "discovery_available" ? <><Search size={15} aria-hidden="true" /> Food search</> : <><CircleMinus size={15} aria-hidden="true" /> Not connected</>}</span>
              </li>)}
            </ul></>}
          </WorkspacePanel>

          {(manualOpen || selectedOffer) && <WorkspacePanel index="03" title="Constraints and quote" className="constraints-panel">
            {manualOpen && <><div className="workspace-subhead"><SlidersHorizontal size={18} aria-hidden="true" /><h3>Set preferences</h3></div>
            <p className="workspace-help">Add these manually. They’re saved with your request.</p>
            <div className="constraint-fields">
              <div className="workspace-field"><label htmlFor="category">Category</label><select {...fieldState("category")} value={draft.category} onChange={(event) => update("category", event.target.value)}><option value="">Any category</option><option value="food">Food</option><option value="rides">Rides</option></select></div>
              <div className="constraint-pair">
                <div className="workspace-field"><label htmlFor="budget">Budget (₹)</label><input {...fieldState("budget")} inputMode="decimal" value={draft.budget} onChange={(event) => update("budget", event.target.value)} placeholder="Optional" />{fieldError("budget")}</div>
                <div className="workspace-field"><label htmlFor="distance">Radius (km)</label><input {...fieldState("distance")} inputMode="decimal" value={draft.distance} onChange={(event) => update("distance", event.target.value)} placeholder={foodActive ? "Default 5" : "Optional"} />{fieldError("distance")}</div>
              </div>
              <div className="workspace-field"><label htmlFor="priority">Priority</label><select {...fieldState("priority")} value={draft.priority} onChange={(event) => update("priority", event.target.value)}><option value="">No preference</option><option value="fastest">Fastest</option><option value="lowest-price">Lowest price</option></select></div>
              {foodActive ? <FoodLocationFields location={foodLocation} onChange={(location) => { setFoodLocation(location); setSelectedOffer(null); }} /> :
                <div className="workspace-field"><label htmlFor="location" className="location-label"><MapPin size={16} aria-hidden="true" /> Location</label><input {...fieldState("location")} value={draft.location} onChange={(event) => update("location", event.target.value)} placeholder="Area or landmark" />{fieldError("location")}</div>}
            </div>
            </>}
            <div className="workspace-quote">
              <div className="workspace-subhead"><ReceiptText size={18} aria-hidden="true" /><h3 ref={quoteHeading} tabIndex={-1}>Transaction status</h3></div>
              {selectedOffer ? <FoodCheckout key={voiceQuote ? `${voiceQuote.id}-${voiceQuote.phase}` : selectedOffer.offer.quote.id} initialTransaction={voiceQuote} selected={selectedOffer} configured={checkout?.configured ?? false} onViewReceipt={(id) => { setActiveReceipt(id); switchTab("orders"); }} voiceLanguage={voiceAvailable ? voiceLanguage : undefined} onSpeak={capturingVoice ? undefined : speakTransaction} onUpdate={(transaction) => {
                updateTransaction(transaction);
                if (transaction.phase === "confirmed") {
                  setJustConfirmedProvider(transaction.id);
                  setRestoredTurn(undefined);
                  setRestoredIntent(undefined);
                }
                announceTransaction(transaction);
              }} /> : <>
                <p className="workspace-help">Select an eligible food offer to review its quote.</p>
                <ol>{transactionStages.map((stage) => <li key={stage}>{stage}<span>Pending</span></li>)}</ol>
              </>}
            </div>
          </WorkspacePanel>}
          </div>

        </div>
        <div className="approved-compose">
          <form className="composer" ref={formRef} onSubmit={(event) => { event.preventDefault(); void submitDraft(); }}>
            <label className="sr-only" htmlFor="text">Message Jugaad</label>
            <textarea {...fieldState("text")} rows={1} value={draft.text} lang={requestLanguages[draft.language as SavedRequest["language"]].script} placeholder="Ask anything, or tell Jugaad what you need…" onChange={(event) => update("text", event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submitDraft(); }
            }} />
            <button className="composer-send" aria-label="Send message" type="submit" disabled={!geminiAvailable || !draft.text.trim()}><ArrowUpRight size={20} /></button>
          </form>
          {interpretationError && <p className="field-error" role="alert">{interpretationError}</p>}
          {interpretationPending && <p className="workspace-help" role="status">Checking your request…</p>}
          {!geminiAvailable && <p className="workspace-help">Conversation is unavailable. Manual food search is available below.</p>}
          <div className="approved-conversation-actions">
            <button className="inline-link" type="button" aria-expanded={manualOpen} onClick={() => setManualOpen(!manualOpen)}>Manual food search</button>
            <button className="inline-link" type="button" onClick={() => void interpretRequest("End this conversation")}>End conversation</button>
          </div>
        </div>
        {manualOpen && <div className="approved-manual">
          <Button variant="quiet" onClick={loadExample}>Load example</Button>
          <Button variant="quiet" onClick={saveRequest}>Save request</Button>
          {feedback && <p className="workspace-help" role="status">{feedback}</p>}
        </div>}
      </section>
      {tab === "orders" && <ApprovedOrders orders={sandbox.orders} checkout={checkout} loading={!checkout && !checkoutError} error={checkoutError} active={activeReceipt}
        onOpen={setActiveReceipt} onClose={() => setActiveReceipt(null)} onBack={() => switchTab("jugaad")} onReload={() => setHistoryReload((value) => value + 1)}
        detail={<OrderHistory summary={checkout} initialError={checkoutError} activeId={activeReceipt} onActivate={setActiveReceipt} onUpdate={updateTransaction} onReconciled={announceTransaction} onReload={() => setHistoryReload((value) => value + 1)} />} />}
      {tab === "profile" && profile && <ApprovedProfile profile={profile} onSave={savePreferences} />}
    </ApprovedShell>
  );
}
