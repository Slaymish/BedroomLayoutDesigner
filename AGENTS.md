# AGENTS.md

This file is a contents page for coding agents. Use it to find the right source files and project docs quickly.

## Start Here

- Product overview and local commands: `README.md`
- System architecture and invariants: `ARCHITECTURE.md`
- Execution plan standard (required for complex work): `PLANS.md`
- Design docs index: `docs/design-docs/index.md`
- User story workflow and backlog process: `docs/user-story-workflow/README.md`

## Design Docs

- Design docs entry point: `docs/design-docs/index.md`
- Core mission and style baseline: `docs/design-docs/core-beliefs.md`
- User story planning workflow: `docs/user-story-workflow/README.md`

## ExecPlans

- In-progress example: `docs/exec-plans/tech-debt-tracker.md`
- Completed example: `docs/exec-plans/completed/feng-shui-alignment-detector.md`
- For significant features/refactors, create and maintain an ExecPlan per `PLANS.md`.

## Source Map

- App bootstrap: `src/main.tsx`
- Global orchestration and canonical workspace state: `src/App.tsx`
- Shared model types: `src/types.ts`
- Canvas interactions and high-frequency editing: `src/components/RoomCanvas.tsx`
- Room/workspace shells: `src/components/RoomWorkspace.tsx`, `src/components/RoomCard.tsx`
- Object rendering/editing: `src/components/RoomObject.tsx`, `src/components/EditObjectPanel.tsx`
- Preferences and workspace actions: `src/components/PreferencesPanel.tsx`

## Domain and Persistence Utilities

- State defaults, cloning, sanitization, migration: `src/utils/workspaceState.ts`
- Units conversion (boundary-only conversion): `src/utils/units.ts`
- Opening normalization/wall snapping: `src/utils/openings.ts`
- Autosave fingerprint and persistence behavior: `src/utils/autosave.ts`
- Workspace file import/export contract: `src/utils/workspaceFile.ts`
- Export capture bounds for PDFs: `src/utils/exportCapture.ts`
- Feng shui rule evaluation: `src/utils/fengShui.ts`

## Rules That Must Hold

1. Keep geometry in centimeters in state; convert units only at UI/input/output boundaries (`src/utils/units.ts`).
2. Route workspace mutations through the state update flow in `src/App.tsx` (no direct nested mutation).
3. If persistence schema changes, update migration and sanitization in `src/utils/workspaceState.ts`.
4. Preserve workspace import/export behavior in `src/utils/workspaceFile.ts`.
5. Keep autosave behavior aligned with `src/utils/autosave.ts`.
6. Keep high-frequency canvas interactions efficient; buffer locally in `src/components/RoomCanvas.tsx` when appropriate.

## Testing and Validation

- Run: `npm run test` after changes.
- Run: `npm run build` for runtime wiring changes.
- Run: `npm run lint` when changing TS/React code patterns.
- Add or update tests in `tests/` for behavior changes in utilities, persistence, or migration logic.

## Change Hygiene

- Prefer minimal, targeted changes.
- Do not commit generated artifacts from `dist/` unless explicitly requested.
- Update `ARCHITECTURE.md` when structural decisions or invariants change.
