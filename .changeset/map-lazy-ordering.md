---
'@aceshooting/lyra-ui': patch
---

Keep map layer ordering and style overrides behind their existing lazy feature loader. GeoJSON placement waits for the ordering helper before changing native resources; bounded style-value validation is shared without importing override handling eagerly.
