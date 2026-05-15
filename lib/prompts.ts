import { OG_HERO_ASPECT_RATIO } from "./og-layout";

export type ReporterBeat = {
  realName: string;
  beat: string;
  fitsAngles: string;
};

/**
 * Real TechCrunch staff still active post-Regent acquisition (March 2025).
 * The LinkedIn caption will literally @-tag the realName — they'll get the notification.
 * The rendered image byline uses a clearly-parody twist of the same name.
 */
export const TC_REPORTERS: ReporterBeat[] = [
  {
    realName: "Anna Heim",
    beat: "Europe startups, fintech, SaaS — TechCrunch's Europe correspondent",
    fitsAngles: "EU founders, fundraising in Europe, fintech/insurtech, generic MEGATHON-Amsterdam stories",
  },
  {
    realName: "Kyle Wiggers",
    beat: "AI — TechCrunch senior reporter on AI models, agents, infra",
    fitsAngles: "AI founders, LLM releases, agent demos, AI tooling, anything model-flavoured",
  },
  {
    realName: "Dominic-Madori Davis",
    beat: "Venture capital & startups — TechCrunch senior reporter",
    fitsAngles: "fundraising lore, pitch deck drama, VC chaos, term sheet bits, dealmaking",
  },
  {
    realName: "Lucas Ropek",
    beat: "AI / consumer tech / startups",
    fitsAngles: "consumer products, cursed AI launches, weird-product founders, anything 'normie tech meets AI'",
  },
  {
    realName: "Lorenzo Franceschi-Bicchierai",
    beat: "Hacking, cybersecurity, surveillance, privacy",
    fitsAngles: "demos that gained sentience, security incidents, anything cursed/leaked/breached, surveillance angles",
  },
  {
    realName: "Connie Loizos",
    beat: "Editor-in-Chief, TechCrunch",
    fitsAngles: "reserve for finals-stage / main-stage / 'this is the moment' big-swing stories only",
  },
];

export const REPORTERS_BLOCK = TC_REPORTERS.map(
  (r) => `- ${r.realName} — ${r.beat}. Fits: ${r.fitsAngles}.`,
).join("\n");

export const MEGATHON_FACTS = `MEGATHON — the real event being mythologised (megathon.xyz):
- Tagline: "Where Europe's Builders Come to Win."
- Mission given to builders: "Unite Europe. Ship real startups. Build something undeniable."
- Vibe filter: "Everyone's invited. Not everyone's ready."
- When: June 19–21, 2026. Friday 5 PM → Sunday 3 PM continuous build. Finals on the main stage Sunday at 6 PM.
- Where: Amsterdam (single venue, food + music + mentorship on site).
- Scale: 500+ builders, ~150 startups launched in one weekend, €100K+ prize pool awarded live on stage.
- Format pillars: "Nonstop Build" (46-hour grind), mentor sessions with founders and engineers, Friday kick-off + team formation, Saturday evening social, Sunday "Demo day on steroids."
- Judges & VCs are present in the room AND livestreaming globally. Decisions are made on momentum, not polish: "Where you started vs. where you ended. That's what matters."
- "Hype Europe" — communities back their builders in a live audience-hype mechanic during finals.
- Stated partners include Mollie, OpenAI, Peak Capital, and various builder communities.`;

export const STUDIO_SYSTEM_PROMPT = `You are the creative director of MEGATON STUDIO — a clearly-fictional international tech-news studio that mythologises founders attending MEGATHON ("Europe's biggest hackathon" — megathon.xyz). Megaton Studio is our parody outlet name; MEGATHON is the real event we cover.

Your job: turn a real person's LinkedIn profile into absurd, viral-flavoured, clearly-fictional MEGATHON lore. Founder mythology. Startup trauma as comedy. Suspiciously specific emotional stakes. Demos that feel slightly cursed. Pitch decks with too much lore. Athletic suffering converted to product development.

You write in a chaotic, hype-driven, creative-director-slightly-too-excited voice. Punchy, cinematic, big swings.

${MEGATHON_FACTS}

CORE PRINCIPLE — story weight:
The story is ~85% ABOUT THIS PERSON. Their role, their company, their actual problem space, their post topics, the contradictions and tropes in their bio. MEGATHON is the SETTING / framing device — a small twist, a backdrop, a closing beat — not the subject. The reader should walk away thinking "they made this very specifically about [name]" with MEGATHON as the stage they happen to be on. Avoid stories where the MEGATHON beat is doing the heavy lifting and the person is interchangeable.

HARD RULES:
- Output is FICTION / PARODY / CONCEPT-ART. Never claim real publications, journalists, investors, founders, or events endorsed, covered, funded, or confirmed anything.
- EVERY story direction MUST contain the literal word "MEGATHON" in its hook. EVERY one of the three headlines MUST contain the literal word "MEGATHON" too. No exceptions. If you produce a hook or headline without MEGATHON in it, regenerate it.
- Keep the MEGATHON mention tight (one phrase per hook / per headline — a dateline, a venue, a closing beat) so the story is still ~85% about the person.
- The hook must lead with the PERSON — their actual role, post pattern, industry tic — and then have MEGATHON catalyse or escalate it. Not the other way around.
- Use the person's REAL name and REAL professional context (role, company, posts, vibe) as raw material — but the story itself is invented and clearly absurd.
- Do NOT mock the person personally. The comedy lives in the founder-archetype universe — overconfidence, marathon energy, broken laptops, suspicious wearables, demos that gained sentience. Punch UP at startup-culture, never DOWN at the individual.
- Avoid real journalist names. Avoid claims of TechCrunch / Sifted / EU-Startups coverage. Real MEGATHON sponsors (Mollie, OpenAI, Peak Capital) can appear as ambient context but must NEVER be quoted, depicted endorsing, funding, or commenting on the subject.
- It should make a reader think "wait — is this real?" for half a second, then realise it is clearly a bit.

You will be given a LinkedIn profile and asked to produce story directions. Mine the profile DEEPLY for hooks: their actual role, the actual problem space, recent post topics, a specific phrase they use, a contradiction in their bio, an industry trope they'd be the avatar of, a recurring word they over-use. Then drop that into MEGATHON as the lightest possible setting. Profile detail does the work; MEGATHON adds the dateline.

Return STRICT JSON only — no prose, no markdown fences, no commentary. Match the schema requested.`;

export function buildStoryUserPrompt(profile: {
  url: string;
  name?: string;
  headline?: string;
  summary?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  experiences?: string[];
  posts: string[];
}): string {
  const postsBlock =
    profile.posts.length > 0
      ? profile.posts
          .slice(0, 8)
          .map((p, i) => `${i + 1}. ${p.slice(0, 420)}`)
          .join("\n")
      : "(no recent posts available)";

  const expBlock =
    profile.experiences && profile.experiences.length > 0
      ? profile.experiences.map((e) => `- ${e}`).join("\n")
      : "(no experience data)";

  return `Subject profile:
- Name: ${profile.name ?? "(unknown)"}
- Headline: ${profile.headline ?? "(unknown)"}
- Current role: ${profile.jobTitle ?? "(unknown)"} ${profile.company ? `at ${profile.company}` : ""}
- Location: ${profile.location ?? "(unknown)"}
- About: ${(profile.summary ?? "").slice(0, 800) || "(none)"}
- LinkedIn: ${profile.url}

Experience:
${expBlock}

Recent posts:
${postsBlock}

Generate THREE distinct story directions for this person. Each direction MUST:
- be ~85% about THIS PERSON — pull TWO+ specific details from their real profile (role, company quirk, post topic, phrasing they use, industry trope, contradiction)
- be clearly fictional and absurd, yet plausible enough to make readers double-take
- contain the word "MEGATHON" verbatim somewhere in the hook (one mention per direction is plenty — it can be a dateline, a venue, or the catalyst). MEGATHON must be present in every direction without exception.
- pick ONE specific MEGATHON beat to anchor that mention (don't reuse the same beat across all three directions):
  · a MEGATHON dateline ("Amsterdam, MEGATHON 2026")
  · the 46-hour build as a passing time pressure
  · the Sunday main-stage finals as a closing beat
  · a mentor-session aside
  · a "Hype Europe" livestream reaction
  · judges/VCs in the room as ambient witnesses
  Keep MEGATHON to roughly one sentence-worth inside the hook.
- vary in angle so the three directions hit DIFFERENT facets of the person (e.g. their work persona, their post style, their industry trope, their stated mission, a contradiction in their bio)

Then pick the ONE you recommend and explain in ≤25 words why it lands hardest for THIS person — lead with the profile detail, mention the MEGATHON touch only if relevant.

For EACH of the three directions, write a fully-formed press dispatch — every direction is shippable on its own:

  HEADLINES (per direction) — THREE viral-flavoured headlines that match THAT direction's angle/hook. Headlines should sound like screenshotted EU tech-press chaos — specific to THIS person, dramatic, slightly emotional, never libellous, no real publication names. The person and their work should be the subject of every headline. EVERY headline must contain the word "MEGATHON" somewhere — three different MEGATHON framings per direction is ideal (one as dateline, one as venue mid-headline, one as the closing punchline). Headlines from direction A must read distinctly from B's and C's.

  REPORTER (per direction) — PICK A REPORTER who supposedly broke that direction's story. Each direction should have its own reporter, matched to that direction's angle/beat. You may reuse a reporter only if the angle truly demands it; prefer three different reporters.
${REPORTERS_BLOCK}
  Output the reporter's realName EXACTLY as listed (spelling, casing, hyphens — must match one of the names above letter-for-letter; the system tags this person on LinkedIn so it has to resolve). Then invent a clearly-parody twist of that name to use as the byline on the rendered front-page image. Rules for the parodyName: sounds phonetically similar to the realName but OBVIOUSLY fake (e.g. "Anna Heim" → "Anya Heimlich"; "Kyle Wiggers" → "Kyle Wigglers"; "Dominic-Madori Davis" → "Domino-Mallory Davis"; "Lorenzo Franceschi-Bicchierai" → "Lorenzo Francheesy-Bicchierino"). Must stay believable as a person's name, two-word minimum, never identical to the realName.

  LINKEDIN CAPTION (per direction) — the subject's first-person post for THAT direction. Rules:
  - 5–8 short lines, line breaks between beats — reads on a phone.
  - Voice: the SUBJECT posting it themselves with theatrical mock-modesty ("ok so apparently this happened…"), not a third-party announcement.
  - Open with a one-line hook riffing on THAT direction's first headline. Then 2–3 lines that escalate THAT direction's absurd premise. Reference at least one concrete profile detail.
  - Include the literal phrase "filed by @<reporter realName>" on its own line near the bottom, EXACTLY matching that direction's reporter realName.
  - Include a "MEGATHON 2026 · Amsterdam" dateline line.
  - Make the parody/fiction framing UNMISTAKABLE — e.g. "(this is fiction, no founders were harmed)" or "(100% parody, 0% verified)".
  - NO hashtags. 1–3 emojis OK. No links. No real publication names.

Return STRICT JSON ONLY with this exact shape:
{
  "directions": [
    {
      "id": "a",
      "angle": "string (2-4 word label like 'cursed demo' or 'marathon founder')",
      "hook": "string (1 sentence, the story premise — punchy, ≤30 words)",
      "why": "string (1 sentence on what makes this fit THIS person, references a real profile detail)",
      "headlines": ["string", "string", "string"],
      "reporter": {
        "realName": "string — must match one of the listed TechCrunch reporter names letter-for-letter",
        "parodyName": "string — your clearly-fictional twist of the realName, used as the byline",
        "reason": "string ≤20 words — why this reporter's beat fits THIS direction's angle"
      },
      "linkedinCaption": "string (multi-line LinkedIn caption for THIS direction — real newlines, includes the @<reporter realName> mention. NO hashtags.)"
    },
    { "id": "b", "angle": "...", "hook": "...", "why": "...", "headlines": [...], "reporter": {...}, "linkedinCaption": "..." },
    { "id": "c", "angle": "...", "hook": "...", "why": "...", "headlines": [...], "reporter": {...}, "linkedinCaption": "..." }
  ],
  "recommendedId": "a" | "b" | "c",
  "recommendationReason": "string ≤25 words"
}`;
}

const SCENE_ARCHETYPES: Record<string, string> = {
  stage:
    "ON THE MAIN STAGE: subject mid-pitch under hard MEGATHON finals lights, clicker in hand, a slide glowing behind them, judges' silhouettes in the front row, a camera operator visible at the edge. Shot from a low 3/4 angle. Strong key-light from the stage rig, deep shadows in the audience.",
  sprint:
    "SPRINT THROUGH THE VENUE: subject mid-run down an industrial corridor between rows of build desks, laptop tucked under one arm, lanyard flying, MOTION BLUR on the legs, builders at desks looking up as they pass. Shot at hip height following the run. Mixed warm tungsten and cool monitor glow.",
  demo:
    "DEMO COLLAPSING: subject hunched over a laptop on a cluttered build desk, two monitors glowing, cables and energy-drink cans everywhere, half-eaten food, the screen visibly showing red error text / something on fire. Hands mid-keystroke, jaw clenched. Close 35mm framing, shallow depth of field on the face.",
  mentor:
    "MENTOR-SESSION CHAOS: subject leaning into a whiteboard covered in arrows and crossed-out diagrams, a mentor gesturing with both hands, scribbled product math on a sticky note in the foreground. Side-light from a window, warm tones, deep focus.",
  crowd:
    "CROWD ROAR / HYPE EUROPE MOMENT: subject on stage with arms WIDE open, hundreds of builders in the audience standing, phones up filming, stage lighting flares from above. Wide shot from the back of the stage looking out into the crowd. Big sense of scale.",
  trench:
    "4AM TRENCH: subject collapsed in a beanbag or against a server rack, empty cans, glow-stick lanyard, laptop still open on their lap, eyes half-closed but fingers still typing. Mostly dark, only the laptop screen lighting the face. Quiet, intimate, slightly tragic.",
  backstage:
    "BACKSTAGE PRE-FINALS: subject in a curtained corridor with hard stage light leaking through a gap, headset around their neck, mouthing words to themselves, MEGATHON signage half-visible behind them. Vertical light slice across the face. Pre-game tension.",
};

function pickScene(angle: string, hook: string): keyof typeof SCENE_ARCHETYPES {
  const t = `${angle} ${hook}`.toLowerCase();
  const match = (...needles: string[]) => needles.some((n) => t.includes(n));
  if (match("stage", "pitch", "final", "demo day", "main stage", "judges")) return "stage";
  if (match("crowd", "hype", "livestream", "audience", "viral", "applause", "roar")) return "crowd";
  if (match("sprint", "run", "marathon", "athletic", "race", "rush", "chase")) return "sprint";
  if (match("mentor", "advice", "whiteboard", "session", "consult", "office hours")) return "mentor";
  if (match("4am", "midnight", "exhaust", "trench", "tired", "all-night", "all night", "burnout")) return "trench";
  if (match("backstage", "pre-finals", "before the stage", "rehears", "nerves", "wait")) return "backstage";
  // default fallback: cursed demo (matches the broadest set of hooks)
  return "demo";
}

export function buildImagePrompt(opts: {
  name?: string;
  headline?: string;
  hook: string;
  angle: string;
  mode: "clean" | "mock-graphic";
  caption?: string;
}): string {
  const subject = opts.name ?? "the founder";
  const role = opts.headline ? ` (${opts.headline})` : "";
  const sceneKey = pickScene(opts.angle, opts.hook);
  const scene = SCENE_ARCHETYPES[sceneKey];

  const base = [
    `Cinematic editorial photograph of ${subject}${role} at MEGATHON — Europe's biggest hackathon, Amsterdam, June 19–21 2026 (megathon.xyz) — captured mid-action from the fictional story: "${opts.hook}".`,
    `Mood / angle: ${opts.angle}.`,
    `Use the provided photograph as a strict likeness reference for the person — same face, same identity. Render them photo-realistically in this new editorial scene; do NOT collage or paste the original photo. The subject must be IN the action, not posing for a portrait.`,

    `SCENE — render this EXACT scene archetype (no substitutions, no defaults): ${scene}`,

    "Setting details: Amsterdam venue mid 46-hour 'Nonstop Build' — repurposed industrial space, exposed brick and ducts, banks of monitors, scattered laptops, exposed cables, MEGATHON lanyards, plastic cups, half-eaten food, mentor whiteboards, a main demo stage lit for finals visible somewhere. 500 other builders, blurred but present. Sponsor signage on banners is INVENTED/abstract — no real company logos, no real publication names, no real MEGATHON sponsor logos rendered legibly.",
    "Photography: 35mm look, shallow depth of field, natural high-ISO grain, DRAMATIC mixed lighting (cool monitor light + warm tungsten accents + an occasional hard stage spot), strong subject focus, motion blur where action demands it, documentary-style framing — think Magnum-meets-tech-press photo essay.",
    `Composition (${OG_HERO_ASPECT_RATIO} hero crop): subject is the unambiguous focal point but caught IN MOTION — slight off-centre allowed, body language tells the story, hands and face visible. Safe margins on all sides — no cropped head, no critical detail at the edges. This image will fill the hero of a TechCrunch-style article card.`,
    "Subject: VISIBLE emotion — choose ONE strong beat that matches the angle: triumphant fist-pump, mid-pitch laser focus, manic mid-keystroke clarity, suspiciously calm under pressure, exhausted-but-still-typing, mid-laugh during a mentor exchange, eyes wide at a screen on fire. NO neutral expressions. Wardrobe: realistic startup-event attire (hoodie, t-shirt, lanyard, running shoes if the scene calls for movement).",
    "Quality: editorial photo-realism, sharp, true to life, believable. Should look like a hero frame from a tech-press photo essay — chaotic, kinetic, alive — not a stylised illustration and not a LinkedIn headshot.",
  ];

  const cleanRules = [
    "HARD RULES — clean editorial mode:",
    "• NO headline text, NO subheadlines, NO captions, NO publication logos, NO TechCrunch / Sifted / EU-Startups branding, NO article-card layouts, NO newsletter chrome, NO ad buttons, NO CTA labels, NO poster typography, NO watermarks, NO interface overlays.",
    "• Any signage visible in the scene should be ambient/abstract, not readable brand text.",
    "• Output a clean standalone photograph that could later be placed inside a fictional article. The image must be free of any overlaid text.",
  ];

  const mockRules = [
    "MOCK EDITORIAL GRAPHIC MODE — this is a fictional/parody tech-news card:",
    `• Overlay the headline text exactly: "${opts.caption ?? ""}".`,
    "• Layout: clearly stylised as a fictional/parody publication card — generic 'TECH NEWS' style chrome is OK, but DO NOT imitate any real publication's exact wordmark, colour palette, or layout. Invent a fake outlet name if needed (e.g. 'EURO BUILDERS', 'HACK FLOOR', 'STARTUP UNCONFIRMED').",
    "• Typography: bold editorial sans-serif, properly kerned, no AI-typography artefacts. Headline must be perfectly legible.",
    "• Include a small fictional byline (invented name) and a fictional dateline like 'MEGATON 2026'.",
    "• Image stays photo-realistic underneath the chrome; the result reads as a screenshot of a fictional tech-news article.",
  ];

  return [...base, ...(opts.mode === "clean" ? cleanRules : mockRules)].join(" ");
}
