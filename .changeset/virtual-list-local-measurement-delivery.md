---
'@aceshooting/lyra-ui': patch
---

Prevent ResizeObserver loop errors when a virtual list's local viewport follows its content, including slotted transcripts in an agent workspace. Row and group measurements now apply together on the next frame in both local and external scrolling modes, preserving scroll-anchor corrections while avoiding size writes during observer delivery.

Resolve queued row measurements against the current array membership so removal cannot read a missing row and reordering updates offsets from the row's new position.

The membership check adds 117 unpacked runtime bytes. Reviewed size ceilings advance only for the two exceeded measurements: the package measures 22,553,125 unpacked bytes (ceiling 22,553,152), and the agent-tools aggregate measures 508,549 gzip bytes (ceiling 508,608). Both use the next 64-byte boundary; other size limits are unchanged.
