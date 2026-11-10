export function confirmationAnswer(text: string): "yes" | "no" | undefined {
  const value = text.normalize("NFKC").toLowerCase().trim().replace(/[.!?।]+$/u, "").replace(/[’‘]/gu, "'").replace(/[,，]+/gu, " ").replace(/\s+/gu, " ");
  if (/^(?:yes|yeah|yep|correct|that's right|exactly|sure|haan(?: ji)?|ha(?:n)? ji|bilkul|avunu|हाँ(?: जी)?|हां(?: जी)?|बिल्कुल|सही|అవును|సరే)(?: (?:please|proceed|go ahead|use it))?$/u.test(value) || value === "use it") return "yes";
  if (/^(?:no|nope|that's wrong|not that one|nahin?|kaadu|नहीं|नही|కాదు)(?:\s|$)/u.test(value)) return "no";
}
