# Agent-Ready Prompts

Use these prompts to assign prioritized `ready` stories to coding agents.

## US-007 Keyboard delete for selected objects

```
Implement user story US-007 from docs/user-story-workflow/backlog.json.

Goal:
Add keyboard delete support so selected objects can be removed using Delete/Backspace without opening the edit panel.

Acceptance criteria:
1. Pressing Delete or Backspace removes selected objects when canvas/object focus is active.
2. Keyboard delete does not trigger while typing in text or number input fields.
3. Deletion remains undoable through existing undo/redo flow.

Constraints:
- Keep geometry in centimeters in state.
- Route all workspace mutations through App update flow (no direct nested mutation).
- Preserve autosave/import/export behavior.
- Keep high-frequency interactions responsive.

Likely files:
- src/App.tsx
- src/components/RoomCanvas.tsx
- src/components/EditObjectPanel.tsx
- tests/ (add/update targeted tests)

Validation:
- npm run test
- npm run lint
- npm run build

Deliverable:
Return a concise summary of code changes and any test additions.
```

## US-009 Auto-exit measure mode after creation

```
Implement user story US-009 from docs/user-story-workflow/backlog.json.

Goal:
After creating one measure line, automatically exit measure mode to prevent accidental extra measures.

Acceptance criteria:
1. After creating a measure line, measure mode turns off automatically.
2. Users can create another measure by explicitly re-enabling measure mode.
3. Accidental extra measure creation is reduced in move/edit workflows.

Constraints:
- Keep existing measurement data model and cm-based geometry invariants.
- Avoid regressions in object drag/resize behavior.
- Preserve undo/redo expectations around measurement creation.

Likely files:
- src/App.tsx
- src/components/RoomCanvas.tsx
- tests/ (add/update focused behavior tests)

Validation:
- npm run test
- npm run lint
- npm run build

Deliverable:
Return a concise summary with before/after measure-mode behavior.
```

## US-006 Improve wall measure drag affordance

```
Implement user story US-006 from docs/user-story-workflow/backlog.json.

Goal:
Make wall-based measurement drag interactions easier to discover and execute.

Acceptance criteria:
1. Wall measure drag handles are visually clearer and easier to target.
2. Starting a wall-based measurement requires fewer failed attempts.
3. No regression to existing room/object dragging behavior.

Constraints:
- Preserve current design language and token system.
- Keep pointer interaction path performant in RoomCanvas.
- Do not degrade mobile usability.

Likely files:
- src/components/RoomCanvas.tsx
- src/App.css
- src/index.css
- tests/ (utility or interaction-focused tests where feasible)

Validation:
- npm run test
- npm run lint
- npm run build

Deliverable:
Return a concise summary and describe the final affordance changes.
```
