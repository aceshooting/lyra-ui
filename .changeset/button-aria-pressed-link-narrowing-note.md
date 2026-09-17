---
"@aceshooting/lyra-ui": patch
---

**Documentation: `aria-pressed` stopped reaching a link button (`href` set) in 16.0.0 — recorded
here because 16.0.0 filed it where nobody would find it.**

No behaviour changes in this release. This entry exists because the change itself shipped without a
discoverable release note, and a consumer pinning the old contract met it as an unexplained test
failure after a dependency bump.

**What changed, and when.** Through 15.0.0, `<lr-button>`, `<lr-icon-button>` and `<lr-card>`
forwarded a host `aria-pressed` onto the `<a>` they render when `href` is set. Since **16.0.0** they
do not: `aria-pressed` reaches the `<button>` rendering only. `role="link"` has no pressed state, so
forwarding it there asserted an ARIA state that does not exist on that role — an ARIA conformance
failure, not a feature. The behaviour is correct and is not being reverted.

This narrowed a documented forwarding contract, so it was a **breaking change** for anyone relying
on the old behaviour, and it should have been filed as one. 16.0.0 did describe it, but as the third
sub-heading of a long `<lr-card>` disabled-state entry whose opening sentence never mentions
`<lr-button>` — so neither scanning the release notes for button changes nor reading a per-component
digest surfaced it.

**Migration.** If the control is a real toggle, drop `href` — the same host `aria-pressed` then
reaches the `<button>` that replaces the anchor, and the pressed state is exposed again. If it is a
navigation target, use the global `aria-current` (`page`, `step`, `location`, `date`, `time`,
`true`, `false`) instead: that one is valid on `role="link"` and does still reach the anchor.

The `lr-button`, `lr-icon-button` and `lr-card` reference sections now name 16.0.0 as the version
the carve-out landed in, so the rule can be dated from the reference alone.
