---
'@aceshooting/lyra-ui': major
---

`lr-copy-button`'s `feedback-duration` defaults to `1000` ms instead of `1500` ms, the default both
Web Awesome's `wa-copy-button` and Shoelace's `sl-copy-button` use. A non-finite value now falls
back to `1000`. The `wa-`/`sl-` migration no longer inserts `feedback-duration="1000"` on converted
copy buttons, because the default already matches. Other built-in copy affordances keep their own
feedback timing.

## Migration

A copy button without `feedback-duration` now returns to its copy icon half a second sooner. To keep
the previous timing, set `feedback-duration="1500"`. `npx lyra-ui-migrate --origin=lyra-v32 --check`
reports each `.feedbackDuration` property read, write and binding on an `lr-copy-button`; search
markup for `<lr-copy-button` elements without `feedback-duration` yourself.
