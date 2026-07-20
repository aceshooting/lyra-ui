---
"@aceshooting/lyra-ui": minor
---

Add a `renderExcerpt` hook to `<lr-thread-list>`, rendering rich per-row excerpt content into the
row `<lr-conversation-item>`'s own `excerpt` slot — where it wins over the plain-string `excerpt`
property — for cases like a server-highlighted search-match snippet, without giving up the built-in
title layout and inline-rename affordance the way `renderRowContent` requires.
