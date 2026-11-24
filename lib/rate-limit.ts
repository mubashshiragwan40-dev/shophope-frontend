// lib/rate-limit.ts
// In-memory limiter: fine for one server. On serverless or many instances, use Upstash Redis instead.
const hits: Map<string, number[]> = new Map();

export function clientKey(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

/** Returns true when the caller has used up its allowance. */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now: number = Date.now();
  const recent: number[] = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // simple memory guard
  return recent.length > limit;
}
