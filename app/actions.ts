"use server";

import { scrapeLinkedInProfile, type LinkedInProfile } from "@/lib/apify";
import { generateStories, type StoryBundle } from "@/lib/story";
import { generateImage, type ImageMode } from "@/lib/image";
import { fal } from "@/lib/fal";
import { checkLimit, limitError } from "@/lib/limits";
import { buildSignedOgUrl, type OgPostInput } from "@/lib/og-params";

export type EnrichResult =
  | { ok: true; profile: LinkedInProfile; stories: StoryBundle }
  | { ok: false; error: string };

export async function enrichAndGenerate(linkedinUrl: string): Promise<EnrichResult> {
  try {
    const trimmed = linkedinUrl.trim();
    if (!/linkedin\.com\/in\//i.test(trimmed)) {
      return { ok: false, error: "That doesn't look like a LinkedIn profile URL." };
    }
    if (!process.env.APIFY_API_TOKEN) {
      return { ok: false, error: "APIFY_API_TOKEN missing on server." };
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "ANTHROPIC_API_KEY missing on server." };
    }

    const limit = await checkLimit("enrich");
    if (!limit.ok) return { ok: false, error: limitError(limit) };

    const profile = await scrapeLinkedInProfile(trimmed);
    if (!profile.name && !profile.headline && profile.posts.length === 0) {
      return {
        ok: false,
        error:
          "Couldn't read that profile (Apify came back empty). Profile might be private, or the URL is off.",
      };
    }

    const stories = await generateStories(profile);
    return { ok: true, profile, stories };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[enrichAndGenerate] error:", err);
    return { ok: false, error: msg };
  }
}

export type ImageActionResult =
  | { ok: true; imageUrl: string }
  | { ok: false; error: string };

export async function makeImage(args: {
  profile: { name?: string; headline?: string; photoUrl?: string };
  direction: { hook: string; angle: string };
  mode: ImageMode;
  caption?: string;
  extraImageUrls?: string[];
}): Promise<ImageActionResult> {
  const limit = await checkLimit("image");
  if (!limit.ok) return { ok: false, error: limitError(limit) };

  const res = await generateImage({
    photoUrl: args.profile.photoUrl,
    extraImageUrls: args.extraImageUrls,
    name: args.profile.name,
    headline: args.profile.headline,
    hook: args.direction.hook,
    angle: args.direction.angle,
    mode: args.mode,
    caption: args.caption,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, imageUrl: res.imageUrl };
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function uploadReferenceImage(dataUrl: string): Promise<UploadResult> {
  try {
    if (!process.env.FAL_KEY) return { ok: false, error: "FAL_KEY not configured." };
    const limit = await checkLimit("upload");
    if (!limit.ok) return { ok: false, error: limitError(limit) };

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { ok: false, error: "Invalid data URL." };
    const contentType = match[1]!;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(contentType)) {
      return { ok: false, error: "Only PNG / JPEG / WEBP images are accepted." };
    }
    const buf = Buffer.from(match[2]!, "base64");
    if (buf.byteLength > 8 * 1024 * 1024) {
      return { ok: false, error: "Image too large (max 8MB)." };
    }
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const file = new File([buf], `ref.${ext}`, { type: contentType });
    const url = await fal.storage.upload(file);
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export type SignedOgResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function signOgUrl(input: OgPostInput): Promise<SignedOgResult> {
  try {
    const limit = await checkLimit("sign");
    if (!limit.ok) return { ok: false, error: limitError(limit) };
    const url = await buildSignedOgUrl(input);
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[signOgUrl] error:", err);
    return { ok: false, error: msg };
  }
}
