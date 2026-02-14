# Remediate Codebase Review Findings (Geometry, Testing, Hygiene)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

This plan resolves the six findings from the latest repository review so the app is safer to evolve: opening geometry will remain valid on all walls, test runs will be deterministic and fresh, critical interaction logic will gain automated coverage, build-time SEO asset generation will stop causing churn, dead component paths will be removed, and duplicated geometry helpers will be centralized.

After this work, users should see no regression in room editing behavior, and contributors should see cleaner diffs plus stronger safety rails from tests.

## Progress

- [x] (2026-02-14 10:39Z) Created ExecPlan and mapped review findings to concrete implementation tasks.
- [x] (2026-02-14 10:44Z) Implemented opening-geometry normalization fix and added regression tests for oversized openings on short walls.
- [x] (2026-02-14 10:44Z) Updated test command to clean `.test-dist` before compilation.
- [x] (2026-02-14 10:44Z) Expanded automated interaction coverage by extracting and testing keyboard + measure-editing logic.
- [x] (2026-02-14 10:44Z) Made SEO asset generation deterministic and write-only-on-change.
- [x] (2026-02-14 10:44Z) Removed dead/unwired components and aligned architecture documentation references.
- [x] (2026-02-14 10:44Z) Centralized geometry helpers and removed duplicated local implementations.
- [x] (2026-02-14 10:45Z) Ran validation commands (`npm run test`, `npm run lint`, `npm run build`) and recorded evidence.
- [x] (2026-02-14 10:45Z) Verified deterministic SEO generation behavior with a second `npm run seo:assets` run (`No asset changes`).
- [x] (2026-02-14 10:45Z) Moved ExecPlan to `docs/exec-plans/completed/` with final retrospective.

## Surprises & Discoveries

- Observation: The Node test environment has no `HTMLElement`, so keyboard target guards must be defensive to stay testable.
  Evidence: Added an environment guard in `src/utils/keyboardShortcuts.ts` before `instanceof HTMLElement`.

## Decision Log

- Decision: Implement all six findings in a single bounded remediation pass instead of separate plans.
  Rationale: Findings are tightly related and can be validated together with one full quality-gate run.
  Date/Author: 2026-02-14 / Codex

- Decision: Prefer extraction of pure logic into `src/utils` for interaction test coverage rather than adding a new browser/component test stack.
  Rationale: This repo already has a stable Node test harness for utilities; extracting interaction-critical logic gives immediate regression protection without introducing heavy tooling churn.
  Date/Author: 2026-02-14 / Codex

- Decision: Remove `lastmod` from generated sitemap output and write SEO files only when content changes.
  Rationale: This removes day-to-day build churn while preserving crawl metadata quality and reproducibility.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

All six review findings are resolved in code and validated. Opening normalization now enforces wall-length bounds, test runs are cleaned before compile, interaction-critical logic is extracted and covered by new utility tests, SEO generation is deterministic and write-only-on-change, dead component paths were removed, and duplicated geometry helpers were centralized.

No user-facing regressions were observed in automated checks, and the build pipeline now avoids date-based sitemap churn. Remaining debt from the broader tracker still exists (notably large orchestrator modules and limited browser-level integration coverage), but this plan’s scoped remediation goal is complete.

## Context and Orientation

`src/App.tsx` orchestrates workspace state, keyboard shortcuts, measure editing, persistence, and export. `src/components/RoomCanvas.tsx` drives pointer-heavy canvas interaction and wall/opening rendering. Geometry and persistence normalization are in `src/utils/openings.ts` and `src/utils/workspaceState.ts`.

Current tests run from `tests/*.ts` compiled into `.test-dist` via `tsconfig.test.json`. Build currently regenerates `public/robots.txt`, `public/sitemap.xml`, and `public/llms.txt` during `prebuild` using `scripts/generate-seo-assets.mjs`.

This plan removed two previously unwired components (`src/components/AddObjectPanel.tsx` and `src/components/RoomOnboardingPanel.tsx`) to reduce dead maintenance surface.

## Plan of Work

First, fix opening normalization so opening span width cannot exceed the length of the wall it is attached to. Add tests proving this for both direct normalization and workspace sanitization.

Second, make test runs clean `.test-dist` before recompiling, removing stale-test risk.

Third, extract interaction-critical pure logic from `App.tsx` into `src/utils` modules (keyboard delete gating and measure-length editing math), wire `App.tsx` to use these helpers, and add focused tests.

Fourth, make SEO asset generation deterministic by removing date volatility and writing files only when content changes.

Fifth, remove dead components and update agent-facing docs that referenced them.

Sixth, introduce a shared geometry utility module and refactor duplicate local helpers in `App.tsx`, `RoomCanvas.tsx`, and `workspaceState.ts` to use it.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation and validation commands:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Acceptance criteria:

1. Oversized openings no longer produce out-of-bounds spans on short walls; tests cover this behavior.
2. `npm run test` always starts from a clean `.test-dist`.
3. Interaction-critical helper logic used by `App.tsx` has dedicated automated tests.
4. Re-running `npm run build` does not produce date-only SEO asset diffs.
5. Dead components are removed and references are aligned.
6. Geometry helper duplication in `App.tsx` and `RoomCanvas.tsx` is removed in favor of shared utilities.
7. `npm run test`, `npm run lint`, and `npm run build` pass.

## Idempotence and Recovery

All changes are additive or safe deletions of unreferenced files. Commands are repeatable. If any step causes a regression, revert the most recent file-level change and rerun the full validation suite.

## Artifacts and Notes

Validation transcript summary:

    npm run test
    # tests 9
    # pass 9
    # fail 0

    npm run lint
    eslint .

    npm run build
    [seo] Updated sitemap.xml for https://bedroomlayout.app
    vite v7.2.6 ... ✓ built

Determinism check:

    npm run seo:assets
    [seo] No asset changes for https://bedroomlayout.app

Touched implementation files:

    src/utils/geometry.ts
    src/utils/measureEditing.ts
    src/utils/keyboardShortcuts.ts
    src/utils/openings.ts
    src/utils/roomCanvasMath.ts
    src/utils/workspaceState.ts
    src/components/RoomCanvas.tsx
    src/App.tsx
    scripts/generate-seo-assets.mjs
    package.json
    ARCHITECTURE.md
    tests/openings.test.ts
    tests/measureEditing.test.ts
    tests/keyboardShortcuts.test.ts

## Interfaces and Dependencies

New/updated interfaces expected after completion:

- `src/utils/geometry.ts`
  - `clamp(value: number, min: number, max: number): number`
  - `getBoundingBox(w: number, h: number, rotation?: number): { width: number; height: number }`

- `src/utils/measureEditing.ts`
  - `getMeasureLengthCm(...)`
  - `resizeMeasureToLengthInRoom(...)`
  - formatting helpers for measure input behavior

- `src/utils/keyboardShortcuts.ts`
  - delete shortcut gating helpers used by `App.tsx`

Revision Note (2026-02-14 / Codex): Created this ExecPlan to implement all six findings from the latest codebase review in a single validated pass.
Revision Note (2026-02-14 / Codex): Updated progress/outcomes/artifacts after implementation and validation so the plan can be completed and archived.
