import { Redis } from "@upstash/redis";
import type { OgPostInput } from "./og-params";

export type WallEntry = {
  id: string;
  createdAt: number;
  imageUrl: string;
  subjectName?: string;
  subjectPhotoUrl?: string;
  og: OgPostInput;
};

const KEY = "wall:entries";
const MAX = 200;

let _redis: Redis | null = null;
function client(): Redis {
  if (_redis) return _redis;
  // @upstash/redis auto-reads UPSTASH_REDIS_REST_URL / KV_REST_API_URL.
  // We pass explicitly for clarity & to fail fast if missing.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis env not configured (KV_REST_API_URL / KV_REST_API_TOKEN).",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export async function publishEntry(entry: Omit<WallEntry, "id" | "createdAt">): Promise<WallEntry> {
  const full: WallEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const r = client();
  await r.lpush(KEY, JSON.stringify(full));
  await r.ltrim(KEY, 0, MAX - 1);
  return full;
}

export async function getRecentEntries(limit = 60): Promise<WallEntry[]> {
  const r = client();
  const raw = await r.lrange<string | WallEntry>(KEY, 0, Math.max(0, limit - 1));
  const out: WallEntry[] = [];
  for (const item of raw) {
    // Upstash auto-parses JSON sometimes; handle both.
    if (typeof item === "string") {
      try {
        out.push(JSON.parse(item) as WallEntry);
      } catch {
        // skip malformed
      }
    } else if (item && typeof item === "object") {
      out.push(item as WallEntry);
    }
  }
  return out;
}

export function isWallConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}
