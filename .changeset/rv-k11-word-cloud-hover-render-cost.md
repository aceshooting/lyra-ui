---
"@aceshooting/lyra-ui": patch
---
lr-word-cloud: moving the pointer across the cloud no longer re-reads computed styles or re-parses every word and legend colour; fills, the derived legend and the keyboard order are computed once per layout, palette or theme change.
