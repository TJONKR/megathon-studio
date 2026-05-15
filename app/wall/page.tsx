import Link from "next/link";
import { getRecentEntries, isWallConfigured, type WallEntry } from "@/lib/wall";
import { buildSignedOgUrl } from "@/lib/og-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Tile = {
  entry: WallEntry;
  ogUrl: string | null;
};

async function loadTiles(): Promise<Tile[]> {
  if (!isWallConfigured()) return [];
  const entries = await getRecentEntries(60);
  return Promise.all(
    entries.map(async (e) => {
      let ogUrl: string | null = null;
      try {
        ogUrl = await buildSignedOgUrl(e.og);
      } catch (err) {
        console.warn("[wall] sign failed for", e.id, err);
      }
      return { entry: e, ogUrl };
    }),
  );
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default async function WallPage() {
  const configured = isWallConfigured();
  const tiles = await loadTiles();

  return (
    <main className="page wall-page">
      <header className="hero" style={{ paddingBottom: 16 }}>
        <div className="eyebrow">
          <span className="dot" />
          The Wire · Megaton Studio · Live Feed
        </div>
        <h1>
          The <span className="it">wall</span>
          <span className="small">
            Every front page filed by every builder, in print order.
          </span>
        </h1>
        <p className="lede">
          A shared bulletin of every Megaton Studio render. Refreshes on every
          visit. No edits. No takedowns. No real journalists were harmed.
        </p>
        <div className="hero-meta">
          <Link href="/" className="ink">
            ← Back to the press desk
          </Link>
          <span>{tiles.length} dispatches on the wire</span>
        </div>
      </header>

      {!configured && (
        <div className="err" style={{ margin: "12px 0" }}>
          ⚠ Wall storage not configured. Set <code>KV_REST_API_URL</code> and{" "}
          <code>KV_REST_API_TOKEN</code> in your environment.
        </div>
      )}

      {configured && tiles.length === 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              No <em>dispatches</em> filed yet
            </h2>
            <span className="section-meta">Be the first to print one</span>
          </div>
          <p>
            Head back to the <Link href="/">intake desk</Link> and file a story
            — it will appear here the moment fal.ai develops the negative.
          </p>
        </section>
      )}

      {tiles.length > 0 && (
        <section className="section">
          <div className="wall-grid">
            {tiles.map(({ entry, ogUrl }) => (
              <article key={entry.id} className="wall-tile">
                <div className="wall-tile-frame">
                  {ogUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ogUrl} alt={entry.og.title} loading="lazy" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.imageUrl}
                      alt={entry.og.title}
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="wall-tile-body">
                  <div className="wall-tile-meta">
                    <span className="cat">{entry.og.angle}</span>
                    <span className="dim">{fmtAgo(entry.createdAt)}</span>
                  </div>
                  <h3 className="wall-tile-title">{entry.og.title}</h3>
                  <div className="wall-tile-byline">
                    {entry.og.byline}
                    {entry.subjectName ? ` · on ${entry.subjectName}` : ""}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
