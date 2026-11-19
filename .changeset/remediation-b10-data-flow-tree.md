---
'@aceshooting/lyra-ui': patch
---

Flow canvas, minimap and tree keyboard navigation respect text composition and browser shortcuts while preserving their documented selection and reorder commands.
Holding Enter, Space or Delete on a flow node triggers its action once.
Flow controls accept a group label and keep focus in the group when locking the canvas disables the focused button.
Timeline items expose their variant as text, and horizontal timelines resume measuring items after a move.
Timeline markers and rails, selected tree rows and running-node progress remain distinguishable in forced colors.
Tree row focus rings and active timeline marker rings stay inside their scroll containers.
Flow canvas edge strokes, pointer targets and minimap viewport outlines keep a consistent on-screen width at different zoom levels.
Flow minimaps follow horizontal right-to-left canvases and accept the next genuine click after a drag.
Flow source searches announce result counts, and endpoint actions name the source or target node and its edge.
A failing flow companion no longer prevents other subscribers from receiving viewport updates.
Flow nodes name progress bars after their node and reserve space only for the handle groups they display.
Whitespace-only accessible names fall back to usable text on trees, environment lists, flow components and the graph query builder.
Condition builder controls identify their row, announce additions and removals, show validation errors on the affected control and wrap at narrow widths.
Both builders contain requests from their own pickers, and file trees contain bulk-toggle events from the inner tree.
File trees accept a row size and include visible diff summaries and status in source-row names.
Settled lazy tree branches retain their expansion when moved, and pointer reordering tolerates unavailable pointer capture.
Disabled selected tree rows keep their selection fill under the pointer.
Environment lists isolate variable names and values, announce remasking, show copy feedback and give text actions a minimum 24px target.
Graph query builders accept a saved-queries heading level and describe errors before hints.
Environment lists show a localized notice when entries beyond the ceiling are not rendered, and expose hover and pressed fill tokens for their buttons.
Flow minimaps expose hover and pressed fill tokens for the map.
Timeline items and flow nodes recognise slotted content through shared slot tracking, including content forwarded through another component's slot.
Flow controls expose hover and pressed fills for built-in and slotted buttons.
Unchecked tree checkboxes expose hover and pressed border colors.
Tree item badges supplied without a tone use a quiet neutral fill.
Timeline items expose ordered marker sizing and marker colors for each variant.
Flow canvas and minimap drags release pointer capture when canceled, and edge connection gestures track their initiating pointer.
Bulk tree expansion reads each branch's motion style once and honors its own duration.
Condition builders load optional value editors when a row needs them.
