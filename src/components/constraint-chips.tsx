"use client";

import { X } from "lucide-react";
import type { FoodIntent } from "@/lib/integrations/food-intent";
import { extractConstraintChips, type ChipItem } from "@/lib/focus/focus-state";

export { extractConstraintChips, type ChipItem };

type Props = {
  constraints?: FoodIntent;
  locationLabel?: string;
  onRemove?: (key: keyof FoodIntent | "location") => void;
};

export function ConstraintChips({ constraints, locationLabel, onRemove }: Props) {
  const chips = extractConstraintChips(constraints, locationLabel);

  if (chips.length === 0) return null;

  return (
    <div className="constraint-chips" role="region" aria-label="Active understood criteria">
      <div className="constraint-chips__label">
        <span>Understood criteria:</span>
      </div>
      <div className="constraint-chips__list">
        {chips.map(({ key, label, value }) => (
          <span key={key} className="constraint-chip">
            <span className="constraint-chip__key">{label}:</span>
            <strong className="constraint-chip__value">{value}</strong>
            {onRemove && key !== "location" && (
              <button
                type="button"
                className="constraint-chip__remove"
                onClick={() => onRemove(key)}
                aria-label={`Clear ${label} constraint`}
                title={`Clear ${label}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
