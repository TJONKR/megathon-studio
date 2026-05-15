"use client";

import { useState } from "react";
import { OG_LOGO_HEIGHT, OG_LOGO_OFFSET_LEFT, OG_LOGO_URL } from "@/lib/og-brand";

export default function PreviewPage() {
  const [image, setImage] = useState(
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1500"
  );
  const [title, setTitle] = useState(
    "Anthropic's Cat Wu says that, in the future, AI will anticipate your needs before you know what they are"
  );
  const [byline, setByline] = useState("Lucas Ropek");
  const [dateline, setDateline] = useState("12:28 PM PDT · May 13, 2026");
  const [category, setCategory] = useState("AI");
  const [brand, setBrand] = useState("Megaton");
  const [credits, setCredits] = useState("MEGATON STUDIO");
  const [body, setBody] = useState(
    `With the AI industry singularly focused on frontier models, our subject is having an exceptionally strange year. Sources close to the matter — none of whom exist — confirm the round is approximately whatever sounds best at a dinner party.

The company may soon pull ahead of competitors that, until recently, didn't know it existed. Customers increasingly express a preference for whichever product was mentioned most loudly on a podcast that week.

Insiders describe the trajectory as "vertical, possibly diagonal." A spokesperson, when reached for comment, sent only a single fire emoji. We have chosen to interpret this as confirmation.`
  );
  const [sidebarTitle, setSidebarTitle] = useState("Most Popular");
  const [sidebarItems, setSidebarItems] = useState(
    "Founder admits headline was the product.|Series A closed via group chat reaction.|Investor confuses pitch deck for menu."
  );
  const [logoUrl, setLogoUrl] = useState(
    process.env.NEXT_PUBLIC_OG_LOGO_URL ?? OG_LOGO_URL
  );
  const [logoHeight, setLogoHeight] = useState(
    process.env.NEXT_PUBLIC_OG_LOGO_HEIGHT ?? OG_LOGO_HEIGHT
  );

  const params = new URLSearchParams({
    image,
    title,
    byline,
    dateline,
    category,
    brand,
    credits,
    body,
    sidebarTitle,
    sidebarItems,
    logoUrl,
    logoHeight,
    logoOffsetLeft: OG_LOGO_OFFSET_LEFT,
  });
  const src = `/api/og?${params.toString()}`;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1700, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16 }}>OG Preview</h1>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Image URL" value={image} set={setImage} />
          <Field label="Title" value={title} set={setTitle} textarea />
          <Field label="Byline" value={byline} set={setByline} />
          <Field label="Dateline" value={dateline} set={setDateline} />
          <Field label="Category" value={category} set={setCategory} />
          <Field label="Brand" value={brand} set={setBrand} />
          <Field label="Credits" value={credits} set={setCredits} />
          <Field label="Body (blank line = new paragraph)" value={body} set={setBody} textarea rows={8} />
          <Field label="Sidebar title" value={sidebarTitle} set={setSidebarTitle} />
          <Field label="Sidebar items (pipe-separated)" value={sidebarItems} set={setSidebarItems} textarea rows={3} />
          <Field label="Logo URL (blank = SVG mark)" value={logoUrl} set={setLogoUrl} />
          <Field label="Logo height (px)" value={logoHeight} set={setLogoHeight} />
          <a href={src} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
            Open raw PNG ↗
          </a>
        </div>
        <div style={{ border: "1px solid #ddd" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="og preview" style={{ width: "100%", display: "block" }} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  set,
  textarea,
  rows = 4,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", fontSize: 12, gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => set(e.target.value)}
          rows={rows}
          style={{ fontFamily: "inherit", padding: 6 }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          style={{ fontFamily: "inherit", padding: 6 }}
        />
      )}
    </label>
  );
}
