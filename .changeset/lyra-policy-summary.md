---
"@aceshooting/lyra-ui": minor
---

New `<lr-policy-summary>` component: a read-only list of guardrail, permission, privacy, and
tool-policy decisions, each carrying an `allow` / `deny` / `needs-review` state and an
always-visible, accessible explanation of why that decision was made -- never conveyed by color
alone. Composes `<lr-badge>` for the compact per-decision state indicator and `<lr-callout
inline>` for the explanation text, whose own `role="alert"`/`role="status"` semantics already
carry the right urgency per state, plus `<lr-details>` for a decision's optional richer `detail`
(matched rule text, policy id, cited evidence) behind progressive disclosure. `decisions` is
controlled and never mutated by the component -- this is a summary surface, not an approval gate
(see `<lr-tool-approval-dialog>`/`<lr-confirm-bar>` for that).
