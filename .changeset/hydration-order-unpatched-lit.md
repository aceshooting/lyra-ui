---
'@aceshooting/lyra-ui': patch
---

Server-rendered components no longer render a second copy of their template when Lit's hydration support was not installed in time. A code-splitting bundler can move Lit into a shared chunk that evaluates before `@aceshooting/lyra-ui/hydration.js`, which left the server's declarative shadow root in place with a duplicate tree rendered in front of it. A component now detects a server-rendered shadow root that Lit cannot hydrate, discards the server markup and renders into the same shadow root, and the development build warns once naming the cause. The SSR guide adds a bundler recipe (one shared chunk for Lit and `hydration.js`, or `hydration.js` as a separate first script) so such pages hydrate instead of re-rendering.
