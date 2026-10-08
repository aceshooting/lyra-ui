---
'@aceshooting/lyra-ui': patch
---

Hand-wired form controls now inherit `getForm()`, `labels`, `validity`, `validationMessage` and `willValidate` from one shared base instead of per-class copies; `lr-slider` label, readout, reference and hint text now wrap at word boundaries (`overflow-wrap: break-word`). No API change.
