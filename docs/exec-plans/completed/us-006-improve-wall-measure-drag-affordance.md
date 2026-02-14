# Improve Wall Measure Drag Affordance (US-006)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, wall-based measurement creation is easier to discover and easier to start on first try. Users should see clearer wall target guides and get a larger interaction target while in measure mode.

You can observe this by enabling measure mode and hovering walls: wall guides should be visibly stronger and initiating a wall-based measure should require fewer precise pointer placements.

## Progress

- [x] (2026-02-14 10:16Z) Reviewed wall measure target geometry/rendering and measure-mode helper copy in `RoomCanvas` and `App`.
- [x] (2026-02-14 10:18Z) Increased wall target hit affordance and strengthened guide rendering in `src/components/RoomCanvas.tsx`.
- [x] (2026-02-14 10:18Z) Added theme tokens in `src/index.css` for wall target guide band and midpoint node visuals.
- [x] (2026-02-14 10:18Z) Updated measure-mode helper copy in `src/App.tsx` to direct users to wall guides and anchors.
- [x] (2026-02-14 10:18Z) Ran `npm run test`, `npm run lint`, and `npm run build` successfully.
- [x] (2026-02-14 10:18Z) Updated this plan with final validation artifacts.

## Surprises & Discoveries

- Observation: Wall targets are already generated as segmented wall lines that exclude openings, so affordance improvements can reuse this geometry without changing wall/opening calculations.
  Evidence: `wallSegments` in `RoomCanvas` comes from `subtractIntervals` across each wall with opening cutouts.

## Decision Log

- Decision: Keep behavior changes visual/interaction-size focused and avoid changing snapping or geometry math.
  Rationale: The user feedback targets discoverability and ease-of-start, not measurement accuracy rules.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

US-006 is implemented. Wall-based measure targets now have a stronger visible guide band, larger hit area, and a clear midpoint node, making them easier to find and start from. Measure-mode instructions now explicitly tell users to drag from highlighted wall guides or object anchors.

The change preserved existing geometry and snapping logic, and only modified affordance rendering, target sizing, and instructional copy.

## Context and Orientation

`RoomCanvas` computes `wallMeasureTargets` from wall segments and currently renders a thin dashed centerline plus a transparent hit line. The hit area is moderate, but visual affordance is subtle. `App.tsx` shows measure-mode guidance text in the edit rail, which currently does not explicitly direct users to wall guides.

The change should keep the existing room-wall segmentation and pointer event model while making interaction clearer through stronger visuals and larger hit zones.

## Plan of Work

In `RoomCanvas`, increase effective wall-target hit width and render a stronger visual stack for each target (guide band + clearer centerline + visible midpoint node) while preserving existing hover/active color feedback and pointer handlers.

In `src/index.css`, add token variables for wall measure guide band and midpoint node for both light and dark themes.

In `App.tsx`, update measure-mode instructional copy to explicitly mention starting a measure from highlighted wall guides.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation steps:

1. Edit `src/components/RoomCanvas.tsx` to:
   - enlarge wall-target hit zone,
   - render stronger guide visuals,
   - keep existing `beginMeasureFromWallTarget` pointer path.
2. Edit `src/index.css` with corresponding theme tokens.
3. Edit measure-mode guidance text in `src/App.tsx`.
4. Run validations:

    npm run test
    npm run lint
    npm run build

## Validation and Acceptance

Manual acceptance:

1. Run `npm run dev`.
2. Enable measure mode.
3. Hover wall guides and verify clear hover/active visual response.
4. Start measures from multiple wall segments (including near openings) and verify easier initiation.
5. Confirm regular object dragging behavior remains unchanged when measure mode is off.

Automated validation:

    npm run test
    npm run lint
    npm run build

## Idempotence and Recovery

Changes are additive and confined to visual affordance and helper copy. If needed, rollback by restoring the previous wall-target rendering block and removing added style tokens.

## Artifacts and Notes

Validation transcript summary:

    npm run test
    # pass 6
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 3.74s

## Interfaces and Dependencies

No external dependencies are added and no persisted schema changes are required.

No public API changes are required; this is an internal UI behavior/visual update in `RoomCanvas`, theme tokens in `index.css`, and guidance copy in `App.tsx`.

Revision Note (2026-02-14 / Codex): Created plan prior to implementation for US-006 to execute interaction-affordance work with explicit validation gates.
Revision Note (2026-02-14 / Codex): Updated plan after implementation with completed progress and validation artifacts for shipped US-006 changes.
