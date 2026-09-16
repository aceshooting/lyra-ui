---
"@aceshooting/lyra-ui": patch
---

Docs: every component whose icon-only action became a composed `<lr-icon-button>` in 16.0.0 now
carries the migration note that only `lr-copy-button` had. A `::part()` rule that used to paint that
button now names the composed child's host, which paints nothing — and because `color` still
inherits, such a rule looks half-alive rather than broken, which is how it escapes review. The note
says what to do instead: set the `--lr-icon-button-*` paint tokens on the component or an ancestor,
and use `--lr-theme-icon-button-size` for size, since `--lr-icon-button-size` is re-declared on every
host and never reaches a composed child.

Also pins the border half of that contract with a test: an ancestor `--lr-icon-button-border` does
reach a composed control, so border is not the one paint property that silently dies.
