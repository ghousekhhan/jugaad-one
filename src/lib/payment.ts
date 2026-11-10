import type { VoiceLocale } from "./voice/types";

export type PaymentSource = "provider" | "jugaad";

export function paymentHref(source: PaymentSource, id: string) {
  return `/payment?source=${source}&id=${encodeURIComponent(id)}`;
}

export type PaymentDetails = {
  source: PaymentSource;
  id: string;
  merchant: string;
  provider: string;
  items: string[];
  breakdown: { label: string; paise: number }[];
  totalPaise: number;
  payer: { name: string; identity: string };
  language: VoiceLocale;
  stage: "authorize" | "reconcile" | "confirmed" | "failed";
  receipt?: { id: string; reference: string };
};
