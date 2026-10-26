---
"@aceshooting/lyra-ui": patch
---

Expose a required select's invalid state after native form submission or `reportValidity()`,
including its accessible state and error styling. Silent validity checks keep pristine controls
unchanged, and resetting the form restores that state.
