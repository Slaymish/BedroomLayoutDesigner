# AGENTS.md

Guidance for humans and coding agents working in this repository.

## Project Overview

- App type: client-side React + TypeScript (Vite), no backend API.
- Domain: bedroom layout editing with furniture/openings, measurements, autosave, and workspace import/export.
- Source of truth: `src/App.tsx` coordinates workspace state and global interactions.

## Setup and Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

## Important Architecture Rules

1. Keep geometry in centimeters in state. Convert units only at UI/input/output boundaries (`src/utils/units.ts`).
2. Route workspace mutations through the established update flow in `src/App.tsx` (no direct nested mutation).
3. If persistence schema changes, update migration/sanitization logic in `src/utils/workspaceState.ts`.
4. Preserve import/export contract in `src/utils/workspaceFile.ts` and autosave behavior in `src/utils/autosave.ts`.
5. Keep high-frequency canvas interactions efficient; buffer locally where possible (`src/components/RoomCanvas.tsx`).

## Testing Expectations

- Run `npm run test` after code changes.
- Add or update tests in `tests/` for any behavior change in utilities, persistence, or migration logic.
- Validate build with `npm run build` for changes affecting runtime wiring.

## Scope and Hygiene

- Prefer minimal, targeted changes.
- Do not commit generated artifacts from `dist/` unless explicitly requested.
- Keep `ARCHITECTURE.md` aligned when structural decisions or invariants change.

# ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in PLANS.md) from design to implementation.