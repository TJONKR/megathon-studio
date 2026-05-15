import type { Metadata } from "next";
import { headers } from "next/headers";
import { appendOgBrandParams } from "@/lib/og-brand";

type SP = Record<string, string | string[] | undefined>;

function flatten(sp: SP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v[0]) out[k] = v[0];
  }
  return out;
}

async function getOgUrl(sp: SP): Promise<{ ogUrl: string; absShareUrl: string; flat: Record<string, string> }> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const flat = flatten(sp);
  const params = new URLSearchParams(flat);
  appendOgBrandParams(params);
  const ogUrl = `${base}/api/og?${params.toString()}`;
  const absShareUrl = `${base}/share?${params.toString()}`;
  return { ogUrl, absShareUrl, flat };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const { ogUrl, flat } = await getOgUrl(sp);
  const title = flat.title ?? "A Megaton Studio dispatch";
  const description =
    (flat.body ?? "Fictional press dispatch from MEGATHON 2026, Amsterdam.").slice(0, 220);
  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      images: [{ url: ogUrl, width: 2000, height: 1500, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const { ogUrl, absShareUrl, flat } = await getOgUrl(sp);
  const title = flat.title ?? "A Megaton Studio dispatch";
  const byline = flat.byline ?? "By Our Intl. Builders Desk";
  const dateline = flat.dateline ?? "MEGATHON 2026 · Amsterdam";
  const body = flat.body ?? "";

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 24px 80px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#0c0d0d",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#6c7571" }}>
        Megaton Studio · Fictional Press
      </div>
      <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: "12px 0 8px" }}>{title}</h1>
      <div style={{ fontSize: 13, color: "#535554", marginBottom: 20 }}>
        {byline} · {dateline}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ogUrl}
        alt={title}
        style={{ width: "100%", height: "auto", display: "block", border: "1px solid #ddd" }}
      />
      {body && (
        <div style={{ marginTop: 24, fontSize: 16, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {body}
        </div>
      )}
      <p style={{ marginTop: 32, fontSize: 12, color: "#6c7571" }}>
        This is fiction / parody / concept-art. Built by Megaton Studio for MEGATHON 2026.
        Canonical link: <a href={absShareUrl}>{absShareUrl}</a>
      </p>
    </main>
  );
}
