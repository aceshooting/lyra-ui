---
"@aceshooting/lyra-ui": minor
---

`<lr-export-button>`: expose the trigger's paint as public custom properties.

The component resolved nine paint values — resting, hover and active fill/label/border — but only
through private `--_lr-export-button-*` names, so the one and only way to repaint a trigger was to
reach for `::part(trigger)`. Its sibling `lr-button` has layered the same nine over public
`--lr-button-*` names for a long time; this is that pattern, applied here.

`--lr-export-button-background`, `--lr-export-button-color`, `--lr-export-button-border` and the
matching `--lr-export-button-hover-*` / `--lr-export-button-active-*` triples each layer over
whatever the current `appearance` resolves to and leave the other paints untouched.

That last point is the reported case. `appearance="outlined"` paints the label `--lr-color-brand`,
and `lr-export-button` — unlike `lr-button` — has no `variant` of its own to return it to neutral
text, so an outlined trigger sitting next to neutral-text buttons could not be matched through
documented properties at all. `--lr-export-button-color` is now that escape hatch.

Nothing changes for a consumer who sets none of them: every `appearance` still resolves exactly the
values it did, and the private defaults are untouched.
