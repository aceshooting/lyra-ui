---
"@aceshooting/lyra-ui": major
---

`<lr-button>`'s label no longer grows to fill a stretched button.

`[part="label"]` was `flex: 1 1 auto`. In a button wider than its content that made the label
absorb every spare pixel, so a stretched button with a `start` icon and a short label rendered the
icon hard against the leading edge and the text floating in the middle of a wide empty row — the
native `<button>` UA stylesheet centres text, which the label wrapper inherited. The gap between
icon and text read as arbitrary rather than as the `--lr-button-gap` token.

The label is now `flex: 0 1 auto` with `min-inline-size: 0`, so it shrink-wraps its text and the
whole icon+label pair centres as one unit; the icon-to-text distance is exactly `--lr-button-gap`.
It also now sets `text-align: start`, which fixes two more things the inherited centring caused: a
label narrower than its own text centred the overflow, so the ellipsis appeared at the end while
the START of the word was silently clipped, and the `<a>` root (which never inherited the centring)
disagreed with the `<button>` root across a mode switch.

Growing is now conditional: a `with-caret` button, and one with an `end`/`suffix` adornment, keep
the growing label so that trailing affordance stays pinned to the trailing content edge, which is
what a dropdown trigger needs.

**Migration.** Affected: a `<lr-button>` laid out WIDER than its own content — an explicit
`width`/`--lr-button-width`, a `display: block`/`width: 100%` wrapper, a `flex: 1` or a grid cell —
that has a `start`/`end` adornment or a slotted icon, and no `with-caret`. Such a button now centres
icon+label as one unit instead of stretching the label across the row. Unaffected: any button
sized by its own content (the overwhelmingly common inline case) renders byte-identical, as does
any `with-caret` or `end`-adornment button, which keeps the grown label.

Restore the old layout per-instance, or globally, with one declaration:

```css
/* BEFORE 16.0.0: [part="label"] was flex: 1 1 auto, so this rendered
   [icon][........ label ........] with the text floating mid-row. */
.toolbar lr-button {
  width: 100%;
}

/* AFTER, to keep exactly that: re-grow the label. */
.toolbar lr-button {
  width: 100%;
  --lr-button-label-grow: 1;
}

/* Or keep the new shrink-wrapped pair and just place it. */
.toolbar lr-button {
  width: 100%;
  --lr-button-justify: flex-start; /* space-between, end, … */
}
```

`--lr-button-label-grow` also overrides the automatic grow in the other direction: setting it to
`0` opts a `with-caret` / `end`-adornment row OUT of pinning its trailing affordance to the content
edge. `--lr-button-justify` replaces a hard-coded `justify-content: center`, so before 16.0.0 there
was no supported way to reposition the row at all.

Two additions land with it:

- **`wrap`** — a `false`-defaulting boolean that wraps a long label onto multiple lines instead of
  ellipsis-truncating it to one, the same opt-in (and the same four declarations) `<lr-chip>`
  already ships. Unset, `[part="label"]` keeps its single-line, ellipsis-truncated rule exactly.
- **Icon-only detection ignores a visually hidden label.** `<lr-button>` detects an icon-only
  default slot and applies the square, `--lr-icon-button-size`-floored treatment. It counted a
  visually hidden label as content, so the library's own recommended way to name an icon-only
  action — an icon plus an `.sr-only` span — rendered as a wide labelled button with a blank second
  column. `<lr-visually-hidden>`, `hidden`/`display: none`/`visibility: hidden`, and the standard
  absolutely-positioned `clip-path: inset(50%)` algorithm are all recognised from computed style,
  so a consumer's own utility class works whatever it is called.
