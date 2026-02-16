# Selection and Measurement Click Reliability (US-017)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, users can reliably single-click to select furniture and measurement lines without needing repeated clicks or losing selection unexpectedly. The user-visible goal is to remove interaction flakiness where tiny pointer jitter or event ordering clears or suppresses intended selection.

You can observe success by opening the app, clicking objects and measure lines once, and seeing selection remain stable on the first attempt across repeated tries.

## Progress

- [x] (2026-02-16 00:09Z) Reviewed `US-017` backlog entry and traced `RoomCanvas` object/measure pointer flows.
- [x] (2026-02-16 00:09Z) Created this ExecPlan and documented implementation/validation approach.
- [x] (2026-02-16 00:10Z) Moved `US-017` to `in_progress` in `docs/user-story-workflow/backlog.json`.
- [x] (2026-02-16 00:12Z) Implemented pointer interaction reliability fixes in `src/components/RoomCanvas.tsx` and `src/components/RoomObject.tsx`.
- [x] (2026-02-16 00:12Z) Added utility-level drag threshold module and tests (`src/utils/pointerDrag.ts`, `tests/pointerDrag.test.ts`).
- [x] (2026-02-16 00:13Z) Ran full validation (`npm run test`, `npm run lint`, `npm run build`) successfully.
- [x] (2026-02-16 00:13Z) Marked `US-017` as `done` in `docs/user-story-workflow/backlog.json` and finalized this ExecPlan.

## Surprises & Discoveries

- Observation: Object selection currently depended on `click`, but object `pointerdown` immediately captured pointer and started drag bookkeeping, which made small pointer jitter suppress click selection.
  Evidence: Pre-change `src/components/RoomCanvas.tsx` gated `handleObjectClick` on `hasDragged`, and `hasDragged` was set as soon as pointer movement processing started.

- Observation: Canvas-level `onClick` selection clearing was redundant with pointerdown blank-space deselection and could clear fresh selections in edge event-order cases.
  Evidence: Pre-change root canvas `<div>` handled `onClick` clearing while `beginBoxSelection` already treated tiny blank drags as deselect.

- Observation: Utility-only tests remain the practical coverage layer for this repository’s automated suite.
  Evidence: `npm run test` compiles and executes `src/utils/**` + `tests/**`; new pointer-threshold behavior was covered through `tests/pointerDrag.test.ts`.

## Decision Log

- Decision: Shift object single-select commit to pointer-up of the object interaction when drag threshold is not crossed.
  Rationale: Pointer-up in the existing drag lifecycle is more reliable than browser click synthesis for this interaction pattern.
  Date/Author: 2026-02-16 / Codex

- Decision: Add a minimal object-drag threshold (`2`) before treating movement as drag.
  Rationale: Filters tiny pointer jitter so normal clicks are not misclassified as drags.
  Date/Author: 2026-02-16 / Codex

- Decision: Remove canvas-level `onClick` deselection and rely on explicit pointer flows (`beginBoxSelection`, measure actions).
  Rationale: Prevents accidental post-selection clears and keeps selection state transitions in pointer handlers.
  Date/Author: 2026-02-16 / Codex

- Decision: Introduce `src/utils/pointerDrag.ts` with tests.
  Rationale: Keeps threshold math deterministic, reusable, and covered by the Node-run test harness.
  Date/Author: 2026-02-16 / Codex

## Outcomes & Retrospective

`US-017` is implemented and marked `done`.

Delivered behavior:

- Object selection no longer depends on `click`; it commits on pointer-up when no real drag occurred.
- Tiny pointer jitter no longer suppresses selection because object dragging now requires threshold crossing.
- Canvas root no longer has redundant `onClick` deselect behavior, reducing selection-clear race conditions.
- `RoomObject` click plumbing was removed to align with pointer-driven selection.

Validation outcome:

- `npm run test`: pass (12/12)
- `npm run lint`: pass
- `npm run build`: pass

Remaining follow-up:

- Manual UX QA is still recommended to tune threshold feel on touch devices if needed.

## Context and Orientation

`src/App.tsx` owns authoritative room selection state (`editingItemId`, `selectedItemIdsByRoom`, `selectedMeasureByRoom`) and passes callbacks into `src/components/RoomCanvas.tsx`.

`src/components/RoomCanvas.tsx` handles high-frequency pointer interactions for drag, resize, box-select, and measure editing. This change keeps drag behavior local in `RoomCanvas`, but now commits single-object selection during pointer-up instead of relying on click events.

`src/components/RoomObject.tsx` is the object hit target wrapper and now only forwards pointer-down for selection/drag lifecycle entry.

Tests in this repository run with Node’s built-in test runner and compile `src/utils/**` plus `tests/**` (`tsconfig.test.json`), so new automated coverage was added in utility space.

## Plan of Work

This plan was delivered in focused slices.

First, `US-017` was moved to `in_progress` in backlog tracking. Next, `RoomCanvas` gained drag threshold tracking and pointer-up selection commit logic, and redundant canvas click clearing was removed. Then `RoomObject` click callback plumbing was removed to prevent conflicting selection semantics. Finally, a pure drag-threshold utility and tests were added, followed by full quality-gate validation.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Commands run:

1. Edited backlog status for `US-017` (`backlog` -> `in_progress` -> `done`).
2. Edited:

    src/components/RoomCanvas.tsx
    src/components/RoomObject.tsx
    src/utils/pointerDrag.ts
    tests/pointerDrag.test.ts

3. Ran validation:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Manual behavior checks for acceptance:

1. Select a furniture item with one click; selection appears immediately and consistently.
2. Drag an item slightly (below threshold) and release; it behaves as click-select instead of a failed/no-op interaction.
3. Drag beyond threshold; object movement occurs and selection does not unexpectedly clear.
4. Select a measure line with one click; selection persists and is not cleared by canvas click side effects.
5. Repeatedly switch between selecting objects and measures; reselection works without requiring double-clicks.

Automated checks completed:

- `npm run test`
- `npm run lint`
- `npm run build`

Acceptance for `US-017` is satisfied by code delivery plus passing quality gates.

## Idempotence and Recovery

All edits are additive and safe to re-run. If interaction feel needs rollback, revert only the threshold/pointer-up selection changes in `RoomCanvas` and the related `RoomObject` callback removal, then rerun validation commands.

No persistence schema or migration changes are involved, so rollback risk is limited to UI interaction behavior.

## Artifacts and Notes

Changed files:

- `docs/exec-plans/us-017-selection-and-measure-click-reliability.md`
- `docs/user-story-workflow/backlog.json`
- `src/components/RoomCanvas.tsx`
- `src/components/RoomObject.tsx`
- `src/utils/pointerDrag.ts`
- `tests/pointerDrag.test.ts`

Validation transcript summary:

    npm run test
    # tests 12
    # pass 12
    # fail 0

    npm run lint
    eslint .

    npm run build
    [seo] No asset changes for https://bedroomlayout.app
    vite v7.2.6 building client environment for production...
    ✓ built in 3.95s

## Interfaces and Dependencies

No third-party dependencies were added.

Interface changes delivered:

- `src/utils/pointerDrag.ts` exports:

    getPointerTravelDistance(start, end)
    hasPointerExceededDragThreshold(start, end, threshold)

- `RoomCanvas` now commits object selection on pointer-up when drag threshold is not exceeded.
- `RoomObject` no longer receives click callback props for selection.

Revision Note (2026-02-16 / Codex): Created ExecPlan for `US-017` and documented implementation approach before code changes.
Revision Note (2026-02-16 / Codex): Finalized implementation, validation evidence, and backlog status updates after marking `US-017` done.
