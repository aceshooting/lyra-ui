---
"@aceshooting/lyra-ui": patch
---
lr-histogram: bucket labels in CSV exports, event details, formatter metadata and accessible text no longer carry invisible bidi isolate characters; each surface isolates the label itself, so right-to-left pages still read ranges left-to-right (`binValues()` output is unchanged).
