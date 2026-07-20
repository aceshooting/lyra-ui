---
"@aceshooting/lyra-ui": patch
---

Raise `lr-trace-tree`'s active-row status labels to clear WCAG AA without flattening their hue.
`[part='status-text']` on the active row now renders
`color-mix(in srgb, var(--lr-color-<tone>) 75%, var(--lr-color-text))` for each semantic tone —
success moves from 4.46:1 to 6.18:1 and `denied` from 4.28:1 to 5.96:1 against the default active
tint, while `error` and `running` (which only barely cleared the floor) gain headroom too. Keeping
the hue matters: an error row that stops being red once selected loses the fastest scan signal in a
trace list.

The mix is applied to every semantic tone rather than only the two that fail at the shipped
defaults, because a per-status carve-out is theme-fragile — a consumer retheming one `--lr-color-*`
moves that ratio and would silently re-break. It is also theme-symmetric by construction:
`--lr-color-text` flips with the color scheme, so the same declaration darkens the label in light
mode and lightens it in dark mode. `[part='bar']` is deliberately untouched — it is a non-text
graphic on a 3:1 floor it already passes, and scoping the mix to `[part='status-text']` avoids
re-pointing a consumer's own `--lr-color-*` override inside one row.
