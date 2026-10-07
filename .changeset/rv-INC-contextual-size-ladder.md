---
"@aceshooting/lyra-ui": major
---
`lr-alert`, `lr-callout`, `lr-gauge`, `lr-otp-input`, `lr-thread-list` and `lr-retrieval-search` now follow the shared form-control size ladder (`s` 2rem, `m` 2.25rem, `l` 2.5rem), its padding cap and the 44px coarse-pointer floor; the `--lr-size-1-875rem` token and its `--lr-theme-size-1-875rem` input are removed, so retune the tiers with `--lr-theme-form-control-height-s|m|l` instead.
