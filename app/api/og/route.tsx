import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type React from "react";
import { OG_LOGO_HEIGHT, OG_LOGO_OFFSET_LEFT, OG_LOGO_URL } from "@/lib/og-brand";
import { OG_CANVAS_HEIGHT, OG_CANVAS_WIDTH, OG_HERO_HEIGHT, OG_HERO_WIDTH_RATIO } from "@/lib/og-layout";
import { verifyParams } from "@/lib/sign";

export const runtime = "edge";

// Params that, when present, indicate a user-controlled render and therefore
// require a valid HMAC signature.
const USER_PARAMS = [
  "image",
  "title",
  "byline",
  "dateline",
  "category",
  "brand",
  "credits",
  "body",
  "sidebarTitle",
  "sidebarItems",
  "nav",
  "logo",
  "logoUrl",
  "logoHeight",
  "logoOffsetLeft",
  "showWordmark",
];

// Hard server-side clamps. The signing helper clamps too, but treat this
// route as the trust boundary: an attacker who somehow forges a signature
// still can't blow up the renderer.
const MAX = {
  image: 800,
  title: 320,
  body: 1600,
  byline: 160,
  dateline: 80,
  category: 80,
  brand: 60,
  credits: 200,
  sidebarTitle: 80,
  sidebarItems: 1200,
  nav: 240,
  logoUrl: 800,
};

// Hosts we'll fetch the hero image from. fal stores generations on fal.media;
// LinkedIn profile photos come from *.licdn.com.
const IMAGE_HOST_ALLOWLIST = [
  /^([a-z0-9-]+\.)*fal\.media$/i,
  /^([a-z0-9-]+\.)*fal\.run$/i,
  /^([a-z0-9-]+\.)*licdn\.com$/i,
];

function isAllowedImageUrl(raw: string | null): boolean {
  if (!raw) return true; // image is optional
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return IMAGE_HOST_ALLOWLIST.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

function clamp(s: string | null, n: number): string | null {
  if (s == null) return null;
  return s.length > n ? s.slice(0, n) : s;
}

const interRegular = fetch(
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
).then((r) => r.arrayBuffer());

const interBold = fetch(
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf"
).then((r) => r.arrayBuffer());

const interBlack = fetch(
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf"
).then((r) => r.arrayBuffer());

const mono = fetch(
  "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf"
).then((r) => r.arrayBuffer());

const archivoBlack = fetch(
  "https://fonts.gstatic.com/s/archivoblack/v23/HTxqL289NzCGg4MzN6KJ7eW6OYs.ttf"
).then((r) => r.arrayBuffer());

const GREEN = "#0b8936";
const GREEN_DEEP = "#014600";
const BLACK = "#0c0d0d";
const PAPER = "#f6fff3";
const INK = "#0c0d0d";
const CREDIT_GRAY = "#6c7571";
const MUTED = "#535554";

function MarkMegaton() {
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <path
        d="M6 26 L6 6 L13 6 L22 19 L31 6 L38 6 L38 26 L33 26 L33 14 L24 26 L20 26 L11 14 L11 26 Z"
        fill={BLACK}
      />
    </svg>
  );
}

function MarkBlast() {
  // Two stacked chevrons — a shock wave.
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <path d="M6 22 L16 10 L26 22" stroke={BLACK} strokeWidth="3.2" fill="none" strokeLinejoin="miter" />
      <path d="M18 22 L28 10 L38 22" stroke={BLACK} strokeWidth="3.2" fill="none" strokeLinejoin="miter" />
    </svg>
  );
}

function MarkBureau() {
  // Nested rectangles — a stamped filing.
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <rect x="5" y="4" width="34" height="24" stroke={BLACK} strokeWidth="2" fill="none" />
      <rect x="10" y="8" width="24" height="16" stroke={BLACK} strokeWidth="1.4" fill="none" />
      <rect x="19" y="14" width="6" height="4" fill={BLACK} />
    </svg>
  );
}

function MarkBlock() {
  // Interlocked blocks suggesting an M.
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <rect x="6" y="5" width="9" height="22" fill={BLACK} />
      <rect x="29" y="5" width="9" height="22" fill={BLACK} />
      <rect x="13" y="11" width="18" height="6" fill={BLACK} />
      <rect x="20" y="17" width="4" height="10" fill={BLACK} />
    </svg>
  );
}

function MarkWedge() {
  // A bold rightward dispatch wedge with a bar.
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <path d="M6 8 L6 24 L20 16 Z" fill={BLACK} />
      <rect x="24" y="14" width="14" height="4" fill={BLACK} />
    </svg>
  );
}

function MarkSeal() {
  // 8-point starburst — a press credential seal.
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" style={{ display: "flex" }}>
      <rect width="44" height="32" fill={PAPER} />
      <path
        d="M22 3 L25 11 L33 7 L29.5 15 L37 16 L29.5 17 L33 25 L25 21 L22 29 L19 21 L11 25 L14.5 17 L7 16 L14.5 15 L11 7 L19 11 Z"
        fill={BLACK}
      />
      <circle cx="22" cy="16" r="3.5" fill={PAPER} />
    </svg>
  );
}

const MARKS = {
  megaton: MarkMegaton,
  blast: MarkBlast,
  bureau: MarkBureau,
  block: MarkBlock,
  wedge: MarkWedge,
  seal: MarkSeal,
} as const;

function ShareIcons() {
  const s = { display: "flex" as const };
  return (
    <div style={{ alignItems: "center", gap: 22, ...s }}>
      {/* Facebook */}
      <svg width="22" height="22" viewBox="0 0 24 24" style={s}>
        <path
          d="M13.5 22V12.5h2.7l.4-3.2h-3.1V7.2c0-.9.3-1.6 1.6-1.6h1.7V2.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.5H7.6v3.2h2.8V22h3.1z"
          fill={PAPER}
        />
      </svg>
      {/* X */}
      <svg width="20" height="20" viewBox="0 0 24 24" style={s}>
        <path
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          fill={PAPER}
        />
      </svg>
      {/* LinkedIn */}
      <svg width="22" height="22" viewBox="0 0 24 24" style={s}>
        <path
          d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"
          fill={PAPER}
        />
      </svg>
      {/* Reddit alien */}
      <svg width="22" height="22" viewBox="0 0 24 24" style={s}>
        <circle cx="12" cy="13" r="8.2" fill={PAPER} />
        <circle cx="17.5" cy="6.5" r="1.6" fill={PAPER} />
        <circle cx="9" cy="13" r="1.3" fill={GREEN} />
        <circle cx="15" cy="13" r="1.3" fill={GREEN} />
        <path d="M8 16 Q12 18.5 16 16" stroke={GREEN} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <line x1="12.5" y1="3" x2="16.5" y2="6.5" stroke={PAPER} strokeWidth="1.4" />
      </svg>
      {/* Mail */}
      <svg width="22" height="20" viewBox="0 0 24 22" style={s}>
        <rect x="2" y="3" width="20" height="16" rx="1" stroke={PAPER} strokeWidth="1.8" fill="none" />
        <path d="M3 5 L12 13 L21 5" stroke={PAPER} strokeWidth="1.8" fill="none" />
      </svg>
      {/* Link */}
      <svg width="22" height="22" viewBox="0 0 24 24" style={s}>
        <path
          d="M10.6 13.4a4 4 0 005.7 0l3-3a4 4 0 10-5.7-5.7l-1 1"
          stroke={PAPER}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M13.4 10.6a4 4 0 00-5.7 0l-3 3a4 4 0 105.7 5.7l1-1"
          stroke={PAPER}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

const DEFAULT_BODY = `With the AI industry singularly focused on frontier models, our subject is having an exceptionally strange year. Sources close to the matter — none of whom exist — confirm the round is approximately whatever sounds best at a dinner party.

The company may soon pull ahead of competitors that, until recently, didn't know it existed. Customers increasingly express a preference for whichever product was mentioned most loudly on a podcast that week.

Insiders describe the trajectory as "vertical, possibly diagonal." A spokesperson, when reached for comment, sent only a single fire emoji. We have chosen to interpret this as confirmation.`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Signature gate. Any user-controlled param requires a valid HMAC sig.
  // The unsigned "no-params" mode still works (renders the demo defaults)
  // so the route is debuggable, and we additionally allow unsigned access
  // in dev for the /preview tool.
  const hasUserParams = USER_PARAMS.some((p) => searchParams.has(p));
  const sig = searchParams.get("sig");
  const isDev = process.env.NODE_ENV !== "production";
  if (hasUserParams && !isDev) {
    if (!sig) {
      return new Response("missing signature", { status: 401 });
    }
    const toVerify: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) {
      if (k === "sig") continue;
      toVerify[k] = v;
    }
    const ok = await verifyParams(toVerify, sig);
    if (!ok) return new Response("invalid signature", { status: 401 });
  }

  // Image URL allowlist — belt and suspenders against SSRF / using us as
  // a free CDN even if the signing secret ever leaks.
  const rawImage = clamp(searchParams.get("image"), MAX.image);
  if (rawImage && !isAllowedImageUrl(rawImage)) {
    return new Response("image host not allowed", { status: 400 });
  }

  const brand = clamp(searchParams.get("brand"), MAX.brand) ?? "Megaton";
  const category = clamp(searchParams.get("category"), MAX.category) ?? "AI";
  const title =
    clamp(searchParams.get("title"), MAX.title) ??
    "Anthropic's Cat Wu says that, in the future, AI will anticipate your needs before you know what they are";
  const byline = clamp(searchParams.get("byline"), MAX.byline) ?? "Lucas Ropek";
  const dateline = clamp(searchParams.get("dateline"), MAX.dateline) ?? "12:28 PM PDT · May 13, 2026";
  const imageUrl = rawImage;
  const credits = (clamp(searchParams.get("credits"), MAX.credits) ?? "MEGATON STUDIO").toUpperCase();
  const navParam = clamp(searchParams.get("nav"), MAX.nav);
  const logo = (searchParams.get("logo") ?? "megaton").toLowerCase();
  const Mark = (MARKS as Record<string, () => React.ReactElement>)[logo] ?? MARKS.megaton;
  const rawLogoUrl = clamp(searchParams.get("logoUrl"), MAX.logoUrl) ?? OG_LOGO_URL;
  const logoUrl = rawLogoUrl.startsWith("http")
    ? rawLogoUrl
    : new URL(rawLogoUrl, req.url).toString();
  const logoHeight = Number(searchParams.get("logoHeight") ?? OG_LOGO_HEIGHT);
  const logoOffsetLeft = Number(searchParams.get("logoOffsetLeft") ?? OG_LOGO_OFFSET_LEFT);
  const showWordmark = logoUrl
    ? searchParams.get("showWordmark") === "1"
    : true;
  const body = clamp(searchParams.get("body"), MAX.body) ?? DEFAULT_BODY;
  const sidebarTitle = clamp(searchParams.get("sidebarTitle"), MAX.sidebarTitle) ?? "Most Popular";
  const sidebarItems = (clamp(searchParams.get("sidebarItems"), MAX.sidebarItems) ??
    "Founder admits headline was the product.|Series A closed via group chat reaction.|Investor confuses pitch deck for menu.")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const [fontReg, fontBold, fontBlack, fontMono, fontArchivo] = await Promise.all([
    interRegular,
    interBold,
    interBlack,
    mono,
    archivoBlack,
  ]);

  const nav = navParam
    ? navParam.split(",").map((s) => s.trim()).filter(Boolean)
    : ["Wire", "Founders", "Capital", "Studios", "Labs", "AI", "Filings", "Events", "Dispatch", "Subscribe"];

  const paragraphs = body.split(/\n\s*\n/).filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
          fontFamily: "Inter",
        }}
      >
        {/* NAV */}
        <div
          style={{
            height: 64,
            backgroundColor: BLACK,
            display: "flex",
            alignItems: "center",
            paddingLeft: 36,
            paddingRight: 36,
            color: PAPER,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                style={{
                  display: "flex",
                  height: logoHeight,
                  maxHeight: 48,
                  maxWidth: 280,
                  marginLeft: logoOffsetLeft,
                  objectFit: "contain",
                }}
              />
            ) : (
              <Mark />
            )}
            {showWordmark && (
              <span
                style={{
                  fontFamily: "InterBlack",
                  fontSize: 20,
                  letterSpacing: -0.5,
                  display: "flex",
                }}
              >
                {brand}
              </span>
            )}
          </div>

          <div style={{ flex: 1, display: "flex" }} />

          <div
            style={{
              display: "flex",
              gap: 28,
              fontSize: 15,
              fontFamily: "InterBold",
              letterSpacing: -0.2,
            }}
          >
            {nav.map((n) => (
              <span key={n} style={{ display: "flex" }}>
                {n}
              </span>
            ))}
          </div>

          <div style={{ flex: 1, display: "flex" }} />

          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={PAPER} strokeWidth="2" />
              <path d="M20 20L16.5 16.5" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg width="22" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M3 12h18M3 18h18" stroke={PAPER} strokeWidth="2.4" strokeLinecap="square" />
            </svg>
          </div>
        </div>

        {/* HERO ROW */}
        <div style={{ display: "flex", height: OG_HERO_HEIGHT, position: "relative" }}>
          <div
            style={{
              width: `${OG_HERO_WIDTH_RATIO * 100}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: BLACK,
              overflow: "hidden",
            }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "center",
                }}
              />
            ) : null}
          </div>

          <div
            style={{
              width: "59%",
              backgroundColor: GREEN,
              display: "flex",
              flexDirection: "column",
              padding: "48px 72px 56px 72px",
              color: PAPER,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "InterBold",
                  fontSize: 15,
                  letterSpacing: 0.3,
                  display: "flex",
                }}
              >
                {category}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingTop: 12,
                  borderTop: `1px solid ${PAPER}33`,
                  paddingLeft: 8,
                  minWidth: 360,
                }}
              >
                <ShareIcons />
              </div>
            </div>

            <div
              style={{
                marginTop: 80,
                fontFamily: "ArchivoBlack",
                fontSize: 66,
                lineHeight: 1.08,
                letterSpacing: -1.8,
                color: PAPER,
                display: "flex",
              }}
            >
              {title}
            </div>

            <div style={{ flex: 1, display: "flex" }} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 17,
                marginTop: 24,
              }}
            >
              <span style={{ fontFamily: "InterBold", display: "flex" }}>{byline}</span>
              <span style={{ display: "flex", opacity: 0.85 }}>—</span>
              <span style={{ fontFamily: "JetBrainsMono", fontSize: 14, display: "flex", opacity: 0.95 }}>
                {dateline}
              </span>
            </div>
          </div>
        </div>

        {/* CREDITS STRIP */}
        <div
          style={{
            height: 56,
            backgroundColor: PAPER,
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              fontFamily: "JetBrainsMono",
              fontSize: 12,
              letterSpacing: 1.6,
              color: CREDIT_GRAY,
              paddingLeft: 600,
              display: "flex",
            }}
          >
            IMAGE CREDITS: {credits}
          </div>
          <div
            style={{
              position: "absolute",
              right: 160,
              bottom: 0,
              width: 460,
              height: 14,
              backgroundColor: GREEN,
              display: "flex",
            }}
          />
        </div>

        {/* BODY SECTION */}
        <div
          style={{
            display: "flex",
            padding: "48px 96px 56px 240px",
            gap: 56,
            flex: 1,
          }}
        >
          {/* article body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              maxWidth: 820,
              color: INK,
              fontSize: 20,
              lineHeight: 1.55,
              gap: 18,
            }}
          >
            {paragraphs.map((p, i) => (
              <p key={i} style={{ margin: 0, display: "flex" }}>
                {p}
              </p>
            ))}
          </div>

          {/* sidebar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignSelf: "flex-start",
              width: 380,
              backgroundColor: "#fffceb",
              border: "1px solid rgba(0,0,0,0.06)",
              padding: "28px 28px 24px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontFamily: "InterBlack",
                  fontSize: 34,
                  letterSpacing: -0.8,
                  color: INK,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {sidebarTitle}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  backgroundColor: "#ffe26b",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M7 17 L17 7" stroke={INK} strokeWidth="2.6" strokeLinecap="square" />
                  <path d="M9 7 L17 7 L17 15" stroke={INK} strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {sidebarItems.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    color: INK,
                    fontSize: 16,
                    lineHeight: 1.4,
                    paddingTop: i === 0 ? 0 : 14,
                    paddingBottom: 14,
                    borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      width: 7,
                      height: 7,
                      backgroundColor: INK,
                      marginTop: 9,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ display: "flex", fontFamily: "InterBold" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: OG_CANVAS_WIDTH,
      height: OG_CANVAS_HEIGHT,
      fonts: [
        { name: "Inter", data: fontReg, weight: 400, style: "normal" },
        { name: "InterBold", data: fontBold, weight: 700, style: "normal" },
        { name: "InterBlack", data: fontBlack, weight: 900, style: "normal" },
        { name: "JetBrainsMono", data: fontMono, weight: 400, style: "normal" },
        { name: "ArchivoBlack", data: fontArchivo, weight: 900, style: "normal" },
      ],
    }
  );
}
