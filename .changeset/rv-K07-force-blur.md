---
"@aceshooting/lyra-ui": patch
---
lr-radio, lr-slider and lr-rating: the blur the platform forces when a fieldset disables a focused control no longer counts as interaction, so re-enabling it does not match `:state(user-invalid)`; the same holds when a focused lr-slider switches `range` or a focused lr-radio changes `appearance`.
