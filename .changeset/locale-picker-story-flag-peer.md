---
"@aceshooting/lyra-ui": patch
---

The `lr-locale-picker` Storybook page now registers the optional flag peer, so its rows render real
flags instead of silently empty frames. Found by the new `<lr-flag>` missing-resolver warning on its
first run — `flag.stories.ts` had always imported `flag-peer.js` for exactly this reason, and the
locale-picker page never did.
