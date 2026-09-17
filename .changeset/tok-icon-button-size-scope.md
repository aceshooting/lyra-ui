---
"@aceshooting/lyra-ui": minor
---

Design tokens: add `--lr-icon-button-size-scope`, an ancestor-scoped input for the icon-only
control size.

`--lr-icon-button-size` is element-scoped and has to stay that way: the shared token layer
re-declares it on every `lr-*` host so the coarse-pointer touch-target floor can apply per element.
The side effect is that a wrapper setting `--lr-icon-button-size` is replaced at the first
component in between, so it never reaches an icon button composed inside another component — a
`<lr-icon-button>` slotted through `<lr-popover>`, or the copy affordance inside `<lr-code-block>`.
The only ancestor lever was `--lr-theme-icon-button-size`, which is application-wide by design, so
"make just this toolbar denser" meant reaching for the global theme input and scoping it by hand.

`--lr-icon-button-size-scope` is declared nowhere, so it inherits the whole way down and reaches
every icon-only control below the wrapper that sets it:

```css
.message-toolbar {
  --lr-icon-button-size-scope: 1.75rem;
}
```

Precedence is `--lr-theme-icon-button-size` → `--lr-icon-button-size-scope` → the `2.5rem` default,
and the coarse-pointer floor still raises a resolved value below `2.75rem` back to it, so the new
knob is not a route around WCAG 2.2 SC 2.5.8. Purely additive: `--lr-icon-button-size` keeps its
current element-scoped behaviour exactly, and the resolved default is unchanged.
