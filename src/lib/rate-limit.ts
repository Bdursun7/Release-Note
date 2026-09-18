type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimitsForTests() {
  buckets.clear();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

/** Demo/anonymous LLM (env key or BYOK) — per user, per IP, and global. */
export function consumeDemoLlmLimit(opts: { userId: string; ip: string }): boolean {
  const hour = 60 * 60 * 1000;
  return (
    rateLimit(`demo-llm:user:${opts.userId}`, 6, hour) &&
    rateLimit(`demo-llm:ip:${opts.ip}`, 10, hour) &&
    rateLimit("demo-llm:global", 40, hour)
  );
}
