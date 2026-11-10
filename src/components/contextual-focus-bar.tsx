"use client";

import {
  FOCUS_PHASES,
  phaseOrder,
  type ContextualFocusPhase,
  type FocusPhaseDef,
} from "@/lib/focus/focus-state";

export { FOCUS_PHASES, phaseOrder, type ContextualFocusPhase, type FocusPhaseDef };

type Props = {
  phase: ContextualFocusPhase;
};

export function ContextualFocusBar({ phase }: Props) {
  const currentDef = FOCUS_PHASES.find((p) => p.id === phase) ?? FOCUS_PHASES[0];
  const currentIndex = phaseOrder[phase];

  return (
    <section className="focus-bar paper-grid" aria-label="Conversation focus rail">
      <div className="focus-bar__rail">
        {FOCUS_PHASES.map(({ id, step, label }, index) => {
          const isCurrent = id === phase;
          const isPast = index < currentIndex;
          return (
            <div
              key={id}
              className={`focus-bar__step ${isCurrent ? "focus-bar__step--current" : ""} ${isPast ? "focus-bar__step--past" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="focus-bar__num">{step}</span>
              <span className="focus-bar__label">{label}</span>
              {isCurrent && <span className="focus-bar__dot" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <div className="focus-bar__banner" aria-live="polite">
        <span className="focus-bar__badge">
          Step {currentDef.step} · {currentDef.label}
        </span>
        <span className="focus-bar__desc">{currentDef.desc}</span>
      </div>
    </section>
  );
}
