---
"@aceshooting/lyra-ui": major
---

Every floating surface in the library now paints from one shared overlay token family, so a
consumer restyles every popup from one place.

`--lr-overlay-surface`, `--lr-overlay-border` and `--lr-overlay-radius` are read by `<lr-popover>`'s
and `<lr-dropdown>`'s popup (and its arrow, fill and edge only — never the radius, whose corners its
clip path already cuts), `<lr-select>`'s and `<lr-locale-picker>`'s listbox, `<lr-combobox>`'s
popup, `<lr-menu>`'s own surface and its submenu surface, and `<lr-dialog>`'s and `<lr-drawer>`'s
panel, including the dialog's header and footer rules and its close button's corner. Every other
anchored surface in the library moved with them, so the family really is one place: `<lr-mention-popover>`'s
and `<lr-voice-picker>`'s and `<lr-model-select>`'s listbox, `<lr-color-picker>`'s panel,
`<lr-export-button>`'s menu popup and `<lr-selection-toolbar>`'s toolbar. Elevation
stays two names rather than one, because it is the one property of a floating surface that differs
by kind rather than by theme: `--lr-overlay-shadow-anchored` (default `var(--lr-shadow-m)`) for
positioner-placed popups, listboxes, menus and submenus, and `--lr-overlay-shadow-modal` (default
`var(--lr-shadow-xl)`) for modal panels — so raising popups never raises dialogs.

None of the five is declared on `:host`. That is what makes the family a real cascade point: an
undeclared custom property inherits, so one declaration on `:root` retints every overlay in the
application, and the same declaration on any other ancestor scopes the retint to that subtree.
Before this, the surface tokens each popup read were declared per `:host` by the token layer, so
"a popup surface is not a control surface" could not be expressed at all — retinting a popup meant
retinting every card, panel and input behind it.

A component that already publishes its own hook keeps it as the outer arm: `<lr-locale-picker>`'s,
`<lr-voice-picker>`'s, `<lr-model-select>`'s and `<lr-color-picker>`'s surfaces each resolve
`var(--lr-<component>-radius, var(--lr-overlay-radius, …))`, so a component-scoped override still
wins over the shared name.

**Breaking — anchored popups move onto the overlay surface, a visible dark-mode change.** An
anchored popup, listbox or menu surface previously painted `--lr-color-surface`, the page surface;
it now paints `--lr-color-surface-overlay`, the surface a panel floating over the page uses. In
light mode the two resolve to the same value and nothing changes. In dark mode the overlay surface
is a distinctly lighter near-black, so a popup that used to be the same colour as the page behind it
now reads as a raised object — which is the point, but it *is* a visible change. To restore the
previous colour, set `--lr-overlay-surface: var(--lr-color-surface)` on `:root`.

`<lr-tooltip>` is a deliberate exclusion: a tooltip bubble is a high-contrast label, not a panel, so
it keeps `--lr-tooltip-background`/`--lr-tooltip-color`, no border, and its tighter corner.
`<lr-drawer>` reads the family's fill and edge but keeps squaring its own corners and stepping its
own elevation down, because three of its edges are flush with the viewport.

`<lr-menu-item>` also gains three row-chrome hooks, each an inline fallback so unset rendering is
byte-identical: `--lr-menu-item-hover-bg` (default `var(--lr-color-brand-quiet)`, and the pressed
state now mixes from that same value, so a retuned hover fill keeps its pressed step),
`--lr-menu-item-icon-color` (default `inherit`) and `--lr-menu-item-min-height` (default
`max(var(--lr-form-control-height), var(--lr-size-24px))`).

`<lr-dialog>`'s reference entry previously listed `--lr-color-surface`, a bare `--lr-shadow` and
`--lr-easing-standard` among the shared tokens its panel reads. None of the three has ever appeared
in a declaration in the dialog's stylesheet; the entry now states the overlay-family tokens and the
shared tokens the panel and its chrome really consume. `<lr-mention-popover>`'s entry carried the
same invented `--lr-shadow`, and is corrected the same way.
