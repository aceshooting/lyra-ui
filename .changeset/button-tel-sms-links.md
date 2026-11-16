---
'@aceshooting/lyra-ui': minor
---

`lr-button` and `lr-icon-button` now render a native anchor for `tel:` and `sms:` hrefs, so `<lr-button href="tel:+40700000100">Call</lr-button>` is a click-to-call action. Like `mailto:`, both hand off to a system app, name no web origin and execute nothing. Behavior change: such an href previously fell back to the native `<button>` and now renders a link. `download` still drops all three handoff schemes, the `target`-derived `noopener noreferrer` guard is unchanged, and executable or document schemes stay rejected. Content-derived links (`lr-markdown`, `lr-streaming-text`) keep their narrower allowlist and do not admit `tel:` or `sms:`.
