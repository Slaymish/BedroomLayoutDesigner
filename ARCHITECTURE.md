# Architecture

This document explains how the Bedroom Layout Designer is structured today, where core logic lives, and which invariants keep the system stable.

## 1. System Overview

Bedroom Layout Designer is a client-side React + TypeScript single-page app.

- Runtime: browser only (no backend API).
- Storage: `localStorage` autosave + explicit JSON import/export.
- Rendering: DOM/CSS furniture primitives and SVG overlays for measurements.
- Deployment: static build (`vite`) hosted on Netlify, with a service worker for offline resilience.

The architecture is intentionally centralized: `src/App.tsx` is the application coordinator and source of truth for workspace state.

## 2. Architectural Style

The codebase follows a pragmatic layered shape:

1. UI orchestration in `App.tsx`.
2. Reusable visual/interaction components in `src/components`.
3. Domain and persistence helpers in `src/utils`.
4. Shared types in `src/types.ts`.

This is not strict Clean Architecture. Instead, it optimizes for low indirection and fast feature iteration in a browser-only app.

## 3. Code Map

### Entrypoints

- `src/main.tsx`: app bootstrap, stylesheet import, service worker registration in production.
- `src/App.tsx`: workspace orchestration, commands, undo/redo, autosave, import/export, toolbar, modal flow.

### Domain Types

- `src/types.ts`: canonical model types (`WorkspaceState`, `RoomDesign`, `RoomItem`, `MeasureLine`, preferences, telemetry).

### UI Components

- `src/components/RoomWorkspace.tsx`: room list shell and per-room card wiring.
- `src/components/RoomCard.tsx`: room card chrome (rename/delete/reorder + injected room body).
- `src/components/RoomCanvas.tsx`: high-frequency interactions (drag, resize, measurement drawing/editing), rendering floorplan.
- `src/components/RoomObject.tsx`: visual furniture/opening primitives.
- `src/components/EditObjectPanel.tsx`: selected object editor (dimensions/position/rotation/door swing).
- `src/components/PreferencesPanel.tsx`: workspace preferences and workspace file actions.

Currently not wired into `App.tsx`:

- `src/components/AddObjectPanel.tsx`
- `src/components/RoomOnboardingPanel.tsx`

### Utilities

- `src/utils/workspaceState.ts`: domain defaults, sanitization, cloning/equality, migration, room helpers.
- `src/utils/openings.ts`: opening normalization/snapping/wall inference.
- `src/utils/units.ts`: unit conversion to/from base centimeters.
- `src/utils/autosave.ts`: autosave fingerprint builder.
- `src/utils/workspaceFile.ts`: workspace export file format + parser + download.
- `src/utils/exportCapture.ts`: robust capture bounds for PDF image generation.

### Styling and Runtime Assets

- `src/index.css`, `src/App.css`: design tokens + component-level styling.
- `public/sw.js`: cache strategy and offline behavior.
- `netlify.toml`: static hosting config, SPA redirects, security headers.

## 4. Data Model and Invariants

Core invariant: all geometric values are stored in centimeters in state.

- Unit conversion only happens at UI/input/output boundaries (`units.ts`).
- `WorkspaceState` contains:
  - `rooms: RoomDesign[]`
  - `activeRoomId`
  - `preferences`
  - `version` (storage schema version)

Room-level invariants:

- `roomWidthCm` and `roomHeightCm` are minimum constrained by sanitizers and editors.
- `nextItemId` is always >= highest existing item id + 1.
- `editingItemId` is either null or references an existing item.
- Opening objects (`Door`, `Window`) are wall-normalized and stay attached to room perimeter.
- Measurement endpoints are clamped into room bounds.

Persistence invariants:

- Storage is always normalized to `WORKSPACE_STORAGE_VERSION`.
- Legacy schema versions are migrated in `parseStoredWorkspaceState`.
- Equality/snapshot helpers avoid redundant history entries and avoid noisy autosaves.

## 5. State Ownership and Update Flow

`App.tsx` owns the canonical `WorkspaceState` and all global UI state:

- selection state
- measure mode
- history stacks
- autosave bookkeeping
- telemetry state
- transient modal drafts

Mutation flow is command-oriented:

1. UI event (toolbar/canvas/editor/modal).
2. `App` handler computes next state via `updateWorkspace` or `updateRoom`.
3. Optional history capture (`pushUndoSnapshot`).
4. React re-render.
5. Debounced autosave pipeline persists stable state to `localStorage`.

High-frequency canvas interactions are locally buffered in `RoomCanvas` and committed upward on interaction completion, reducing parent re-render pressure.

## 6. Undo/Redo Model

- Snapshot type: rooms + active room id (`WorkspaceSnapshot`).
- Capacity: `MAX_HISTORY_SNAPSHOTS` (80).
- Continuous pointer interactions record one snapshot at start and commit at end if state changed.
- Scrub interactions in object editor avoid excessive history noise by using intent-aware history behavior.

## 7. Persistence, Import/Export, and Offline

### Local persistence

- Autosave is fingerprint-driven and debounced (220ms).
- Fingerprint ignores transient click-only selection fields (for fewer meaningless writes).
- `beforeunload` flushes pending autosave.

### Workspace file import/export

- Export format: `WorkspaceFile` (`kind`, `version`, timestamp, sanitized workspace payload).
- Import path validates kind/version and sanitizes before replacing in-memory workspace.

### PDF export

- Dynamic imports: `html-to-image` + `jspdf`.
- Export captures per-room DOM targets (`data-floorplan-export-room`), trims transparent bounds, and writes one or many PDF pages.
- Measurements can be toggled per-line for PDF inclusion.

### Service worker

- Build-id versioned shell/runtime caches.
- Navigation: network-first with app-shell fallback.
- Static assets: stale-while-revalidate.

## 8. Performance Strategy

Key techniques already in place:

- Local interaction buffering in `RoomCanvas`.
- `requestAnimationFrame` scheduling for pointer move processing.
- Component memoization (`memo`) and explicit prop comparators.
- History deduplication via structural equality helpers.
- Optional debug telemetry for layout and scroll frame timing.

## 9. Testing Strategy

Current automated tests (Node test runner) cover utility contracts:

- `tests/workspaceState.test.ts`: migration and reorder behavior.
- `tests/workspaceFile.test.ts`: export/import schema validation.
- `tests/autosave.test.ts`: autosave fingerprint semantics.
- `tests/exportCapture.test.ts`: capture-size fallback logic.

Most UI interactions are not yet covered by integration/e2e tests.

## 10. How To Extend Safely

When adding features, preserve these rules:

1. Keep geometry in centimeters in state.
2. Add/adjust sanitization and migration logic in `workspaceState.ts` for persisted schema changes.
3. Route state mutations through `updateWorkspace` / `updateRoom` (do not mutate nested state directly).
4. For high-frequency pointer interactions, buffer locally and commit once.
5. Ensure new interactive state does not pollute autosave fingerprints unless persistence is intended.
6. Add focused utility tests for new domain/persistence behavior.

## 11. Known Technical Debt

- `src/App.tsx` is large and mixes orchestration with UI assembly.
- Some components appear legacy/unwired (`AddObjectPanel`, `RoomOnboardingPanel`).
- Limited UI-level automated testing for drag/measure/export workflows.

The current structure is still coherent; refactors should be incremental and guided by concrete feature pressure.
