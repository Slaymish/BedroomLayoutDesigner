# Add Direct Measure Length Input in Edit Panel (US-005)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, users can type an exact measure length in the measurement edit panel and have the selected measure line resize to that value. This removes repetitive dragging for precise measurements and improves control for precision-focused workflows.

You can observe this by selecting a measure, entering a numeric value in the panel length input, and seeing endpoints update to match the requested length.

## Progress

- [x] (2026-02-14 10:24Z) Reviewed current measure edit UI in `src/App.tsx` and measure line model in `src/types.ts`.
- [x] (2026-02-14 10:27Z) Added numeric measure length input in selected-measure panel with blur/Enter commit and Escape revert behavior.
- [x] (2026-02-14 10:27Z) Added deterministic helper to resize measure endpoints by target length while keeping segment within room bounds.
- [x] (2026-02-14 10:27Z) Kept conversion at input/display boundary with `toBaseCm` / `fromBaseCm`, while preserving undoable `updateRoom` mutation flow.
- [x] (2026-02-14 10:27Z) Ran `npm run test`, `npm run lint`, and `npm run build` successfully.
- [x] (2026-02-14 10:27Z) Updated this ExecPlan with outcomes and validation evidence.

## Surprises & Discoveries

- Observation: Using an uncontrolled number input with blur commit avoided additional draft-state plumbing and avoided touching `roomUiStateTokens`.
  Evidence: Input uses `defaultValue` + `key` reset pattern and commits on blur via `commitSelectedMeasureLength`.

## Decision Log

- Decision: Resize measure by preserving its midpoint and direction, while clamping maximum reachable length to room bounds.
  Rationale: Keeps editing predictable and prevents endpoints escaping room geometry.
  Date/Author: 2026-02-14 / Codex

- Decision: Commit numeric length edits on blur or Enter, with Escape to revert draft.
  Rationale: Gives stable typed input behavior without noisy per-keystroke geometry mutations.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

US-005 is implemented. Selected measures now expose a numeric length input in the edit panel. Entering a value and blurring (or pressing Enter) resizes the measure. Pressing Escape reverts the typed value in the input before blur.

Geometry updates preserve the measure midpoint and orientation, then clamp reachable length to room bounds so endpoints remain valid.

## Context and Orientation

`src/App.tsx` currently shows selected measure length as read-only text and supports toggling `includeInPdf` and deleting the measure. There is no numeric measure length input.

Measure geometry is stored directly in centimeters as endpoint coordinates (`MeasureLine` fields `x1`, `y1`, `x2`, `y2`). Unit conversion is done at display/input boundaries via `fromBaseCm` and `toBaseCm` from `src/utils/units.ts`.

## Plan of Work

Add a panel input for selected measure length. On blur/Enter, parse input in active unit, convert to centimeters, and apply a geometry update that preserves line center/orientation and clamps to valid bounds. Use Escape to revert the current typed value.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation steps:

1. Add helper functions in `src/App.tsx`:
   - measure length calculation in cm
   - format helpers for display/input
   - endpoint recomputation from target length + room bounds
2. Replace read-only length display in selected-measure panel with numeric input + commit interactions.
3. Run validation commands:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Manual acceptance:

1. Run `npm run dev`.
2. Create/select a measure line.
3. Enter a target length value in the panel and blur/press Enter.
4. Confirm measure line updates to requested length (or maximum allowed if constrained by room bounds).
5. Press undo and confirm prior geometry is restored.
6. Focus input and press Escape to revert draft edits.

Automated validation:

    npm run test
    npm run lint
    npm run build

## Idempotence and Recovery

Changes are additive and localized to measure editing UI/logic in `App.tsx`. If needed, rollback by removing the new input handlers/state and restoring prior read-only length text block.

## Artifacts and Notes

Validation transcript summary:

    npm run test
    # pass 6
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 3.75s

## Interfaces and Dependencies

No external dependencies are required.

No persisted schema changes are required.

Internal helper interface added in `src/App.tsx`:

    resizeMeasureToLengthInRoom(measure, targetLengthCm, roomWidthCm, roomHeightCm)

Revision Note (2026-02-14 / Codex): Created plan prior to implementing US-005 so work remains executable and auditable.
Revision Note (2026-02-14 / Codex): Updated plan after implementation with completed progress and validation evidence for shipped US-005 behavior.
