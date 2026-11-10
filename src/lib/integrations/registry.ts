import type { Category, Integration, ProviderAdapter, ProviderId } from "./contracts";

export const aiServices = [
  { name: "Gemini", role: "Request understanding" },
  { name: "Gnani Prisma", role: "Speech-to-text" },
  { name: "Gnani Timbre", role: "Spoken replies" },
] as const;

type ProviderDefinition = { name: string; category: Category; adapter: Integration<ProviderAdapter> };

const providers: Record<ProviderId, ProviderDefinition> = {
  wiggy: { name: "Wiggy", category: "food", adapter: { status: "not_connected" } },
  tomato: { name: "Tomato", category: "food", adapter: { status: "not_connected" } },
  frapido: { name: "Frapido", category: "rides", adapter: { status: "not_connected" } },
  suber: { name: "Suber", category: "rides", adapter: { status: "not_connected" } },
};

export const providerDirectory = Object.entries(providers).map(([id, { name, category, adapter }]) => ({
  id,
  name,
  category,
  status: category === "food" ? "discovery_available" as const : adapter.status,
  environment: "fictional sandbox" as const,
}));
