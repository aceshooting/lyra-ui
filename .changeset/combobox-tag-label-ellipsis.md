---
"@aceshooting/lyra-ui": patch
---

Fixed `lr-combobox`, `lr-token-input` and `lr-radio-button` declaring a
`text-overflow: ellipsis` that could never fire.

`text-overflow` only applies to content that overflows its line box inline. Each
of these parts was left at `white-space: normal`, so the text wrapped instead of
overflowing and the box never had horizontal overflow at any label length --
`scrollWidth === clientWidth` in every case. `lr-combobox`'s and
`lr-token-input`'s labels additionally set `overflow-wrap: anywhere`, which put
the wrap *inside* a word.

The visible effect was worst on `lr-combobox`, whose tag caps at
`--tag-max-size` (80px by default): a selected `Received` rendered as `Receiv/ed`
across two lines, and a wrapped tag row could overflow a trigger pinned with
`--lr-combobox-trigger-height`.

All three now carry `white-space: nowrap`, matching `lr-select`'s
`[part='tag-label']`, which has always had it. Content that fits today is
unchanged; content that used to wrap now truncates, which is what the existing
declaration asked for.

`--tag-max-size` still defaults to 80px on `lr-combobox` against `lr-select`'s
12rem. That difference is deliberate for now -- changing it alters default
rendering rather than fixing a dead declaration -- and is tracked separately.
