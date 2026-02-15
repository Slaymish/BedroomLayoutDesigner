# Dedicated Landing Page with FAQ and Comparison Matrices (US-011)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, visitors who land on `https://bedroomlayout.app/` will see a focused marketing page that explains what the tool does, who it is best for, and why to choose it over alternatives. The page will include a factual FAQ and a comparison matrix, then send users into the planner in one click.

Today, the planner UI is the default landing experience, which is weaker for first-time conversion and for search intent like "bedroom layout planner". This change creates a search-oriented entry point while preserving the existing planner experience at a dedicated route.

You can observe success by running the app, opening `/`, seeing the landing content sections and call-to-action (CTA means the primary action button that starts planning), then opening `/app` and using the existing planner as before.

## Progress

- [x] (2026-02-15 00:20Z) Reviewed `PLANS.md`, current routing/bootstrap (`src/main.tsx`), planner orchestration (`src/App.tsx`), and SEO asset generation (`scripts/generate-seo-assets.mjs`).
- [x] (2026-02-15 00:23Z) Moved `US-011` status from `backlog` to `ready` in `docs/user-story-workflow/backlog.json`.
- [x] (2026-02-15 00:28Z) Authored this implementation ExecPlan in `docs/exec-plans/us-011-dedicated-landing-page.md`.
- [x] (2026-02-15 00:41Z) Implemented Milestone 1: added route split in `src/main.tsx` and created `src/components/LandingPage.tsx` + `src/components/LandingPage.css`.
- [x] (2026-02-15 00:44Z) Implemented Milestone 2: added structured content in `src/content/landingContent.ts` and wired FAQ/comparison rendering from data.
- [x] (2026-02-15 00:47Z) Implemented Milestone 3: added route-aware metadata/schema updates and expanded generated sitemap/llms assets to include `/app`.
- [x] (2026-02-15 00:54Z) Implemented Milestone 4: added landing CTA analytics hooks, updated `ARCHITECTURE.md`, and ran full validation (`npm run test`, `npm run lint`, `npm run build`).
- [x] (2026-02-15 00:56Z) Updated `US-011` story status from `ready` to `in_progress` while review/sign-off is pending.

## Surprises & Discoveries

- Observation: Canonical URL is currently forced to `/` for every route by runtime code.
  Evidence: `src/main.tsx` sets canonical and `og:url` to `new URL('/', CANONICAL_ORIGIN)` regardless of pathname.

- Observation: Current sitemap generation exposes only the homepage URL.
  Evidence: `scripts/generate-seo-assets.mjs` outputs one `<url>` entry (`<loc>${siteOrigin}/</loc>`).

- Observation: The app currently has no route switch abstraction; `App` is always rendered.
  Evidence: `src/main.tsx` renders only `<App />` and no path-based component selection.

- Observation: Reusing the planner button style classes (`ui-btn`) on the landing page required no style duplication because `App.tsx` imports `App.css` at module load time.
  Evidence: Landing CTA buttons render with shared button tokens/classes without moving stylesheet imports.

- Observation: Generating route-specific JSON-LD is easiest by updating one script tag in place.
  Evidence: Adding `id="route-structured-data"` in `index.html` allowed `src/main.tsx` to replace schema content per route without duplicate script blocks.

## Decision Log

- Decision: Keep dependencies unchanged and implement pathname-based route selection without adding React Router.
  Rationale: This project is currently lightweight and static-hosted; a simple route switch minimizes scope and regression risk.
  Date/Author: 2026-02-15 / Codex

- Decision: Preserve existing planner implementation in `src/App.tsx` and introduce a separate landing page component.
  Rationale: US-011 is a discovery/conversion feature, not a planner refactor; this keeps delivery targeted.
  Date/Author: 2026-02-15 / Codex

- Decision: Keep account-free sharing out of this plan and leave it to `US-012`.
  Rationale: Isolating scope prevents coupling landing-page delivery to new state-sharing mechanics.
  Date/Author: 2026-02-15 / Codex

- Decision: Use full-page navigation (`window.location.assign('/app')`) for CTA transitions instead of client-side history patching.
  Rationale: It is deterministic in static hosting environments and keeps route rendering simple while still allowing click-event analytics capture.
  Date/Author: 2026-02-15 / Codex

- Decision: Compare against tool categories ("Template Tools" and "Inspiration Articles") instead of naming specific vendors in the matrix.
  Rationale: This avoids stale competitor claims and keeps the matrix factual and maintainable.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

`US-011` is implemented in code and moved into active execution state (`in_progress`) with all planned milestones completed. The app now has:

- a conversion-focused landing surface at `/`,
- the planner at `/app`,
- data-driven FAQ/comparison sections,
- route-aware metadata and structured data,
- generated crawl assets that include both `/` and `/app`,
- and CTA analytics hooks for measurable conversion events.

Automated quality gates are green (`test`, `lint`, `build`). Manual browser walkthrough is still recommended for final product sign-off (copy quality, CTA feel, and responsive layout polish).

## Context and Orientation

The app is a browser-only React + TypeScript single-page application. `src/App.tsx` is the planner and state orchestrator. `src/main.tsx` now bootstraps rendering for both `/` (landing) and `/app` (planner). Search-facing metadata is primarily in `index.html`, with crawler files generated by `scripts/generate-seo-assets.mjs` into `public/robots.txt`, `public/sitemap.xml`, and `public/llms.txt`.

Key files you will edit in this plan:

- `src/main.tsx`: route-based root rendering and route-specific metadata updates.
- `src/App.tsx`: planner remains intact, with optional small navigation hooks back to landing.
- `src/index.css` and/or `src/App.css`: landing page styling tokens/components.
- `src/components/LandingPage.tsx` (new): landing page UI and section rendering.
- `src/content/landingContent.ts` (new): source-of-truth copy for FAQ items, feature rows, and comparison data.
- `index.html`: default metadata baseline and schema adjustments to support landing-first intent.
- `scripts/generate-seo-assets.mjs`: sitemap/llms updates for multi-route discoverability.
- `ARCHITECTURE.md`: update the code map to include the landing-route component and content module.

Terms used in this plan:

- CTA (call to action): the primary UI action that moves the user into the planner, for example a "Start Planning" button.
- Comparison matrix: a grid comparing this app and alternatives across factual capabilities.
- FAQ schema: structured metadata (`FAQPage`) that matches visible FAQ content.

## Plan of Work

Milestone 1 introduces route separation. Add a landing page component and render it when `window.location.pathname` is `/`. Render the existing planner when pathname is `/app`. Include a safe fallback so unknown paths render landing content and present a clear route into `/app`.

Milestone 2 builds content from data, not hardcoded JSX fragments. Create a `landingContent` module containing hero copy, proof bullets, FAQ entries, and comparison rows. Render these structures into semantically meaningful HTML sections (`section`, `h2`, list/table markup) so both users and crawlers can understand page structure.

Milestone 3 aligns metadata and crawler assets with the split routes. Update runtime metadata handling so canonical and `og:url` match the current route. Keep landing-focused title/description for `/`, and set planner-appropriate metadata for `/app`. Extend generated sitemap and llms files to include `/app` as a discoverable route while preserving truthful copy.

Milestone 4 adds measurement and closes the documentation loop. Add analytics events for primary landing CTA clicks and FAQ/comparison interactions if event plumbing already exists. Run full quality gates, perform manual route checks, and update `ARCHITECTURE.md` plus this ExecPlan with final evidence.

## Milestones

### Milestone 1: Route split and landing shell

At the end of this milestone, the app has two user-visible surfaces: a marketing landing page at `/` and the planner at `/app`. No planner feature behavior changes.

Implementation details:

- Create `src/components/LandingPage.tsx` for landing layout and CTA controls.
- In `src/main.tsx`, add route detection using `window.location.pathname` and render either landing or planner.
- Ensure CTA navigation opens `/app` in the same tab via normal location navigation (or pushState + rerender if implemented).

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run build

Acceptance:

- `http://localhost:5173/` shows landing shell.
- `http://localhost:5173/app` shows existing planner.
- No runtime errors in browser console during route transition.

### Milestone 2: FAQ and comparison content model

At the end of this milestone, landing sections are populated by structured content arrays and are easy to maintain without deep JSX edits.

Implementation details:

- Add `src/content/landingContent.ts` with typed arrays for FAQs and matrix rows.
- Render FAQ section with readable headings and answer text that exactly matches product behavior.
- Render comparison matrix using factual, maintainable fields and short evidence-oriented wording.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run lint

Acceptance:

- FAQ and matrix sections render from `landingContent` data.
- Copy is factual, no placeholder text, no unverifiable claims.
- Primary CTA remains visible above the fold and repeated near the comparison section.

### Milestone 3: Metadata and crawler assets alignment

At the end of this milestone, route-level metadata and generated crawl assets reflect the new landing/planner split.

Implementation details:

- Update metadata logic in `src/main.tsx` so canonical and social URL tags reflect current route.
- Keep root metadata conversion-focused and landing-oriented.
- Add `/app` URL entry to generated sitemap in `scripts/generate-seo-assets.mjs`.
- Update generated llms content to mention both landing and planner routes explicitly.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run seo:assets
    npm run build

Acceptance:

- `public/sitemap.xml` includes both `/` and `/app`.
- Route-specific canonical URL is correct when visiting `/` vs `/app`.
- Metadata text remains truthful and consistent with visible content.

### Milestone 4: Measurement, validation, and docs

At the end of this milestone, landing CTA interactions are measurable, quality gates are green, and docs describe the new structure.

Implementation details:

- Add lightweight event hooks for CTA clicks using existing telemetry patterns in `App.tsx` when feasible.
- Update `ARCHITECTURE.md` code map and overview to include landing route/component and content module.
- Update this plan with completed progress, discoveries, and outcomes.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test
    npm run lint
    npm run build

Acceptance:

- All three commands pass.
- Manual walkthrough confirms landing -> planner path works and planner behavior is unchanged.
- Documentation points new contributors to landing-specific files.

## Concrete Steps

Use this sequence from repository root:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner

1. Implement route split in `src/main.tsx` and create `src/components/LandingPage.tsx`.
2. Add structured copy module `src/content/landingContent.ts` and wire sections in landing component.
3. Adjust metadata defaults in `index.html` and route-specific metadata logic in `src/main.tsx`.
4. Update `scripts/generate-seo-assets.mjs` and regenerate assets with `npm run seo:assets`.
5. Update `ARCHITECTURE.md` and this plan’s living sections.
6. Run validation commands:

    npm run test
    npm run lint
    npm run build

Expected short transcript at completion:

    npm run test
    # pass N
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite ...
    ✓ built in <time>

## Validation and Acceptance

Manual validation flow:

1. Run `npm run dev`.
2. Open `/` and verify hero, feature summary, FAQ, and comparison matrix are present.
3. Click primary CTA and verify navigation to `/app`.
4. In `/app`, create or edit a room item to confirm planner workflows still function.
5. Reload `/app` directly and confirm app still boots correctly on deep link.

Automated validation:

- `npm run test`
- `npm run lint`
- `npm run build`

Behavioral acceptance criteria:

- Landing page improves first-time clarity with factual content sections.
- Planner remains functional and reachable at `/app`.
- Search/crawler metadata and sitemap reflect the new route architecture.

## Idempotence and Recovery

All changes are additive and safe to re-run. `npm run seo:assets` is idempotent and should report no changes when rerun without content edits.

If routing changes break deep links, revert `src/main.tsx` route switch first and restore single-render `<App />`, then iterate in smaller steps.

If metadata/crawler files drift, rerun `npm run seo:assets` to regenerate canonical versions from script source.

## Artifacts and Notes

Implementation evidence:

    npm run seo:assets
    [seo] Updated sitemap.xml, llms.txt for https://bedroomlayout.app

    npm run test
    # tests 9
    # pass 9
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 3.84s

## Interfaces and Dependencies

No new package dependencies are required for US-011.

Implemented interface additions:

- `src/content/landingContent.ts` exports typed content arrays:

    export interface LandingFaqItem { question: string; answer: string }
    export interface ComparisonMatrixRow { capability: string; bedroomLayoutPlanner: string; templateTools: string; inspirationArticles: string }

- `src/components/LandingPage.tsx` exports default React component:

    export default function LandingPage(props: { onStartPlanning: (placement: 'header' | 'hero' | 'comparison') => void }): JSX.Element

- `src/main.tsx` includes route-aware metadata updater:

    setSeoForRoute(route: 'landing' | 'planner'): void

Revision Note (2026-02-15 / Codex): Created this ExecPlan after moving `US-011` to `ready`, so implementation can proceed with a self-contained, route-aware, SEO-safe plan.
Revision Note (2026-02-15 / Codex): Updated this ExecPlan after implementing all planned milestones, recording final decisions, discoveries, and validation evidence.
