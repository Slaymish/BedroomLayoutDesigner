# Reduce Landing "Producty" Feel with CTA-First Entry (US-013)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, a first-time visitor opening `/` will initially see only one clear action: a button that opens the planner. Product explanation content still exists, but it is below the first viewport so people who want details can scroll for it.

This directly addresses feedback that the current landing page feels too much like a sales page. The observable outcome is simple: load `/`, see a single primary planner button on first paint, then scroll to reach details (capabilities, comparison, FAQ).

## Progress

- [x] (2026-02-15 08:03Z) Reviewed `PLANS.md`, `US-013` backlog entry, and current landing implementation in `src/components/LandingPage.tsx`, `src/components/LandingPage.css`, and `src/main.tsx`.
- [x] (2026-02-15 08:05Z) Marked `US-013` status as `in_progress` in `docs/user-story-workflow/backlog.json`.
- [x] (2026-02-15 08:05Z) Implemented CTA-first landing layout in `src/components/LandingPage.tsx` with a single full-viewport launch button and below-fold detail sections.
- [x] (2026-02-15 08:05Z) Updated `src/components/LandingPage.css` so first viewport contains only the planner CTA and detail sections begin below the fold.
- [x] (2026-02-15 08:06Z) Ran validation commands (`npm run test`, `npm run lint`, `npm run build`) successfully.
- [x] (2026-02-15 08:06Z) Marked `US-013` as `done` in `docs/user-story-workflow/backlog.json` and finalized this ExecPlan.

## Surprises & Discoveries

- Observation: The current landing page has multiple above-the-fold elements (sticky header, hero copy, two CTA controls, and proof bullets), which conflicts with the requested CTA-only first impression.
  Evidence: `src/components/LandingPage.tsx` currently renders `landing-header` and `landing-hero` before all detail sections.

- Observation: Removing the visible `h1` from the first viewport requires an accessibility fallback so page structure remains semantically valid.
  Evidence: Added `landing-sr-only` class and hidden `h1` in `src/components/LandingPage.tsx`.

- Observation: Build validation still triggers SEO asset generation as a prebuild step; no crawler asset updates were needed for this UX-only change.
  Evidence: `npm run build` output included `[seo] No asset changes for https://bedroomlayout.app`.

## Decision Log

- Decision: Keep route structure (`/` landing and `/app` planner) unchanged and only change landing composition.
  Rationale: The request is about first-impression UX, not navigation or app architecture.
  Date/Author: 2026-02-15 / Codex

- Decision: Preserve detailed informational sections below the fold instead of deleting them.
  Rationale: Feedback asked for progressive disclosure (CTA first, more info on scroll), not removal of information.
  Date/Author: 2026-02-15 / Codex

- Decision: Replace header and hero CTA placements with a single `launchpad` placement for analytics.
  Rationale: The first-screen design now has one primary CTA; tracking should reflect that exact interaction location.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

Outcome: `US-013` is completed and the landing page now follows a progressive disclosure flow.

What changed:

- First viewport on `/` is now a full-height launch section with one planner CTA.
- Header/hero marketing density was removed from the initial view.
- Capability/comparison/FAQ content remains available below the fold for users who scroll.

Validation status:

- `npm run test`: pass (10/10).
- `npm run lint`: pass.
- `npm run build`: pass.

Remaining work:

- Manual visual sign-off in a browser is still recommended to confirm the first viewport feels correct across device sizes.

## Context and Orientation

The landing page is rendered from `src/main.tsx` when the resolved route is `landing`. `src/components/LandingPage.tsx` defines landing markup and CTA click placements for analytics. `src/components/LandingPage.css` controls layout and determines whether content appears above or below the first viewport.

`US-013` in `docs/user-story-workflow/backlog.json` was created from flatmate feedback requesting a less sales-like first impression. The user-visible interpretation used in this plan is: first viewport should show only a single action button that opens `/app`; explanatory content is available after scrolling.

## Plan of Work

This implementation will be done in one focused UI slice:

1. Update story lifecycle state in `docs/user-story-workflow/backlog.json` to reflect active work.
2. Refactor `LandingPage` structure in `src/components/LandingPage.tsx`:
   - remove sticky header and dense hero content from the initial viewport,
   - add a full-viewport launch section containing only the planner CTA button,
   - keep feature/comparison/FAQ sections below that launch section.
3. Rework `src/components/LandingPage.css` to enforce the CTA-first viewport and preserve readable detail sections below fold.
4. Keep analytics wiring in `src/main.tsx` intact by updating CTA placement types if needed.
5. Run test/lint/build quality gates.
6. Mark story status to `done` and update this ExecPlan with final evidence.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Planned command sequence:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test
    npm run lint
    npm run build

The file-edit sequence is:

1. `docs/user-story-workflow/backlog.json` (`US-013` status update).
2. `src/components/LandingPage.tsx` (layout restructuring + CTA placement literal updates).
3. `src/components/LandingPage.css` (viewport/layout styling updates).
4. `src/main.tsx` (type compatibility updates if placement union changes).

## Validation and Acceptance

Manual acceptance:

1. Run `npm run dev`.
2. Open `http://localhost:5173/`.
3. Confirm the first viewport initially shows only a planner CTA button.
4. Scroll down and confirm details remain available (feature/capability info, comparison, FAQ).
5. Click the CTA and confirm navigation to `/app`.

Automated acceptance:

- `npm run test` passes.
- `npm run lint` passes.
- `npm run build` passes.

Behavioral acceptance criteria for US-013:

- Initial landing view is intentionally minimal and action-first.
- Additional context is progressively disclosed by scrolling.
- Planner entry path remains one click from `/`.

## Idempotence and Recovery

These edits are additive and safe to reapply. If the new layout unintentionally hides detail sections, recover by reverting only `src/components/LandingPage.tsx` and `src/components/LandingPage.css` and reapplying smaller, testable changes.

If CTA tracking types mismatch after refactor, update only the placement union in `LandingPage.tsx` and corresponding handler typing in `src/main.tsx` without changing analytics event names.

## Artifacts and Notes

Planned evidence to capture after implementation:

- Diff snippets for `src/components/LandingPage.tsx` and `src/components/LandingPage.css` showing CTA-first structure.
- Quality-gate transcript summary (`test`, `lint`, `build`).

Validation transcript summary:

    npm run test
    # tests 10
    # pass 10
    # fail 0

    npm run lint
    eslint .

    npm run build
    [seo] No asset changes for https://bedroomlayout.app
    vite v7.2.6 building client environment for production...
    ✓ built in 4.35s

## Interfaces and Dependencies

No new dependencies are required.

Interface updates expected:

- `src/components/LandingPage.tsx` exports:

      type LandingCtaPlacement = 'launchpad' | 'comparison'

  (Exact literals may vary if we retain existing placement naming, but the CTA-first button must be tracked consistently.)

Revision Note (2026-02-15 / Codex): Created this ExecPlan to implement `US-013` feedback requesting a CTA-first landing experience with details available on scroll.
Revision Note (2026-02-15 / Codex): Updated progress after implementing CTA-first landing structure and noted accessibility/analytics decisions before validation.
Revision Note (2026-02-15 / Codex): Finalized the plan after passing quality gates and marking `US-013` done.
