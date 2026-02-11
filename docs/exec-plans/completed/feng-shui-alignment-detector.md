# Add Feng Shui Alignment Detector and Active-Room Toolbar Warning

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, the app evaluates the currently active room against a practical feng shui bedroom rule set and surfaces a subtle warning in the main toolbar when rules are broken. The warning is an orange triangle indicator with a count. Hovering it shows which rules are currently violated for the active room.

This gives users immediate design feedback while they move furniture, doors, and windows. The behavior is observable without opening a modal: select a room, place conflicting items (for example, bed facing a door), and watch the warning appear in the toolbar.

## Progress

- [x] (2026-02-11 22:44Z) Read `PLANS.md`, `src/App.tsx`, room geometry helpers, and styling to identify integration points.
- [x] (2026-02-11 22:45Z) Added new rule engine utility `src/utils/fengShui.ts` with explicit rule catalog and room evaluation function.
- [x] (2026-02-11 22:46Z) Added test coverage in `tests/fengShui.test.ts` for safe layout and each broken-rule scenario.
- [x] (2026-02-11 22:46Z) Wired active-room rule evaluation into `src/App.tsx` and added warning indicator + hover tooltip in toolbar metadata.
- [x] (2026-02-11 22:46Z) Added warning chip styles in `src/App.css` and theme tokens in `src/index.css` (light and dark).
- [x] (2026-02-11 22:47Z) Validated with `npm run test`, `npm run build`, and `npm run lint`.
- [x] (2026-02-11 22:47Z) Updated `ARCHITECTURE.md` utility/test map so project docs match the new feature modules.

## Surprises & Discoveries

- Observation: Door and window placement data stores opening span in `item.width` regardless of wall orientation, while `item.height` remains wall thickness.
  Evidence: `src/utils/openings.ts` normalization logic and `src/components/RoomObject.tsx` rendering behavior required wall-aware span calculations for accurate detector geometry.

- Observation: Existing toolbar metadata chip styling is broad (`.command-toolbar-meta span`), so a new warning chip needed explicit overrides to keep the orange visual treatment.
  Evidence: Added `!important` token-based overrides in `src/App.css` for `.feng-shui-warning-chip`.

## Decision Log

- Decision: Implement a deterministic rule engine in `src/utils/fengShui.ts` instead of embedding conditions directly in `App.tsx`.
  Rationale: Keeps domain logic testable and reusable, and preserves `App.tsx` as orchestrator instead of geometry/rule implementation.
  Date/Author: 2026-02-11 / Codex

- Decision: Ship four conservative rules that are broadly used in feng shui and detectable from existing room data: bed-facing-door, unsupported headboard, bed-under-window, and blocked door-entry path.
  Rationale: These rules are explainable and computable from current object types and coordinates without adding schema changes.
  Date/Author: 2026-02-11 / Codex

- Decision: Use a subtle toolbar warning chip with native hover tooltip text rather than a larger custom popover component.
  Rationale: Matches the user request for subtle warning-on-hover and minimizes UI complexity/risk.
  Date/Author: 2026-02-11 / Codex

## Outcomes & Retrospective

The feature goal was achieved: active room feng shui issues are detected and surfaced in the toolbar with an orange warning triangle and hover details. Rule logic is now centralized in a utility with tests covering positive and negative paths. Build, tests, and lint all pass.

The largest risk area was geometry interpretation for wall-mounted openings and rotated furniture. That risk was reduced by using existing opening normalization assumptions and by evaluating furniture via rotated axis-aligned bounding boxes for collision/overlap checks.

## Context and Orientation

This project is a client-side React + TypeScript app. `src/App.tsx` owns workspace state and renders global controls, including the top command toolbar. Each room stores dimensions and items in centimeters (`RoomDesign`, `RoomItem` in `src/types.ts`). Openings (`Door`, `Window`) are normalized onto walls by utilities in `src/utils/openings.ts`.

The new feature introduces a room analysis utility that accepts a single `RoomDesign` and returns violations. `App.tsx` computes this analysis for the active room and renders a warning indicator in `command-toolbar-meta` if any violations exist.

Key files:

- `src/utils/fengShui.ts`: new feng shui rule definitions and evaluator.
- `src/App.tsx`: active-room analysis wiring and toolbar warning render.
- `src/App.css`: warning chip styling.
- `src/index.css`: theme variables for warning colors.
- `tests/fengShui.test.ts`: detector behavior tests.

## Plan of Work

Create a dedicated utility module for rule evaluation. Define rule identifiers, a readable rule catalog, and an `evaluateRoomFengShui(room)` function returning violations. Keep all geometry calculations local to this utility: rotated furniture bounding boxes, opening wall inference, opening span extraction, and overlap checks.

Use that utility in `App.tsx` via `useMemo` scoped to `activeRoom`. Build tooltip copy from violations and render a warning chip only when there are violations. Keep warning state derived only from active room data so no persistence schema changes are required.

Add targeted Node tests in `tests/fengShui.test.ts`. Include one safe configuration and one failing case per rule to prevent regressions. Validate full repo test/build/lint commands.

## Concrete Steps

Working directory for all commands:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Implementation steps:

1. Add `src/utils/fengShui.ts` with:
   - `FENG_SHUI_RULES`
   - `FengShuiRuleViolation` / `FengShuiAssessment` types
   - `evaluateRoomFengShui(room: RoomDesign): FengShuiAssessment`
2. Add `tests/fengShui.test.ts` using `node:test`.
3. Update `src/App.tsx`:
   - import `evaluateRoomFengShui`
   - compute active-room assessment in `useMemo`
   - render warning chip with orange `AlertTriangle` and hover tooltip.
4. Update styles in `src/App.css` and tokens in `src/index.css`.
5. Run validation commands:

    npm run test
    npm run build
    npm run lint

Expected output summary:

- `npm run test`: all tests pass, including `fengShui.test.js`.
- `npm run build`: Vite build completes successfully and writes `dist/assets/*`.
- `npm run lint`: exits cleanly with no errors.

## Validation and Acceptance

Acceptance is behavior-based:

1. Run `npm run dev`.
2. In the active room, add a bed and a door so the foot of the bed points toward the door.
3. Observe an orange warning triangle chip in the toolbar metadata area.
4. Hover the warning chip and confirm tooltip text lists broken feng shui rules for the active room.
5. Move/rotate objects to satisfy rules and confirm warning count decreases or disappears.

Automated validation:

    npm run test
    npm run build
    npm run lint

All three commands must succeed.

## Idempotence and Recovery

All edits are additive and repeatable. Re-running tests/build/lint is safe.

If detector behavior needs rollback, remove `src/utils/fengShui.ts` usage from `src/App.tsx` first, then remove styles and tests. No migration or persistent schema changes were introduced, so stored workspace data remains compatible.

## Artifacts and Notes

Validation transcript excerpts:

    > npm run test
    # Subtest: .test-dist/tests/fengShui.test.js
    ok 3 - .test-dist/tests/fengShui.test.js
    # pass 6
    # fail 0

    > npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 4.04s

    > npm run lint
    eslint .

## Interfaces and Dependencies

New interface surface in `src/utils/fengShui.ts`:

    export interface FengShuiRuleViolation {
      ruleId: FengShuiRuleId;
      title: string;
      detail: string;
    }

    export interface FengShuiAssessment {
      evaluatedRules: number;
      violations: FengShuiRuleViolation[];
    }

    export const FENG_SHUI_RULES: readonly FengShuiRuleDefinition[];

    export const evaluateRoomFengShui: (room: RoomDesign) => FengShuiAssessment;

No external dependencies were added. The detector uses existing room/item types and opening utilities only.

Revision Note (2026-02-11 / Codex): Created and finalized this ExecPlan after implementation to capture the shipped design, full validation evidence, and architecture-document alignment changes in one self-contained record.
