---
"@aceshooting/lyra-ui": patch
---
Motion-preference observers test each added or removed node against one ancestor per subscription instead of the whole ancestry, which keeps document-wide DOM churn cheap with many running animations.
