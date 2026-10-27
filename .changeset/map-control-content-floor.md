---
'@aceshooting/lyra-ui': patch
---

Keep `lr-map` native controls at least as wide as their own content. When a consumer removes a control's margin through its part and enlarges its buttons, the shrink-to-fit corner no longer clamps the group below its buttons and clips their icons off-centre; long attribution still wraps inside the map.
