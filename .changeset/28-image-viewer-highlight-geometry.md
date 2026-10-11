---
"@aceshooting/lyra-ui": patch
---

`<lr-image-viewer>` region highlights now paint exactly the percentage rectangle they describe. A region smaller than `--lr-icon-button-size` no longer grows down and right past its data and over its neighbours at any fit, zoom or rotation. The minimum pointer target is now a transparent `::after` centred on the highlight, painted beneath every highlight box, so a region's own box always wins over a neighbour's enlarged area and overlapping enlarged areas resolve to the later highlight in document order. Keyboard navigation is unchanged.
