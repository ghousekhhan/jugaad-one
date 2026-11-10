"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ShieldCheck, Delete, ArrowLeft } from "lucide-react";
import { demoCode } from "@/lib/commerce/types";
import { Button } from "./ui";

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function DemoKeypad({
  pending,
  totalFormatted,
  merchantName,
  label = "Authorize simulated payment",
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  totalFormatted?: string;
  merchantName?: string;
  label?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const [code, setCode] = useState("");
  const enabled = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot) && !pending;

  function handleDigit(digit: string) {
    if (!enabled || code.length >= 4) return;
    setCode((value) => value.length < 4 ? value + digit : value);
    navigator.vibrate?.(8);
  }

  function handleDelete() {
    if (!enabled || !code) return;
    setCode((val) => val.slice(0, -1));
  }

  function handleQuickFill() {
    if (!enabled) return;
    setCode(demoCode);
  }

  const isMatched = code === demoCode;
  useEffect(() => {
    if (!enabled) return;
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat ||
          (event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable]"))) return;
      if (/^[0-9]$/u.test(event.key)) {
        event.preventDefault();
        setCode((value) => value.length < 4 ? value + event.key : value);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setCode((value) => value.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return (
    <div className="jugaad-pay-scene" aria-label="Jugaad Pay simulated payment">
      {/* Header with security disclosure */}
      <div className="jugaad-pay-scene__header">
        <div className="jugaad-pay-scene__badge">
          <ShieldCheck size={16} className="text-emerald-700" aria-hidden="true" />
          <span>Jugaad Pay · Simulated payment</span>
        </div>
        {totalFormatted && (
          <div className="jugaad-pay-scene__amount">
            <span className="meta muted">Total to authorize</span>
            <div className="jugaad-pay-scene__price">{totalFormatted}</div>
          </div>
        )}
        {merchantName && (
          <p className="meta muted">Fictional provider: {merchantName}</p>
        )}
      </div>

      {/* Code Prompt & PIN Dots */}
      <div className="jugaad-pay-scene__body">
        <p className="jugaad-pay-prompt">
          Enter the <strong>four-digit demo PIN</strong> to authorize this simulated payment.
        </p>

        <div className="jugaad-pay-dots" aria-label={`${code.length} of 4 demo digits entered`}>
          {[0, 1, 2, 3].map((index) => {
            const hasDigit = code.length > index;
            return (
              <div
                key={index}
                className={`jugaad-pay-dot ${hasDigit ? "jugaad-pay-dot--filled" : ""}`}
              />
            );
          })}
        </div>

        {code.length === 4 && !isMatched && (
          <p className="field-error text-center" role="alert">
            Incorrect demo code. Use <strong>{demoCode}</strong> or tap Autofill.
          </p>
        )}

        {/* Demo Helper Button */}
        <button
          type="button"
          className="demo-code-helper-pill"
          onClick={handleQuickFill}
          disabled={!enabled}
        >
          <span>Demo code is <strong>{demoCode}</strong></span>
          <span className="demo-code-helper-tap">Tap to autofill</span>
        </button>

        {/* Tactile Keypad */}
        <div className="jugaad-keypad-grid" aria-label="Demo code keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              className="jugaad-keypad-btn"
              disabled={!enabled || code.length >= 4}
              onClick={() => handleDigit(digit)}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className="jugaad-keypad-btn jugaad-keypad-btn--action"
            disabled={!enabled || !code}
            onClick={handleDelete}
            aria-label="Delete last digit"
          >
            <Delete size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="jugaad-keypad-btn"
            disabled={!enabled || code.length >= 4}
            onClick={() => handleDigit("0")}
          >
            0
          </button>
          <button
            type="button"
            className="jugaad-keypad-btn jugaad-keypad-btn--clear"
            disabled={!enabled || !code}
            onClick={() => setCode("")}
            aria-label="Clear all digits"
          >
            Clear
          </button>
        </div>

        {/* Actions & Disclaimers */}
        <div className="jugaad-pay-actions">
          <Button
            variant="primary"
            disabled={!enabled || !isMatched}
            onClick={onConfirm}
            className="jugaad-pay-confirm-btn"
          >
            {pending ? "Confirming with provider…" : label}
          </Button>

          {onCancel && (
            <Button
              variant="quiet"
              disabled={!enabled}
              onClick={onCancel}
              className="jugaad-pay-cancel-btn"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Cancel authorization
            </Button>
          )}
        </div>

        <p className="jugaad-pay-disclaimer">
          This payment is simulated. Your bank balance will stay the same.
        </p>
      </div>
    </div>
  );
}
