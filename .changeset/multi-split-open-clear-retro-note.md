---
"@aceshooting/lyra-ui": patch
---

Document `<lr-multi-split>`'s 9.0.0 behavior change: leaving a non-floating collapse state now
actually clears `open`, a change that shipped without a changelog entry.

Before 8.2.3, the component reference already promised: "Leaving 'floating' while `open` is still
`true` also closes it, the same way `<lr-app-rail>` closes its mobile overlay when leaving
'mobile' while open." 8.2.3's compiled class never implemented it — there was no assignment
clearing `open` anywhere in the collapse path; `this.open = false` appeared only as the property
initializer.

9.0.0 implemented it, in `applyEffectiveCollapseTransition`: for any transition to a state other
than `'floating'`, `open` is now cleared. The direction of the fix was correct — the code now
matches what was always documented — but it shipped silently, and the reference read identically
in both versions since it described the intended behavior all along, giving no changelog signal
to grep for.

The ordering matters to any `lr-multi-split-collapse-change` handler that reads `open`: the clear
happens **after** the event fires, not before, so a listener reading `this.open` synchronously
inside its own handler still sees the pre-clear value.

This is the same omission class already retro-documented twice in 9.1.0 (the heatmap
flat-property-to-`data` collapse, and the tab group's removed `slot`/`label` child model).
