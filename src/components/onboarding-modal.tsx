"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Compass, MapPin, User, X, ArrowRight, ArrowLeft } from "lucide-react";
import { postJson } from "@/lib/client-request";
import { demoCities, matchGpsToDemoCity, type DemoCity } from "@/lib/marketplace/demo-cities";
import type { FoodLocation } from "@/lib/marketplace/discovery-types";
import { voiceLanguages, type VoiceLocale } from "@/lib/voice/types";
import { BrandMark } from "./brand";
import { Button, IndexLabel, Panel } from "./ui";

export type OnboardingProfile = {
  name: string;
  language: VoiceLocale;
  location: FoodLocation;
  cityName: string;
  isActualLocation: boolean;
  actualGpsCoords?: { latitude: number; longitude: number };
};

type Props = {
  isOpen: boolean;
  onComplete: (profile: OnboardingProfile, greetingTicket?: string, greetingText?: string) => void;
  onClose?: () => void;
  initialProfile?: Partial<OnboardingProfile>;
  voiceAvailable: boolean;
};

type OnboardingStep = "language" | "name" | "location";

const languageOptions: Array<{
  id: VoiceLocale;
  nativeTitle: string;
  englishLabel: string;
  subtext: string;
  badge?: string;
}> = [
  {
    id: "en-IN",
    nativeTitle: "English",
    englishLabel: "Indian English",
    subtext: "Voice & text in Indian English",
  },
  {
    id: "hi-IN",
    nativeTitle: "हिंदी",
    englishLabel: "Hindi",
    subtext: "सहज और स्वाभाविक हिंदी",
  },
  {
    id: "te-IN",
    nativeTitle: "తెలుగు",
    englishLabel: "Telugu",
    subtext: "సహజమైన వాయిస్ సంభాషణ",
    badge: "Full Telugu voice",
  },
  {
    id: "hi-en",
    nativeTitle: "Hinglish",
    englishLabel: "Hindi + English",
    subtext: "Natural conversational blend",
  },
];

const stepTitles: Record<VoiceLocale, { nameTitle: string; namePrompt: string; locationTitle: string; locationPrompt: string }> = {
  "en-IN": {
    nameTitle: "Hi, I'm Jugaad.",
    namePrompt: "What should I call you?",
    locationTitle: "Delivery location",
    locationPrompt: "Where should your simulated orders be delivered?",
  },
  "hi-IN": {
    nameTitle: "नमस्ते, मैं जुगाड़ हूँ।",
    namePrompt: "मैं आपको क्या कहकर बुलाऊँ?",
    locationTitle: "डिलीवरी का स्थान",
    locationPrompt: "आपके सिमुलेटेड ऑर्डर कहाँ डिलीवर करें?",
  },
  "te-IN": {
    nameTitle: "నమస్కారం, నేను జుగాడ్.",
    namePrompt: "నేను మిమ్మల్ని ఏమని పిలవాలి?",
    locationTitle: "డెలివరీ ప్రాంతం",
    locationPrompt: "మీ సిమ్యులేటెడ్ ఆర్డర్లు ఎక్కడికి డెలివరీ చేయాలి?",
  },
  "hi-en": {
    nameTitle: "Hi, I'm Jugaad.",
    namePrompt: "Aapko kis naam se bulaayein?",
    locationTitle: "Delivery location",
    locationPrompt: "Where should your simulated orders be delivered?",
  },
};

export function OnboardingModal({ isOpen, onComplete, onClose, initialProfile, voiceAvailable }: Props) {
  const [step, setStep] = useState<OnboardingStep>("language");
  const [language, setLanguage] = useState<VoiceLocale>(initialProfile?.language ?? "en-IN");
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [selectedCityId, setSelectedCityId] = useState<DemoCity["id"]>(
    initialProfile?.location?.source === "manual" ? (initialProfile.location.cityId as DemoCity["id"]) : "bengaluru"
  );
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: "info" | "success" | "warning";
    message: string;
    matchedCityId?: DemoCity["id"];
    coords?: { latitude: number; longitude: number };
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && step === "name") {
      nameInputRef.current?.focus();
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  function selectLanguage(chosenLang: VoiceLocale) {
    setLanguage(chosenLang);
    setError("");
    setStep("name");
  }

  function handleNameNext(e?: FormEvent) {
    if (e) e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(
        language === "te-IN"
          ? "దయచేసి మీ పేరును చెప్పండి లేదా నమోదు చేయండి."
          : language === "hi-IN"
          ? "कृपया अपना नाम बताएं या लिखें।"
          : "Please tell us your name so Jugaad can greet you."
      );
      nameInputRef.current?.focus();
      return;
    }
    if (cleanName.length > 40) {
      setError("Please enter a name up to 40 characters.");
      return;
    }
    setError("");
    setStep("location");
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus({
        type: "warning",
        message: "Geolocation is not supported by your browser. Please select a demo city manually.",
      });
      return;
    }

    setLocating(true);
    setLocationStatus({ type: "info", message: "Requesting device coordinates…" });

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const actualCoords = {
          latitude: Number(coords.latitude.toFixed(5)),
          longitude: Number(coords.longitude.toFixed(5)),
        };

        const match = matchGpsToDemoCity(actualCoords);
        if (match.isWithinSupportedRegion) {
          setSelectedCityId(match.matchedCity.id);
          setLocationStatus({
            type: "success",
            message: `Detected device location near ${match.matchedCity.name} (~${match.distanceKm} km away). We’ll search in this city.`,
            matchedCityId: match.matchedCity.id,
            coords: actualCoords,
          });
        } else {
          setSelectedCityId("bengaluru");
          setLocationStatus({
            type: "warning",
            message: `Your location is outside our 4 demo cities (${match.distanceKm} km from nearest). We’ve selected Bengaluru. You can choose a different city below.`,
            matchedCityId: "bengaluru",
            coords: actualCoords,
          });
        }
      },
      (geoError) => {
        setLocating(false);
        setLocationStatus({
          type: "warning",
          message:
            geoError.code === 1
              ? "Location permission was denied. Choose one of our 4 demo cities below."
              : "Unable to retrieve device position. Choose a demo city below.",
        });
      },
      { timeout: 10_000, maximumAge: 0, enableHighAccuracy: true }
    );
  }

  async function handleFinalSubmit() {
    const cleanName = name.trim() || (language === "te-IN" ? "మిత్రమా" : language === "hi-IN" ? "दोस्त" : "Friend");
    setSubmitting(true);
    setError("");

    const city = demoCities[selectedCityId] ?? demoCities.bengaluru;
    const isGps = locationStatus?.type === "success" && locationStatus.coords;

    const location: FoodLocation = isGps
      ? { source: "gps", coordinates: locationStatus.coords! }
      : { source: "manual", cityId: city.id };

    const profile: OnboardingProfile = {
      name: cleanName,
      language,
      location,
      cityName: city.name,
      isActualLocation: Boolean(isGps),
      actualGpsCoords: locationStatus?.coords,
    };

    let greetingTicket: string | undefined;
    let greetingText: string | undefined;

    try {
      if (voiceAvailable) {
        const res = await postJson<{ text: string; language: VoiceLocale; speechTicket?: string }>(
          "/api/voice/greeting",
          { name: cleanName, language }
        );
        greetingTicket = res.speechTicket;
        greetingText = res.text;
      }
    } catch {
      // Non-blocking greeting synthesis fallback
    } finally {
      setSubmitting(false);
      onComplete(profile, greetingTicket, greetingText);
    }
  }

  const currentStrings = stepTitles[language] || stepTitles["en-IN"];

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-step-title">
      <Panel className="onboarding-card paper-grid">
        {/* Top Header */}
        <div className="onboarding-header">
          <div className="onboarding-identity">
            <BrandMark size={32} />
            <div>
              <IndexLabel>
                {step === "language"
                  ? "Step 1 of 3 · Language"
                  : step === "name"
                  ? "Step 2 of 3 · Your Name"
                  : "Step 3 of 3 · Delivery Location"}
              </IndexLabel>
              <h2 className="display-feature" id="onboarding-step-title">
                {step === "language"
                  ? "Choose your conversation language"
                  : step === "name"
                  ? currentStrings.namePrompt
                  : currentStrings.locationTitle}
              </h2>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              className="onboarding-close"
              onClick={onClose}
              aria-label="Close onboarding"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* STEP 1: LANGUAGE SELECTION FIRST */}
        {step === "language" && (
          <div className="onboarding-step-container">
            <p className="onboarding-subtitle">
              Select your preferred language for voice and text. You can speak or tap below:
            </p>

            <div className="language-grid" role="radiogroup" aria-label="Preferred language">
              {languageOptions.map((opt) => {
                const isSelected = language === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectLanguage(opt.id)}
                    className={`language-card ${isSelected ? "language-card--selected" : ""}`}
                  >
                    <div className="language-card__header">
                      <span className="language-card__native">{opt.nativeTitle}</span>
                      {opt.badge && <span className="language-card__badge">{opt.badge}</span>}
                    </div>
                    <span className="language-card__english">{opt.englishLabel}</span>
                    <span className="language-card__subtext">{opt.subtext}</span>
                    {isSelected && (
                      <div className="language-card__check" aria-hidden="true">
                        <Check size={16} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="onboarding-step-footer">
              <span className="meta muted">Microphone permission will be requested next for spoken conversation</span>
              <Button
                variant="primary"
                onClick={() => setStep("name")}
              >
                Continue with {voiceLanguages[language]?.label ?? "Selected Language"} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: SPOKEN NAME ONBOARDING */}
        {step === "name" && (
          <form onSubmit={handleNameNext} className="onboarding-step-container">
            <p className="onboarding-subtitle">
              {language === "te-IN"
                ? "మీ పేరు చెప్పండి లేదా కింద టైప్ చేయండి."
                : language === "hi-IN"
                ? "अपना नाम बोलें या नीचे लिखें।"
                : "Speak your name or enter it below so Jugaad can address you naturally."}
            </p>

            <div className="workspace-field">
              <label htmlFor="user-name" className="field-label-large">
                <User size={18} aria-hidden="true" /> {currentStrings.namePrompt}
              </label>
              <input
                id="user-name"
                ref={nameInputRef}
                type="text"
                autoComplete="given-name"
                placeholder={
                  language === "te-IN"
                    ? "ఉదాహరణ: ప్రియ, రాహుల్, అనన్య"
                    : language === "hi-IN"
                    ? "उदा: प्रिया, राहुल, अनन्य"
                    : "e.g. Priya, Rahul, Ananya"
                }
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                className="input-large"
              />
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="name-tips-row">
              <span className="meta">
                {language === "te-IN"
                  ? "వాయిస్ ద్వారా కూడా పేరు నమోదు చేయవచ్చు."
                  : "You can also change or confirm your name by voice at any time."}
              </span>
            </div>

            <div className="onboarding-step-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("language")}
              >
                <ArrowLeft size={16} /> Back
              </Button>
              <Button type="submit" variant="primary">
                Next: Set Location <ArrowRight size={16} />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: LOCATION CONSENT & CONFIRMATION */}
        {step === "location" && (
          <div className="onboarding-step-container">
            <p className="onboarding-subtitle">
              {currentStrings.locationPrompt}
            </p>

            <div className="location-action-bar">
              <Button
                type="button"
                variant="secondary"
                onClick={detectLocation}
                disabled={locating}
                className="detect-location-btn"
              >
                <Compass size={16} className={locating ? "animate-spin" : ""} aria-hidden="true" />
                {locating ? "Detecting device GPS…" : "Detect my live GPS location"}
              </Button>
              <span className="meta muted">
                Browser permission requested on demand. Real coordinates are securely normalized.
              </span>
            </div>

            {locationStatus && (
              <div
                className={`location-status-banner location-status-banner--${locationStatus.type}`}
                role="status"
              >
                <MapPin size={16} aria-hidden="true" />
                <span>{locationStatus.message}</span>
              </div>
            )}

            <div className="demo-city-picker">
              <label className="field-label-small">
                Supported cities:
              </label>
              <div className="demo-city-grid" role="radiogroup" aria-label="Demo city selection">
                {Object.values(demoCities).map((city) => {
                  const isSelected = selectedCityId === city.id;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setSelectedCityId(city.id);
                        setLocationStatus(null);
                      }}
                      className={`demo-city-card ${isSelected ? "demo-city-card--selected" : ""}`}
                    >
                      <div className="demo-city-card__name">{city.name}</div>
                      <div className="demo-city-card__meta">
                        {city.neighborhoods.length} neighborhoods
                      </div>
                      {isSelected && (
                        <div className="demo-city-card__check" aria-hidden="true">
                          <Check size={14} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="onboarding-step-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep("name")}
              >
                <ArrowLeft size={16} /> Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleFinalSubmit()}
                disabled={submitting}
              >
                {submitting ? "Preparing conversation…" : "Start with Jugaad"} <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
