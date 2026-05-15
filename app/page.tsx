"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  enrichAndGenerate,
  makeImage,
  publishToWall,
  signOgUrl,
  uploadReferenceImage,
  type EnrichResult,
} from "./actions";
import type { OgPostInput } from "@/lib/og-params";

type Phase = "idle" | "enriching" | "ready" | "generating-image" | "image-ready";

type RefPhoto = { id: string; url: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

const CHECKLIST_STEPS = [
  "copy-caption",
  "open-linkedin",
  "paste-caption",
  "tag-reporter",
  "download-image",
  "attach-image",
] as const;
type ChecklistStep = (typeof CHECKLIST_STEPS)[number];

async function fetchSignedOgUrl(opts: OgPostInput): Promise<string | null> {
  const res = await signOgUrl(opts);
  if (!res.ok) {
    console.warn("[signOgUrl] failed:", res.error);
    return null;
  }
  return res.url;
}

const TICKER_TOP = [
  "Megaton Studio",
  "Intl. Edition",
  "All Stories Parody",
  "Wire: Unconfirmed",
  "Circulation: Builder's Own",
  "Breaking — New Lore Incoming",
  "Founders Mythologised Daily",
  "No Real Journalists Were Harmed",
  "Press Pass: Imaginary",
  "Subscribe? You Already Did",
];

const TICKER_BOTTOM = [
  "Filed Under: Parody",
  "Liability: The Builder's Own",
  "Editorial Integrity: Unranked",
  "Distribution: Group Chat",
  "Fact-Checking Department: On Marathon",
  "Investors Confirmed: Imaginary",
  "Wire Service: Vibes",
  "© Megaton Studio, Fictional Press 2026",
  "Do Not Cite In Court",
  "Do Cite In Tweets",
];

export default function Page() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EnrichResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState("TUE · MAY · 2026");
  const [issueNo, setIssueNo] = useState("047");
  const [, startTransition] = useTransition();
  const [refPhotos, setRefPhotos] = useState<RefPhoto[]>([]);
  const [refUploading, setRefUploading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [tcPostUrl, setTcPostUrl] = useState<string | null>(null);
  const [tcPostLoading, setTcPostLoading] = useState(false);
  const [checklistDone, setChecklistDone] = useState<Set<ChecklistStep>>(new Set());
  const [checklistNote, setChecklistNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const d = new Date();
    const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
    const mo = [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ][d.getMonth()];
    setDateStr(`${dow} · ${mo} ${d.getDate()} · ${d.getFullYear()}`);
    // Issue number = day-of-year, padded
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    setIssueNo(String(Math.floor(diff)).padStart(3, "0"));
  }, []);

  const profile = data && data.ok ? data.profile : null;
  const stories = data && data.ok ? data.stories : null;
  const selectedDirection =
    stories?.directions.find((d) => d.id === selectedId) ??
    (stories ? stories.directions.find((d) => d.id === stories.recommendedId) : null);

  useEffect(() => {
    if (!imageUrl || !selectedDirection || !stories) return;
    let cancelled = false;
    setTcPostLoading(true);
    setChecklistDone(new Set());
    setChecklistNote(null);
    (async () => {
      const tcUrl = await fetchSignedOgUrl({
        imageUrl,
        title: selectedDirection.headlines[0] ?? selectedDirection.hook,
        angle: selectedDirection.angle,
        headlines: selectedDirection.headlines,
        body: selectedDirection.body,
        byline: `By ${selectedDirection.reporter.parodyName}`,
      });
      if (!cancelled) setTcPostUrl(tcUrl);
    })();
    return () => {
      cancelled = true;
    };
  // Only rebuild when the user changes their pick; image-driven rebuilds
  // happen inside onGenerateImage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setImageUrl(null);
    setImageError(null);
    setSelectedId(null);
    setRefPhotos([]);
    setRefError(null);
    setTcPostUrl(null);
    setPhase("enriching");
    startTransition(async () => {
      const res = await enrichAndGenerate(url);
      setData(res);
      if (!res.ok) {
        setError(res.error);
        setPhase("idle");
        return;
      }
      setSelectedId(res.stories.recommendedId);
      setPhase("ready");
    });
  }

  async function onGenerateImage(mode: "clean" | "mock-graphic", caption?: string) {
    if (!profile || !selectedDirection || !stories) return;
    setImageError(null);
    setTcPostUrl(null);
    setChecklistNote(null);
    setPhase("generating-image");
    startTransition(async () => {
      const res = await makeImage({
        profile: {
          name: profile.name,
          headline: profile.headline,
          photoUrl: profile.photoUrl,
        },
        direction: { hook: selectedDirection.hook, angle: selectedDirection.angle },
        mode,
        caption,
        extraImageUrls: refPhotos.map((r) => r.url),
      });
      if (!res.ok) {
        setImageError(res.error);
        setPhase("ready");
        return;
      }
      setImageUrl(res.imageUrl);
      setPhase("image-ready");
      setTcPostLoading(true);
      setChecklistDone(new Set());
      setChecklistNote(null);
      const ogInput = {
        imageUrl: res.imageUrl,
        title: selectedDirection.headlines[0] ?? selectedDirection.hook,
        angle: selectedDirection.angle,
        headlines: selectedDirection.headlines,
        body: selectedDirection.body,
        byline: `By ${selectedDirection.reporter.parodyName}`,
      };
      const tcUrl = await fetchSignedOgUrl(ogInput);
      setTcPostUrl(tcUrl);
      publishToWall({
        og: ogInput,
        subjectName: profile.name,
        subjectPhotoUrl: profile.photoUrl,
      }).catch((err) => console.warn("[publishToWall] failed:", err));
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          document
            .getElementById("tc-post")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }

  async function onAddReferenceFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setRefError(null);
    setRefUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (refPhotos.length + 1 > 4) {
          setRefError("Maximum 4 reference photos.");
          break;
        }
        if (!file.type.startsWith("image/")) {
          setRefError("Only image files are accepted.");
          continue;
        }
        const dataUrl = await fileToDataUrl(file);
        const res = await uploadReferenceImage(dataUrl);
        if (!res.ok) {
          setRefError(res.error);
          continue;
        }
        setRefPhotos((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: res.url },
        ]);
      }
    } finally {
      setRefUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onRemoveReference(id: string) {
    setRefPhotos((prev) => prev.filter((r) => r.id !== id));
  }

  function tickStep(step: ChecklistStep) {
    setChecklistDone((prev) => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }

  function toggleStep(step: ChecklistStep) {
    setChecklistDone((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  }

  async function onCopyCaption() {
    if (!selectedDirection?.linkedinCaption || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(selectedDirection.linkedinCaption);
      tickStep("copy-caption");
      setChecklistNote("Caption copied. Paste it as the FIRST thing in LinkedIn (⌘V / Ctrl+V).");
    } catch (err) {
      console.warn("[share] caption copy failed:", err);
      setChecklistNote("Couldn't auto-copy — select the caption below and copy it manually.");
    }
  }

  function onOpenLinkedIn() {
    tickStep("open-linkedin");
    setChecklistNote("LinkedIn opened in a new tab. Click 'Start a post', then paste the caption first (⌘V).");
  }

  function onDownloadPng() {
    if (!tcPostUrl || typeof window === "undefined") return;
    const a = document.createElement("a");
    a.href = tcPostUrl;
    a.download = `megaton-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    tickStep("download-image");
    setChecklistNote("Image saved to your Downloads. Switch to LinkedIn and click the photo icon to attach it.");
  }

  return (
    <>
      {/* TOP TICKER */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...TICKER_TOP, ...TICKER_TOP].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>

      {/* MASTHEAD */}
      <header className="masthead">
        <div className="masthead-side">
          <div className="ink">VOL. I</div>
          <div className="dim">NO. {issueNo}</div>
          <div className="dim">{dateStr}</div>
        </div>
        <div className="masthead-wordmark">
          Megaton<span className="stop">.</span>Studio
        </div>
        <div className="masthead-side right">
          <div className="ink">
            <a href="/wall">The Wall →</a>
          </div>
          <div className="dim">Press · Hackathon · Parody</div>
          <div className="dim">€0 · Forever Free</div>
        </div>
      </header>
      <div className="masthead-rules" aria-hidden />

      <main className="page">
        {/* HERO */}
        <header className="hero">
          <div className="eyebrow">
            <span className="dot" />
            On the Wire · Megaton Studio · Issue {issueNo}
          </div>

          <h1>
            International Tech News,
            <br />
            <span className="it">but invented</span>
            <span className="small">about you, for Europe&apos;s biggest hackathon.</span>
          </h1>

          <p className="lede">
            We mine LinkedIns. We mythologise founders. We never tell the
            truth — <strong>we just print it.</strong> Paste a profile, get an
            absurd Megaton story arc, three viral-flavoured headlines, and a
            cinematic editorial scene of the founder mid-bit.
          </p>

          <div className="hero-meta">
            <span className="ink">A Fictional Press Studio</span>
            <span>Filed from Amsterdam, Brussels, &amp; the Hackathon Floor</span>
            <span>Volume One · Forever Issue {issueNo}</span>
          </div>
        </header>

        {/* SECTION 1 — INTAKE */}
        <section className="section">
          <div className="section-tab">
            <span className="num">01</span>
            <span>File a New Story</span>
          </div>
          <div className="section-head">
            <h2 className="section-title">
              Submit a <em>subject</em> for mythologisation
            </h2>
            <span className="section-meta">Intake Desk · LinkedIn Required</span>
          </div>

          <form onSubmit={onSubmit} className="intake">
            <div className="intake-row">
              <input
                className="input"
                type="url"
                placeholder="https://www.linkedin.com/in/their-name"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={phase === "enriching"}
                required
              />
              <button
                className="btn"
                disabled={phase === "enriching" || !url.trim()}
                type="submit"
              >
                {phase === "enriching" ? (
                  <>
                    <span className="spinner">
                      <span />
                      <span />
                      <span />
                    </span>
                    Mining lore
                  </>
                ) : (
                  <>File this story →</>
                )}
              </button>
            </div>

            {error && <div className="err">⚠ {error}</div>}

            <div className="sponsors">
              <div className="sponsors-label">
                Running
                <br />
                on
              </div>

              <a
                className="sponsor-chip"
                href="https://cal.com/tijs-lerai/megathon"
                target="_blank"
                rel="noreferrer"
              >
                <div className="chip-top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="brand-logo apify"
                    src="/logos/apify.svg"
                    alt="Apify"
                  />
                  <span className="please">sponsor us 🙏</span>
                </div>
                <blockquote className="pullquote">
                  &ldquo;Mines a LinkedIn faster than a founder can{" "}
                  <em>humblebrag</em> about one.&rdquo;
                </blockquote>
                <div className="chip-foot">
                  <span className="role-tag">LinkedIn Wire</span>
                  <span className="handle">@apify · apify.com ↗</span>
                </div>
              </a>

              <a
                className="sponsor-chip"
                href="https://cal.com/tijs-lerai/megathon"
                target="_blank"
                rel="noreferrer"
              >
                <div className="chip-top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="brand-logo fal"
                    src="/logos/fal.png"
                    alt="fal.ai"
                  />
                  <span className="please">sponsor us 🙏</span>
                </div>
                <blockquote className="pullquote">
                  &ldquo;Twelve seconds, one founder, one{" "}
                  <em>cinematic frame</em>. The negative develops itself.&rdquo;
                </blockquote>
                <div className="chip-foot">
                  <span className="role-tag">Cinematic Render</span>
                  <span className="handle">@fal · fal.ai ↗</span>
                </div>
              </a>

              <a
                className="open-letter"
                href="https://cal.com/tijs-lerai/megathon"
                target="_blank"
                rel="noreferrer"
              >
                <div className="letter-head">
                  <span className="stamp-mini">OPEN&nbsp;LETTER</span>
                  <span className="dateline">MEGATON · {issueNo}</span>
                </div>
                <div className="letter-body">
                  <strong>To:</strong> @apify, @fal.ai &nbsp;
                  <strong>Re:</strong> a small press partnership.
                  <br />
                  We&apos;re already running on you. Make it{" "}
                  <em>official</em> — sponsor Megaton Studio.
                </div>
                <div className="letter-foot">
                  Sincerely, the Editor &nbsp;·&nbsp; Book a call →
                </div>
              </a>
            </div>
          </form>
        </section>

        {profile && stories && (
          <>
            {/* SECTION 2 — SUBJECT DOSSIER */}
            <section className="section">
              <div className="section-tab">
                <span className="num">02</span>
                <span>Today&apos;s Subject</span>
              </div>
              <div className="section-head">
                <h2 className="section-title">
                  The <em>dossier</em>
                </h2>
                <span className="section-meta">
                  Sourced · LinkedIn · {profile.posts.length} Posts Mined
                </span>
              </div>

              <div className="dossier">
                <div className="photo-frame">
                  <div className="ph">
                    {profile.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.photoUrl} alt="" />
                    ) : null}
                  </div>
                  <div className="caption">File Photo · Provided</div>
                </div>

                <div className="dossier-body">
                  <div className="name">
                    {profile.name ?? "Unidentified Founder"}
                  </div>
                  <div className="role">
                    {profile.headline && (
                      <div>
                        <span className="label">Headline /</span>
                        {profile.headline}
                      </div>
                    )}
                    {(profile.jobTitle || profile.company) && (
                      <div>
                        <span className="label">Currently /</span>
                        {[profile.jobTitle, profile.company]
                          .filter(Boolean)
                          .join(" @ ")}
                      </div>
                    )}
                    {profile.location && (
                      <div>
                        <span className="label">Filed from /</span>
                        {profile.location}
                      </div>
                    )}
                  </div>

                  {profile.summary && (
                    <div className="summary">
                      &ldquo;{profile.summary.slice(0, 320)}
                      {profile.summary.length > 320 ? "…" : ""}&rdquo;
                    </div>
                  )}

                  <div className="dossier-stats">
                    <div className="stat">
                      <span className="num">{profile.posts.length}</span>
                      Posts Mined
                    </div>
                    <div className="stat">
                      <span className="num">{profile.experiences.length}</span>
                      Past Roles
                    </div>
                    <div className="stat">
                      <span className="num">{stories.directions.length}</span>
                      Possible Arcs
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3 — STORY DESK */}
            <section className="section">
              <div className="section-tab">
                <span className="num">03</span>
                <span>Story Desk</span>
              </div>
              <div className="section-head">
                <h2 className="section-title">
                  Three <em>arcs</em>, one editor&apos;s pick
                </h2>
                <span className="section-meta">Click to select · Default = recommended</span>
              </div>

              <div className="recommendation-strip">
                <strong>Editor&apos;s note —</strong>
                {stories.recommendationReason}
              </div>

              <div className="story-grid">
                {stories.directions.map((d, i) => {
                  const isRec = d.id === stories.recommendedId;
                  const isSel = selectedId === d.id;
                  return (
                    <button
                      type="button"
                      key={d.id}
                      className={`story-card ${isSel ? "selected" : ""} ${
                        isRec ? "recommended" : ""
                      }`}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <div className="num">
                        {String(i + 1).padStart(2, "0")}
                        <span className="angle">{d.angle}</span>
                      </div>
                      <h3 className="hook">{d.hook}</h3>
                      <div className="why">{d.why}</div>

                      {isRec && (
                        <div className="stamp" aria-label="Editor's Pick">
                          Editor&apos;s
                          <span className="sub">Pick</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* SECTION 4 — FRONT PAGE */}
            {selectedDirection && (
              <section className="section">
                <div className="section-tab">
                  <span className="num">04</span>
                  <span>Front Page</span>
                </div>
                <div className="section-head">
                  <h2 className="section-title">
                    Tomorrow&apos;s <em>headlines</em>, today
                  </h2>
                  <span className="section-meta">All Caps Optional · Drama Mandatory</span>
                </div>

                <div className="frontpage">
                  <div className="frontpage-byline">
                    <span className="ink">By Our Intl. Builders Desk</span>
                    <span>Wire · Unconfirmed</span>
                    <span>Dateline · MEGATON 2026</span>
                    <span>Edition · {issueNo}</span>
                  </div>

                  {selectedDirection.headlines.map((h, i) => (
                    <div key={i} className="headline-item">
                      <div className="h-num">
                        <span className="big">{String(i + 1).padStart(2, "0")}</span>
                        Story
                      </div>
                      <div className="h-text">&ldquo;{h}&rdquo;</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 5 — PHOTOGRAPHY DESK */}
            {selectedDirection && (
              <section className="section">
                <div className="section-tab">
                  <span className="num">05</span>
                  <span>Front Page Print Room</span>
                </div>
                <div className="section-head">
                  <h2 className="section-title">
                    Render the <em>front page</em>
                  </h2>
                  <span className="section-meta">
                    One-shot · Photo + Headline + Layout
                  </span>
                </div>

                <div className="photo-desk">
                  <div className="ref-photos">
                    <div className="ref-photos-head">
                      <div>
                        <div className="ref-photos-title">Reference photos</div>
                        <div className="ref-photos-sub">
                          Optional · adds extra visual references for the render (wardrobe, vibe, venue). LinkedIn headshot is already used as the likeness anchor.
                        </div>
                      </div>
                      <div className="ref-photos-actions">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => onAddReferenceFiles(e.target.files)}
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={refUploading || refPhotos.length >= 4}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {refUploading ? (
                            <>
                              <span className="spinner">
                                <span />
                                <span />
                                <span />
                              </span>
                              Uploading
                            </>
                          ) : (
                            <>+ Add reference photo</>
                          )}
                        </button>
                      </div>
                    </div>

                    {refError && <div className="err">⚠ {refError}</div>}

                    {refPhotos.length > 0 && (
                      <div className="ref-photo-strip">
                        {refPhotos.map((r) => (
                          <div key={r.id} className="ref-photo-tile">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.url} alt="reference" />
                            <button
                              type="button"
                              className="ref-photo-remove"
                              onClick={() => onRemoveReference(r.id)}
                              aria-label="Remove reference"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {imageError && <div className="err">⚠ {imageError}</div>}

                  <div id="tc-post" className="tc-post solo">
                    <div className="tc-post-head">
                      <span className="ink">
                        {tcPostUrl
                          ? "Mock front page · TechCrunch-style"
                          : phase === "generating-image"
                            ? "Printing front page…"
                            : "Front page · not yet filed"}
                      </span>
                      <div className="tc-post-head-actions">
                        {tcPostUrl && (
                          <a
                            className="btn ink small"
                            href={tcPostUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open raw PNG ↗
                          </a>
                        )}
                        {imageUrl && (
                          <a
                            className="btn ghost small"
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open the underlying photo at full resolution"
                          >
                            Photo ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="tc-post-frame">
                      <span className="crop tl" />
                      <span className="crop tr" />
                      <span className="crop bl" />
                      <span className="crop br" />
                      {phase === "generating-image" || tcPostLoading ? (
                        <div className="working tc-loading" role="status" aria-live="polite">
                          <span className="stamp">
                            {phase === "generating-image"
                              ? "Exposing · 35mm · Pass 1/1"
                              : "Composing · Edge · OG/2000"}
                          </span>
                          <span className="label">
                            <span className="spinner">
                              <span />
                              <span />
                              <span />
                            </span>
                            {phase === "generating-image"
                              ? "Developing print at fal.ai"
                              : "Setting front page"}
                          </span>
                          <span className="sub">
                            {phase === "generating-image"
                              ? "Negative cooking · ~12s · do not open the door"
                              : "Laying out hero · pulling sidebar · printing dateline"}
                          </span>
                        </div>
                      ) : null}
                      {tcPostUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tcPostUrl}
                          alt="Fictional TechCrunch-style post"
                          onLoad={() => setTcPostLoading(false)}
                          onError={() => setTcPostLoading(false)}
                          style={{ opacity: tcPostLoading ? 0 : 1 }}
                        />
                      ) : phase !== "generating-image" ? (
                        <div className="placeholder">
                          [ Front page not yet filed ]
                          <br />
                          Press <em>Print front page</em> to render
                        </div>
                      ) : null}
                    </div>

                    <div className="photo-actions tc-post-cta">
                      <button
                        className="btn"
                        disabled={phase === "generating-image"}
                        onClick={() => onGenerateImage("clean")}
                      >
                        {imageUrl ? "Re-print front page" : "Print front page"} →
                      </button>
                    </div>
                    </div>

                    {tcPostUrl && selectedDirection?.linkedinCaption && (
                      <div className="ship-it">
                        <div className="ship-head">
                          <div>
                            <div className="ship-stamp">Ship to LinkedIn</div>
                            <div className="ship-sub">
                              Six steps. Caption + image, hand-pasted. (LinkedIn
                              won&apos;t let us do it in one click — blame them.)
                            </div>
                          </div>
                          <div className="ship-progress">
                            {checklistDone.size}/{CHECKLIST_STEPS.length}
                          </div>
                        </div>

                        <div className="caption-box">
                          <div className="caption-label">Caption (this is what people will read)</div>
                          <pre className="caption-text">{selectedDirection.linkedinCaption}</pre>
                        </div>

                        <ol className="checklist">
                          <li className={checklistDone.has("copy-caption") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("copy-caption")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("copy-caption") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">Copy the caption</div>
                              <div className="step-sub">Goes onto your clipboard as plain text.</div>
                            </div>
                            <button
                              type="button"
                              className="btn linkedin small"
                              onClick={onCopyCaption}
                            >
                              Copy caption ⎘
                            </button>
                          </li>

                          <li className={checklistDone.has("open-linkedin") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("open-linkedin")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("open-linkedin") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">Open the LinkedIn composer</div>
                              <div className="step-sub">Opens in a new tab — keep this tab open.</div>
                            </div>
                            <a
                              className="btn linkedin small"
                              href="https://www.linkedin.com/feed/?shareActive=true"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={onOpenLinkedIn}
                            >
                              Open LinkedIn ↗
                            </a>
                          </li>

                          <li className={checklistDone.has("paste-caption") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("paste-caption")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("paste-caption") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">Paste the caption in LinkedIn (⌘V / Ctrl+V)</div>
                              <div className="step-sub">Click the post body and paste. Tick this when done.</div>
                            </div>
                          </li>

                          <li className={checklistDone.has("tag-reporter") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("tag-reporter")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("tag-reporter") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">
                                Tag @{selectedDirection.reporter.realName} properly
                              </div>
                              <div className="step-sub">
                                Delete the literal &ldquo;@{selectedDirection.reporter.realName}&rdquo;, retype{" "}
                                <code>@{selectedDirection.reporter.realName}</code>, and pick them from
                                LinkedIn&apos;s dropdown so the mention actually links.
                                {selectedDirection.reporter.reason && (
                                  <>
                                    {" "}
                                    <em>(Picked because: {selectedDirection.reporter.reason})</em>
                                  </>
                                )}
                              </div>
                            </div>
                          </li>

                          <li className={checklistDone.has("download-image") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("download-image")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("download-image") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">Download the front-page image</div>
                              <div className="step-sub">
                                LinkedIn won&apos;t accept a pasted image — it only takes file uploads.
                                Saves the PNG to your Downloads folder.
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn linkedin small"
                              onClick={onDownloadPng}
                              disabled={tcPostLoading}
                            >
                              Download PNG ↓
                            </button>
                          </li>

                          <li className={checklistDone.has("attach-image") ? "done" : ""}>
                            <button
                              type="button"
                              className="check"
                              onClick={() => toggleStep("attach-image")}
                              aria-label="toggle step"
                            >
                              {checklistDone.has("attach-image") ? "✓" : ""}
                            </button>
                            <div className="step-body">
                              <div className="step-title">Attach the image in LinkedIn</div>
                              <div className="step-sub">
                                In the composer, click the <strong>photo icon</strong> (bottom toolbar),
                                pick the PNG you just downloaded. Then hit Post 🚀
                              </div>
                            </div>
                          </li>
                        </ol>

                        {checklistNote && <div className="share-note">{checklistNote}</div>}
                      </div>
                    )}
                </div>
              </section>
            )}
          </>
        )}

        {/* COLOPHON */}
        <section className="colophon">
          <div>
            <p className="ink">A note from the publisher.</p>
            <p>
              Everything printed by Megaton Studio is parody, concept-art, or
              outright fiction. Real names are used as raw material for clearly
              absurd narratives. No real publication, journalist, investor, or
              outlet has endorsed, covered, or confirmed any of this.
            </p>
            <p>Do not cite in court. Do cite in group chats.</p>
          </div>
          <div>
            <p className="ink">Masthead</p>
            <p>Editor-in-Chief · The Builder</p>
            <p>Photography · fal.ai</p>
            <p>Source Wire · Apify</p>
          </div>
        </section>
      </main>

      {/* BOTTOM TICKER */}
      <div className="ticker bottom" aria-hidden>
        <div className="ticker-track">
          {[...TICKER_BOTTOM, ...TICKER_BOTTOM].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </>
  );
}
