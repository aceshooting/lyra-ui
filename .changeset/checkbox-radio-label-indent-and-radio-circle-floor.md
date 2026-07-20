---
"@aceshooting/lyra-ui": minor
---

`lr-checkbox` / `lr-radio`: publish the label indent, and stop hard-sizing the radio's circle.

- **New `--lr-checkbox-label-indent` and `--lr-radio-label-indent`** carry the distance from the
  control's start edge to the start of the label — the box/circle's own floor
  (`min(--lr-icon-button-size, 1.75rem)`) plus the label gap (`--lr-space-s`), i.e. `2.25rem` at the
  default tokens. Consumers composing per-option hint text under a checkbox previously had to
  hardcode that `2.25rem` after reading it out of the shadow styles, where neither term was a public
  contract, so the hint silently de-aligned on any retheme. `[part='base']`'s `gap` is now *derived
  from* the published property rather than repeating `--lr-space-s`, so the advertised value and the
  rendered geometry cannot drift: setting the property moves the label. Rendering is byte-identical
  when it is left unset.

  **Read this before assuming it closes the filed case.** The property is declared on the
  component's `:host`, so it is readable by the element itself and overridable from your own
  stylesheet (`lr-checkbox { --lr-checkbox-label-indent: … }` beats a `:host` rule), but custom
  properties inherit *down*, not sideways — a **sibling** `<p>` in your own tree can never read it
  off the checkbox. What actually solves that case is the `--lr-theme-icon-button-size` bridge that
  landed alongside this release: compute `calc(min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem)
  + var(--lr-theme-space-s, 0.5rem))` on your own wrapper from tokens you control, and both the
  control and your hint text stay aligned through a retheme. The new "Aligning per-option hint text"
  stories show both halves. This is not an unfixed gap; please do not re-file it as one.

- **Bug fix — `lr-radio`'s `[part='circle']` was hard-sized**, with `inline-size`/`block-size` where
  `lr-checkbox`'s `[part='box']` correctly uses `min-inline-size`/`min-block-size`. Since
  `[part='base']` carries no box of its own, that circle *is* the entire tap target for a label-less
  radio, and a hard size can be smaller than its own content — an enlarged indicator overflowed it
  instead of growing it. It is now a floor, matching `lr-checkbox` exactly. Default rendering is
  unchanged (28×28 at the default tokens, above the WCAG 2.2 SC 2.5.8 24×24 minimum).

  Note the residual, unchanged in this release: neither control guarantees the 24×24 minimum once
  `--lr-icon-button-size` is themed below it — `min()` still tracks the token down 1:1. Both
  controls behave identically here; a hard floor would need its own decision, since it would also
  block a deliberately dense checkbox.

`lr-checkbox` deliberately still has no `hint`/`errorText` chrome of its own (see its class docs);
that omission is intentional and adding it would require a `form-control` wrapper that changes the
part structure for existing consumers.
