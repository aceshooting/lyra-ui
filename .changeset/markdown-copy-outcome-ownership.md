---
'@aceshooting/lyra-ui': patch
---

Stop obsolete Markdown code-copy feedback after a copy outcome listener disconnects the component, disables its code-block header, or starts another copy. Both Markdown variants now recheck the active copy before announcing feedback or scheduling its reset, preventing timers from surviving teardown or replacing a newer copy's timer.

The shared fix adds 13 gzip bytes to the largest component and 141 unpacked package bytes with its guidance. Only the exceeded component maximum and unpacked package budgets advance to the next 64-byte boundary; passing limits remain unchanged.
