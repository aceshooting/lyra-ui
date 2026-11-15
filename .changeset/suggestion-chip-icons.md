---
'@aceshooting/lyra-ui': minor
---

`lr-suggestion-chips` can show a vector icon per suggestion: `iconName` (with optional `iconLibrary`) renders an `lr-icon`, and a light-DOM element in the `icon-<suggestionId>` slot, such as an inline SVG, replaces it. The literal `icon` text is unchanged and is still never parsed as markup. Icons stay decorative; each chip's accessible name is its label.
