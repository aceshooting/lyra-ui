---
"@aceshooting/lyra-ui": patch
---
Components that copy their collection properties no longer cut an assignment silently when it exceeds the 10,000-entry or 50,000-value limit, or holds values that cannot be copied: a development warning names the element, the property and how many entries were kept.
