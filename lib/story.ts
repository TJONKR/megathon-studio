import Anthropic from "@anthropic-ai/sdk";
import { STUDIO_SYSTEM_PROMPT, buildStoryUserPrompt, TC_REPORTERS } from "./prompts";
import type { LinkedInProfile } from "./apify";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type StoryDirection = {
  id: string;
  angle: string;
  hook: string;
  why: string;
};

export type Reporter = {
  realName: string;
  parodyName: string;
  reason?: string;
};

export type StoryBundle = {
  directions: StoryDirection[];
  recommendedId: string;
  recommendationReason: string;
  headlines: string[];
  reporter: Reporter;
  linkedinCaption: string;
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
  });
  bundle.headlines.forEach((h, i) => {
    if (!MEGATHON_RE.test(h)) issues.push(`headlines[${i}] is missing MEGATHON`);
  });
  return issues;
}

function ensureMegathon(bundle: StoryBundle): StoryBundle {
  return {
    ...bundle,
    directions: bundle.directions.map((d) =>
      MEGATHON_RE.test(d.hook)
        ? d
        : { ...d, hook: `${d.hook.replace(/[.!?]?\s*$/, "")} — filed from MEGATHON 2026, Amsterdam.` },
    ),
    headlines: bundle.headlines.map((h) =>
      MEGATHON_RE.test(h) ? h : `${h.replace(/\s*$/, "")} — MEGATHON 2026`,
    ),
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

function ensureReporterMention(bundle: StoryBundle): StoryBundle {
  const tag = `@${bundle.reporter.realName}`;
  const tagRe = new RegExp(
    `@\\s*${bundle.reporter.realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\s+/g, "\\s+")}`,
    "i",
  );
  if (tagRe.test(bundle.linkedinCaption)) return bundle;
  const lines = bundle.linkedinCaption.split("\n");
  const hashtagIdx = lines.findIndex((l) => /(^|\s)#\w/.test(l));
  const insertAt = hashtagIdx === -1 ? lines.length : hashtagIdx;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const padded = before.length && before[before.length - 1].trim() !== "" ? [...before, ""] : before;
  return {
    ...bundle,
    linkedinCaption: [...padded, `filed by ${tag}`, ...after].join("\n"),
  };
}

async function callModel(userPrompt: string, system: string): Promise<string> {
  const res = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function fallbackCaption(p: Partial<StoryBundle>, reporter: Reporter): string {
  const headline =
    (p.headlines && p.headlines[0]) ||
    (p.directions && p.directions[0]?.hook) ||
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

function parseBundle(text: string): StoryBundle {
  const raw = extractJson(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[story] failed to parse JSON:", text);
    throw new Error("Story model returned malformed JSON.");
  }
  const p = parsed as Partial<StoryBundle>;
  if (
    !p.directions ||
    !Array.isArray(p.directions) ||
    p.directions.length === 0 ||
    !p.recommendedId ||
    !p.headlines
  ) {
    throw new Error("Story model returned incomplete payload.");
  }
  const reporter = normalizeReporter(p.reporter, p.headlines?.[0]);
  const rawCaption =
    typeof p.linkedinCaption === "string" && p.linkedinCaption.trim().length > 0
      ? p.linkedinCaption
      : fallbackCaption(p, reporter);
  return { ...(p as StoryBundle), reporter, linkedinCaption: stripHashtags(rawCaption) };
}

export async function generateStories(profile: LinkedInProfile): Promise<StoryBundle> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured.");
  }

  const userPrompt = buildStoryUserPrompt(profile);
  const text = await callModel(userPrompt, STUDIO_SYSTEM_PROMPT);
  let bundle = parseBundle(text);

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

  bundle = ensureReporterMention(bundle);

  return bundle;
}
