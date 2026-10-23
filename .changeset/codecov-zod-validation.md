---
'@aceshooting/lyra-ui': patch
---

Use patched Zod 4 for Codecov build tooling, removing its remaining Zod 3 dependency. Preserve configuration validation, build-stopping errors, and normalized option types through a scoped compatibility patch. Verify both module formats and the GitHub job metadata/upload flow without contacting external services.
