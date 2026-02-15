# Box Selection and Multi-Object Move/Delete (US-008)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, users can drag a rectangular selection box on the room canvas to select multiple objects at once. The selected group can then be moved together (drag any selected object) and deleted together (Delete/Backspace or the edit rail action).

Today, selection is single-object only (`editingItemId`), which makes repetitive cleanup and arrangement slow. This feature enables practical multi-object workflows without changing persisted workspace schema.

You can observe success by adding several furniture objects in `/app`, dragging on empty canvas space to create a selection box, then moving the group and deleting the group in one action.

## Progress

- [x] (2026-02-15 08:12Z) Reviewed `US-008` requirements, `RoomCanvas` pointer flow, and `App` selection/delete wiring.
- [x] (2026-02-15 08:13Z) Moved `US-008` from `backlog` to `in_progress` in `docs/user-story-workflow/backlog.json`.
- [x] (2026-02-15 08:17Z) Added `src/utils/selectionBox.ts` and `tests/selectionBox.test.ts` for selection rectangle normalization and hit-testing behavior.
- [x] (2026-02-15 08:20Z) Implemented transient multi-selection state in `App.tsx` and wired multi-delete behavior in keyboard and side-rail flows.
- [x] (2026-02-15 08:21Z) Implemented box-selection drag and group drag behavior in `src/components/RoomCanvas.tsx` with non-opening box selection filtering.
- [x] (2026-02-15 08:22Z) Updated `ARCHITECTURE.md` for new selection utility and transient multi-selection state ownership.
- [x] (2026-02-15 08:23Z) Ran full validation (`npm run test`, `npm run lint`, `npm run build`) successfully.
- [x] (2026-02-15 08:23Z) Marked `US-008` as `done` in `docs/user-story-workflow/backlog.json` and finalized this ExecPlan.

## Surprises & Discoveries

- Observation: Existing persistent room schema only tracks one selected item (`editingItemId`), and current tests intentionally exclude React components.
  Evidence: `src/types.ts` contains only `editingItemId` for selection; `tsconfig.test.json` includes utility files and `tests/**/*.ts` only.

- Observation: Utility modules used by Node-run tests must use explicit `.js` relative imports for ESM resolution in `.test-dist`.
  Evidence: First test run failed with `ERR_MODULE_NOT_FOUND` for `./geometry`; resolved by importing `./geometry.js` in `src/utils/selectionBox.ts`.

## Decision Log

- Decision: Keep multi-selection transient in `App` UI state instead of adding it to persisted workspace schema.
  Rationale: Avoids migration/persistence churn for a UI-only interaction state while preserving autosave/import/export contracts.
  Date/Author: 2026-02-15 / Codex

- Decision: Scope box selection and group movement to non-measure mode and keep single-object edit behavior intact.
  Rationale: Measurement interactions already use pointer-heavy flows and should remain isolated for predictable UX.
  Date/Author: 2026-02-15 / Codex

- Decision: Exclude openings (`Door`/`Window`) from drag-box multi-selection.
  Rationale: Group drag uses free XY translation while openings are wall-constrained; filtering avoids invalid mixed interaction semantics in this delivery.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

`US-008` is implemented and marked `done`.

Delivered behavior:

- Dragging on empty canvas creates a visible selection rectangle and selects multiple objects.
- Selected object groups can be moved together by dragging any selected object.
- Delete/Backspace removes all selected objects, and the edit rail now includes a multi-select delete action.
- Undo/redo integration remains intact by reusing existing interaction snapshot flow in `App`.

Validation outcome:

- `npm run test`: pass (11/11)
- `npm run lint`: pass
- `npm run build`: pass

Remaining follow-up:

- Manual QA across desktop/mobile pointer interactions is still recommended for product sign-off on selection feel and drag thresholds.

## Context and Orientation

`src/App.tsx` owns room-level selection (`editingItemId`) and keyboard delete behavior. `src/components/RoomCanvas.tsx` handles object drag/resize pointer interactions and currently only supports single selected item semantics. Utility tests run through Node in `tests/` and compile only `src/utils/**` utilities, so selection hit-testing logic should be extracted into a utility for deterministic coverage.

`US-008` acceptance criteria require:

1. Drag gesture creates selection box for multiple objects.
2. Selected group can move together and delete together.
3. Undo/redo integration remains correct.

## Plan of Work

Implement in three coordinated slices:

1. Add a tested selection-box utility module for rectangle normalization and item hit-testing.
2. Extend `RoomCanvas` to support marquee/box selection on empty-canvas drag and group dragging for selected items.
3. Extend `App` with transient `selectedItemIdsByRoom` state and wire group delete + side-panel behavior while preserving `editingItemId` for single-item editing.

No persistence schema changes are required.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation sequence:

1. Update backlog status (`US-008` -> `in_progress`).
2. Add `src/utils/selectionBox.ts` and `tests/selectionBox.test.ts`.
3. Update `src/components/RoomCanvas.tsx` props and pointer flow for box select + group move.
4. Update `src/App.tsx` with transient multi-selection state, keyboard delete behavior, and UI wiring.
5. Update architecture documentation if structural map/invariants changed.
6. Run:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Manual validation:

1. Open `/app`, add at least three furniture objects.
2. Drag on empty canvas to draw a selection rectangle over at least two objects.
3. Confirm selected objects highlight together.
4. Drag one selected object and verify selected group moves as a unit.
5. Press Delete/Backspace and verify selected group is removed.
6. Use Undo/Redo to confirm grouped move/delete interactions restore correctly.

Automated validation:

- `npm run test`
- `npm run lint`
- `npm run build`

Acceptance:

- Multi-select can be created by drag-box gesture.
- Group move/delete works and is reflected in history flow.
- Existing single-select edit flows still function.

## Idempotence and Recovery

Edits are additive and can be rerun safely. If selection-box pointer wiring causes regressions, first revert `RoomCanvas` interaction additions while keeping utility tests, then reintroduce with smaller steps.

Because this change avoids persisted schema updates, rollback risk is limited to UI behavior.

## Artifacts and Notes

Key changed files:

- `src/App.tsx` (transient `selectedItemIdsByRoom`, group delete wiring, RoomCanvas props wiring)
- `src/components/RoomCanvas.tsx` (box-select rectangle, multi-highlight, group drag behavior)
- `src/utils/selectionBox.ts` (new pure selection helpers)
- `tests/selectionBox.test.ts` (new utility tests)
- `src/utils/keyboardShortcuts.ts` and `tests/keyboardShortcuts.test.ts` (delete guard now uses selected-count semantics)
- `ARCHITECTURE.md` (updated map/state ownership/testing notes)

Validation transcript summary:

    npm run test
    # tests 11
    # pass 11
    # fail 0

    npm run lint
    eslint .

    npm run build
    [seo] No asset changes for https://bedroomlayout.app
    vite v7.2.6 building client environment for production...
    ✓ built in 4.20s

## Interfaces and Dependencies

No new third-party dependencies are added.

Expected interface additions:

- `src/components/RoomCanvas.tsx` gains multi-selection props:

      selectedItemIds?: number[]
      onSelectItems?: (ids: number[]) => void

- `src/utils/selectionBox.ts` exports pure helpers for selection rectangle normalization and hit-testing used by `RoomCanvas`.

Revision Note (2026-02-15 / Codex): Created this ExecPlan to implement `US-008` with transient multi-select state and utility-tested box-hit logic.
Revision Note (2026-02-15 / Codex): Finalized implementation, recorded decisions/discoveries, and captured validation evidence after marking `US-008` done.
