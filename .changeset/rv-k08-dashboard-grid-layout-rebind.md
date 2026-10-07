---
"@aceshooting/lyra-ui": major
---
lr-dashboard-grid: assigning the same `layout` array again is now a no-op, and a new array whose cell geometry is unchanged keeps a drag or resize in progress, so a re-rendering parent no longer cancels the gesture or rebuilds every default widget. Migration: after editing cells, assign a new array (for example `grid.layout = [...layout]`); mutating the assigned one in place and re-assigning it does nothing.
