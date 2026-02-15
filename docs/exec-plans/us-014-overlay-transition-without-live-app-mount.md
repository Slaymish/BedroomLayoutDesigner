# Overlay Transition Without Live Planner Mount (US-014)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

The landing experience previously mounted the full planner app behind the overlay so dismissing the overlay felt instant. That approach removed visual flash but loaded heavy planner logic, autosave wiring, and localStorage work even when the user had not entered `/app`.

After this change, landing still transitions smoothly into the planner, but the planner is lazy-loaded and prewarmed rather than fully mounted behind the overlay. Users still get a no-jarring transition while landing becomes cheaper and cleaner.

## Progress

- [x] (2026-02-15 22:20Z) Audited route/overlay code paths in `src/RouteExperience.tsx`, `src/components/LandingPage.tsx`, `src/components/LandingPage.css`, and `src/App.tsx`.
- [x] (2026-02-15 22:23Z) Replaced background live planner mount with lazy-loading + preload transition in `src/RouteExperience.tsx`.
- [x] (2026-02-15 22:24Z) Added static planner preview shell and planner-open fallback/error UI in landing CSS/route composition.
- [x] (2026-02-15 22:26Z) Added overlay keyboard and focus behavior improvements (focus restore, Escape close, tab containment) in `src/components/LandingPage.tsx`.
- [x] (2026-02-15 22:28Z) Removed first-render hydration gate in `src/App.tsx` by bootstrapping workspace state from localStorage in initial state setup.
- [x] (2026-02-15 22:32Z) Ran `npm run lint`, `npm run test`, and `npm run build` successfully and captured output notes.
- [x] (2026-02-15 22:33Z) Updated architecture notes and finalized retrospective for this refactor.
- [x] (2026-02-15 22:41Z) Follow-up fix: moved `App.css` loading to `src/main.tsx` and aligned landing preview shell colors with app theme tokens to resolve odd load/background behavior.

## Surprises & Discoveries

- Observation: The visual flash risk came from two separate factors: route chunk loading and planner hydration loader behavior.
  Evidence: `src/RouteExperience.tsx` mounted `<App />` behind overlay, and `src/App.tsx` gated render behind `isHydrated`.

- Observation: `App.tsx` already had pure parse/bootstrap helpers to safely hydrate state from localStorage at startup without async effect.
  Evidence: `parseStoredWorkspaceState` in `src/utils/workspaceState.ts` is synchronous and tolerant of invalid payloads.

## Decision Log

- Decision: Keep the overlay pattern but remove background live planner mount.
  Rationale: Preserves intended user flow while eliminating unnecessary app initialization cost on `/`.
  Date/Author: 2026-02-15 / Codex

- Decision: Preload planner module while on landing and lazily mount on navigation.
  Rationale: Keeps the transition smooth without eager runtime overhead.
  Date/Author: 2026-02-15 / Codex

- Decision: Add keyboard and focus behavior to the overlay panel.
  Rationale: `role="dialog"` with `aria-modal="true"` should provide basic keyboard accessibility and focus containment.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

Outcome: Landing now keeps a smooth transition into planner without mounting the live planner behind the overlay.

What changed:

- `RouteExperience` now preloads `App` while on landing and lazy-mounts it when transitioning to `/app`.
- Landing background is a static preview shell, not a live `App` instance.
- Overlay now supports initial focus, Escape dismissal, and tab containment in dialog mode.
- `App` no longer requires a startup hydration loading gate, reducing transition flash risk.

Validation completed:

- `npm run lint`: pass
- `npm run test`: pass (11/11)
- `npm run build`: pass

Tradeoff note:

- The static preview shell is visual scaffolding only; it does not mirror live planner state. This is intentional to avoid heavy runtime work on `/`.
- App-level styling is now loaded at bootstrap to avoid style-pop when lazy planner chunk mounts.

## Context and Orientation

Routing flow and landing/planner transitions are coordinated in `src/RouteExperience.tsx`. The overlay UI and full landing markup are in `src/components/LandingPage.tsx` with styles in `src/components/LandingPage.css`. Planner orchestration lives in `src/App.tsx`, including localStorage bootstrap, autosave, and share-link handling.

The key architecture update is that `/` should no longer mount the full planner component tree just to avoid a visual transition gap.

## Plan of Work

Apply five focused edits:

1. Convert planner mount in `RouteExperience` to `React.lazy` + `Suspense` and add a prewarm import while on landing.
2. Replace live background `<App />` with a lightweight static preview shell.
3. Add resilient transition behavior (`isOpeningPlanner` guard, load error surface, retry path through CTA).
4. Improve overlay accessibility in `LandingPage` with initial focus, keyboard trap, and Escape dismissal.
5. Remove startup hydration flash source in `App` by initializing workspace from localStorage in the first render path.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Commands:

    npm run lint
    npm run test
    npm run build

Expected outcome:

- No lint violations.
- Existing utility tests pass.
- Production build completes and still emits planner chunks.

## Validation and Acceptance

Manual acceptance:

1. Start dev server (`npm run dev`).
2. Open `/` and confirm planner UI is not fully interactive behind overlay (static preview shell only).
3. Trigger `Start Planning` or backdrop dismiss and confirm planner opens smoothly.
4. Use keyboard on overlay: Tab remains inside panel and Escape dismisses overlay.

Automated acceptance:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.

## Idempotence and Recovery

These edits are safe to reapply. If route transition regressions appear, revert `src/RouteExperience.tsx` and restore prior route behavior, then reintroduce preload and preview shell in smaller slices.

If localStorage bootstrap causes issues in unsupported environments, fallback is to restore the prior `isHydrated` effect gate in `src/App.tsx`.

## Artifacts and Notes

Main files edited:

- `src/RouteExperience.tsx`
- `src/components/LandingPage.tsx`
- `src/components/LandingPage.css`
- `src/App.tsx`
- `ARCHITECTURE.md`

## Interfaces and Dependencies

No new dependencies were introduced.

Interface updates:

- `LandingPage` now accepts optional `isOpeningPlanner?: boolean` to support transition state and control disabling.

Revision Note (2026-02-15 / Codex): Created this ExecPlan to capture the implementation that preserves no-flash transition while removing background live planner mounting on landing.
Revision Note (2026-02-15 / Codex): Marked implementation complete after lint/test/build passed and captured final outcomes.
Revision Note (2026-02-15 / Codex): Applied follow-up UX polish after user feedback about weird loading/background appearance.
