// HMAC-SHA256 sign/verify for /api/og params.
// Web Crypto so it works in both Node and Edge runtimes.

function getSecret(): string {
  const s = process.env.OG_SIGN_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "OG_SIGN_SECRET missing or too short (need ≥16 chars). Set it in your env.",
    );
  }
  return s;
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  // base64url
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Canonicalise a URLSearchParams-like object by sorting keys.
function canonical(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

export async function signParams(params: Record<string, string>): Promise<string> {
  return hmac(canonical(params), getSecret());
}

export async function verifyParams(
  params: Record<string, string>,
  sig: string,
): Promise<boolean> {
  try {
    const expected = await hmac(canonical(params), getSecret());
    // constant-time-ish compare
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
