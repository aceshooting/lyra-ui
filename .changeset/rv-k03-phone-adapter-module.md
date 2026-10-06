---
"@aceshooting/lyra-ui": patch
---
`loadLibphonenumberAdapter()` and the adapter types live in a decorator-free module, so importing the loader no longer retains `lr-phone-input`; import paths are unchanged.
