---
"@aceshooting/lyra-ui": minor
---

`lr-activity-feed`: make the virtualized entry rows actually styleable, by this component and by a
consumer.

At/above `virtualizeThreshold` the entries are produced by this component's `renderItem` but
committed into the embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a
`[part='entry']` selector can reach — so every entry, icon, text and timestamp rule was silently
inert and a long feed rendered as unstyled rows. Each rule now pairs its plain selector (still
correct below the threshold, where the same template renders into this component's own shadow root)
with an `lr-virtual-list::part(…)` twin, and an `exportparts` forwarding declaration makes the same
parts reachable as `lr-activity-feed::part(entry)` etc. from a consuming stylesheet.

The tone dot is promoted from an internal class to a named `tone-dot` part, since a class selector
cannot cross a shadow boundary either. `::part()` cannot be followed by an attribute selector, so
the tone carries a second name in the dot's part list rather than being matched through
`[data-tone]` (`::part()` matches with `part~=` semantics, so both names select the same element).
New parts: `tone-dot`, plus `tone-dot-neutral`/`tone-dot-brand`/`tone-dot-success`/
`tone-dot-warning`/`tone-dot-danger`. The `data-tone` attributes are unchanged, and a consumer can
now retint a single tone instead of overriding a library-wide color token.
