# Add Keyboard Delete for Selected Objects (US-007)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, a user can delete the currently selected object using the keyboard (`Delete` or `Backspace`) instead of opening the edit panel and clicking Remove. This makes high-frequency layout iteration faster while preserving undo/redo behavior.

You can observe this by selecting an object on the canvas, pressing `Delete`, and seeing the object removed. Then press undo and confirm it returns.

## Progress

- [x] (2026-02-14 10:14Z) Reviewed `PLANS.md`, `src/App.tsx`, and current keyboard shortcut flow to identify safe integration points.
- [x] (2026-02-14 10:15Z) Added keyboard handling for `Delete` / `Backspace` in `src/App.tsx` with input-focus safeguards.
- [x] (2026-02-14 10:15Z) Verified deletion path uses `updateRoom` in `App.tsx`, preserving default history snapshot behavior.
- [x] (2026-02-14 10:15Z) Ran `npm run test`, `npm run lint`, and `npm run build` successfully.
- [x] (2026-02-14 10:15Z) Updated this plan with final outcomes and validation evidence.

## Surprises & Discoveries

- Observation: Global keyboard handling already exists in `App.tsx` for `Escape`, undo, and redo, so object deletion can be added without introducing a second event listener system.
  Evidence: `src/App.tsx` has a `window.addEventListener('keydown', onKeyDown)` effect with centralized shortcut routing.

## Decision Log

- Decision: Implement keyboard deletion inside the existing global keydown handler instead of creating canvas-specific listeners.
  Rationale: Keeps shortcut behavior centralized and minimizes regression risk.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

US-007 is implemented. Pressing `Delete` or `Backspace` now removes the selected object in the active editable room when focus is not in an input control. The object removal still routes through existing workspace mutation flow and remains undoable with existing history shortcuts.

No schema or persistence logic changed. The implementation stayed localized to keyboard shortcut routing in `src/App.tsx`, minimizing regression risk.

## Context and Orientation

`src/App.tsx` owns workspace state and defines `removeSelectedItem(roomId)` which removes `editingItemId` through `updateRoom`. `updateRoom` routes through `updateWorkspace`, which records undo snapshots by default. This means keyboard deletion should call `removeSelectedItem` to preserve history behavior and avoid direct state mutation.

The existing helper `isEditableElement` in `src/App.tsx` already prevents shortcuts while typing in inputs/textareas/selects. This should be reused so `Backspace` does not delete objects while entering values in the edit panel.

## Plan of Work

Modify the `onKeyDown` handler in `src/App.tsx` to process unmodified `Delete` and `Backspace` before undo/redo checks. Guard with:

- active room exists and is editable,
- an object is currently selected (`editingItemId !== null`),
- target is not an editable input control,
- no control/meta/alt modifiers are held.

When those conditions pass, call `updateRoom(activeRoomId, ...)` to remove `editingItemId` and the corresponding object, then call `event.preventDefault()`.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation steps:

1. Edit `src/App.tsx` keyboard handler to add Delete/Backspace branch.
2. Re-run project quality gates:

    npm run test
    npm run lint
    npm run build

Expected behavior:

- Pressing Delete/Backspace with selected object removes it.
- Pressing Delete/Backspace while typing in form controls does not remove objects.
- Undo (`Ctrl/Cmd+Z`) restores deleted object.

## Validation and Acceptance

Manual acceptance:

1. Run `npm run dev`.
2. Select an object in an editable room.
3. Press `Delete` or `Backspace`; object disappears.
4. Press undo shortcut; object reappears.
5. Focus a numeric/text input and press Backspace; only text editing occurs.

Automated validation:

    npm run test
    npm run lint
    npm run build

## Idempotence and Recovery

Edits are additive and local to keyboard input routing. If behavior regresses, remove only the new Delete/Backspace branch from `src/App.tsx` and rerun validation commands.

## Artifacts and Notes

Validation transcript summary:

    npm run test
    # pass 6
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 4.12s

## Interfaces and Dependencies

No new dependencies are required.

No public interfaces change. The change extends the internal keyboard shortcut handling in `src/App.tsx` and uses existing functions:

    updateRoom(roomId: string, updater, options?): void
    isEditableElement(target: EventTarget | null): boolean

Revision Note (2026-02-14 / Codex): Updated plan after implementation with completed progress, validation evidence, and final design details for shipped US-007 behavior.
