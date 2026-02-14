# User Story Workflow

This workflow gives you a consistent way to decide what agents should work on next.

## What this system does

- Stores personas in `docs/user-story-workflow/personas.json`.
- Stores stories in `docs/user-story-workflow/backlog.json`.
- Links each story to one or more personas.
- Scores and ranks stories using a transparent formula.
- Produces an agent-ready prioritized list.

## Story lifecycle

Use these statuses in `backlog.json`:

- `backlog`: captured but not ready.
- `ready`: clear enough to assign to an agent.
- `in_progress`: currently being implemented.
- `done`: shipped/complete.
- `icebox`: intentionally postponed.

## Scoring model

Priority score formula used by `npm run stories:prioritize`:

`((impact * 2) + urgency + riskReduction + confidence) / effort`

Scoring fields should be integers from 1-5:

- `impact`: user value if shipped.
- `urgency`: time pressure.
- `riskReduction`: debt/risk removed by doing it.
- `confidence`: how sure you are in scope/solution.
- `effort`: implementation size/complexity (higher = harder).

Higher score means higher priority.

## Working loop

1. Add or update personas in `personas.json`.
2. Add stories in `backlog.json` with persona links (`personaIds`) and acceptance criteria.
3. Mark stories `ready` once they are specific and testable.
4. Run `npm run stories:prioritize`.
5. Pick the top ranked `ready` story and assign it to an agent.
6. Set status to `in_progress`, then `done` when complete.

## Agent handoff checklist

Before assigning a story to an agent, make sure it has:

- Clear problem statement (`story`).
- At least one persona in `personaIds`.
- Concrete acceptance criteria (observable behavior).
- Constraints and hints in `agentHints`.
- Reasonable scoring values.

## Commands

Run from repository root:

```bash
npm run stories:prioritize
npm run stories:prioritize -- --status ready,backlog --limit 8
npm run stories:prioritize -- --all
```

## Tips

- Keep stories small enough for one agent-sized delivery.
- Split stories when effort is high and confidence is low.
- Re-score stories weekly so priorities reflect current goals.
