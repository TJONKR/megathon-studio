import { fal } from "./fal";
import { OG_HERO_ASPECT_RATIO } from "./og-layout";
import { buildImagePrompt } from "./prompts";

export type ImageMode = "clean" | "mock-graphic";

export type GenerateImageInput = {
  photoUrl?: string;
  extraImageUrls?: string[];
  name?: string;
  headline?: string;
  hook: string;
  angle: string;
  mode: ImageMode;
  caption?: string;
};

export type GenerateImageResult =
  | { ok: true; imageUrl: string; prompt: string }
  | { ok: false; error: string };


async function urlToFalStorage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const file = new File([buf], `subject.${ext}`, { type: contentType });
    return await fal.storage.upload(file);
  } catch (e) {
    console.error("[image] upload failed:", e);
    return null;
  }
}

async function callFalWithRetry(
  prompt: string,
  imageUrls: string[],
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const endpoint =
        imageUrls.length > 0
          ? "fal-ai/gemini-3-pro-image-preview/edit"
          : "fal-ai/gemini-3-pro-image-preview";

      const input: Record<string, unknown> = {
        prompt,
        num_images: 1,
        aspect_ratio: OG_HERO_ASPECT_RATIO,
        output_format: "jpeg",
        resolution: "2K",
      };
      if (imageUrls.length > 0) input.image_urls = imageUrls;

      const res = await fal.subscribe(endpoint, {
        input: input as never,
        logs: false,
        pollInterval: 2000,
      });
      const images = (res.data?.images ?? []) as { url: string }[];
      if (!images[0]?.url) throw new Error("fal returned no image");
      return images[0].url;
    } catch (err) {
      lastErr = err;
      console.error(`[image] attempt ${attempt} failed:`, err);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  try {
    if (!process.env.FAL_KEY) return { ok: false, error: "FAL_KEY not configured." };

    const prompt = buildImagePrompt({
      name: input.name,
      headline: input.headline,
      hook: input.hook,
      angle: input.angle,
      mode: input.mode,
      caption: input.caption,
    });

    const imageUrls: string[] = [];
    if (input.photoUrl) {
      const uploaded = await urlToFalStorage(input.photoUrl);
      if (uploaded) imageUrls.push(uploaded);
    }
    if (input.extraImageUrls?.length) {
      imageUrls.push(...input.extraImageUrls);
    }

    const url = await callFalWithRetry(prompt, imageUrls);
    return { ok: true, imageUrl: url, prompt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generateImage] error:", err);
    return { ok: false, error: msg };
  }
}
