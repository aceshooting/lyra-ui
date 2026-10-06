---
"@aceshooting/lyra-ui": patch
---
The external-label support is now installed when a form-associated control is defined, not by importing the shared form helpers, so bundles of non-form components such as `lr-details`, `lr-option` and `lr-copy-button` can leave it out.
