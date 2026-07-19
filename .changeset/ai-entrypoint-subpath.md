---
"@aceshooting/lyra-ui": minor
---

Adds an `@aceshooting/lyra-ui/ai` entrypoint re-exporting the provider-neutral AI/agent data
contracts from `src/ai/types.ts` (also re-exported as types from the root `lyra.ts` barrel), so
consumers importing these shared types don't have to reach into `./ai/types` directly.
