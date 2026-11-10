"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPaise } from "@/lib/marketplace/discovery-types";
import { demoCode, trackingStage, type CommerceAction, type SandboxState } from "@/lib/commerce/types";
import { Button } from "./ui";
import { DemoKeypad } from "./demo-keypad";
import { Clock, Star, ArrowRight, ShieldCheck, Tag } from "lucide-react";

export function SandboxCommerce({
  state,
  onAction,
  pending,
}: {
  state: SandboxState;
  onAction: (input: CommerceAction) => Promise<void>;
  pending: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state.orders.length) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [state.orders.length]);

  const quote = state.quote;
  const offers = state.offers;
  const addOnPaise = quote?.offer.selectedModifiers?.reduce((total, option) => total + option.pricePaise, 0) ?? 0;

  // Compute trade-off deltas if there are 2 offers (Offer A vs Offer B)
  const tradeOffs = useMemo(() => {
    if (offers.length < 2) return null;
    const [first, second] = offers;
    const priceDiff = first.totalPaise - second.totalPaise;
    const etaDiff = first.listing.etaMinutes - second.listing.etaMinutes;

    return {
      priceDiff,
      etaDiff,
      firstCheaper: priceDiff < 0,
      secondCheaper: priceDiff > 0,
      firstFaster: etaDiff < 0,
      secondFaster: etaDiff > 0,
      cheaperAmount: formatPaise(Math.abs(priceDiff)),
      fasterMinutes: Math.abs(etaDiff),
    };
  }, [offers]);

  return (
    <div className="sandbox-commerce-zone">
      {/* OFFER COMPARISON (Core Moment: Offer A vs Offer B) */}
      {offers.length > 0 && !quote && (
        <section aria-label="Sandbox comparison" className="sandbox-comparison-section">
          <div className="comparison-headline">
            <span className="comparison-badge">
              <span>Simulated Offer Comparison</span>
            </span>
            <p className="meta muted">
              Comparing {offers.length} eligible options across simulated sellers in your area
            </p>
          </div>

          <div className="comparison-cards-grid">
            {offers.map(({ listing, totalPaise }, index) => {
              const isOfferA = index === 0;
              const isOfferB = index === 1;
              const isLowest = offers.length > 1 && offers.every((offer) => offer.listing.id === listing.id || totalPaise < offer.totalPaise);

              return (
                <div
                  key={listing.id}
                  className={`comparison-card offer-card ${isLowest ? "comparison-card--recommended" : ""}`}
                >
                  <div className="comparison-card__top">
                    <div className="comparison-card__label">
                      <span className="comparison-card__opt">Option 0{index + 1}</span>
                      <span className="comparison-card__seller">{listing.seller}</span>
                    </div>
                    {isLowest && (
                      <span className="comparison-card__badge-rec">
                        Lowest total
                      </span>
                    )}
                  </div>

                  <h3 className="comparison-card__title">{listing.name}</h3>

                  {/* Attributes & dietary tokens */}
                  <div className="comparison-card__attrs">
                    {Object.entries(listing.attributes).map(([key, val]) => (
                      <span key={key} className="comparison-attr-tag">
                        {String(val)}
                      </span>
                    ))}
                  </div>

                  {/* Telemetry metadata: Rating, ETA, Region */}
                  <div className="comparison-card__telemetry">
                    <span className="telemetry-pill">
                      <Star size={13} className="text-amber-500 fill-amber-500" aria-hidden="true" />
                      <span>{listing.rating.toFixed(1)} / 5</span>
                    </span>
                    <span className="telemetry-pill">
                      <Clock size={13} aria-hidden="true" />
                      <span>~{listing.etaMinutes} min</span>
                    </span>
                    <span className="telemetry-pill meta muted">
                      {listing.region}
                    </span>
                  </div>

                  {/* Trade-off Rationale Callout */}
                  {tradeOffs && (
                    <div className="comparison-card__tradeoff">
                      {isOfferA && tradeOffs.firstCheaper && (
                        <span className="tradeoff-chip tradeoff-chip--cheaper">
                          <Tag size={12} aria-hidden="true" /> {tradeOffs.cheaperAmount} cheaper
                        </span>
                      )}
                      {isOfferB && tradeOffs.secondCheaper && (
                        <span className="tradeoff-chip tradeoff-chip--cheaper">
                          <Tag size={12} aria-hidden="true" /> {tradeOffs.cheaperAmount} cheaper
                        </span>
                      )}
                      {isOfferA && tradeOffs.firstFaster && (
                        <span className="tradeoff-chip tradeoff-chip--faster">
                          <Clock size={12} aria-hidden="true" /> {tradeOffs.fasterMinutes} min faster
                        </span>
                      )}
                      {isOfferB && tradeOffs.secondFaster && (
                        <span className="tradeoff-chip tradeoff-chip--faster">
                          <Clock size={12} aria-hidden="true" /> {tradeOffs.fasterMinutes} min faster
                        </span>
                      )}
                    </div>
                  )}

                  {/* Dominant Total Price */}
                  <div className="comparison-card__pricing">
                    <span className="meta muted">All-inclusive total</span>
                    <div className="comparison-card__total-price">
                      {formatPaise(totalPaise)}
                    </div>
                    <span className="meta muted">Includes delivery & taxes</span>
                  </div>

                  {/* Selection Button */}
                  <Button
                    variant={isLowest ? "primary" : "secondary"}
                    disabled={pending}
                    onClick={() => void onAction({ action: "select", listingId: listing.id })}
                    className="comparison-card__select-btn"
                  >
                    <span>Choose {listing.seller}</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* JUGAAD PAY / QUOTE REVIEW SECTION */}
      {quote && (
        <section className="checkout-payment-card paper-grid" aria-label="Jugaad Pay">
          <div className="checkout-payment-card__header">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-orange-600" aria-hidden="true" />
              <h3 className="display-feature">
                {quote.approvedAt ? "Jugaad Pay · Complete Authorization" : "Review Exact Sandbox Quote"}
              </h3>
            </div>
            <p className="meta muted">
              {quote.offer.quantity} × {quote.offer.listing.name} from {quote.offer.listing.seller}
            </p>
          </div>

          {!quote.approvedAt && quote.offer.listing.modifiers?.map((group) => <fieldset key={group.id} className="recovery-addons">
            <legend>{group.name}</legend>
            {group.options.map((option) => {
              const added = quote.offer.selectedModifiers?.some(({ id }) => id === option.id);
              return <Button key={option.id} variant="secondary" disabled={pending || added} onClick={() => void onAction({ action: "customize", quoteId: quote.id, modifierId: option.id })}>
                {added ? "Added" : "Add"} {option.name} · {formatPaise(option.pricePaise)} each
              </Button>;
            })}
          </fieldset>)}

          <dl className="quote-breakdown-grid">
            <div className="breakdown-row">
              <dt>Items ({quote.offer.quantity}x)</dt>
              <dd>{formatPaise(quote.offer.listing.pricePaise * quote.offer.quantity)}</dd>
            </div>
            {quote.offer.selectedModifiers?.map((option) => <div key={option.id} className="breakdown-row">
              <dt>{option.name} ({quote.offer.quantity}×)</dt>
              <dd>{formatPaise(option.pricePaise * quote.offer.quantity)}</dd>
            </div>)}
            <div className="breakdown-row">
              <dt>Simulated delivery fee</dt>
              <dd>{formatPaise(quote.offer.listing.deliveryPaise)}</dd>
            </div>
            <div className="breakdown-row">
              <dt>Taxes & packaging</dt>
              <dd>{formatPaise(quote.offer.totalPaise - quote.offer.listing.deliveryPaise - (quote.offer.listing.pricePaise + addOnPaise) * quote.offer.quantity)}</dd>
            </div>
            <div className="breakdown-row breakdown-row--total">
              <dt>{quote.approvedAt ? "Approved total" : "Total to approve"}</dt>
              <dd className="total-highlight">{formatPaise(quote.offer.totalPaise)}</dd>
            </div>
          </dl>

          {!quote.approvedAt ? (
            <div className="approval-action-row">
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  void onAction({
                    action: "approve",
                    quoteId: quote.id,
                    totalPaise: quote.offer.totalPaise,
                  })
                }
                className="w-full"
              >
                Approve exact total · {formatPaise(quote.offer.totalPaise)}
              </Button>
              <Button
                variant="quiet"
                disabled={pending}
                onClick={() => void onAction({ action: "cancel", quoteId: quote.id })}
              >
                Cancel quote
              </Button>
            </div>
          ) : (
            <DemoKeypad
              key={quote.id}
              pending={pending}
              totalFormatted={formatPaise(quote.offer.totalPaise)}
              merchantName={quote.offer.listing.seller}
              label="Authorize simulated payment"
              onConfirm={() => void onAction({ action: "pay", quoteId: quote.id, code: demoCode })}
              onCancel={() => void onAction({ action: "cancel", quoteId: quote.id })}
            />
          )}
        </section>
      )}

      {/* CONFIRMED SANDBOX ORDERS & TRACKING */}
      {state.orders.length > 0 && (
        <section aria-label="Sandbox orders" className="sandbox-orders-section">
          <div className="orders-section-header">
            <h3 className="display-feature">Your Sandbox Transactions</h3>
            <span className="meta muted">Persisted in local session</span>
          </div>

          <div className="orders-cards-list">
            {state.orders.map((order) => (
              <div key={order.reference} className="order-receipt-card">
                <div className="order-receipt-card__top">
                  <span className="order-ref-pill">{order.reference}</span>
                  <span className="order-status-badge">
                    {trackingStage(order, now)}
                  </span>
                </div>

                <div className="order-receipt-card__main">
                  <strong>
                    {order.quote.offer.quantity} × {order.quote.offer.listing.name}
                  </strong>
                  <p className="meta muted">
                    {order.quote.offer.listing.seller} · {formatPaise(order.quote.offer.totalPaise)}
                  </p>
                </div>

                <div className="order-receipt-card__footer">
                  <span className="meta muted">
                    {order.destination ? `${order.destination} · ` : ""}
                    {order.quote.offer.listing.region}
                  </span>
                  <span className="meta muted">
                    Est.{" "}
                    {new Date(
                      order.confirmedAt + order.quote.offer.listing.etaMinutes * 60_000
                    ).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
