---
'@aceshooting/lyra-ui': patch
---

Fix `lr-eval-dataset` and `lr-prompt-studio` no longer crashing and blanking their whole display when one record in a host-assigned collection has a malformed nested field (a non-array `tags` value, or missing/null message `content`); the malformed record is tolerated in place and every other record still renders.
