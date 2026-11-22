---
'@aceshooting/lyra-ui': minor
---

`lr-stepper` now mirrors the Web Awesome stepper alongside its data-driven `steps` mode, which is
unchanged. The new `lr-step` element (`name`, `completed`, `loading`, `disabled`, `variant`,
`attention`, `description` and `icon` slots, connector/marker/spinner/status parts, and the `active`, `completed`, `loading`, `disabled`, `locked` and `clickable` custom states) can be used as
children: the stepper then owns the current step through `active`, `linear`, `clickable` and
`label`, the `goTo()`, `next()` and `previous()` methods, `data-stepper="next|previous|goto <id>"`
invokers, and the cancelable `lr-before-step-change` plus `lr-step-change` events, with a roving
keyboard stop (RTL-aware), a localized status text and polite position announcements. `orientation`
also accepts `auto`, which stacks the steps when the stepper is too narrow, in both modes. New
strings: `stepperSteps`, `stepperStepPosition`, `stepperStateLoading` and `stepperStateDisabled`.

The stepper also exposes the `completed`, `loading` and `stacked` custom states and a `steps` part on
the step list (beside `base`), and both elements read the unprefixed `--marker-size`,
`--connector-color`, `--connector-color-active`, `--connector-width`, `--connector-gap`, `--gap` and
`--pulse-color` custom properties as aliases of their `--lr-stepper-*`/`--lr-step-*` counterparts.
