# Deploy notes

Pre-launch safety checklist for Megaton Studio.

## Required env vars

```
ANTHROPIC_API_KEY=sk-ant-...
APIFY_API_TOKEN=apify_api_...
FAL_KEY=...

# NEW — required in production. Used to HMAC-sign /api/og params so
# the OG endpoint can't be used as branding-as-a-service / SSRF proxy.
# Generate with: openssl rand -base64 48
OG_SIGN_SECRET=<random ≥16 chars, ideally 48+>
```

Without `OG_SIGN_SECRET` set in prod, any call to `/api/og` with user-controllable params returns `401 missing signature`. The unsigned default render (zero params) still works.

## What got added before deploy

- **`lib/limits.ts`** — per-IP sliding-window rate limit + global daily counter on the four paid surfaces (`enrich`, `image`, `upload`, `sign`). Caps live in that file; tune to taste.
- **`lib/sign.ts`** — HMAC-SHA256 sign/verify (Web Crypto, edge-compatible).
- **`lib/og-params.ts`** — server-side OG URL builder. Clamps body/title/etc to bounded lengths so a leaked secret still can't blow up the renderer.
- **`signOgUrl` server action** — only path to a valid `/api/og?...&sig=...` URL.
- **`/api/og` hardened** — requires valid `sig` for any user-controllable param. `image=` URL host allowlisted to fal.media / fal.run / *.licdn.com.

## Known limitations of the in-memory limits

State is per-instance. On Vercel a determined attacker can partially bypass by hitting cold instances. For a hackathon launch this is fine. For sustained traffic, swap `lib/limits.ts` for Upstash Ratelimit + Vercel KV — same shape, persistent state.

## Dashboard alerts to set BEFORE going live

Last line of defence — set hard spend caps in each provider's console:

- **Anthropic Console** → Billing → Spend limit. Set a daily/monthly cap.
- **fal.ai dashboard** → Billing → set monthly budget alert.
- **Apify Console** → Settings → Usage limits → daily $ cap.

If any of these dashboards lacks hard caps, set a generous alert + plan to manually revoke the key.

## Things to verify on first deploy

1. Set all four env vars in Vercel project settings (production env).
2. Deploy.
3. Hit the site with one real LinkedIn profile end-to-end — confirm story + image + download PNG works.
4. Hit `/api/og?title=hax` with no signature → should return 401.
5. Watch logs for `[limits]` warnings. Tune caps in `lib/limits.ts` if normal usage hits them.

## Dev-only tools

- `/preview` — only works locally (`NODE_ENV !== production` bypasses the sig check). In production it'll just render the unsigned default.
- `/share` — same; routes to `/api/og` with raw params, so it fails closed in prod. Currently not part of the user flow, kept as a future hook.

## Not yet covered (worth considering if you scale)

- No content moderation on the LinkedIn URL or the generated stories themselves. Real journalist names are restricted in the prompt and the reporter set is an allowlist, but the story body is free-form Opus output. If you want a safety net, run the generated story through `claude-haiku-4-5` with a moderation prompt before returning.
- No CAPTCHA. If the in-memory rate limit gets bypassed under real load, Turnstile / hCaptcha on the intake form is the next step.
- No domain pinning. In Vercel, restrict the project to your production domain so preview deploys don't leak the API keys publicly.
