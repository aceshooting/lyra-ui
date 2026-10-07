---
"@aceshooting/lyra-ui": patch
---
lr-checkbox-group no longer re-queries and re-scans every option on each child write and render, so selecting all or mounting hundreds of options is linear instead of quadratic.
