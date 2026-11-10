"use client";

import { holdSounds, stopSound } from "@/lib/sound/engine";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { voiceLocale, type SpeechSource, type VoiceLocale } from "@/lib/voice/types";
import { pcmPlayback } from "@/lib/voice/pcm-playback";
import { inspectVoiceWave, voiceSampleRate, waveformLevels } from "@/lib/voice/wave";

type PlaybackStatus = "idle" | "loading" | "playing" | "ready" | "stopped" | "error";
type Clip = { url: string; audio: HTMLAudioElement; text: string; language: VoiceLocale; key: string };

function release(clip?: Clip) {
  if (!clip) return;
  clip.audio.onended = null;
  clip.audio.onerror = null;
  clip.audio.ontimeupdate = null;
  clip.audio.pause();
  clip.audio.removeAttribute("src");
  clip.audio.load();
  URL.revokeObjectURL(clip.url);
}

export function useVoicePlayback() {
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  useLayoutEffect(() => {
    if (status === "loading" || status === "playing") return holdSounds();
  }, [status]);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [caption, setCaption] = useState<{ text: string; language: VoiceLocale }>();
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const mute = useRef(false);
  const context = useRef<AudioContext | undefined>(undefined);
  const streamed = useRef<ReturnType<typeof pcmPlayback> | undefined>(undefined);

  function prime() {
    if (!window.AudioContext) return;
    try {
      context.current ??= new AudioContext();
      if (context.current.state !== "running") void context.current.resume().catch(() => undefined);
    } catch { /* Buffered playback remains available. */ }
  }
  const clip = useRef<Clip | undefined>(undefined);
  const pending = useRef<{ key: string; controller: AbortController } | undefined>(undefined);
  const lastSource = useRef<SpeechSource | undefined>(undefined);
  const playbackAttempt = useRef(0);

  useEffect(() => () => {
    playbackAttempt.current += 1;
    pending.current?.controller.abort();
    release(clip.current);
    streamed.current?.stop();
    if (context.current && context.current.state !== "closed") void context.current.close().catch(() => undefined);
    context.current = undefined;
  }, []);

  const startClip = useCallback(async (current: Clip) => {
    stopSound();
    const attempt = ++playbackAttempt.current;
    setNotice("");
    current.audio.currentTime = 0;
    try {
      await current.audio.play();
      if (attempt === playbackAttempt.current && clip.current === current) setStatus("playing");
    } catch (error) {
      if (attempt !== playbackAttempt.current || clip.current !== current) return;
      setStatus("ready");
      setNotice(error instanceof DOMException && error.name === "NotAllowedError" ? "Tap Replay audio to play this reply." : "Playback could not start. Try Replay audio.");
    }
  }, []);

  const play = useCallback(async (source: SpeechSource, captionHint?: { text: string; language: VoiceLocale }, sessionSignal?: AbortSignal) => {
    if (sessionSignal?.aborted) return;
    const key = JSON.stringify(source);
    if (pending.current?.key === key) return;
    stopSound();
    lastSource.current = source;
    pending.current?.controller.abort();
    streamed.current?.stop();
    streamed.current = undefined;
    if (clip.current?.key === key) { pending.current = undefined; await startClip(clip.current); return; }
    playbackAttempt.current += 1;
    release(clip.current);
    clip.current = undefined;
    const controller = new AbortController();
    const signal = sessionSignal ? AbortSignal.any([sessionSignal, controller.signal]) : controller.signal;
    pending.current = { key, controller };
    setVoiceNotice("");
    setCaption(captionHint);
    setNotice("");
    setStatus("loading");
    const start = performance.now();
    const audioContext = context.current?.state === "running" ? context.current : undefined;
    let live: ReturnType<typeof pcmPlayback> | undefined;
    let firstPlaybackMs: number | undefined;
    try {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json", ...(audioContext ? { Accept: "audio/x-pcm" } : {}) }, body: key, signal });
      const headersAt = performance.now();
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message ?? "Timbre audio is unavailable.");
      }
      if (signal.aborted) return;
      if (response.headers.get("x-voice-fallback") === "1") {
        setVoiceNotice(`Your selected voice is temporarily unavailable. Playing ${response.headers.get("x-voice-id")} for this reply.`);
      }
      const locale = voiceLocale.parse(response.headers.get("x-voice-language"));
      const encoded = response.headers.get("x-voice-text");
      const mediaType = response.headers.get("content-type");
      if (!encoded || (mediaType !== "audio/wav" && mediaType !== "audio/x-pcm")) throw new Error("Timbre did not return a playable reply.");
      const text = new TextDecoder().decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
      let bytes: ArrayBuffer;
      if (mediaType === "audio/x-pcm" && audioContext && response.body) {
        live = pcmPlayback(audioContext, mute.current);
        streamed.current = live;
        const playback = live;
        const abort = () => playback.stop();
        signal.addEventListener("abort", abort, { once: true });
        void live.end.then(() => {
          signal.removeEventListener("abort", abort);
          if (streamed.current === playback) {
            streamed.current = undefined;
            if (!signal.aborted) setStatus("ready");
          }
        });
        setCaption({ text, language: locale });
        const reader = response.body.getReader();
        try {
          while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            const frame = live.add(value);
            if (frame) {
              if (firstPlaybackMs === undefined) {
                firstPlaybackMs = performance.now() - start + frame.leadMs;
                setStatus("playing");
              }
              const count = Math.min(frame.samples.length, voiceSampleRate / 5);
              setLevels(waveformLevels(count, (index) => frame.samples[index]));
            }
          }
          if (signal.aborted) return;
          bytes = live.finish();
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      } else {
        bytes = await response.arrayBuffer();
      }
      if (signal.aborted) return;
      const bytesAt = performance.now();
      const wave = inspectVoiceWave(bytes);
      if (!wave?.hasSignal) throw new Error("Timbre did not return a playable reply.");
      const view = new DataView(bytes);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      const audio = new Audio(url);
      audio.muted = mute.current;
      const next = { url, audio, text, language: locale, key };
      clip.current = next;
      audio.onended = () => { if (clip.current === next) setStatus("ready"); };
      audio.onerror = () => { if (clip.current === next) { setStatus("error"); setNotice("This audio could not be played. You can read the reply below."); } };
      audio.ontimeupdate = () => {
        if (clip.current !== next || audio.paused) return;
        const start = Math.floor(audio.currentTime * voiceSampleRate);
        const count = Math.min(voiceSampleRate / 5, wave.samples - start);
        if (count > 0) setLevels(waveformLevels(count, (index) => view.getInt16(wave.pcmStart + (start + index) * 2, true) / 32768));
      };
      if (!live) {
        setLevels([]);
        setCaption({ text, language: locale });
        await startClip(next);
      }
      performance.measure("jugaad-voice-playback", { start, end: performance.now(), detail: {
        responseHeadersMs: headersAt - start, audioDownloadedMs: bytesAt - start, playbackStartupMs: performance.now() - bytesAt,
        started: firstPlaybackMs !== undefined || !audio.paused, muted: audio.muted, firstPlaybackMs,
      } });
    } catch (error) {
      if (streamed.current === live) streamed.current = undefined;
      live?.stop();
      if (!signal.aborted) { setStatus("error"); setNotice(error instanceof Error ? error.message : "Timbre audio is unavailable."); }
    } finally { if (pending.current?.controller === controller) pending.current = undefined; }
  }, [startClip]);

  const stop = useCallback(() => {
    playbackAttempt.current += 1;
    const live = streamed.current;
    streamed.current = undefined;
    live?.stop();
    if (pending.current) { pending.current.controller.abort(); pending.current = undefined; }
    if (clip.current) { clip.current.audio.pause(); clip.current.audio.currentTime = 0; }
    if (lastSource.current) setStatus("stopped");
    setNotice("");
  }, []);

  function reset() {
    stop();
    release(clip.current);
    clip.current = undefined;
    lastSource.current = undefined;
    setCaption(undefined);
    setVoiceNotice("");
    setStatus("idle");
  }

  async function waitForEnd(signal?: AbortSignal) {
    const live = streamed.current;
    if (live) { await live.end; return; }
    const audio = clip.current?.audio;
    if (!audio || audio.paused || audio.ended || signal?.aborted) return;
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("pause", finish);
        audio.removeEventListener("error", finish);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, 25_000);
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("pause", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      signal?.addEventListener("abort", finish, { once: true });
    });
  }

  function replay() {
    if (clip.current) void startClip(clip.current);
    else if (lastSource.current) void play(lastSource.current, caption);
  }

  function toggleMute() {
    mute.current = !mute.current;
    if (clip.current) clip.current.audio.muted = mute.current;
    streamed.current?.mute(mute.current);
    setMuted(mute.current);
  }

  return { status, caption, muted, notice, voiceNotice, levels, play, stop, reset, replay, toggleMute, waitForEnd, prime };
}

export type VoicePlayback = ReturnType<typeof useVoicePlayback>;
