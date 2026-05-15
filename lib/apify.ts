const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

export interface LinkedInProfile {
  url: string;
  name?: string;
  firstName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  photoUrl?: string;
  experiences: string[];
  posts: string[];
}

async function runApifyActor(
  actorId: string,
  input: unknown,
  timeoutSecs = 90,
): Promise<unknown[]> {
  if (!APIFY_TOKEN) {
    console.error("[apify] APIFY_API_TOKEN not configured");
    return [];
  }
  try {
    console.log(`[apify] starting actor ${actorId}…`);
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&timeout=${timeoutSecs}&waitForFinish=${timeoutSecs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!runRes.ok) {
      const err = await runRes.text();
      console.error(`[apify] ${actorId} run failed:`, err);
      return [];
    }
    const run = await runRes.json();
    const datasetId = run.data?.defaultDatasetId;
    if (!datasetId) {
      console.error(`[apify] ${actorId}: no dataset ID`);
      return [];
    }
    const dataRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=50`,
    );
    if (!dataRes.ok) return [];
    const items = (await dataRes.json()) as unknown[];
    console.log(`[apify] ${actorId}: got ${items.length} items`);
    return items;
  } catch (e) {
    console.error(`[apify] ${actorId} error:`, e);
    return [];
  }
}

type DevFusionProfile = {
  fullName?: string;
  firstName?: string;
  headline?: string;
  about?: string;
  jobTitle?: string;
  companyName?: string;
  addressWithCountry?: string;
  profilePicHighQuality?: string;
  profilePic?: string;
  experiences?: Array<{ title?: string; subtitle?: string; caption?: string }>;
};

type HarvestPost = {
  type?: string;
  content?: string;
  author?: {
    name?: string;
    info?: string;
    avatar?: { url?: string };
    publicIdentifier?: string;
  };
};

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function scrapeLinkedInProfile(url: string): Promise<LinkedInProfile> {
  const cleanUrl = url.trim().replace(/\?.*$/, "").replace(/\/$/, "");
  const result: LinkedInProfile = { url: cleanUrl, experiences: [], posts: [] };

  // Run both actors in parallel: dev_fusion for rich profile, harvestapi for recent posts.
  const [profileItems, postItems] = (await Promise.all([
    runApifyActor(
      "dev_fusion~Linkedin-Profile-Scraper",
      { profileUrls: [cleanUrl] },
      90,
    ),
    runApifyActor(
      "harvestapi~linkedin-profile-posts",
      { profileUrls: [cleanUrl], maxPosts: 15 },
      90,
    ),
  ])) as [DevFusionProfile[], HarvestPost[]];

  const profile = profileItems[0];
  if (profile) {
    result.name = profile.fullName;
    result.firstName = profile.firstName;
    result.headline = profile.headline ? cleanText(profile.headline) : undefined;
    result.summary = profile.about ? cleanText(profile.about) : undefined;
    result.location = profile.addressWithCountry;
    result.company = profile.companyName || undefined;
    result.jobTitle = profile.jobTitle || undefined;
    result.photoUrl = profile.profilePicHighQuality || profile.profilePic;

    if (Array.isArray(profile.experiences)) {
      result.experiences = profile.experiences
        .slice(0, 6)
        .map((e) => {
          const parts = [e.title, e.subtitle, e.caption]
            .filter(Boolean)
            .map((s) => cleanText(String(s)));
          return parts.join(" · ");
        })
        .filter((s) => s.length > 0);
    }
  }

  if (postItems.length > 0) {
    result.posts = postItems
      .map((p) => (p.content ? cleanText(p.content) : ""))
      .filter((s) => s.length > 0)
      .slice(0, 12);

    // If dev_fusion didn't return name/headline/photo, harvest from posts as fallback.
    if (!result.name || !result.headline || !result.photoUrl) {
      const author = postItems[0]?.author;
      if (author) {
        result.name = result.name || author.name;
        result.headline = result.headline || (author.info ? cleanText(author.info) : undefined);
        result.photoUrl = result.photoUrl || author.avatar?.url;
      }
    }
  }

  // OG-tag fallback if both actors failed
  if (!result.name && !result.headline) {
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const html = await res.text();
        const titleMatch =
          html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
          html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) result.name = titleMatch[1].replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
        const descMatch =
          html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i) ||
          html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
        if (descMatch) result.headline = descMatch[1];
        const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        if (imgMatch) result.photoUrl = imgMatch[1];
      }
    } catch {}
  }

  if (result.name && !result.firstName) {
    result.firstName = result.name.split(/\s+/)[0];
  }

  return result;
}
