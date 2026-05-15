/** OG card canvas — keep in sync with app/api/og/route.tsx ImageResponse size. */
export const OG_CANVAS_WIDTH = 2000;
export const OG_CANVAS_HEIGHT = 1500;

/** Left hero column in the article layout. */
export const OG_HERO_HEIGHT = 760;
export const OG_HERO_WIDTH_RATIO = 0.41;
export const OG_HERO_WIDTH = Math.round(OG_CANVAS_WIDTH * OG_HERO_WIDTH_RATIO);

/**
 * fal aspect_ratio for generated hero photos.
 * Hero slot is ~820×760 (≈1.08:1); 1:1 is the closest supported ratio.
 */
export const OG_HERO_ASPECT_RATIO = "1:1" as const;
