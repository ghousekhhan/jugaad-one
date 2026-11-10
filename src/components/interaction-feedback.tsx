"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  closeSound, getDefaultPreferences, getPreferences, primeSound,
  subscribePreferences, updatePreferences, type FeedbackPreferences,
} from "@/lib/sound/engine";

export function InteractionFeedback() {
  useEffect(() => {
    const apply = () => { document.documentElement.dataset.feedbackMotion = getPreferences().motion; };
    const unsubscribe = subscribePreferences(apply);
    const gesture = (event: Event) => { if (event.isTrusted) primeSound(); };
    apply();
    window.addEventListener("pointerup", gesture, true);
    window.addEventListener("keydown", gesture, true);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerup", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      closeSound();
      delete document.documentElement.dataset.feedbackMotion;
    };
  }, []);
  return null;
}

export function SoundMotionSettings() {
  const settings = useSyncExternalStore(subscribePreferences, getPreferences, getDefaultPreferences);
  return <fieldset className="feedback-settings">
    <legend>Sound &amp; Motion</legend>
    <p>These settings apply in this browser. Voice playback has its own mute control.</p>
    <label htmlFor="interface-sounds">Interface sounds</label>
    <select id="interface-sounds" value={settings.sounds ? "on" : "off"}
      onChange={(event) => updatePreferences({ ...settings, sounds: event.target.value === "on" })}>
      <option value="on">On</option><option value="off">Off</option>
    </select>
    <label htmlFor="interface-volume">Sound volume</label>
    <select id="interface-volume" value={settings.volume} disabled={!settings.sounds}
      onChange={(event) => updatePreferences({ ...settings, volume: event.target.value as FeedbackPreferences["volume"] })}>
      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
    </select>
    <label htmlFor="interface-motion">Reduced motion</label>
    <select id="interface-motion" value={settings.motion}
      onChange={(event) => updatePreferences({ ...settings, motion: event.target.value as FeedbackPreferences["motion"] })}>
      <option value="system">Follow system</option><option value="reduce">Reduce motion</option>
    </select>
  </fieldset>;
}
