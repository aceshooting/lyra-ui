---
"@aceshooting/lyra-ui": patch
---
Server rendering no longer runs components' browser-only first-render setup (light-DOM and browser-capability reads), so the server markup is always the markup the hydrating browser reproduces before it applies those reads.
