# Megaton Studio (FALATHON)

LinkedIn URL → absurd, clearly-fictional Megaton hackathon founder lore + cinematic editorial image.

## Stack

- Next.js 15 + React 19 + server actions
- Apify (`harvestapi/linkedin-profile-posts`) for profile enrichment
- Anthropic (`claude-opus-4-7`) for story directions + headlines
- fal.ai (`fal-ai/gemini-3-pro-image-preview/edit`) for cinematic image gen with the LinkedIn photo as likeness reference

## Setup

```bash
cp .env.local.example .env.local
# fill in FAL_KEY, APIFY_API_TOKEN, ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>.

## Flow

1. Paste a LinkedIn profile URL
2. App scrapes name, headline, company, location, recent posts, photo
3. Claude Opus 4.7 writes 3 Megaton story directions (with a recommended pick) + 3 viral-style headlines
4. Click a direction → generate a clean cinematic editorial image (default: no text, no logos)
5. Optional: regenerate as a parody editorial graphic with the headline overlaid

Everything is framed as fictional / parody / concept-art — not real journalism.
