"use client";

type Props = {
  active: boolean;
  query?: string;
};

export function ProviderProgress({ active, query }: Props) {
  if (!active) return null;

  return (
    <div className="provider-progress paper-grid" role="status" aria-live="polite">
      <div className="provider-progress__header">
        <div className="provider-progress__title-row">
          <span className="provider-progress__badge">Multi-Provider Scan</span>
          <span className="provider-progress__meta">Calculating final totals with fees & tax</span>
        </div>
        {query && <p className="provider-progress__query">Looking for: <strong>“{query}”</strong></p>}
      </div>
      <div className="provider-progress__list">
        <div className="provider-progress__item">
          <div className="provider-progress__item-head">
            <div className="provider-progress__dot" />
            <strong>Wiggy</strong>
            <span className="provider-progress__state">Scanning branch catalog & delivery estimate…</span>
          </div>
          <div className="provider-progress__track" aria-hidden="true">
            <div className="provider-progress__bar" />
          </div>
        </div>
        <div className="provider-progress__item">
          <div className="provider-progress__item-head">
            <div className="provider-progress__dot" />
            <strong>Tomato</strong>
            <span className="provider-progress__state">Fetching branch menu & calculating surge fees…</span>
          </div>
          <div className="provider-progress__track" aria-hidden="true">
            <div className="provider-progress__bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
