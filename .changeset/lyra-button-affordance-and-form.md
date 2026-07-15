---
"@aceshooting/lyra-ui": minor
---

`lyra-button` ships a default `:hover`/`:active` pointer-interaction treatment on `[part='base']`
(`filter: brightness(--lyra-button-hover-brightness)` on hover, `transform: scale(--lyra-button-active-scale)`
on active, both disabled under `prefers-reduced-motion`) -- previously it had zero hover/active CSS,
so a mechanical `wa-button` -> `lyra-button` rename silently dropped all pointer-interaction feedback.

`lyra-button` is now form-associated (`static formAssociated = true` + `attachInternals()`), so it
participates in an ancestor `<form>.elements` the same way `wa-button` does -- a sibling text field's
own Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) now finds
it, instead of silently failing to submit the form.

`lyra-button` gains an `appearance="accent"` value -- a loud, high-contrast filled tier equivalent to
`wa-button`'s own runtime-default appearance, including for `variant="neutral"` (`'filled'` reads the
ambient surface color there, matching `wa-button`'s `appearance="filled"`; `'accent'` reads a solid
neutral fill, matching `wa-button`'s own unset-appearance default). New `--lyra-button-accent-fill`/
`-accent-on-fill` custom properties back it.

`lyra-heatmap` gains a `monthLabelText?: (jsMonth: number, year: number) => string | undefined`
property, the month-axis analogue of the existing `weekdayLabelText` -- lets a consumer's calendar-mode
month labels track the same locale signal (e.g. an app's own i18n store) as every other localizable
string on the component, instead of always following `toLocaleString(undefined, ...)`'s browser/OS-
language default. Unset (the default) reproduces today's exact locale-derived output.
