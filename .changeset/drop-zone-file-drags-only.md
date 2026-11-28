---
"@aceshooting/lyra-ui": patch
---
`lr-drop-zone` now claims only file drags while enabled, so text and link drops into inputs inside its region (and every drop on a disabled zone) keep their native behavior, and its `for`/`target` overlay stays inside the viewport and is re-measured on scroll and resize during a drag.
