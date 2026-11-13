import type { Session } from "../commerce/session";
import type { DialogueAction } from "./actions";
import type { TaskTransition } from "./routing";

export type Workflow = "idle" | "clarifying" | "comparing" | "awaiting_selection" | "awaiting_quote_approval" | "awaiting_payment_approval";
export type Decision = { taskId?: string; action: DialogueAction; transition: TaskTransition; changedFields: string[] };

// Transaction phases remain authoritative on quotes and receipts, not in conversational summaries.
export function workflow(session: Session): Workflow {
  if (session.dialogue?.confirmation?.type === "payment" || session.quote?.approvedAt) return "awaiting_payment_approval";
  if (session.dialogue?.awaitingApproval || session.quote || session.providerQuoteId) return "awaiting_quote_approval";
  if (session.dialogue?.confirmation?.type === "offer") return "awaiting_selection";
  if (session.dialogue?.clarification) return "clarifying";
  return session.dialogue?.task ? "comparing" : "idle";
}

export function changedFields(before: object, after: object) {
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
}

export function rememberDecision(history: Decision[] = [], next: Decision) {
  const previous = history.at(-1);
  if (previous && JSON.stringify(previous) === JSON.stringify(next)) return history;
  return [...history, next].slice(-12);
}
