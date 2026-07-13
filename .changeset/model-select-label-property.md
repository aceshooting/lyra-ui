---
"@aceshooting/lyra-ui": minor
---

`<lyra-model-select>`: added a `label` property that renders a visible `part="form-control-label"` title above the trigger/combobox, paired with it via `for`/`id`, mirroring `<lyra-select>`'s own `label` exactly. Once non-empty it also takes over as the accessible-name source, with an explicit host `aria-label` still winning over it (same precedence as `lyra-select`). Unset (the default), the control keeps today's exact `aria-label || placeholder || 'Model'` fallback chain unchanged.
