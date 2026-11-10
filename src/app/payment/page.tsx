import { createHash } from "node:crypto";
import Link from "next/link";
import { cookies } from "next/headers";
import { z } from "zod";
import { readSession } from "@/lib/commerce/session";
import { appliedWelcomeDiscount, type SandboxQuote } from "@/lib/commerce/types";
import { checkoutCookie, checkoutOwner } from "@/lib/marketplace/checkout";
import { transactionStore } from "@/lib/marketplace/transaction-store";
import type { PaymentDetails } from "@/lib/payment";
import { PaymentScreen } from "@/components/payment-screen";
import "./payment.css";

export const metadata = { title: "Jugaad Pay", robots: { index: false, follow: false } };

const paymentQuery = z.object({ source: z.enum(["provider", "jugaad"]), id: z.uuid() });

function localBreakdown(quote: SandboxQuote) {
  const { listing, quantity, selectedModifiers, totalPaise } = quote.offer;
  const subtotal = (listing.pricePaise + (selectedModifiers ?? []).reduce((sum, option) => sum + option.pricePaise, 0)) * quantity;
  const discount = appliedWelcomeDiscount(quote);
  return [
    { label: "Item subtotal", paise: subtotal },
    { label: "Delivery", paise: listing.deliveryPaise },
    { label: "Taxes and packaging", paise: totalPaise + discount - subtotal - listing.deliveryPaise },
    ...(discount ? [{ label: "Jugaad Welcome Offer", paise: -discount }] : []),
  ];
}

async function loadPayment(query: z.infer<typeof paymentQuery>, owner: string): Promise<PaymentDetails | undefined> {
  const session = await readSession(owner);
  const name = session.profile?.name ?? "Guest";
  const language = session.profile?.language ?? "en-IN";
  const handle = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "guest";
  const alias = createHash("sha256").update(`jugaad-pay:${owner}`).digest("hex").slice(0, 10);
  const payer = { name, identity: `${handle}-${alias}@jugaad-demo` };
  if (query.source === "jugaad") {
    const order = session.orders.find(({ quote }) => quote.id === query.id);
    const quote = order?.quote ?? session.quote;
    if (!quote || quote.id !== query.id || !quote.approvedAt) return;
    const { listing, quantity, selectedModifiers, totalPaise } = quote.offer;
    return {
      ...query, payer, language, merchant: listing.seller, provider: "Jugaad One",
      items: [`${quantity} × ${listing.name}`, ...(selectedModifiers ?? []).map(({ name }) => name)],
      breakdown: localBreakdown(quote), totalPaise,
      stage: order ? "confirmed" : quote.expiresAt > Date.now() ? "authorize" : "failed",
      receipt: order ? { id: order.reference, reference: order.reference } : undefined,
    };
  }
  const transaction = (await (await transactionStore()).get(owner, query.id))?.transaction;
  if (!transaction || transaction.phase === "quoted" || !transaction.approvedAt) return;
  const { quote, order, phase } = transaction;
  const price = quote.pricing;
  return {
    ...query, payer, language, merchant: transaction.restaurant, provider: quote.provider.name,
    items: quote.lineItems.map((line) => `${line.quantity} × ${line.name}${line.selectedOptions.length ? ` · ${line.selectedOptions.map(({ name }) => name).join(", ")}` : ""}`),
    breakdown: [
      { label: "Item subtotal", paise: price.subtotalPaise },
      { label: "Delivery", paise: price.deliveryFeePaise },
      { label: "Packaging", paise: price.packagingFeePaise },
      { label: "Platform fee", paise: price.platformFeePaise },
      { label: "Tax", paise: price.taxPaise },
      ...(price.discountPaise ? [{ label: "Provider discount", paise: -price.discountPaise }] : []),
    ],
    totalPaise: price.totalPaise,
    stage: phase === "confirmed" && order ? "confirmed" :
      phase === "booking" || phase === "reconciliation" ? "reconcile" :
      phase === "approved" && Date.parse(quote.expiresAt) > Date.now() ? "authorize" : "failed",
    receipt: phase === "confirmed" && order ? { id: transaction.id, reference: order.reference } : undefined,
  };
}

export default async function PaymentPage({ searchParams }: PageProps<"/payment">) {
  const query = paymentQuery.safeParse(await searchParams);
  const owner = checkoutOwner((await cookies()).get(checkoutCookie)?.value);
  let payment: PaymentDetails | undefined;
  let unavailable = false;
  if (owner && query.success) {
    try { payment = await loadPayment(query.data, owner); }
    catch { unavailable = true; }
  }
  if (payment) return <PaymentScreen key={`${payment.source}:${payment.id}`} payment={payment} />;
  return <main id="main" className="pay-page pay-centered">
    <section className="pay-surface">
      <p className="pay-brand">Jugaad Pay</p>
      <h1>{unavailable ? "Checkout is temporarily unavailable" : "No approved checkout"}</h1>
      <p>Return to Jugaad to review and approve a quote.</p>
      <Link className="btn btn-dark" href="/workspace">Back to Jugaad</Link>
    </section>
  </main>;
}
