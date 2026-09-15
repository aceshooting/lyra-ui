---
"@aceshooting/lyra-ui": minor
---

The `toast()` helper (`toaster.js`) no longer statically imports `<lr-toast>`/`<lr-toast-item>`'s
own class implementations. Merely importing the helper — including through the package root — used
to pull the whole toast subsystem into the eagerly loaded graph even for a consumer that only ever
shows an occasional single message. The class modules are now dynamically imported and registered
on the first actual `toast()` call; the returned `ToastHandle.item` promise (and `dismiss()`, which
already chains off it) absorb the extra tick transparently. Behavior once a toast is shown is
unchanged.
