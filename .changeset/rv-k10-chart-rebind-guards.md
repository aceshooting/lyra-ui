---
"@aceshooting/lyra-ui": patch
---
lr-chart and its typed subclasses: re-binding the same `hiddenDatums` array, or assigning `config` its own current value, no longer re-projects it and schedules a redraw on every parent render.
