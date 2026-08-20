---
"@aceshooting/lyra-ui": patch
---

Documented that `<lr-chart>`'s `description` **replaces** the generated accessible summary rather
than adding to it.

Unset, the component builds an sr-only per-series summary from the actual data; set, it discards
that summary entirely and substitutes the supplied text. That is the right behaviour for a full
override, but the property was documented only as "Accessible chart description", which reads as
additive — and a consumer adding a one-line caveat to five charts would have silently traded away
the data summary on all five. They caught it by reading the source, and applied it only where the
trade was actually wanted.

No behaviour change; the JSDoc and the family reference now state the trade and point at the better
tool for a caveat, which is visible text beside the chart rather than a note only screen-reader
users hear.
