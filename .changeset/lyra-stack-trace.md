---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-stack-trace>`: parses V8/JS-TS, Firefox/Safari, and Python stack traces (including
chained-error groups) into a message plus collapsible, activatable frames (`lyra-frame-select`),
folding internal frames (`node_modules/`, `node:internal`, `site-packages/`, ...) behind a
count-labeled toggle. Falls back to verbatim raw text when nothing parses.
