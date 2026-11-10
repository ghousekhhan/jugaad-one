"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Radio,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";
import { requestJson } from "@/lib/client-request";
import { beginVoiceCapture, type VoiceCapture } from "@/lib/voice/capture";
import { voiceLanguages, type VoiceLocale, type VoiceTranscript } from "@/lib/voice/types";
import { maxRecordingSeconds, voiceSampleRate, waveformBars, type VadState } from "@/lib/voice/wave";
import { Button } from "./ui";
import type { VoicePlayback } from "./use-voice-playback";

export type VoiceMode = "continuous" | "manual";

export type VisualVoiceStage =
  | "idle"
  | "permission"
  | "listening"
  | "hearing"
  | "understanding"
  | "searching"
  | "comparing"
  | "speaking"
  | "paused"
  | "error";

type CaptureState =
  | "idle"
  | "permission"
  | "listening"
  | "hearing"
  | "transcribing"
  | "responding"
  | "ready"
  | "paused"
  | "error";

const stageDescriptors: Record<VisualVoiceStage, { label: string; subtext: string }> = {
  idle: {
    label: "Ready to listen",
    subtext: "Tap the mic or start continuous conversation to speak in your language.",
  },
  permission: {
    label: "Awaiting mic access",
    subtext: "Please allow microphone permissions in your browser to speak.",
  },
  listening: {
    label: "Listening for your voice…",
    subtext: "Speak naturally. Tell Jugaad what you'd like to find or order.",
  },
  hearing: {
    label: "Hearing you speak…",
    subtext: "Receiving your voice stream…",
  },
  understanding: {
    label: "Understanding your request…",
    subtext: "Extracting constraints, dietary rules, and intent…",
  },
  searching: {
    label: "Checking eligible offers…",
    subtext: "Checking provider availability…",
  },
  comparing: {
    label: "Comparing final totals…",
    subtext: "Evaluating delivery speed, pricing, and ratings…",
  },
  speaking: {
    label: "Jugaad is speaking…",
    subtext: "Streaming natural voice in your selected language.",
  },
  paused: {
    label: "Microphone paused",
    subtext: "Resume whenever you are ready to continue.",
  },
  error: {
    label: "Voice notice",
    subtext: "Microphone or transcription issue. You can retry or type below.",
  },
};

function VoiceWaveform({ levels, active = true, tone = "orange" }: { levels: number[]; active?: boolean; tone?: "orange" | "teal" }) {
  return (
    <div className={`voice-waveform voice-waveform--${tone} ${active ? "voice-waveform--active" : ""}`} aria-hidden="true">
      {Array.from({ length: waveformBars }, (_, index) => (
        <span key={index} style={{ height: `${3 + (levels[index] ?? 0) * 22}px` }} />
      ))}
    </div>
  );
}

export function VoiceControls({
  language,
  onLanguage,
  onTranscript,
  onAutoSubmit,
  onStarted,
  onCapture,
  playback,
  disabled,
  agentResponding,
  activeSubstage,
  compact = false,
  compactPrompt = "Say your name",
}: {
  language: VoiceLocale;
  onLanguage: (value: VoiceLocale) => void;
  onTranscript: (result: VoiceTranscript) => void;
  onStarted?: (signal: AbortSignal) => Promise<void>;
  onAutoSubmit?: (text: string, language: VoiceLocale, signal: AbortSignal) => Promise<"stop" | "stop_speech" | "pause" | "mute" | void>;
  playback: VoicePlayback;
  disabled: boolean;
  onCapture: (active: boolean) => void;
  agentResponding?: boolean;
  activeSubstage?: "searching" | "comparing";
  compact?: boolean;
  compactPrompt?: string;
}) {
  const [mode, setMode] = useState<VoiceMode>("continuous");
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const active = useRef<AbortController | null>(null);
  const capture = useRef<VoiceCapture | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isContinuous = mode === "continuous";
  const { stop: stopPlayback } = playback;
  const transcription = useRef<AbortController | null>(null);
  const opening = useRef<AbortController | null>(null);
  const lastTranscriptId = useRef<string | undefined>(undefined);
  const turnHandlers = useRef({ onAutoSubmit, onTranscript, state, language, playbackStatus: playback.status });
  const readyAt = useRef(0);

  useLayoutEffect(() => {
    turnHandlers.current = { onAutoSubmit, onTranscript, state, language, playbackStatus: playback.status };
  }, [onAutoSubmit, onTranscript, state, language, playback.status]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    active.current?.abort();
    capture.current?.cancel();
  }, []);

  // Derive consolidated visual stage
  const visualStage: VisualVoiceStage = useMemo(() => {
    if (playback.status === "playing") return "speaking";
    if (agentResponding) {
      if (activeSubstage === "comparing") return "comparing";
      if (activeSubstage === "searching") return "searching";
      return "understanding";
    }
    if (state === "transcribing") return "understanding";
    if (state === "hearing") return "hearing";
    if (state === "listening") return "listening";
    if (state === "permission") return "permission";
    if (state === "paused") return "paused";
    if (state === "error") return "error";
    return "idle";
  }, [playback.status, agentResponding, activeSubstage, state]);

  function endSession() {
    clearTimeout(timer.current);
    active.current?.abort();
    active.current = null;
    capture.current?.cancel();
    capture.current = null;
    stopPlayback();
    setState("idle");
    setError("");
    setLevels([]);
    onCapture(false);
  }

  function togglePause() {
    if (!capture.current) return;
    if (state === "paused") {
      capture.current.resume();
      setState("listening");
    } else {
      capture.current.pause();
      setState("paused");
      setLevels([]);
    }
  }

  async function handleTurnAudio(audio: ArrayBuffer, timing?: { audioMs: number; endpointMs: number; encodeMs: number }) {
    const controller = active.current;
    if (!controller) return;
    opening.current?.abort();
    transcription.current?.abort();
    const current = new AbortController();
    transcription.current = current;
    const signal = AbortSignal.any([controller.signal, current.signal]);
    const start = performance.now();
    let transcriptAt: number | undefined;
    let pauseRequested = false;
    setError("");
    setState("transcribing");
    try {
      const result = await requestJson<VoiceTranscript>(`/api/voice/transcribe?language=${turnHandlers.current.language}`, {
        method: "POST",
        body: audio,
        headers: { "Content-Type": "audio/wav" },
        signal,
      });

      if (signal.aborted || (result.requestId && result.requestId === lastTranscriptId.current)) {
        performance.mark(signal.aborted ? "jugaad-voice-stale-final" : "jugaad-voice-duplicate-final");
        return;
      }
      lastTranscriptId.current = result.requestId;
      transcriptAt = performance.now();
      turnHandlers.current.onTranscript(result);

      if (isContinuous && turnHandlers.current.onAutoSubmit && result.text) {
        const action = await turnHandlers.current.onAutoSubmit(result.text, result.language, signal);
        if (signal.aborted) return;
        if (action === "stop") endSession();
        if (action === "pause") {
          pauseRequested = true;
          capture.current?.pause();
          setState("paused");
        }
        if (action === "mute" && !playback.muted) playback.toggleMute();
      } else {
        setState(isContinuous ? "listening" : "ready");
      }
    } catch (failure) {
      if (signal.aborted) return;
      if (failure instanceof Error && "code" in failure && failure.code === "VOICE_SILENCE") {
        if (!isContinuous) setState("idle");
      } else {
        setError(failure instanceof Error ? failure.message : "Transcription failed.");
        if (!isContinuous) setState("error");
      }
    } finally {
      if (transcription.current === current) transcription.current = null;
      if (timing)
        performance.measure("jugaad-voice-turn", {
          start,
          end: performance.now(),
          detail: {
            ...timing,
            microphoneStartupMs: readyAt.current,
            transcriptMs: transcriptAt === undefined ? undefined : transcriptAt - start,
            cancelled: controller.signal.aborted,
          },
        });
      if (isContinuous && !pauseRequested && active.current === controller && turnHandlers.current.state !== "paused") {
        if (!transcription.current) setState("listening");
      }
    }
  }

  async function startManualRecording() {
    if (active.current || disabled) return;
    stopPlayback();
    const controller = new AbortController();
    active.current = controller;
    setError("");
    setState("permission");
    setLevels([]);
    try {
      const session = await beginVoiceCapture(controller.signal, setLevels, false);
      if (controller.signal.aborted) {
        session.cancel();
        return;
      }
      capture.current = session;
      onCapture(true);
      setState("listening");
      timer.current = setTimeout(() => void stopManualRecording(), maxRecordingSeconds * 1000);
    } catch (failure) {
      if (controller.signal.aborted) return;
      active.current = null;
      onCapture(false);
      setState("error");
      const name = failure instanceof Error ? failure.name : "";
      setError(name === "NotAllowedError" ? "Microphone permission was denied." : "Microphone recording is unavailable.");
    }
  }

  async function stopManualRecording() {
    const session = capture.current;
    const controller = active.current;
    if (!session || !controller) return;
    capture.current = null;
    clearTimeout(timer.current);
    setState("transcribing");
    try {
      const audio = await session.finish();
      await handleTurnAudio(audio);
    } catch {
      setState("error");
      setError("The microphone did not return usable audio.");
    } finally {
      if (active.current === controller) {
        active.current = null;
        onCapture(false);
      }
    }
  }

  async function startContinuousSession() {
    if (active.current || disabled) return;
    const start = performance.now();
    playback.prime();
    stopPlayback();
    const controller = new AbortController();
    active.current = controller;
    setError("");
    setState("permission");
    setLevels([]);

    try {
      const session = await beginVoiceCapture(
        controller.signal,
        {
          onLevels: (lvl) => setLevels(lvl),
          onSpeechState: (vad: VadState) => {
            const current = turnHandlers.current;
            if (vad.speechSamples >= voiceSampleRate * 0.35 && vad.speaking && current.playbackStatus === "playing") {
              stopPlayback();
            }
            if (vad.speaking && current.state === "listening") {
              setState("hearing");
            } else if (!vad.speaking && current.state === "hearing") {
              setState("listening");
            }
          },
          onTurnEnd: (turnAudio, timing) => {
            if (active.current === controller) void handleTurnAudio(turnAudio, timing);
          },
        },
        true
      );

      if (controller.signal.aborted) {
        session.cancel();
        return;
      }
      capture.current = session;
      onCapture(true);
      readyAt.current = performance.now() - start;
      if (onStarted) {
        const greeting = new AbortController();
        opening.current = greeting;
        const greetingSignal = AbortSignal.any([controller.signal, greeting.signal]);
        void onStarted(greetingSignal).catch(() => {
          if (!greetingSignal.aborted) setError("The opening audio is unavailable. You can still speak or type.");
        }).finally(() => {
          if (opening.current === greeting) opening.current = null;
        });
      }
      setState("listening");
    } catch (failure) {
      if (controller.signal.aborted) return;
      active.current = null;
      onCapture(false);
      setState("error");
      const name = failure instanceof Error ? failure.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access to use continuous voice."
          : name === "NotFoundError"
          ? "No microphone was found on this device."
          : "Microphone recording is unavailable here. You can type your request."
      );
    }
  }

  const isSessionActive = Boolean(capture.current);
  const descriptor = stageDescriptors[visualStage];
  const signalLevels = visualStage === "speaking" ? playback.levels : levels;
  const amplitude = signalLevels.length ? Math.min(1, signalLevels.reduce((sum, level) => sum + level, 0) / signalLevels.length) : 0;

  const presentation = visualStage === "speaking" ? "speaking" : visualStage === "listening" || visualStage === "hearing" ? "listening"
    : visualStage === "understanding" || visualStage === "searching" || visualStage === "comparing" ? "thinking" : "idle";

  return (
    <div className={compact ? "approved-voice approved-voice-compact" : "approved-voice"} data-voice-state={presentation}>
      {!compact && <>
        <div className="agent-card-top"><span><span className="status-dot" /> {visualStage === "idle" ? "Ready when you are" : descriptor.label}</span><span className="agent-label">Jugaad / Voice 01</span></div>
        <div className={`agent-visual ${presentation}`} aria-hidden="true">
          <div className="agent-halo halo-outer" /><div className="agent-halo halo-inner" />
          <div className="agent-orb" style={{ scale: 1 + amplitude * .2 }}><div className="agent-orb-shine" /><div className="agent-orb-surface" /></div>
          <span className="orb-mini-spark spark-one">✳</span><span className="orb-mini-spark spark-two">✦</span>
        </div>
        <div className="agent-voice-copy" role="status">
          <h2>{visualStage === "idle" ? "What’s on your mind?" : descriptor.label}</h2>
          <p>{visualStage === "idle" ? "Speak naturally or type below." : descriptor.subtext}</p>
        </div>
      </>}
      <div className="agent-bottom">
          <button
            type="button"
            className={isContinuous && !isSessionActive ? "mic-button mic-start" : "mic-button"}
            onClick={() => {
              if (isContinuous) {
                if (isSessionActive) {
                  togglePause();
                } else {
                  void startContinuousSession();
                }
              } else {
                if (state === "listening" || state === "hearing") {
                  void stopManualRecording();
                } else {
                  void startManualRecording();
                }
              }
            }}
            disabled={disabled || visualStage === "permission"}
            aria-label={
              !isContinuous ? state === "listening" || state === "hearing" ? "Stop recording" : "Record voice" : isSessionActive
                ? state === "paused"
                  ? "Resume microphone"
                  : "Pause microphone"
                : "Start Conversation"
            }
          >
            {state === "paused" ? (
              <MicOff size={20} aria-hidden="true" />
            ) : visualStage === "speaking" ? (
              <Volume2 size={20} className="text-emerald-700" aria-hidden="true" />
            ) : (
              <Mic size={20} aria-hidden="true" />
            )}
            {isContinuous && !isSessionActive && <span>Start Conversation</span>}
          </button>
        <span>{compact ? (visualStage === "idle" ? compactPrompt : descriptor.label) : visualStage === "idle" ? "Tap to speak, or type below" : descriptor.label}</span>
        {isSessionActive && isContinuous && <Button variant="quiet" onClick={endSession}>End voice</Button>}
      </div>
      <details className="approved-voice-settings">
        <summary>Voice controls</summary>
      <div className="voice-toolbar">
        <div className="voice-toolbar__lang">
          <label htmlFor="voice-language-select" className="meta">
            Language:
          </label>
          <select
            id="voice-language-select"
            value={language}
            disabled={isSessionActive || disabled}
            onChange={(e) => onLanguage(e.target.value as VoiceLocale)}
            className="voice-lang-select"
          >
            {Object.entries(voiceLanguages).map(([code, { label }]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="voice-toolbar__actions">
          {isSessionActive ? (
            <>
              <Button
                variant="secondary"
                onClick={togglePause}
                disabled={visualStage === "understanding"}
              >
                {state === "paused" ? <Mic size={14} aria-hidden="true" /> : <MicOff size={14} aria-hidden="true" />}
                {state === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button variant="quiet" onClick={endSession}>
                <Square size={14} aria-hidden="true" /> Stop
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void startContinuousSession()}
              disabled={disabled}
            >
              <Radio size={14} aria-hidden="true" /> Start continuous
            </Button>
          )}

          <Button
            variant="quiet"
            onClick={() => {
              if (isSessionActive) endSession();
              setMode(isContinuous ? "manual" : "continuous");
            }}
          >
            {isContinuous ? "Push-to-talk mode" : "Continuous mode"}
          </Button>
        </div>
      </div>

      </details>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {playback.notice && <p className="workspace-help" role="status">{playback.notice}</p>}
      {(playback.status !== "idle" || playback.caption) && (
        <div className="voice-playback-bar">
          <div className="voice-playback-info">
            <Volume2 size={16} className="text-emerald-700" aria-hidden="true" />
            <div>
              <p className="meta">{playback.status === "playing" ? "Playing Jugaad response" : playback.status === "loading" ? "Preparing Timbre audio…" : "Jugaad response"}</p>
              {playback.caption && (
                <p className="playback-caption" lang={voiceLanguages[playback.caption.language]?.script ?? "en-IN"}>
                  &ldquo;{playback.caption.text}&rdquo;
                </p>
              )}
            </div>
          </div>
          {playback.status === "playing" && !playback.muted && (
            <VoiceWaveform levels={playback.levels} tone="teal" />
          )}
          <div className="playback-actions">
            <Button variant="quiet" onClick={playback.replay} disabled={playback.status === "loading"}>
              <RotateCcw size={13} aria-hidden="true" /> Replay
            </Button>
            <Button variant="quiet" onClick={playback.toggleMute} aria-pressed={playback.muted}>
              {playback.muted ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
              {playback.muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              variant="quiet"
              onClick={playback.stop}
              disabled={playback.status !== "loading" && playback.status !== "playing"}
            >
              <Square size={13} aria-hidden="true" /> Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
