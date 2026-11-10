"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paymentHref } from "@/lib/payment";
import { Button, Panel } from "./ui";
import { QuoteFees, type SelectedFoodOffer } from "./food-discovery";
import { postJson, requestJson, RequestError } from "@/lib/client-request";
import { trackingFinished, type CheckoutAction, type CheckoutSummary, type FoodTransaction } from "@/lib/marketplace/checkout-types";
import { formatPaise } from "@/lib/marketplace/discovery-types";
import { transactionSpeech } from "@/lib/voice/transaction-speech";
import { voiceLanguages, type VoiceLocale } from "@/lib/voice/types";

const localTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const statusLabels = {
  confirmed: "Confirmed", preparing: "Preparing", partner_assigned: "Simulated partner assigned", arriving_for_pickup: "Arriving for pickup",
  picked_up: "Picked up", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled", failed: "Failed", expired: "Expired",
} as const;

function bookingIssue(code?: string) {
  if (code === "CHECKOUT_CANCELLED") return "You cancelled this quote before payment.";
  if (code === "PRICE_CHANGED") return "The provider price changed after you approved it. Request a fresh quote to review the new total.";
  if (code === "QUOTE_EXPIRED") return "This quote expired before the provider accepted it. Request a fresh quote.";
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return "The marketplace rejected the configured agent key.";
  return "The provider has not confirmed this booking. No money moved.";
}

export function FoodCheckout({ selected, configured, onUpdate, voiceLanguage, onSpeak, initialTransaction, onViewReceipt }: {
  selected: SelectedFoodOffer; configured: boolean; onUpdate: (transaction: FoodTransaction) => void;
  initialTransaction?: FoodTransaction;
  onViewReceipt?: (id: string) => void;
  voiceLanguage?: VoiceLocale; onSpeak?: (transaction: FoodTransaction, event: "approval" | "confirmation") => void;
}) {
  const { item, quote: comparisonQuote } = selected.offer;
  const [transaction, setTransaction] = useState<FoodTransaction | undefined>(initialTransaction);
  const initialLine = (initialTransaction?.quote ?? comparisonQuote).lineItems[0];
  const [quantity, setQuantity] = useState(() => String(initialLine.quantity));
  const [options, setOptions] = useState(() => initialLine.selectedOptions.map(({ groupId, optionId }) => ({ groupId, optionId })));
  const router = useRouter();
  const [pending, setPending] = useState<CheckoutAction["action"]>();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const quote = transaction?.quote ?? comparisonQuote;
  const phase = transaction?.phase;
  const speechEvent = phase === "quoted" ? "approval" : phase === "confirmed" ? "confirmation" : undefined;
  const announcement = transaction && voiceLanguage && speechEvent ? transactionSpeech(transaction, speechEvent, voiceLanguage) : undefined;
  const customizationLocked = Boolean(selected.search.dietary || selected.search.dietaryRestrictions?.length || selected.search.allergens?.length);

  function toggleOption(groupId: string, optionId: string, single: boolean, checked: boolean) {
    setOptions((current) => {
      const remaining = current.filter((option) => option.groupId !== groupId || (!single && option.optionId !== optionId));
      return checked ? [...remaining, { groupId, optionId }] : remaining;
    });
  }

  async function perform(action: CheckoutAction) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(action.action);
    setError("");
    try {
      const result = await postJson<FoodTransaction>("/api/marketplace/transactions", action);
      setTransaction(result);
      onUpdate(result);
      if (action.action === "approve" && result.phase === "approved") router.push(paymentHref("provider", result.id));
    } catch (failure) {
      if (failure instanceof RequestError && failure.code === "QUOTE_EXPIRED") {
        setTransaction(undefined);
      }
      setError(failure instanceof Error ? failure.message : "Checkout could not be completed.");
    } finally {
      inFlight.current = false;
      setPending(undefined);
    }
  }

  function requestQuote() {
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 20) { setError("Enter a quantity from 1 to 20."); return; }
    if (item.customization.some((group) => {
      const selectedCount = options.filter((option) => option.groupId === group.id).length;
      return selectedCount < group.minSelect || selectedCount > group.maxSelect;
    })) { setError("Check each option group’s selection limits."); return; }
    void perform({ action: "quote", provider: item.provider.id, branchId: item.restaurant.branchId, item: { menuItemId: item.id, quantity: count, selectedOptions: options }, search: selected.search });
  }

  return <div className="food-checkout selected-quote">
    <p className="workspace-help">{item.provider.name} · {item.restaurant.name}</p>
    <h4>{item.name}</h4>
    <p className="meta">{transaction ? "Exact quote" : "Comparison quote"} · Expires at {localTime.format(new Date(quote.expiresAt))} IST</p>
    <ul className="checkout-lines">{quote.lineItems.map((line) => <li key={line.menuItemId}>{line.quantity} × {line.name}{line.selectedOptions.length > 0 && <span className="meta">{line.selectedOptions.map(({ name }) => name).join(", ")}</span>}</li>)}</ul>
    <QuoteFees quote={quote} />
    {!configured && <p className="workspace-help">Checkout is temporarily unavailable.</p>}
    {configured && (!transaction || phase === "rejected") && <>
      {phase === "rejected" && <p className="field-error" role="alert">{bookingIssue(transaction?.failure)}</p>}
      <div className="workspace-field"><label htmlFor="checkout-quantity">Quantity</label><input id="checkout-quantity" type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
      {!customizationLocked ? item.customization.map((group) => <fieldset className="checkout-options" key={group.id}>
        <legend>{group.name} <span className="meta">{group.minSelect === group.maxSelect ? `Choose ${group.minSelect}` : `Choose up to ${group.maxSelect}`}</span></legend>
        {group.choices.map((option) => <label className="checkout-choice" key={option.id}>
          <input type={group.minSelect === 1 && group.maxSelect === 1 ? "radio" : "checkbox"} name={group.id}
            checked={options.some((value) => value.groupId === group.id && value.optionId === option.id)}
            onChange={(event) => toggleOption(group.id, option.id, event.target.type === "radio", event.target.checked)} />
          <span>{option.name}{option.priceDeltaPaise > 0 ? ` · +${formatPaise(option.priceDeltaPaise)}` : ""}</span>
        </label>)}
      </fieldset>) : <p className="workspace-help">Default required options are used because custom add-ons have no separate dietary or allergen data.</p>}
      <Button onClick={requestQuote} disabled={Boolean(pending)}>{pending === "quote" ? "Requesting quote…" : "Request exact quote"}</Button>
    </>}
    {transaction && phase === "quoted" && <div className="marketplace-actions">
      <Button disabled={Boolean(pending)} onClick={() => void perform({ action: "approve", id: transaction.id, totalPaise: transaction.quote.pricing.totalPaise })}>{pending === "approve" ? "Approving…" : "Approve final total"}</Button>
      <Button variant="quiet" disabled={Boolean(pending)} onClick={() => setTransaction(undefined)}>Change quote</Button>
    </div>}
    {configured && transaction && phase === "approved" &&
      <Link className="btn btn-orange" href={paymentHref("provider", transaction.id)}>Continue to Jugaad Pay</Link>}
    {transaction && (phase === "booking" || phase === "reconciliation") && <div className="checkout-payment">
      <p className="workspace-help" role="status">{phase === "booking" ? "The simulated payment was recorded. Provider verification is in progress." : "The simulated payment was recorded. The provider outcome needs verification."}</p>
      <Button variant="secondary" disabled={Boolean(pending)} onClick={() => void perform({ action: "retry", id: transaction.id })}>{pending === "retry" ? "Checking…" : "Check booking again"}</Button>
    </div>}
    {phase === "confirmed" && transaction?.order && (
      <div className="confirmed-celebration-banner" role="status">
        <CircleCheck size={20} className="text-emerald-700" aria-hidden="true" />
        <div>
          <strong>Provider confirmed the simulated order</strong>
          <p className="meta">Simulated order {transaction.order.reference} accepted by provider.</p>
        </div>
        {onViewReceipt ? <Button variant="quiet" onClick={() => onViewReceipt(transaction.id)}>View receipt</Button> : <a href="#order-history" className="confirmed-view-link">View receipt</a>}
      </div>
    )}
    {announcement && transaction && voiceLanguage && speechEvent && <div className="voice-announcement">
      <p className="workspace-help" lang={voiceLanguages[voiceLanguage].script}>{announcement}</p>
      {onSpeak && <Button variant="quiet" onClick={() => onSpeak(transaction, speechEvent)}>{speechEvent === "approval" ? "Hear approval question" : "Hear confirmation"}</Button>}
    </div>}
    {error && <p className="field-error marketplace-feedback" role="alert">{error}</p>}
  </div>;
}

function ReceiptTracking({ transaction }: { transaction: FoodTransaction }) {
  const order = transaction.order;
  if (!order) return null;
  const { tracking } = order;
  return <div className="receipt-tracking">
    <div className="workspace-subhead">
      {!tracking.terminal && <CircleCheck className="receipt-check" size={20} aria-hidden="true" />}
      <h3>{tracking.terminal ? `Simulated order ${statusLabels[order.currentStatus].toLowerCase()}` : "Receipt for simulated order"}</h3>
    </div>
    <p>{order.provider.name} · <strong>{order.reference}</strong> · {formatPaise(order.pricing.totalPaise)}</p>
    <p className="workspace-help">{transaction.restaurant} · {statusLabels[order.currentStatus]}. Tracking advances with elapsed time in the simulation.</p>
    <details><summary>Receipt breakdown</summary><QuoteFees quote={order} /></details>
    <ol className="tracking-steps" aria-label="Seven-step simulated tracking timeline">
      {tracking.steps.map((step) => <li key={step.id} aria-current={step.state === "current" ? "step" : undefined}><span>{step.label}</span><span className="meta">{step.state === "completed" ? "Complete" : step.state === "current" ? "Current" : "Upcoming"}</span></li>)}
    </ol>
    {!tracking.terminal && order.currentStatus !== "delivered" && <p className="workspace-help">Simulated assignment {localTime.format(new Date(tracking.assignmentEtaAt))} IST ({tracking.assignmentWindowMinutes.min}–{tracking.assignmentWindowMinutes.max} minutes after confirmation). Estimated delivery {localTime.format(new Date(tracking.deliveryEtaAt))} IST.</p>}
    {tracking.partner && !tracking.terminal && <p className="workspace-help">Simulated partner {tracking.partner.name} · {tracking.partner.vehicle}</p>}
  </div>;
}

type HistoryProps = {
  summary: CheckoutSummary | null; initialError: string; activeId: string | null; onActivate: (id: string) => void;
  onUpdate: (transaction: FoodTransaction) => void; onReconciled: (transaction: FoodTransaction) => void; onReload: () => void;
};

export function OrderHistory({ summary, initialError, activeId, onActivate, onUpdate, onReconciled, onReload }: HistoryProps) {
  const [pollError, setPollError] = useState("");
  const transactions = summary?.transactions.filter(({ phase }) => phase === "confirmed" || phase === "booking" || phase === "reconciliation" || phase === "rejected") ?? [];
  const active = transactions.find(({ id }) => id === activeId) ?? transactions[0];
  const order = active?.order;
  const pollingId = active?.id;
  const interval = order?.tracking.pollingIntervalSeconds;
  const stopped = trackingFinished(order);
  const [retryPending, setRetryPending] = useState(false);
  const retryInFlight = useRef(false);

  useEffect(() => {
    if (!pollingId || !interval || stopped) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden) {
        try {
          const next = await requestJson<FoodTransaction>(`/api/marketplace/transactions/${pollingId}`, { signal: controller.signal });
          if (!controller.signal.aborted) {
            onUpdate(next);
            setPollError("");
            if (trackingFinished(next.order)) return;
          }
        } catch {
          if (!controller.signal.aborted) setPollError("Tracking could not refresh. Showing the last provider-verified status.");
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, (interval ?? 6) * 1000);
    }
    timer = setTimeout(poll, 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [pollingId, interval, stopped, onUpdate]);

  async function retryBooking(id: string) {
    if (retryInFlight.current) return;
    retryInFlight.current = true;
    setRetryPending(true);
    setPollError("");
    try {
      const next = await postJson<FoodTransaction>("/api/marketplace/transactions", { action: "retry", id } satisfies CheckoutAction);
      onUpdate(next);
      if (next.phase === "confirmed") onReconciled(next);
    }
    catch (error) { setPollError(error instanceof Error ? error.message : "Booking verification could not be retried."); }
    finally { retryInFlight.current = false; setRetryPending(false); }
  }

  return <Panel className="marketplace-history" id="order-history">
    <div className="workspace-subhead"><ReceiptText size={18} aria-hidden="true" /><h2>Order history</h2></div>
    {initialError ? <><p className="field-error" role="alert">{initialError}</p><Button variant="quiet" onClick={onReload}>Reload history</Button></> : !summary ? <p className="workspace-help" role="status">Loading transaction history…</p> : !active ? <p className="workspace-help">Provider-confirmed receipts and pending booking attempts appear here.</p> : <>
      {transactions.length > 1 && <div className="workspace-field"><label htmlFor="tracked-order">Choose a transaction</label><select id="tracked-order" value={active.id} onChange={(event) => { setPollError(""); onActivate(event.target.value); }}>
        {transactions.map((entry) => <option key={entry.id} value={entry.id}>{entry.order?.reference ?? `${entry.quote.provider.name} · ${entry.phase}`} · {formatPaise(entry.quote.pricing.totalPaise)}</option>)}
      </select></div>}
      {order ? <ReceiptTracking transaction={active} /> : <>
        <p className="workspace-help" role="status">{active.phase === "rejected" ? bookingIssue(active.failure) : "The simulated payment was recorded. The provider has not yet confirmed this booking."}</p>
        {summary.configured && active.phase !== "rejected" && <Button variant="secondary" disabled={retryPending} onClick={() => void retryBooking(active.id)}>{retryPending ? "Checking…" : "Retry booking verification"}</Button>}
      </>}
      {pollError && <p className="field-error" role="status">{pollError}</p>}
    </>}
  </Panel>;
}
