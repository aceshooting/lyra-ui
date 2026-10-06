---
"@aceshooting/lyra-ui": major
---
`readonly` pickers stay readable and navigable but never change the value: `lr-time-input` no longer opens while readonly, and a readonly `lr-date-picker` keeps days and navigation reachable with `aria-readonly`. Migration: use `disabled` where readonly was used to make `lr-date-picker` unreachable.
