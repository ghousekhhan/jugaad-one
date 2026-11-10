import type { FoodTurn } from "@/lib/integrations/food-intent";
import { formatPaise } from "@/lib/marketplace/discovery-types";
import { foodProviderNames } from "@/lib/marketplace/schemas";
import { voiceLanguages } from "@/lib/voice/types";
import { Button } from "./ui";

export type ConversationEntry = { id: number; text: string; response: FoodTurn; lang: string };

function constraintRows(turn: FoodTurn): [string, string][] {
  const value = turn.constraints;
  const rows: [string, string][] = [];
  if (value.commerce) rows.push(["Product", value.commerce.product]);
  if (value.dish) rows.push(["Dish", value.dish]);
  if (value.restaurant) rows.push(["Restaurant", value.restaurant]);
  if (turn.location || value.city || value.neighborhood) rows.push(["Location", turn.location?.label ?? [value.neighborhood, value.city].filter(Boolean).join(", ")]);
  if (value.budgetPaise !== undefined) rows.push(["Budget", `${value.budgetExclusive ? "Below" : "Up to"} ${formatPaise(value.budgetPaise)}`]);
  const radius = value.radiusKm ?? turn.comparison?.input.radiusKm;
  if (radius !== undefined) rows.push(["Radius", `${radius} km${value.radiusKm === undefined ? " (delivery area)" : ""}`]);
  const quantity = value.quantity ?? turn.comparison?.input.quantity;
  if (quantity !== undefined) rows.push(["Quantity", String(quantity)]);
  if (value.minRating !== undefined) rows.push(["Rating", `${value.ratingExclusive ? "Above" : "At least"} ${value.minRating} / 5`]);
  if (value.cuisine) rows.push(["Cuisine", value.cuisine]);
  if (value.dietaryRestrictions?.length) rows.push(["Dietary", value.dietaryRestrictions.join(", ")]);
  if (value.allergens?.length) rows.push(["Exclude", value.allergens.join(", ")]);
  if (value.priority) rows.push(["Sort by", value.priority === "fastest" ? "Fastest delivery" : "Lowest total"]);
  if (value.maxEtaMinutes !== undefined) rows.push(["Delivery estimate", `At most ${value.maxEtaMinutes} min`]);
  if (value.providerPreference) rows.push(["Provider", `${value.providerPreference.mode === "only" ? "Only" : "Prefer"} ${foodProviderNames[value.providerPreference.provider]}`]);
  return rows;
}

export function FoodConversationLog({ entries, onSpeak }: { entries: ConversationEntry[]; onSpeak?: (response: FoodTurn) => void }) {
  return <div className="history conversation-history">
    <h3>Conversation</h3>
    {entries.length === 0 ? <p className="muted">Ask for something you need. Follow up to change your requirements.</p> : <ol>
      {entries.map(({ id, text, response, lang }, index) => {
        const showCommerce = response.responseView !== "conversation";
        const rows = showCommerce ? constraintRows(response) : [];
        const evidence = response.trace?.searchAttempted ? response.comparison?.result.evidence ?? [] : [];
        return <li key={id}>
          <p className="meta">You</p><p lang={lang}>{text}</p>
          <p className="meta conversation-speaker">Jugaad</p><p lang={voiceLanguages[response.replyLanguage ?? "en-IN"].script}>{response.reply}</p>
          {response.speechTicket && onSpeak && <Button variant="quiet" onClick={() => onSpeak(response)}>Hear reply</Button>}
          {showCommerce && <details className="conversation-constraints" open={index === entries.length - 1}>
            <summary>Constraints after this turn</summary>
            {rows.length ? <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="meta">No constraints yet.</p>}
          </details>}
          {evidence.length > 0 && <details className="conversation-sources">
            <summary>Live provider evidence</summary>
            {evidence.map((source) => <div className="meta" key={source.catalogRequestId}>
              <strong>{foodProviderNames[source.provider]}</strong>
              <p>Catalog request <code>{source.catalogRequestId}</code></p>
              {source.quoteRequestIds.map((id) => <p key={id}>Quote request <code>{id}</code></p>)}
            </div>)}
          </details>}
        </li>;
      })}
    </ol>}
  </div>;
}
