/** Default header logo for TechCrunch-style article OG images. */
export const OG_LOGO_URL = "/logos/tagchurch.png";
export const OG_LOGO_HEIGHT = "44";
export const OG_LOGO_OFFSET_LEFT = "14";

/** Ensures OG/share URLs include the article header logo. */
export function appendOgBrandParams(params: URLSearchParams) {
  if (!params.has("logoUrl")) {
    params.set("logoUrl", OG_LOGO_URL);
    params.set("logoHeight", OG_LOGO_HEIGHT);
    params.set("logoOffsetLeft", OG_LOGO_OFFSET_LEFT);
  }
}
