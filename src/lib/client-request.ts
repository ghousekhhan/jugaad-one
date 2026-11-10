export class RequestError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);
  if (!response.ok || result === null) throw new RequestError(result?.error?.message ?? "The request could not be completed.", result?.error?.code ?? "REQUEST_FAILED");
  return result as T;
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal) {
  return requestJson<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
}
