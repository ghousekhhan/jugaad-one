"use client";

import { playSound, primeSound } from "@/lib/sound/engine";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { postJson } from "@/lib/client-request";
import { demoCode, type SandboxOrder } from "@/lib/commerce/types";
import { formatPaise } from "@/lib/marketplace/discovery-types";
import type { FoodTransaction } from "@/lib/marketplace/checkout-types";
import type { PaymentDetails } from "@/lib/payment";
import { DemoKeypad } from "./demo-keypad";
import { PaymentCelebration } from "./payment-celebration";
import { useVoicePlayback } from "./use-voice-playback";
import { transactionSpeech } from "@/lib/voice/transaction-speech";

export function PaymentScreen({ payment }: { payment: PaymentDetails }) {
  const [stage, setStage] = useState<PaymentDetails["stage"] | "processing">(payment.stage);
  const [receipt, setReceipt] = useState(payment.receipt);
  const [celebrate, setCelebrate] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const feedback = useRef<AbortController | null>(null);
  useEffect(() => () => feedback.current?.abort(), []);
  const playback = useVoicePlayback();
  const heading = useRef<HTMLHeadingElement>(null);
  const amount = formatPaise(payment.totalPaise);
  const pending = stage === "processing";
  useEffect(() => { if (stage !== "authorize") heading.current?.focus(); }, [stage]);

  async function confirm(reconcile = false) {
    if (inFlight.current || stage !== (reconcile ? "reconcile" : "authorize")) return;
    inFlight.current = true;
    feedback.current?.abort();
    const controller = new AbortController();
    feedback.current = controller;
    primeSound();
    playback.prime();
    void playSound("payment.processing", controller.signal);
    setStage("processing");
    setMessage("");
    try {
      let announce: (() => void) | undefined;
      if (payment.source === "provider") {
        const transaction = await postJson<FoodTransaction>("/api/marketplace/transactions", reconcile
          ? { action: "retry", id: payment.id }
          : { action: "pay", id: payment.id, demoUpi: "jugaad@demo", confirmed: true });
        if (transaction.phase === "booking" || transaction.phase === "reconciliation") {
          setStage("reconcile");
          setMessage("The provider is still verifying the order. You can check its status here.");
          return;
        }
        if (transaction.phase !== "confirmed" || !transaction.order || transaction.id !== payment.id ||
            transaction.quote.pricing.totalPaise !== payment.totalPaise) throw new Error("The provider hasn’t confirmed this checkout.");
        setReceipt({ id: transaction.id, reference: transaction.order.reference });
        const text = transactionSpeech(transaction, "confirmation", payment.language);
        if (text) announce = () => { void playback.play({ kind: "confirmation", transactionId: transaction.id, language: payment.language }, { text, language: payment.language }, controller.signal); };
      } else {
        const result = await postJson<{ order?: SandboxOrder; speech?: string; speechTicket?: string }>("/api/commerce", {
          input: { action: "pay", quoteId: payment.id, totalPaise: payment.totalPaise, code: demoCode }, language: payment.language,
        });
        const order = result.order;
        if (!order || order.payment !== "simulated_no_charge" || order.quote.id !== payment.id ||
            order.quote.offer.totalPaise !== payment.totalPaise) throw new Error("The order could not be verified.");
        setReceipt({ id: order.reference, reference: order.reference });
        const { speech, speechTicket } = result;
        if (speech && speechTicket) {
          announce = () => { void playback.play({ kind: "reply", ticket: speechTicket }, { text: speech, language: payment.language }, controller.signal); };
        }
      }
      setCelebrate(true);
      setStage("confirmed");
      void playSound("payment.success", controller.signal).then(() => {
        if (!controller.signal.aborted) announce?.();
      });
    } catch (error) {
      void playSound("action.error", controller.signal);
      setMessage(error instanceof Error ? error.message : "Check the checkout status before trying again.");
      setStage("failed");
    } finally {
      inFlight.current = false;
    }
  }

  return <main id="main" className="pay-page">
    <div className="pay-frame">
      <header className="pay-header">
        <div><p className="pay-brand">Jugaad Pay<span>.</span></p><p>Simulated UPI checkout</p></div>
        {!pending && <Link className="pay-return" href="/workspace"><ArrowLeft size={17} aria-hidden="true" /> Jugaad</Link>}
      </header>
      <p className="pay-notice"><ShieldCheck size={18} aria-hidden="true" /> Demo payment. No real money will be transferred.</p>
      {stage === "authorize" ? <div className="pay-grid">
        <section className="pay-surface" aria-labelledby="payment-title">
          <p className="pay-caption">Amount to authorize</p>
          <h1 id="payment-title" className="pay-total">{amount}</h1>
          <dl className="pay-parties">
            <div><dt>Paying</dt><dd>{payment.merchant}<small>{payment.provider}</small></dd></div>
            <div><dt>Paying as</dt><dd>{payment.payer.name}<small>{payment.payer.identity} · Fictional UPI identity</small></dd></div>
          </dl>
          <p className="pay-caption">Order summary</p>
          <ul className="pay-items">{payment.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
          <dl className="pay-breakdown">
            {payment.breakdown.map(({ label, paise }) => <div key={label}><dt>{label}</dt><dd>{paise < 0 ? "−" : ""}{formatPaise(Math.abs(paise))}</dd></div>)}
            <div><dt>Final total</dt><dd>{amount}</dd></div>
          </dl>
          <p className="pay-id">Checkout ID {payment.id}</p>
        </section>
        <section className="pay-surface pay-auth" aria-label="Demo authorization">
          <div className="pay-mobile-summary"><strong>{amount}</strong><span>{payment.merchant} · {payment.provider}</span></div>
          <DemoKeypad pending={false} label={`Authorize simulated payment · ${amount}`} onConfirm={() => void confirm()} />
          <Link className="pay-return pay-cancel" href="/workspace">Cancel authorization</Link>
        </section>
      </div> : <section className="pay-surface pay-outcome" data-stage={stage}>
        {stage === "processing" ? <>
          <div className="pay-spinner" aria-hidden="true" />
          <h1 ref={heading} tabIndex={-1} aria-live="polite">Processing your simulated payment…</h1>
          <p>Waiting for confirmation of your order.</p>
        </> : stage === "confirmed" && receipt ? <>
          <div className="pay-confirmation-visual" aria-hidden="true">
            {celebrate && <div className="pay-spinner pay-spinner-exit" />}
            <svg className="pay-confirmation-mark" data-animate={celebrate} width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
              <circle cx="58" cy="58" r="54" />
              <path d="M34 58l16 16 33-34" pathLength="1" />
            </svg>
          </div>
          {celebrate && <PaymentCelebration />}
          <h1 ref={heading} tabIndex={-1}>Payment successful!</h1>
          <p>Your simulated payment has been completed.</p>
          <dl className="pay-breakdown pay-receipt">
            <div><dt>Final amount</dt><dd>{amount}</dd></div>
            <div><dt>Merchant</dt><dd>{payment.merchant}</dd></div>
            <div><dt>Order ID</dt><dd>{receipt.reference}</dd></div>
            <div><dt>Status</dt><dd>Confirmed</dd></div>
          </dl>
          <p className="pay-done">Jugaad Done.</p>
          {playback.voiceNotice && <p role="status">{playback.voiceNotice}</p>}
          {playback.caption && <p className="pay-caption">{playback.caption.text}</p>}
          {playback.status === "playing" && <button className="btn btn-dark" type="button" onClick={playback.stop}>Stop audio</button>}
          <div className="pay-actions">
            <Link className="btn btn-orange" href={`/workspace?tab=orders&receipt=${encodeURIComponent(receipt.id)}`}>View order <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link className="btn btn-dark" href="/workspace">Back to Jugaad</Link>
          </div>
        </> : <>
          <h1 ref={heading} tabIndex={-1}>{stage === "reconcile" ? "Waiting for provider confirmation" : "Simulated payment could not be completed."}</h1>
          <p role="status">{message || (stage === "reconcile" ? "Check the existing booking before trying again." : "The quote may have expired. Check its status or return to Jugaad for a fresh quote.")}</p>
          <div className="pay-actions">
            {stage === "reconcile"
              ? <button type="button" className="btn btn-orange" onClick={() => void confirm(true)}>Check booking</button>
              : <button type="button" className="btn btn-orange" onClick={() => window.location.reload()}>Check checkout status</button>}
            <Link className="btn btn-dark" href="/workspace">Back to Jugaad</Link>
          </div>
        </>}
      </section>}
    </div>
  </main>;
}
