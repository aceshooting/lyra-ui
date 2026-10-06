---
"@aceshooting/lyra-ui": patch
---
`lr-csv-viewer` and `lr-dataset-viewer` no longer stay in their "parser unavailable" fallback for the rest of the page after one failed load of the optional `papaparse` peer (for example a chunk request made while offline): the next load retries. In development, a resolved module without a usable `parse()` now reports the same one-time diagnostic as a missing peer instead of failing silently.
