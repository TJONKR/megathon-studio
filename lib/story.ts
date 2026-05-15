import Anthropic from "@anthropic-ai/sdk";
import { STUDIO_SYSTEM_PROMPT, buildStoryUserPrompt, TC_REPORTERS } from "./prompts";
import type { LinkedInProfile } from "./apify";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Reporter = {
  realName: string;
  parodyName: string;
  reason?: string;
};

export type StoryDirection = {
  id: string;
  angle: string;
  hook: string;
  why: string;
  headlines: string[];
  body: string;
  reporter: Reporter;
  linkedinCaption: string;
};

export type StoryBundle = {
  directions: StoryDirection[];
  recommendedId: string;
  recommendationReason: string;
};

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

const MEGATHON_RE = /MEGATHON/i;

function findMissingMegathon(bundle: StoryBundle): string[] {
  const issues: string[] = [];
  bundle.directions.forEach((d, i) => {
    if (!MEGATHON_RE.test(d.hook)) issues.push(`direction[${i}].hook is missing MEGATHON`);
    (d.headlines ?? []).forEach((h, j) => {
      if (!MEGATHON_RE.test(h))
        issues.push(`direction[${i}].headlines[${j}] is missing MEGATHON`);
    });
  });
  return issues;
}

function ensureMegathon(bundle: StoryBundle): StoryBundle {
  return {
    ...bundle,
    directions: bundle.directions.map((d) => ({
      ...d,
      hook: MEGATHON_RE.test(d.hook)
        ? d.hook
        : `${d.hook.replace(/[.!?]?\s*$/, "")} — filed from MEGATHON 2026, Amsterdam.`,
      headlines: (d.headlines ?? []).map((h) =>
        MEGATHON_RE.test(h) ? h : `${h.replace(/\s*$/, "")} — MEGATHON 2026`,
      ),
    })),
  };
}

function normalizeReporter(reporter: Reporter | undefined, fallbackHeadline?: string): Reporter {
  const valid =
    reporter &&
    typeof reporter.realName === "string" &&
    reporter.realName.trim().length > 0 &&
    TC_REPORTERS.some((r) => r.realName === reporter.realName.trim());

  if (valid && reporter) {
    const realName = reporter.realName.trim();
    let parodyName =
      typeof reporter.parodyName === "string" ? reporter.parodyName.trim() : "";
    if (!parodyName || parodyName.toLowerCase() === realName.toLowerCase()) {
      parodyName = makeFallbackParody(realName);
    }
    return { realName, parodyName, reason: reporter.reason };
  }

  // Fallback: pick the most plausible TC reporter from the headline keywords.
  const hint = (fallbackHeadline ?? "").toLowerCase();
  const guess =
    (hint.match(/\b(ai|model|agent|llm)\b/) && "Kyle Wiggers") ||
    (hint.match(/\b(vc|raise|series|fund|cheque|check|pitch deck)\b/) && "Dominic-Madori Davis") ||
    (hint.match(/\b(hack|breach|leak|cursed|sentient|security)\b/) && "Lorenzo Franceschi-Bicchierai") ||
    "Anna Heim";
  return {
    realName: guess,
    parodyName: makeFallbackParody(guess),
  };
}

function makeFallbackParody(realName: string): string {
  // Last-resort parody twist: drop a letter from the first name + tweak last name.
  const parts = realName.split(/\s+/);
  if (parts.length < 2) return `${realName} Heimlich`;
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  const firstTwist = first.length > 3 ? first.slice(0, -1) + first.slice(-1).toLowerCase() + "a" : `${first}o`;
  const lastTwist = last.replace(/s$/i, "z").replace(/r$/i, "rs");
  return `${firstTwist} ${lastTwist}`;
}

function ensureReporterMentionIn(direction: StoryDirection): StoryDirection {
  const tag = `@${direction.reporter.realName}`;
  const escaped = direction.reporter.realName
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\s+/g, "\\s+");
  const tagRe = new RegExp(`@\\s*${escaped}`, "i");
  if (tagRe.test(direction.linkedinCaption)) return direction;
  const lines = direction.linkedinCaption.split("\n");
  const hashtagIdx = lines.findIndex((l) => /(^|\s)#\w/.test(l));
  const insertAt = hashtagIdx === -1 ? lines.length : hashtagIdx;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const padded =
    before.length && before[before.length - 1].trim() !== ""
      ? [...before, ""]
      : before;
  return {
    ...direction,
    linkedinCaption: [...padded, `filed by ${tag}`, ...after].join("\n"),
  };
}

function ensureReporterMentions(bundle: StoryBundle): StoryBundle {
  return {
    ...bundle,
    directions: bundle.directions.map(ensureReporterMentionIn),
  };
}

async function callModel(userPrompt: string, system: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  if (res.stop_reason === "max_tokens") {
    console.warn("[story] model hit max_tokens — output likely truncated");
  }
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function fallbackCaption(
  direction: { headlines?: string[]; hook?: string },
  reporter: Reporter,
): string {
  const headline =
    direction.headlines?.[0] ||
    direction.hook ||
    "Something absurd allegedly happened at MEGATHON 2026.";
  return [
    "ok so apparently this happened…",
    "",
    headline,
    "",
    `filed by @${reporter.realName}`,
    "MEGATHON 2026 · Amsterdam · (100% parody, 0% verified)",
  ].join("\n");
}

function stripHashtags(caption: string): string {
  // Remove any line that is just hashtags (engagement-bait line at the end)
  // and inline #tags, but preserve emojis and other markup.
  return caption
    .split("\n")
    .map((line) => line.replace(/(^|\s)#\w[\w-]*/g, "$1").replace(/\s+$/, ""))
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

type LooseDirection = {
  id?: string;
  angle?: string;
  hook?: string;
  why?: string;
  headlines?: unknown;
  body?: string;
  reporter?: Reporter;
  linkedinCaption?: string;
};

function fallbackBody(hook: string, headlines: string[], name?: string): string {
  const subject = name?.trim() || "The subject";
  const lede = `${subject} is, allegedly, the protagonist of the strangest dispatch out of MEGATHON 2026 in Amsterdam this weekend. ${hook}`;
  const colour = `Sources inside the venue — granted anonymity because the story is, technically, made up — describe a scene of escalating absurdity on the build floor. The reporting room is treating the whole thing as the kind of founder lore that doesn't survive a Monday.`;
  const kicker = headlines[1]
    ? `By Sunday's main-stage finals, the working theory was simpler: ${headlines[1].toLowerCase().replace(/megathon/gi, "MEGATHON")}.`
    : `By Sunday's main-stage finals, no one had a tidy explanation, only the footage.`;
  return [lede, colour, kicker].join("\n\n");
}

function normalizeBody(raw: string | undefined, hook: string, headlines: string[], name?: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallbackBody(hook, headlines, name);
  // Collapse literal "\n" sequences that some models emit instead of real newlines.
  const normalised = trimmed.replace(/\\n/g, "\n");
  // If the model returned a single blob with no paragraph breaks, split on sentence-ish boundaries.
  if (!/\n\s*\n/.test(normalised)) {
    const sentences = normalised.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length >= 3) {
      const third = Math.ceil(sentences.length / 3);
      return [
        sentences.slice(0, third).join(" "),
        sentences.slice(third, third * 2).join(" "),
        sentences.slice(third * 2).join(" "),
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }
  return normalised;
}

function normalizeDirection(raw: LooseDirection, idx: number): StoryDirection {
  const id = (typeof raw.id === "string" && raw.id.trim()) || ["a", "b", "c"][idx] || `d${idx}`;
  const angle = (typeof raw.angle === "string" && raw.angle.trim()) || "story";
  const hook = (typeof raw.hook === "string" && raw.hook.trim()) || "An absurd thing allegedly happened at MEGATHON 2026.";
  const why = (typeof raw.why === "string" && raw.why.trim()) || "Pulled from the subject's profile.";

  const headlines = Array.isArray(raw.headlines)
    ? raw.headlines.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    : [];
  while (headlines.length < 3) headlines.push(`${hook} — MEGATHON 2026`);

  const reporter = normalizeReporter(raw.reporter, headlines[0] ?? hook);
  const body = normalizeBody(raw.body, hook, headlines);

  const rawCaption =
    typeof raw.linkedinCaption === "string" && raw.linkedinCaption.trim().length > 0
      ? raw.linkedinCaption
      : fallbackCaption({ headlines, hook }, reporter);

  return {
    id,
    angle,
    hook,
    why,
    headlines,
    body,
    reporter,
    linkedinCaption: stripHashtags(rawCaption),
  };
}

function parseBundle(text: string): StoryBundle {
  const raw = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[story] failed to parse JSON:", text);
    throw new Error("Story model returned malformed JSON.");
  }
  const p = parsed as {
    directions?: LooseDirection[];
    recommendedId?: string;
    recommendationReason?: string;
  };
  if (!p.directions || !Array.isArray(p.directions) || p.directions.length === 0) {
    throw new Error("Story model returned no directions.");
  }
  const directions = p.directions.map((d, i) => normalizeDirection(d, i));
  const recommendedId =
    typeof p.recommendedId === "string" &&
    directions.some((d) => d.id === p.recommendedId)
      ? p.recommendedId
      : directions[0]!.id;
  const recommendationReason =
    typeof p.recommendationReason === "string" && p.recommendationReason.trim().length > 0
      ? p.recommendationReason
      : "Editor's pick: leans hardest into this subject's actual profile.";

  return { directions, recommendedId, recommendationReason };
}

export async function generateStories(profile: LinkedInProfile): Promise<StoryBundle> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured.");
  }

  const userPrompt = buildStoryUserPrompt(profile);
  let text = await callModel(userPrompt, STUDIO_SYSTEM_PROMPT);
  let bundle: StoryBundle;
  try {
    bundle = parseBundle(text);
  } catch (e) {
    console.warn("[story] first parse failed, retrying with stricter JSON instruction:", e);
    const fixPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT WAS NOT VALID JSON or was truncated. Return ONLY the JSON object, nothing else — no prose, no fences, no commentary. Keep every string concise enough to fit the full payload in one response.`;
    text = await callModel(fixPrompt, STUDIO_SYSTEM_PROMPT);
    bundle = parseBundle(text);
  }

  let missing = findMissingMegathon(bundle);
  if (missing.length > 0) {
    console.warn("[story] retrying — missing MEGATHON in:", missing);
    const fixPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION — every direction.hook and every headline MUST contain the literal word "MEGATHON". Regenerate the full JSON payload, fixing these specifically: ${missing.join("; ")}.`;
    const retryText = await callModel(fixPrompt, STUDIO_SYSTEM_PROMPT);
    try {
      bundle = parseBundle(retryText);
    } catch (e) {
      console.warn("[story] retry parse failed, will auto-patch:", e);
    }
    missing = findMissingMegathon(bundle);
    if (missing.length > 0) {
      console.warn("[story] auto-patching MEGATHON into:", missing);
      bundle = ensureMegathon(bundle);
    }
  }

  bundle = ensureReporterMentions(bundle);

  return bundle;
}
