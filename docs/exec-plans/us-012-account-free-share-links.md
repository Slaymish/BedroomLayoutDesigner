# Account-Free Share Links for In-Progress Layouts (US-012)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes `PLANS.md` at the root. This document is maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

After this change, users can generate a shareable link for their current layout without creating an account. When someone opens that link, they can load the shared layout in the app and continue working from it.

The change must preserve trust in local data. A shared link must not silently overwrite the viewer's existing browser autosave. The behavior must be explicit: viewers can choose to open a shared layout temporarily, keep their local workspace, or adopt the shared layout as their saved local workspace.

You can observe success by opening `/app`, creating a share link, opening it in a second browser session, loading the shared layout, and then returning to local work without losing existing autosave.

## Progress

- [x] (2026-02-15 01:08Z) Reviewed `PLANS.md`, `US-012` backlog entry, and current workspace import/export + autosave flow in `src/App.tsx`.
- [x] (2026-02-15 01:10Z) Audited file boundaries in `src/utils/workspaceFile.ts`, `src/utils/workspaceState.ts`, `src/components/PreferencesPanel.tsx`, and `tests/workspaceFile.test.ts`.
- [x] (2026-02-15 01:13Z) Authored this implementation ExecPlan in `docs/exec-plans/us-012-account-free-share-links.md`.
- [x] (2026-02-15 01:28Z) Implemented Milestone 1: added `src/utils/workspaceShare.ts`, added `WorkspaceSharePayload` type, and added `tests/workspaceShare.test.ts`.
- [x] (2026-02-15 01:35Z) Implemented Milestone 2: added `Share Workspace` action in `PreferencesPanel` and `handleShareWorkspace` link generation/copy flow in `App`.
- [x] (2026-02-15 01:41Z) Implemented Milestone 3: added inbound `#share=` parsing, explicit open/keep decision UI, shared-session controls, and autosave pause/resume safeguards.
- [x] (2026-02-15 01:50Z) Implemented Milestone 4: updated architecture documentation and validated with `npm run test`, `npm run lint`, and `npm run build`.

## Surprises & Discoveries

- Observation: `App` hydration currently restores local storage immediately and autosave starts once hydrated.
  Evidence: `src/App.tsx` restores `STORAGE_KEY` in an effect, then autosave effects track workspace changes and persist on debounce.

- Observation: Existing workspace import (`Load Workspace`) requires explicit user confirmation before replacing state.
  Evidence: `handleLoadWorkspaceFile` in `src/App.tsx` parses JSON and calls `window.confirm` before `setWorkspace(imported)`.

- Observation: There is no existing share or URL-state utility; import/export is currently file-based only.
  Evidence: `src/utils/workspaceFile.ts` exports file parse/build/download helpers only.

## Decision Log

- Decision: Use URL hash payloads (`/app#share=...`) for account-free sharing.
  Rationale: Hash payloads require no backend and avoid server-side query-string logging by default while remaining copy/paste friendly.
  Date/Author: 2026-02-15 / Codex

- Decision: Keep shared-link payload format separate from file export format.
  Rationale: File exports are long-lived artifacts; share links need compact, versioned URL-safe encoding and separate limits.
  Date/Author: 2026-02-15 / Codex

- Decision: Introduce explicit shared-session mode that pauses autosave until user opts in to saving.
  Rationale: This directly satisfies the requirement that share-link behavior does not corrupt local autosaved work.
  Date/Author: 2026-02-15 / Codex

- Decision: Add hard payload length guard with actionable fallback.
  Rationale: URL sizes vary by environment; when payload is too large, users should get a clear message to use JSON export.
  Date/Author: 2026-02-15 / Codex

## Outcomes & Retrospective

Outcome: `US-012` is implemented in the app codebase with account-free share links and explicit local-data safety behavior.

What worked well:

- Share payload logic stayed isolated in a utility module with targeted tests.
- Existing autosave architecture accepted a narrow pause gate (`autosaveWritesEnabled`) without large refactors.
- Reusing existing info/error message channels kept UX changes focused.

Remaining follow-up:

- Manual browser QA should still be run across desktop/mobile to verify clipboard fallback behavior and the full open/save/restore flow in real sessions.

## Context and Orientation

Bedroom Layout Designer is currently a browser-only app with local autosave and JSON import/export. Core orchestration is in `src/App.tsx`; persistence schema and sanitization live in `src/utils/workspaceState.ts`; import/export helpers live in `src/utils/workspaceFile.ts`; workspace action buttons live in `src/components/PreferencesPanel.tsx`.

Critical current behavior for this work:

- Local workspace is restored from `localStorage` key `STORAGE_KEY` during hydration.
- Autosave writes current workspace on a short debounce once hydrated.
- Manual import/export is explicit and user-confirmed.

Because autosave is automatic, shared-link loading must be designed to avoid accidental writes to local saved work.

Key files to modify:

- `src/utils/workspaceShare.ts` (new): share payload encode/decode and URL parsing helpers.
- `src/App.tsx`: generate share links, parse inbound links, shared-session state, autosave pause/restore logic.
- `src/components/PreferencesPanel.tsx`: add a `Share Workspace` action.
- `src/types.ts`: add share-payload types if needed.
- `tests/workspaceShare.test.ts` (new): round-trip and guardrail tests.
- `ARCHITECTURE.md`: include share utility and shared-link flow after implementation.

Terms used in this plan:

- Shared session: a temporary mode where a shared layout is open but autosave to local storage is paused.
- Adopt shared layout: user action that promotes shared session data into normal local autosave state.
- Share payload: serialized, versioned workspace data encoded into a URL-safe string.

## Plan of Work

Milestone 1 creates a dedicated share utility with strict validation and size limits. The utility will sanitize decoded workspace data and reject unsupported payloads, similar to file import safety rules.

Milestone 2 adds outbound sharing UI in the existing workspace actions area. Users can click `Share Workspace`, copy a link to clipboard, and receive clear feedback when link generation succeeds or fails due to payload size.

Milestone 3 implements inbound shared-link handling in `App.tsx`. Opening `/app#share=...` should present an explicit decision UI. Choosing to open shared content starts a shared session with autosave paused. Users can then either adopt and save shared content or return to their previous local workspace.

Milestone 4 hardens and documents behavior: validation commands, architecture docs updates, and ExecPlan evidence capture.

## Milestones

### Milestone 1: Share utility and tests

At the end of this milestone, share encode/decode logic is isolated, versioned, and tested.

Implementation details:

- Add `src/utils/workspaceShare.ts` with:
  - `buildWorkspaceSharePayload(workspace)`
  - `encodeWorkspaceSharePayload(payload)`
  - `decodeWorkspaceSharePayload(encoded)`
  - `readSharePayloadFromHash(hash)`
  - explicit max encoded-length guard (`MAX_SHARE_LINK_LENGTH`)
- Reuse sanitization and bounds checks (`sanitizeWorkspaceState`, `findWorkspaceBoundsViolation`) before returning decoded workspace.
- Add `tests/workspaceShare.test.ts` for:
  - round-trip encode/decode success,
  - invalid payload rejection,
  - oversized payload rejection,
  - workspace bounds rejection.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test

Acceptance:

- New share utility functions are deterministic and pure.
- Tests prove malformed links cannot produce unsafe workspace state.

### Milestone 2: Outbound share link generation

At the end of this milestone, users can generate and copy a share link from the app without logging in.

Implementation details:

- Extend `PreferencesPanel` props with `onShareWorkspace?: () => void`.
- Add `Share Workspace` button in the workspace action section.
- In `App.tsx`, implement `handleShareWorkspace` that:
  - builds payload from `workspaceRef.current`,
  - encodes payload and constructs `${origin}/app#share=<payload>`,
  - copies link via `navigator.clipboard.writeText` with fallback message.
- Surface status in existing info/error message channels.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run lint

Acceptance:

- Clicking `Share Workspace` produces a copyable URL when within length limits.
- If payload is too large, user sees clear fallback guidance (use JSON export).

### Milestone 3: Inbound share flow with autosave safety

At the end of this milestone, opening a share link can restore shared layout data without corrupting existing autosaved local workspace.

Implementation details:

- Add shared-link parse step in `App.tsx` after hydration.
- Add state for:
  - `pendingSharedWorkspace` (decoded candidate not yet loaded),
  - `isSharedSessionActive`,
  - `localWorkspaceBeforeShare` snapshot.
- Add explicit UX choices when a shared payload is present:
  - `Open Shared Layout` (start shared session, pause autosave writes),
  - `Keep My Local Workspace` (dismiss payload),
  - if shared session is active: `Save Shared Layout To This Browser` and `Return To My Local Workspace`.
- Gate autosave write effects behind a boolean (for example `autosaveWritesEnabled`) so shared sessions do not write to `STORAGE_KEY` unless user explicitly saves.
- Clear hash payload from URL after it is consumed using `history.replaceState` so refresh does not repeatedly re-prompt.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test
    npm run build

Acceptance:

- Opening `/app#share=...` presents explicit choices.
- Local autosave remains unchanged unless user selects save/adopt action.
- User can return to prior local workspace within the same session.

### Milestone 4: Final validation and docs

At the end of this milestone, behavior is validated and repository docs are aligned.

Implementation details:

- Update `ARCHITECTURE.md` to document share utility and shared-session/autosave interaction.
- Update this ExecPlan with completed progress, evidence, and final outcomes.
- Keep backlog story and status aligned with actual implementation state.

Commands:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner
    npm run test
    npm run lint
    npm run build

Acceptance:

- All quality gates pass.
- Manual flow confirms both link sharing and safe recovery of local workspace.

## Concrete Steps

Run from repository root:

    cd /home/hamishburke/Documents/BedroomLayoutDesigner

1. Add `src/utils/workspaceShare.ts` and `tests/workspaceShare.test.ts`.
2. Add `onShareWorkspace` wiring in `src/components/PreferencesPanel.tsx` and `src/App.tsx`.
3. Implement inbound hash parsing and shared-session autosave guard in `src/App.tsx`.
4. Add shared-session controls/messages in app UI for adopt/restore actions.
5. Update `ARCHITECTURE.md` and this plan's living sections.
6. Run:

    npm run test
    npm run lint
    npm run build

Expected transcript summary after completion:

    npm run test
    # tests <N>
    # pass <N>
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite ...
    ✓ built in <time>

## Validation and Acceptance

Manual validation flow:

1. In `/app`, build or open a layout and click `Share Workspace`.
2. Paste link into a second browser profile/session and open it.
3. Confirm app offers explicit choices instead of silently replacing local state.
4. Choose `Open Shared Layout` and verify layout loads.
5. Choose `Return To My Local Workspace` and confirm prior layout is restored.
6. Re-open share link, choose `Save Shared Layout To This Browser`, and confirm autosave status returns to normal.

Automated validation:

- `npm run test`
- `npm run lint`
- `npm run build`

Behavioral acceptance criteria:

- Users can generate share links without accounts.
- Shared links restore workspace state reliably.
- Local autosave is protected unless the user explicitly adopts shared state.
- Limits and privacy caveats are documented in UI/help text.

## Idempotence and Recovery

This implementation is safe to run repeatedly. Parsing and applying share payloads should be side-effect free until explicit user choice.

Recovery rules:

- If decoding fails, keep current workspace unchanged and show an error message.
- If user exits shared session, restore `localWorkspaceBeforeShare` and re-enable autosave writes.
- If clipboard write fails, still present the generated link in a user-copyable fallback prompt.

## Artifacts and Notes

Implemented artifacts:

    src/utils/workspaceShare.ts
    tests/workspaceShare.test.ts
    src/types.ts (WorkspaceSharePayload)
    src/components/PreferencesPanel.tsx (Share Workspace action)
    src/App.tsx (outbound share, inbound hash parsing, shared-session controls, autosave guard)
    ARCHITECTURE.md (share-link architecture + autosave interaction)

Validation transcript summary:

    npm run test
    # tests 10
    # pass 10
    # fail 0

    npm run lint
    eslint .

    npm run build
    vite v7.2.6
    ✓ built in 3.83s

## Interfaces and Dependencies

No backend service or account system is introduced.

Planned interfaces:

In `src/utils/workspaceShare.ts`:

    export interface WorkspaceSharePayload {
      kind: 'BedroomLayoutShare';
      version: 1;
      createdAtIso: string;
      workspace: WorkspaceState;
    }

    export const MAX_SHARE_LINK_LENGTH: number;
    export const buildWorkspaceSharePayload: (workspace: WorkspaceState) => WorkspaceSharePayload;
    export const encodeWorkspaceSharePayload: (payload: WorkspaceSharePayload) => string;
    export const decodeWorkspaceSharePayload: (encoded: string) => WorkspaceState;
    export const readSharePayloadFromHash: (hash: string) => WorkspaceState | null;

In `src/components/PreferencesPanel.tsx`:

    onShareWorkspace?: () => void;

No external dependencies are required for the baseline implementation. If a compression dependency is later added to improve long-link success rates, that change must include dedicated tests and an explicit Decision Log update in this plan.

Revision Note (2026-02-15 / Codex): Created this ExecPlan from `US-012` backlog requirements and current autosave/import architecture, with explicit safeguards to prevent shared-link flows from overwriting local browser workspace data.
