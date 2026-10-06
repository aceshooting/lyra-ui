---
"@aceshooting/lyra-ui": patch
---
The development-only "no message registered for locale … falling back to the English default" diagnostic now lives entirely in the development build: production bundles of localized components no longer carry its text or build it on every untranslated lookup in a partially translated locale.
