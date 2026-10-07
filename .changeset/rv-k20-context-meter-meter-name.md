---
"@aceshooting/lyra-ui": major
---
lr-context-meter: the hidden meter is now named by a host `aria-label` (else `label`) and speaks the "X of Y used" summary as `aria-valuetext`, instead of naming itself "label: X of Y used" and ignoring the host name; counts keep their fraction digits (0.4 no longer reads "0") and the summed value is snapped. Migration: read the summary from `aria-valuetext`; `contextMeterLabeledSummary` no longer shapes this component's name.
