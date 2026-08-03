# Lyra composition patterns

Use this reference after the product outcome is known. Confirm each named component's exact public
contract in `$lyra-ui` or the package reference before emitting markup.

## Select the smallest layer that owns the contract

| Need | Start with | Add only when needed |
|---|---|---|
| Document structure | Native `main`, `nav`, `section`, headings, lists, and forms | `lr-page` or application-shell components when their named regions and responsive behavior fit |
| Flow and wrapping | `utilities.css` stack, cluster, grid, gap, alignment, and sizing classes | A stateful layout component for resizing, collapse, rails, or managed navigation |
| Data entry | A form-associated Lyra control with visible label and hint | Grouping, validation summary, conditional fields, or confirmation around the real form owner |
| Data display | Native text/list for small static content | Table, data grid, tree, virtual list, chart, or viewer when their interaction contract is required |
| Feedback | Inline text near the action | Alert, progress, skeleton, spinner, empty state, toast, or live announcement based on urgency and persistence |
| Transient UI | Inline disclosure when space permits | Popover, dropdown, drawer, or dialog when focus/dismissal/stacking behavior is genuinely needed |

Do not nest a component merely to obtain padding or a border. Use layout utilities and semantic
containers for visual grouping; reserve interactive components for interactions they own.

## Build a state matrix

For every data-backed region, decide which rows apply:

| State | Content | Interaction and focus |
|---|---|---|
| Initial | Explain the task or show the stable shell | Put focus only where the user can act |
| Loading | Preserve useful geometry; label indeterminate work | Keep unrelated actions available; do not announce on first mount without intent |
| Populated | Expose primary content before secondary metadata | Define selection, activation, sorting, pagination, and keyboard ownership |
| Empty | Distinguish no data from no filtered results | Offer the next useful action and preserve the user's filter when appropriate |
| Error | Use localized, actionable language | Place retry near the failure; return focus only after a user-triggered transition |
| Disabled/read-only | Explain unavailable actions where necessary | Disable every subordinate action, not only the primary control |

Keep remote-content and optional-peer failures separate from a valid empty result. Never render raw
caught error messages into user-facing status UI.

## Compose common experiences

### Form flow

Use one native `form` as the submission boundary. Give each Lyra control its public `name`, visible
label, hint, and error path. Keep the submit action in the same form, rely on form-associated
behavior, and verify submit, reset-to-default, fieldset-disabled, invalid, and server-error paths.
Do not duplicate a shadow control's label with an unresolved cross-shadow `aria-labelledby`.

### Data workspace

Separate query/filter controls, results status, and the results surface. Preserve filters while
loading or retrying. Use a table for comparable columns, a tree for hierarchy, a virtual list for
large linear data, and a chart only when the visual relationship conveys more than a text summary.
Provide an accessible label and a non-visual equivalent for meaningful graphics.

### Responsive application shell

Lay out semantic regions first. Let reusable content respond to its own allocation; use a shell's
viewport behavior only for true application navigation. At narrow widths, preserve reading and tab
order when a rail becomes a drawer or panels stack. Test at 320px with long labels, then repeat in
RTL so logical start/end and arrow semantics remain correct.

### Conversation or agent flow

Keep message history, current run state, tool approvals, artifacts, and composer responsibilities
separate. Announce user-triggered status transitions without replaying initial state. Put destructive
or consequential tool actions behind an explicit confirmation/approval contract, and keep focus
return deterministic when transient UI closes.

## Implementation handoff checklist

- Register only rendered tags through stable tag-shaped imports.
- Import the framework's type-only declaration entry once.
- Bind complex values as properties; do not serialize objects into attributes.
- Use the documented CustomEvent name and exact detail type; decide whether cancellation matters.
- Use caller data verbatim but localize library-owned labels and announcements.
- Use logical CSS, Lyra tokens, and allocation-aware layout.
- Record SSR mode, optional peers, remote-content boundaries, and failure behavior.
- Test populated/open accessibility, keyboard/focus, narrow/long content, RTL, reduced motion,
  forced colors, form semantics, reconnect, and framework type/build integration as applicable.
