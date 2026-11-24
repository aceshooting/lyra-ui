---
"@aceshooting/lyra-gen": minor
---

Add reviewed rich answer roles, exported as `richAnswerRoles`: `markdown` (Markdown source rendered with raw HTML shown as text and with links and images rendered as plain text), the agent metrics `context-meter`, `stream-status` and `generation-metrics` (plain numbers and status; the built-in Stop and Resume actions and the stall timer stay host-owned), bounded `graph` (at most 200 nodes and 400 edges, sized to its cell) and `mind-map` (one root, at most 12 by 12 topics), and driving controls that write view state through bindings: `segmented`, `toggle-group` with `toggle`, `checkbox-group` with `checkbox-option`, `radio-group` with `radio`, `number-input` (bind `valueAsNumber` to share a number) and `date-input` (one `YYYY-MM-DD` day). Every role carries a reviewed example and usage guide, and none exposes callbacks, URL sinks, data providers or editing.
