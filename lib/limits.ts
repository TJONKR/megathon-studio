import { headers } from "next/headers";

// NOTE: in-memory state. Resets on cold start and is per-instance, so on
// Vercel with multiple concurrent invocations a determined attacker can
// partially bypass these caps. For a hackathon launch this is good enough;
// upgrade to Upstash Ratelimit / Vercel KV before going wide.

type Bucket = number[]; // unix-ms timestamps

const BUCKETS = new Map<string, Bucket>();

const WINDOW_HOUR_MS = 60 * 60 * 1000;
const WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

export type LimitKey = "enrich" | "image" | "upload" | "sign";

const PER_IP_HOURLY_CAPS: Record<LimitKey, number> = {
  enrich: 6,
  image: 12,
  upload: 20,
  sign: 60,
};

const PER_IP_DAILY_CAPS: Record<LimitKey, number> = {
  enrich: 40,
  image: 80,
  upload: 160,
  sign: 400,
};

// Global daily caps across all IPs — last-line-of-defense bill ceiling.
// Tune to your comfort level. Each enrich = 2 Apify runs + 1 Opus call;
// each image = 1 fal gemini-3-pro render (~$0.04).
const GLOBAL_DAILY_CAPS: Record<LimitKey, number> = {
  enrich: 200,
  image: 400,
  upload: 800,
  sign: 4000,
};

const GLOBAL_COUNTERS = new Map<string, number[]>();

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (bucket.length > 0 && bucket[0]! < cutoff) bucket.shift();
}

export type LimitCheck =
  | { ok: true }
  | { ok: false; reason: "ip-hourly" | "ip-daily" | "global-daily"; retryAfterMs: number };

export async function checkLimit(key: LimitKey): Promise<LimitCheck> {
  const ip = await getClientIp();
  const now = Date.now();

  const ipKey = `${key}:${ip}`;
  const ipBucket = BUCKETS.get(ipKey) ?? [];
  prune(ipBucket, WINDOW_DAY_MS, now);

  const hourCount = ipBucket.filter((t) => t > now - WINDOW_HOUR_MS).length;
  if (hourCount >= PER_IP_HOURLY_CAPS[key]) {
    const oldestInHour = ipBucket.find((t) => t > now - WINDOW_HOUR_MS) ?? now;
    return {
      ok: false,
      reason: "ip-hourly",
      retryAfterMs: Math.max(0, oldestInHour + WINDOW_HOUR_MS - now),
    };
  }
  if (ipBucket.length >= PER_IP_DAILY_CAPS[key]) {
    return {
      ok: false,
      reason: "ip-daily",
      retryAfterMs: Math.max(0, ipBucket[0]! + WINDOW_DAY_MS - now),
    };
  }

  const globalBucket = GLOBAL_COUNTERS.get(key) ?? [];
  prune(globalBucket, WINDOW_DAY_MS, now);
  if (globalBucket.length >= GLOBAL_DAILY_CAPS[key]) {
    return {
      ok: false,
      reason: "global-daily",
      retryAfterMs: Math.max(0, globalBucket[0]! + WINDOW_DAY_MS - now),
    };
  }

  ipBucket.push(now);
  globalBucket.push(now);
  BUCKETS.set(ipKey, ipBucket);
  GLOBAL_COUNTERS.set(key, globalBucket);

  return { ok: true };
}

export function limitError(check: Exclude<LimitCheck, { ok: true }>): string {
  const mins = Math.ceil(check.retryAfterMs / 60_000);
  const wait = mins > 60 ? `${Math.ceil(mins / 60)}h` : `${mins}m`;
  if (check.reason === "global-daily") {
    return `Megaton Studio is over capacity today (global daily cap hit). Try again in ~${wait}.`;
  }
  if (check.reason === "ip-daily") {
    return `Daily limit reached for this IP. Try again in ~${wait}.`;
  }
  return `Slow down — too many requests. Try again in ~${wait}.`;
}
