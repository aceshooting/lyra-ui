---
"@aceshooting/lyra-ui": patch
---
lr-calendar-viewer: one event with a malformed date no longer fails the whole calendar (that event shows without a time), and a calendar over the 250-event ceiling is rejected before it is fully parsed.
