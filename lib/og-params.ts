import { signParams } from "./sign";
import { OG_LOGO_HEIGHT, OG_LOGO_OFFSET_LEFT, OG_LOGO_URL } from "./og-brand";

export type OgPostInput = {
  imageUrl: string;
  title: string;
  angle: string;
  headlines: string[];
  body: string;
  byline: string;
};

const MAX_LEN = {
  title: 280,
  body: 1400,
  category: 60,
  byline: 120,
  sidebarItem: 200,
};

function clamp(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

function nowDateline(): string {
  const d = new Date();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${time} CET · ${month} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Build a signed /api/og?... URL. Everything user-derived is clamped so
 * a hostile sender can't blow up the renderer.
 */
export async function buildSignedOgUrl(input: OgPostInput): Promise<string> {
  const body = clamp(input.body.trim(), MAX_LEN.body);

  const sidebarItems =
    input.headlines.length > 1
      ? input.headlines
          .slice(1, 5)
          .map((h) => clamp(h, MAX_LEN.sidebarItem))
          .join("|")
      : "Founder admits headline was the product.|Series A closed via group chat reaction.|Investor confuses pitch deck for menu.";

  const params: Record<string, string> = {
    image: input.imageUrl,
    title: clamp(input.title, MAX_LEN.title),
    byline: clamp(input.byline, MAX_LEN.byline),
    dateline: nowDateline(),
    category: clamp(input.angle.toUpperCase(), MAX_LEN.category),
    brand: "Megaton",
    credits: "MEGATON STUDIO · FAL.AI",
    body,
    sidebarTitle: "Most Popular",
    sidebarItems,
    logoUrl: OG_LOGO_URL,
    logoHeight: OG_LOGO_HEIGHT,
    logoOffsetLeft: OG_LOGO_OFFSET_LEFT,
  };

  const sig = await signParams(params);
  const qs = new URLSearchParams({ ...params, sig });
  return `/api/og?${qs.toString()}`;
}
