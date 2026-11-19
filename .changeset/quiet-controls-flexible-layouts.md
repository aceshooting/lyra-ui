---
'@aceshooting/lyra-ui': minor
---

Add toolbar and label controls for checkbox and radio groups, trigger labeling modes for tooltips, grouped tool timelines, and plain and icon-only export buttons. Extend theming for form labels, buttons, disclosures, navigation rails, tree rows, split-panel dividers, and chat controls. Add fill layout for tab panels and end-aligned composer toolbars.

Keep tab strips visible beside overflowing panels. Preserve keyboard focus styling on hovered textareas and time segments, keep checkbox focus rings clear of their labels, and preserve the checked indicator on circular radios. Empty textareas and chat composers now size from their row settings even when a placeholder wraps. Segmented controls keep a 24 CSS pixel minimum target across size tiers.

Publish runtime accessor defaults in editor metadata. Keep focus after submitting an agent question, name 3D chart rows from their IDs when labels are blank, and visibly mark a data grid's current page. Pause timed alerts while the document is hidden. Preserve anchoring when a context menu reopens during its close event. Recover signature input after pointer capture is lost and expose external signing instructions to the focused drawing surface.

Restore default placement when an overlay or picker placement attribute is removed. Repair keyboard focus after a panel closes, a tag is disabled, or a pager reaches its endpoint. Let modified navigation keys and canceled radio keys reach their existing handlers. Keep calendar dates within ISO bounds and use Gregorian formatting for the Gregorian grid. Leave pristine form validation passive and expose authored errors to assistive technology.

Keep replacement autoload watchers and locale bridges active during reentrant cleanup. Settle current viewer failures, leave retired response bodies unread, and localize persistent errors with the active locale. Keep a ready model mounted during same-document moves. Protect presentation search and replacement loads from obsolete work. Fix time-input forced closure, voice preview after removal, relative-time unit boundaries, and continuous map legends across large finite ranges. Allow progress indicators and dropdown APIs to be queried before the first render.

Refresh required-field validation messages and calendar heatmap labels when the locale changes. Keep invalid JSON unapprovable when translated validation copy is empty. Preserve accessible names for media controls with blank label bindings, and send the draft displayed in the prompt queue.

Retire obsolete media replay, search, selection, downloads, attachment picks, and approval actions when their owners change during a callback. Keep dialog names and descriptions in sync with referenced content. Restore focus after loading a button, clearing a select, or expanding a chip group. Process chip visibility changes in linear time and preserve user changes during removal.

Restore documented defaults when formatter, alert, tooltip, spinner, keycap, and menu label attributes are cleared. Format tiny chart and map values distinctly and choose byte units consistently at power boundaries and with fractional steps. Preserve input-method navigation and keep user input events tied to the actual edit.

Keep menu and result focus on surviving choices, and reconcile radio and checkbox submission with native form behavior. Prevent superseded overlays, viewers, and charts from acting on replacement targets. Restore cluster legends for spatial embeddings and scale extreme coordinates. Keep breadcrumb separators synced with visible items and preserve literal early ISO years in calendar and thread views.

Keep export, widget, chip, path, approval, and stop actions tied to the item and state that initiated them. Recover emoji loading after reconnection, ignore superseded copy feedback, and preserve argument drafts when record keys arrive in a different order. Refresh menu descriptions as their references change, return focus to the memory confirmation trigger, and move focus to an available zoom control at its limit.

Suppress duplicate OTP commits and repeated keyboard activation. Let browser-modified arrows through data and retrieval navigation, restore popup strategy and optional media defaults after attribute removal, and distinguish small nonzero values and unmeasured metrics. Correct the published checkbox group event and random-content action references.

Split independently used form and control styles so standalone imports carry less CSS. Build optional look-mode aliases on first use. Reuse owned response storage for exact-fit reads.

The new control surfaces and lifecycle handling add several KiB gzip to full registration. The largest standalone entry is the agent workspace, which composes the updated composer, message, viewport, and tool timeline. Richer dialog descriptions and group labels account for additional shared accessibility code. The affected bundle ceilings advance to measured 64-byte boundaries.

The quick Chromium comparison with 31.2.1 first flagged chart assignment and select metadata at 1,000 items. A second run flagged only one 10,000-row table filter sample. Alternating published and candidate builds reproduced about 5 ms of chart settle p95 difference while chart total p95 stayed within 0.6 ms across the runs. The published chart baseline's median shifted by one animation frame, matching the first chart total median difference. The select and table follow-ups showed no consistent p95 increase. All paired runs processed the same numbers of items and passed the same correctness checks.
