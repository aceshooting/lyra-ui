---
"@aceshooting/lyra-ui": major
---
lr-mcp-app: `csp` is now typed for inline `html` resources only, since a remote `src` document follows its own server's policy and the field was silently ignored. Migration: drop `csp` from `src` resources.
