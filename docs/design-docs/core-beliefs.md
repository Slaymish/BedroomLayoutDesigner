# Core Beliefs

This document defines what Bedroom Layout Designer is trying to do and how the current UI expresses that intent.

## Core Mission

Bedroom Layout Designer helps people make practical bedroom layout decisions quickly, in a browser, without setup friction.

The product should make it easy to:

- Sketch and iterate on bedroom configurations.
- Place and adjust furniture, doors, windows, and measurements with precision.
- Keep work safe through autosave and portable through import/export.
- Produce shareable outputs (PDF) for planning and discussion.

## Product Beliefs

- Geometry truth stays in centimeters in state; unit conversion happens only at input/output boundaries.
- Workspace state is durable and user-owned (local autosave + JSON workspace files).
- Interactions should feel direct and reversible (clear editing affordances + undo/redo).
- High-frequency canvas work must stay responsive; expensive updates should be buffered and committed deliberately.
- Defaults should be useful, while allowing custom room and object editing for real-world variation.

## Current Style Baseline

The current interface style can be described as:

- Calm, practical, and legible rather than decorative.
- Soft card/surface layering with clear borders and subtle depth.
- Teal-forward accent system for primary actions and focus states.
- Dense but structured controls optimized for tool-like workflows.
- Light/dark theme token parity through CSS variables.

## Current Visual Tokens (Source of Truth)

Visual styling is currently defined in:

- `src/index.css`: global tokens (colors, typography, spacing primitives, theme variables).
- `src/App.css`: component-level class styling and interaction states.

Notable style characteristics from the current code:

- Typography uses `Plus Jakarta Sans` as primary UI/display font.
- Surfaces emphasize off-white and muted blue/teal neutrals in light mode.
- Focus and selection rely on cool cyan/teal rings and borders.
- Components use rounded corners with a soft-shadow, low-contrast card aesthetic.

## Interaction Style

- Controls are explicit and tool-like (buttons, chips, form fields with strong hover/focus states).
- Canvas-first workflows prioritize immediacy (drag/resize/draw) while avoiding noisy global rerenders.
- Validation and warnings are direct, contextual, and minimal.

## Design Guardrails

When extending the UI, keep these constraints:

- Preserve a utility-focused interface over ornamental complexity.
- Keep readability high under both themes and on smaller screens.
- Reuse token-driven styling patterns before introducing one-off values.
- Keep editing operations discoverable and reversible.

