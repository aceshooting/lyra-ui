---
name: compose-lyra-interfaces
description: Design and implement coherent interfaces with @aceshooting/lyra-ui and lr-* custom elements. Use when selecting Lyra components for a page, dashboard, form, data view, retrieval flow, conversation or agent experience; composing responsive layouts and application states; or reviewing a Lyra interface for accessibility, localization, RTL, theming, framework binding, and granular imports.
---

# Compose Lyra Interfaces

Turn product intent into a small, coherent Lyra component hierarchy, then implement and verify it.
Use the separate `$lyra-ui` API skill or the installed package's `llms.txt` reference for exact
properties, events, slots, parts, custom properties, peers, and import paths before writing code.

## Workflow

1. **Frame the experience.** Identify the primary user outcome, critical actions, data ownership,
   navigation boundary, and failure modes. Ask only for choices that materially change the result.
2. **Inventory exact contracts.** Look up every candidate tag. Prefer an existing Lyra or native
   primitive over inventing a wrapper. Record optional peers and stable/experimental status.
3. **Sketch structure before chrome.** Start with semantic page regions and native headings/forms.
   Add Lyra layout, control, data, feedback, and overlay primitives only where they provide a real
   contract. Read [references/composition-patterns.md](references/composition-patterns.md) for
   selection and state patterns.
4. **Model states and transitions.** Cover initial, loading, populated, empty, error, disabled or
   read-only, and destructive/confirmation states that apply. Define event detail, focus movement,
   cancellation, and ownership of controlled values.
5. **Design across constraints.** Check narrow allocation and long content first, then wide layout.
   Include RTL, translated strings, keyboard-only use, reduced motion, forced colors, and both
   supported theme modes. Use logical CSS and Lyra tokens/utilities.
6. **Implement with stable boundaries.** Import registration modules through stable tag-shaped
   paths such as `@aceshooting/lyra-ui/components/lr-input.js`. Bind objects, arrays, functions, and
   sets as properties. Listen for kebab-case CustomEvents through the framework's DOM event path.
   Do not add runtime framework wrappers.
7. **Verify the experience.** Exercise keyboard and focus order, names/roles/states, form submit and
   reset, loading/empty/error recovery, 320px allocation, long translated content, RTL arrows,
   reduced motion, forced colors, SSR/hydration where applicable, and optional-peer failure. Run
   automated accessibility checks on populated/open states. Report human visual or assistive-
   technology review only when it actually occurred.

## Output contract

Deliver:

- a concise hierarchy and state model;
- exact component/import choices with optional peers called out;
- framework-correct property and event bindings;
- responsive, accessibility, localization, RTL, theme, motion, and SSR decisions;
- executable implementation or a file-specific implementation plan, as requested; and
- verification performed plus genuine pending limitations.

Keep examples on granular imports. Never copy upstream source, styles, token values, prose, or
branding. Do not claim undocumented parity or invent a public member from memory.
