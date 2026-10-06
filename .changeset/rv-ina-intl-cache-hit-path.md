---
"@aceshooting/lyra-ui": patch
---
Components that format numbers, dates, lists or plurals per row or per tick (data grid, charts, calendar, virtual list, timeline and others) do less work per formatted value: a repeated shared-formatter lookup with equal options is now answered from the previous lookup instead of re-serializing and re-sorting the options on every call. A reused options object that was mutated in between is still re-resolved.
