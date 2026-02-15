# Technical Debt Tracker and Remediation Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

This plan documents the current technical debt in Bedroom Layout Designer and defines a safe sequence for paying it down without regressions. After executing this plan, the project will have better test coverage for user-critical workflows, reduced coupling in large UI modules, and less duplicated/dead code.

The outcome is observable through faster and safer iteration: core interactions (drag, resize, measure, undo/redo, import/export) will be guarded by automated tests, and refactors will become lower-risk because responsibilities are split into smaller, testable modules.

## Progress

- [x] (2026-02-11 22:56Z) Ran repository signal scan and mapped risk hotspots with `scan-repo-signals.sh`.
- [x] (2026-02-11 22:58Z) Reviewed architecture, source modules, utility layer, tests, and build/config wiring.
- [x] (2026-02-11 22:59Z) Ran quality gates (`npm run test`, `npm run lint`, `npm run build`) to establish baseline behavior.
- [x] (2026-02-11 23:01Z) Recorded prioritized debt findings with file-level evidence and recommended remediation milestones.
- [x] (2026-02-15 02:12Z) Refreshed debt evidence after landing-page and share-link work, including updated module size and quality-gate baselines.
- [x] (2026-02-15 02:14Z) Fixed modal overflow regression in preferences and recorded responsive modal coverage as ongoing debt.
- [ ] Execute Milestone 1 (test harness expansion for interaction-heavy UI paths).
- [ ] Execute Milestone 2 (extract `App.tsx` orchestration into focused hooks/modules).
- [ ] Execute Milestone 3 (extract `RoomCanvas.tsx` interaction controllers).
- [ ] Execute Milestone 4 (remove or wire currently dead component paths and unify shared geometry helpers).

## Surprises & Discoveries

- Observation: CI, lint, tests, and build are all green despite sizable architecture debt.
  Evidence: `npm run test` passed 10/10 suites, `npm run lint` exited cleanly, and `npm run build` completed successfully on 2026-02-15.

- Observation: Existing tests intentionally exclude React components and focus only on utility contracts.
  Evidence: `tsconfig.test.json:14` includes only `src/types.ts`, `src/utils/**/*.ts`, and `tests/**/*.ts`.

- Observation: There are substantial modules with mixed responsibilities that already exceed maintainability-friendly size.
  Evidence: `src/App.tsx` is 2387 lines; `src/components/RoomCanvas.tsx` is 2014 lines.

## Decision Log

- Decision: Track debt using severity-prioritized findings first, then implementation milestones.
  Rationale: The repository needs clear risk ordering before scheduling multi-step refactors.
  Date/Author: 2026-02-11 / Codex

- Decision: Treat missing integration/component tests as top-priority debt even though unit tests pass.
  Rationale: Highest user-facing risk sits in pointer-heavy UI flows that are currently untested by automation.
  Date/Author: 2026-02-11 / Codex

- Decision: Keep this plan remediation-focused and avoid speculative redesign not tied to observed risk.
  Rationale: The codebase is functional; debt should be reduced incrementally with behavior-preserving slices.
  Date/Author: 2026-02-11 / Codex

## Outcomes & Retrospective

The initial audit outcome is complete: this file now contains a concrete and prioritized debt register, along with an executable remediation sequence and validation gates. No production behavior was changed during this audit phase.

Remaining work is implementation: the plan now needs to be executed in milestones, with this file updated at each stop point.

## Context and Orientation

Bedroom Layout Designer is a client-side React + TypeScript app where `src/App.tsx` owns global workspace orchestration and `src/components/RoomCanvas.tsx` handles high-frequency interactions (drag, resize, measure drawing/editing). Persistence and migration behavior lives in `src/utils/workspaceState.ts`, `src/utils/autosave.ts`, and `src/utils/workspaceFile.ts`. Current tests are utility-focused (`tests/*.ts`) and compile via `tsconfig.test.json`.

This tracker covers repository-level technical debt (maintainability, reliability, performance, and testing gaps) and excludes generated artifacts (`dist/`, `.test-dist/`) from deep review, except when they affect workflow behavior.

## Debt Register (Prioritized Findings)

### High: No automated coverage for interaction-heavy UI workflows

- Evidence: `tsconfig.test.json:14` restricts test compile scope to utilities and types; `src/App.tsx:190` and `src/components/RoomCanvas.tsx:213` contain the primary drag/resize/measure/edit orchestration but are untested by automated UI tests.
- Risk: Regressions in core user workflows (selection, drag/resize, measurement editing, undo/redo, PDF/export UX) can ship undetected.
- Recommendation: Add a component/integration test layer for `App` + `RoomCanvas` (Vitest + React Testing Library), then add 1-2 browser-level smoke flows for pointer interactions and workspace import/export.
- Validation: New tests fail before fixes and pass after; run `npm run test` (utilities) and new component/e2e commands in CI.

### High: `App.tsx` and `RoomCanvas.tsx` are oversized mixed-responsibility modules

- Evidence: `src/App.tsx` (2387 lines) combines persistence, history, export, telemetry, shared-link orchestration, modal state, and rendering. `src/components/RoomCanvas.tsx` (2014 lines) combines rendering, pointer lifecycle, snapping, measurement editing, and telemetry.
- Risk: High change coupling, difficult reasoning, and elevated regression probability for unrelated edits.
- Recommendation: Refactor by extraction, not rewrite:
  1) Extract `App` concerns into hooks/modules (`useWorkspaceHistory`, `useWorkspaceAutosave`, `usePdfExport`).
  2) Extract canvas interaction controllers (`useObjectDragResize`, `useMeasureEditing`) from `RoomCanvas`.
- Validation: Behavior parity tests pass, quality gates stay green, and each extracted module has focused tests.

### Medium: Modal responsiveness regressions are still easy to reintroduce without viewport tests

- Evidence: Preferences modal previously clipped at top/bottom on smaller viewports; fixed with `overflow-y-auto` and bounded modal height in `src/App.tsx` and `src/App.css`, but no automated viewport assertions exist.
- Risk: Future layout edits can silently reintroduce clipping or inaccessible controls on mobile/short-height screens.
- Recommendation: Add at least one responsive UI test (component or Playwright smoke) that validates dialog accessibility across a short viewport.
- Validation: Automated test fails when modal cannot scroll/reach controls and passes with the current responsive classes.

### Medium: History snapshots are cloned multiple times in hot paths

- Evidence: `captureWorkspaceSnapshot` deep-clones rooms (`src/utils/workspaceState.ts:443`), then `pushUndoSnapshot` clones snapshot payload again (`src/App.tsx:321` onward). Snapshot capture is used in frequent interaction paths (`src/App.tsx:755`, `src/App.tsx:764`).
- Risk: Unnecessary CPU/memory overhead as room count/object count grows; contributes to slower interactions in large workspaces.
- Recommendation: Remove redundant cloning in `pushUndoSnapshot` or convert history storage to immutable snapshots captured once per event boundary.
- Validation: Profiling comparison with large workspaces shows reduced frame cost and preserved undo/redo correctness.

### Medium: Dead/unwired component paths are still maintained

- Evidence: `src/components/AddObjectPanel.tsx` and `src/components/RoomOnboardingPanel.tsx` are only found at their declarations and are not imported by app wiring (`rg` search shows no consumers).
- Risk: Stale code increases cognitive load and creates false extension paths for contributors.
- Recommendation: Decide and document one path:
  1) Wire these components into `App`, or
  2) remove them and update architecture/docs.
- Validation: `rg -n "AddObjectPanel|RoomOnboardingPanel" src` shows either intentional wiring or only removed references with docs updated.

## Open Questions and Assumptions

- Assumption: The immediate priority is stability and maintainability, not UI redesign.
- Assumption: Existing runtime behavior is acceptable enough to support incremental refactors.
- Open question: Should the project adopt browser-level e2e tests now, or stage them after component-level coverage is established?
- Open question: Should unused components be removed immediately, or retained behind a documented roadmap item?

## Plan of Work

### Milestone 1: Add interaction-focused test coverage

Add a component test harness and target behavior contracts around object selection, drag/resize mutation commitment, measure mode flows, undo/redo boundaries, and file import/export error handling. Keep utility tests unchanged and additive.

### Milestone 2: Decompose `App.tsx` without behavior changes

Extract autosave, history, and PDF export orchestration into dedicated hooks/modules under `src/` while preserving `App` as composition root. Migrate one concern at a time, each with tests and no UI drift.

### Milestone 3: Decompose `RoomCanvas.tsx` interaction controllers

Move pointer lifecycle logic for object interactions and measure interactions into isolated hooks, preserving the current rendering surface. Maintain local buffering semantics and event cleanup guarantees.

### Milestone 4: Resolve code hygiene debt

Unify shared geometry helpers, remove or wire unused components, and align `ARCHITECTURE.md` with the resulting source map.

## Concrete Steps

Working directory:

    /home/hamishburke/Documents/BedroomLayoutDesigner

Baseline commands used in this audit:

    /home/hamishburke/.codex/skills/codebase-reviewer/scripts/scan-repo-signals.sh /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test
    npm run lint
    npm run build

Execution commands for debt payoff milestones (to run when implementing):

    npm run test
    npm run lint
    npm run build

Add milestone-specific commands as each milestone introduces new tooling (for example, component or e2e test commands).

## Validation and Acceptance

Acceptance criteria for this tracker (audit phase):

1. Debt findings are prioritized and backed by file-level evidence.
2. A concrete remediation sequence exists with test-first checkpoints.
3. Baseline quality gates are captured and passing.

Acceptance criteria for implementation phase (when executing milestones):

1. New tests cover critical UI interactions and run in CI.
2. `App.tsx` and `RoomCanvas.tsx` responsibilities are reduced through extraction while preserving behavior.
3. Shared geometry logic is centralized.
4. Unwired component debt is resolved (wired intentionally or removed).
5. `npm run test`, `npm run lint`, and `npm run build` remain green.

## Idempotence and Recovery

This plan is safe to update iteratively. Each milestone should be implemented in small, reversible commits and validated independently.

If a refactor milestone destabilizes behavior, revert only the in-progress extraction commit(s), keep tests as guardrails, and retry with smaller slices. No persistence schema changes are required by this debt plan itself.

## Artifacts and Notes

Baseline validation transcript summary (2026-02-15):

    npm run test
    # pass 10
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6 building client environment for production...
    ✓ built in 3.83s

Key evidence snippets:

    wc -l src/App.tsx src/components/RoomCanvas.tsx
    2387 src/App.tsx
    2014 src/components/RoomCanvas.tsx

    rg -n "export const clamp|export const getBoundingBox" src/utils/geometry.ts
    src/utils/geometry.ts:6:export const clamp = ...

    rg -n "AddObjectPanel|RoomOnboardingPanel" src
    src/components/AddObjectPanel.tsx:11:export default function AddObjectPanel ...
    src/components/RoomOnboardingPanel.tsx:385:export default memo(RoomOnboardingPanel, ...)

## Interfaces and Dependencies

No runtime dependencies were added in this audit phase.

Planned interfaces to introduce during remediation:

- `src/hooks/useWorkspaceHistory.ts` (undo/redo snapshot policy)
- `src/hooks/useWorkspaceAutosave.ts` (autosave scheduling + flush semantics)
- `src/hooks/usePdfExport.ts` (dependency loading + export pipeline)
- `src/hooks/useObjectDragResize.ts` and `src/hooks/useMeasureEditing.ts` (canvas interaction controllers)
- `src/utils/geometry.ts` (shared `clamp`, `getBoundingBox`, and related pure geometry helpers)

Revision Note (2026-02-11 / Codex): Created this tracker from a full repository audit and baseline validation run to replace an empty placeholder and provide an executable debt reduction path.
Revision Note (2026-02-15 / Codex): Refreshed evidence baselines, replaced stale geometry-duplication finding with modal responsiveness debt, and aligned counts with current repository state.
