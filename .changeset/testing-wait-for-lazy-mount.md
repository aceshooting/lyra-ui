---
"@aceshooting/lyra-ui": minor
---

Added `waitForLyraElement()` and `waitForToast()` to `@aceshooting/lyra-ui/testing`. `toast()`
registers `<lr-toast>`/`<lr-toast-item>` through a dynamic `import()` on first call, so a
fire-and-forget `toast(...)` -- the normal application pattern -- leaves the document empty for at
least one microtask, forcing a downstream test to hand-write a polling loop before it can assert on
the toast's rendered text. `waitForLyraElement(selector, options?)` is a generic, bounded,
event-driven awaitable (`MutationObserver` plus `customElements.whenDefined()`, no busy polling) for
"a matching library element is connected and upgraded," reachable from an optional `root` and
filterable by an optional `match` predicate; it rejects with a descriptive error after a bounded
timeout (2000ms default). `waitForToast(match?, options?)` is the named convenience for `<lr-toast-item>`,
matching by trimmed text or a predicate. Both run in a real browser and in the documented happy-dom
test environment. `confirm()` was swept too: it registers `<lr-dialog>` synchronously and has no
equivalent gap, so it gets no new helper.
