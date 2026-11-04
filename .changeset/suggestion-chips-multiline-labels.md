---
'@aceshooting/lyra-ui': minor
---

Let `lr-suggestion-chips` show multi-line prompts. With `wrap` set, each chip label now shows up to three lines and no chip grows wider than the row, so full-question starter prompts stay readable in a narrow chat column. Two new custom properties tune this: `--lr-suggestion-chips-label-lines` sets how many lines a label shows (default 1 in the scrolling row, 3 with `wrap`), and `--lr-suggestion-chips-chip-max-inline-size` sets each chip's maximum inline size (default `var(--lr-size-16rem)`). The scrolling row is unchanged when neither property is set.
