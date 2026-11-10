"use client";

import { useId, useState } from "react";
import { preferredVoice, voiceCatalog, voiceSamples, type VoicePreference } from "@/lib/voice/catalog";
import { voiceLanguages, type VoiceLocale } from "@/lib/voice/types";
import type { VoicePlayback } from "./use-voice-playback";

export function VoicePicker({ language, preference, playback, onSave, onboarding = false, available = true }: {
  language: VoiceLocale;
  preference?: VoicePreference;
  playback: VoicePlayback;
  onSave: (id: string) => Promise<void>;
  onboarding?: boolean;
  available?: boolean;
}) {
  const group = useId();
  const current = preferredVoice(language, preference);
  const [selected, setSelected] = useState(current);
  const [preview, setPreview] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const previewActive = playback.status === "loading" || playback.status === "playing";

  async function save() {
    setSaving(true);
    setError("");
    playback.reset();
    setPreview(undefined);
    try { await onSave(selected); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The voice preference could not be saved."); }
    finally { setSaving(false); }
  }

  return <section className="voice-picker" aria-labelledby={group}>
    <h2 id={group}>{onboarding ? "Choose your Jugaad voice." : "Voice & Language"}</h2>
    <p>{onboarding ? "Pick the voice you’d like to hear throughout your conversations." : `${voiceLanguages[language].label} · Current voice: ${current}`}</p>
    <div className="voice-picker-options" role="group" aria-label="Available voices">
      {voiceCatalog[language].map(({ id, description }) => {
        const playing = preview === id && previewActive;
        return <div className="voice-picker-option" data-selected={selected === id} key={id}>
          <label><input type="radio" name={group} checked={selected === id} disabled={saving} onChange={() => {
            setSelected(id);
            if (preview !== id) { playback.stop(); setPreview(undefined); }
          }} />
            <span><strong>{id}</strong><small>{description}</small></span>
          </label>
          <button type="button" className="outline-action" disabled={saving || !available}
            aria-label={`${playing ? "Stop" : "Play"} ${id} preview`}
            onClick={() => {
              if (playing) { playback.stop(); return; }
              playback.prime();
              setPreview(id);
              void playback.play({ kind: "preview", language, voice: id }, { text: voiceSamples[language], language });
            }}>
            {playing ? (playback.status === "loading" ? "Loading… · Stop" : "Stop") : "Play preview"}
          </button>
        </div>;
      })}
    </div>
    {preview && playback.status === "loading" && <p role="status">Loading {preview}’s preview…</p>}
    {preview && playback.notice && <p role="status">{playback.notice}</p>}
    {!available && <p>Voice previews are currently unavailable.</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <button className="btn btn-orange" type="button" disabled={saving || (!onboarding && selected === current)}
      onClick={() => void save()}>{saving ? "Saving…" : onboarding ? "Continue with this voice" : "Save voice"}</button>
  </section>;
}
