# Auto-Exit Measure Mode After Measure Creation (US-009)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, measure mode turns off automatically after a successful measure is created. Users can still create another measure by manually re-enabling measure mode. This prevents accidental extra measurements when they intended to resume moving objects.

You can observe this by enabling measure mode, drawing one measure, and confirming the ruler toggle exits active state immediately after creation.

## Progress

- [x] (2026-02-14 10:15Z) Reviewed measure creation flow in `src/components/RoomCanvas.tsx` and measure-mode orchestration in `src/App.tsx`.
- [x] (2026-02-14 10:16Z) Added explicit `onMeasureCreated` callback path from `RoomCanvas` to `App`.
- [x] (2026-02-14 10:16Z) Wired `setMeasureMode(false)` to run only after successful measure creation commit.
- [x] (2026-02-14 10:16Z) Ran `npm run test`, `npm run lint`, and `npm run build` successfully.
- [x] (2026-02-14 10:16Z) Updated this plan with final evidence and outcomes.

## Surprises & Discoveries

- Observation: Measure creation already distinguishes valid vs invalid measurements using minimum length checks before committing.
  Evidence: `RoomCanvas` only appends a measure when distance is `>= MIN_MEASURE_LENGTH_CM`.

## Decision Log

- Decision: Trigger auto-exit from `App.tsx` through a dedicated callback instead of changing measure-mode state directly inside `RoomCanvas`.
  Rationale: Keeps global workspace UI state (`measureMode`) owned by `App.tsx`.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

US-009 is implemented. Measure mode now exits automatically after a new measure is successfully created, while cancelled/too-short drags leave mode unchanged. Users can still create additional measures by re-enabling measure mode manually.

The architecture boundary is preserved: `RoomCanvas` emits an event (`onMeasureCreated`) and `App.tsx` owns the global state transition for `measureMode`.

## Context and Orientation

`src/App.tsx` owns the `measureMode` boolean and passes it to `RoomCanvas`. `RoomCanvas` handles pointer interactions and currently calls `onMeasuresChange` and `onSelectMeasure` when a measure is successfully created.

To preserve architecture boundaries, `RoomCanvas` should emit a creation event and `App.tsx` should decide how global mode state changes.

## Plan of Work

Extend `RoomCanvasProps` with an optional callback (`onMeasureCreated`) invoked only when a new measure is committed. In `App.tsx`, pass a handler that sets `measureMode` to `false` for active room interactions.

Keep endpoint/label dragging behavior unchanged and avoid mode changes for cancelled short drags.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation steps:

1. Add optional `onMeasureCreated?: (measureId: number) => void` prop in `src/components/RoomCanvas.tsx`.
2. Invoke callback in measure creation finish path only when measure commit succeeds.
3. Pass `onMeasureCreated={() => setMeasureMode(false)}` in `src/App.tsx` for active room canvas.
4. Run validations:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Manual acceptance:

1. Run `npm run dev`.
2. Enable measure mode and draw one valid measure.
3. Confirm measure mode exits automatically.
4. Re-enable measure mode and draw another measure to confirm repeatability.
5. Attempt a very short cancelled drag and confirm measure mode does not auto-exit on non-creation.

Automated validation:

    npm run test
    npm run lint
    npm run build

## Idempotence and Recovery

This is an additive callback wiring change. If rollback is needed, remove the new prop and callback invocation, then rerun quality gates.

## Artifacts and Notes

Validation transcript summary:

    npm run test
    # pass 6
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 3.80s

## Interfaces and Dependencies

No external dependencies are added.

Interface change in `src/components/RoomCanvas.tsx`:

    onMeasureCreated?: (measureId: number) => void

Revision Note (2026-02-14 / Codex): Created plan prior to implementation for US-009 to keep feature work executable and auditable.
Revision Note (2026-02-14 / Codex): Updated plan after implementation with completed progress and validation evidence for shipped US-009 behavior.
