---
'@aceshooting/lyra-ui': patch
---

Keep newer dialogs interactive when an underlying overlay's native dialog is closed externally, and restore the underlying overlay after the covering dialogs leave. Cancel deferred restoration when its owner closes or disconnects.

Allow an already-mounted overlay to become interactive above another modal without inheriting the lower overlay's temporary inert state. Preserve explicitly authored inert states and restore them when overlays close.
