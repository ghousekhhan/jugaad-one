"use client";

import { SoundMotionSettings } from "./interaction-feedback";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { Profile } from "@/lib/commerce/session";
import type { SandboxOrder } from "@/lib/commerce/types";
import type { CheckoutSummary } from "@/lib/marketplace/checkout-types";
import { demoCities } from "@/lib/marketplace/demo-cities";
import { formatPaise } from "@/lib/marketplace/discovery-types";
import { preferredVoice } from "@/lib/voice/catalog";
import { voiceLanguages, type VoiceLocale } from "@/lib/voice/types";

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export function ApprovedProfile({ profile, onSave, voiceSettings }: { profile: Profile; voiceSettings?: ReactNode; onSave: (profile: Profile) => Promise<void> }) {
  const [name, setName] = useState(profile.name);
  const [language, setLanguage] = useState(profile.language);
  const [region, setRegion] = useState(profile.region);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !region || !name.trim()) return;
    setPending(true);
    setNotice("");
    setFailed(false);
    try {
      const location = region === profile.region && profile.location ? profile.location : { source: "manual" as const, cityId: region };
      await onSave({ name: name.trim(), language, region, location, locality: region === profile.region ? profile.locality : undefined });
      setNotice(language !== profile.language ? `Language saved. Your voice is now ${preferredVoice(language)}.` : "Changes saved.");
    } catch (error) {
      setFailed(true);
      setNotice(error instanceof Error ? error.message : "Could not save your preferences.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="tab-screen">
      <div className="screen-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Personal space</div><h1>Make it<br /><em>yours.</em></h1><p>The essentials, thoughtfully kept out of your way.</p></div><span className="profile-page-marker">03 / Profile</span></div>
      <div className="profile-layout">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-identity-label">Your Jugaad profile</div><h2>{profile.name}</h2><p>A little context goes a long way.</p>
          <div className="profile-identity-line" />
          <div className="profile-meta"><span>Status</span><strong><span className="status-dot" /> Ready to explore</strong></div>
          <div className="profile-meta"><span>Environment</span><strong>Simulated transactions</strong></div>
        </div>
        <form className="profile-form" onSubmit={save}>
          <div className="form-section-head"><div><h2>Your preferences</h2><p>Saved to your Jugaad session.</p></div><span>01 — 03</span></div>
          <label htmlFor="profile-name">Preferred name</label><input id="profile-name" autoComplete="given-name" maxLength={40} required value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="profile-language">Conversation language</label><select id="profile-language" value={language} onChange={(event) => setLanguage(event.target.value as VoiceLocale)}>{Object.entries(voiceLanguages).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}</select>
          <label htmlFor="profile-city">Service city</label><select id="profile-city" required value={region ?? ""} onChange={(event) => setRegion(event.target.value as Profile["region"])}>{Object.values(demoCities).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select>
          <div className="form-bottom"><span>Your next search will use this city.</span><button className="btn btn-orange" disabled={pending} type="submit">{pending ? "Saving…" : "Save changes ↗"}</button></div>
          {notice && <p className={failed ? "field-error" : "workspace-help"} role={failed ? "alert" : "status"}>{notice}</p>}
        </form>
      </div>
      {voiceSettings}
      <SoundMotionSettings />
      <div className="profile-note"><span aria-hidden="true">✳</span><p>Your preferences stay with this browser’s Jugaad session. No account is required.</p></div>
    </section>
  );
}

export function ApprovedOrders({ orders, checkout, loading, error, active, onOpen, onClose, onBack, onReload, detail }: {
  orders: SandboxOrder[]; checkout: CheckoutSummary | null; loading: boolean; error: string;
  active: string | null; onOpen: (id: string) => void; onClose: () => void; onBack: () => void;
  onReload: () => void; detail: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const local = orders.map((order) => ({
    id: order.reference, title: order.quote.offer.listing.name, reference: order.reference,
    merchant: order.quote.offer.listing.seller, total: order.quote.offer.totalPaise, timestamp: order.confirmedAt,
    location: demoCities[order.quote.offer.listing.region].name, confirmed: true,
  }));
  const provider = (checkout?.transactions ?? []).filter(({ phase }) => ["confirmed", "booking", "reconciliation", "rejected"].includes(phase)).map((transaction) => ({
    id: transaction.id, title: transaction.quote.lineItems[0].name, reference: transaction.order?.reference,
    merchant: transaction.quote.provider.name, total: transaction.quote.pricing.totalPaise, timestamp: Date.parse(transaction.createdAt),
    location: transaction.restaurant, confirmed: transaction.phase === "confirmed" && Boolean(transaction.order),
  }));
  const rows = [...local, ...provider].sort((a, b) => b.timestamp - a.timestamp);
  const confirmed = rows.filter((row) => row.confirmed);
  const selection = rows.find((row) => row.id === active);
  const localOrder = orders.find((order) => order.reference === active);
  useEffect(() => {
    const element = dialog.current;
    if (selection && element && !element.open) element.showModal();
  }, [selection?.id, selection]);

  return (
    <section className="tab-screen">
      <div className="screen-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> Your activity</div><h1>Every order,<br /><em>one place.</em></h1><p>A clear record of the transactions you’ve approved.</p></div><button className="outline-action" type="button" onClick={onBack}>↗ Back to Jugaad</button></div>
      <div className="orders-overview">
        <div className="stat-card"><span>Simulated orders</span><strong>{String(confirmed.length).padStart(2, "0")}</strong><small>Confirmed orders</small></div>
        <div className="stat-card"><span>Simulated order total</span><strong>{formatPaise(confirmed.reduce((sum, row) => sum + row.total, 0))}</strong><small>No real payments</small></div>
        <div className="stat-card stat-card-feature"><span>Your order history</span><div className="stat-glyph" aria-hidden="true">↗</div><small>Everything, in one place.</small></div>
      </div>
      <div className="orders-list-card">
        <div className="list-title"><h2>Order history</h2><span>{rows.length} {rows.length === 1 ? "record" : "records"}</span></div>
        {error && <div className="approved-order-status"><p role="alert">{error}</p><button className="outline-action" onClick={onReload} type="button">Reload history</button></div>}
        {loading && !error && <p className="approved-order-status" role="status">Loading order history…</p>}
        {!loading && !error && !rows.length && <div className="approved-order-status"><h3>No orders yet.</h3><p>Your confirmed simulated orders will appear here.</p><button className="outline-action" onClick={onBack} type="button">Back to Jugaad ↗</button></div>}
        {rows.map((row) => <button key={row.id} type="button" className="order-row" onClick={() => onOpen(row.id)}>
          <span><strong>{row.title}</strong><small>{row.merchant} · {row.reference ?? "Booking review"}</small></span>
          <span><strong>{date.format(row.timestamp)}</strong><small>{row.location}</small></span>
          <strong>{formatPaise(row.total)}</strong><ArrowUpRight size={15} aria-hidden="true" />
        </button>)}
      </div>
      <dialog className="approved-order-dialog" ref={dialog} onClose={onClose} aria-labelledby="approved-receipt-title">
        <header><h2 id="approved-receipt-title">{selection?.title ?? "Order details"}</h2><button type="button" className="outline-action" aria-label="Close order details" onClick={() => dialog.current?.close()}><X size={18} /></button></header>
        {localOrder ? <div className="approved-local-receipt">
          <p>Confirmed simulated order · {localOrder.reference}</p><p>{localOrder.quote.offer.quantity} × {localOrder.quote.offer.listing.name} · {localOrder.quote.offer.listing.seller}</p>
          {localOrder.quote.offer.selectedModifiers?.map((option) => <p key={option.id}>{option.name}</p>)}
          <strong>{formatPaise(localOrder.quote.offer.totalPaise)}</strong><p>No money was charged.</p>
        </div> : selection && detail}
      </dialog>
    </section>
  );
}
