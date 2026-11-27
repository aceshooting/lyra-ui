---
"@aceshooting/lyra-ui": patch
---

`lr-transfer-manager` reports more accurate queue metrics. Failed and cancelled transfers leave the overall progress, so a queue with a cancelled item can reach 100 %. The overall remaining time counts only bytes still due from active and queued transfers. Remaining time appears only on active rows. Throughput and remaining time expire after ten seconds without a new snapshot, so a stalled connection reads as unknown rather than as its last speed. Rates scale from B/s to GB/s, hours keep one decimal, and the collapsed percentage rounds down so an unfinished queue never reads 100 %. Completion and failure of a transfer are now announced to assistive technology.
