---
'@aceshooting/lyra-ui': major
---

Use the meter role to find budget usage. Small nonzero percentages and nearly full budgets retain their precision, and formatted quantities and units keep their reading direction in bidirectional text.
Keep a localized accessible name when the heading of a budget meter or agent question is hidden.
Keep keyboard focus in the current workflow when run actions change, a span leaves the timeline, a question changes state, or a task list collapses.
Preserve browser shortcuts and composing keystrokes in run trees, span timelines, reorderable tasks, and highlighted terminal output.
Keep selected rows, budget and progress fills, span bars, activity indicators, and header feedback visible in forced colors.
Draw keyboard focus rings inside clipped rows, frames, and terminal lines.
The span bar rectangle now measures painted duration. Hit-testing the track includes the extended pointer target for short spans.
Identify repeated run actions by run, expose subagent progress to assistive technology, and include a per-run attempt number in retry events.
Keep fallback task-list state across equivalent run updates and contain events from internal form, task-list, and terminal controls.
Respect a toggle-request listener that closes, removes, or updates a thinking panel or activity feed before the toggle commits.
Announce submitted questions after reconnection and announce clipboard results in stack traces and terminal output.
Show and announce a localized terminal note when an input or line exceeds its character limit.
Report terminal text selection only inside the viewport and once for unchanged endpoints. Listen on the selected content's owner for selections elsewhere on the page.
Recognize shared completion, failure, and cancellation spellings in task lists.
Observe streamed thinking-panel content only while the expanded live transcript follows new output.
