---
"@aceshooting/lyra-ui": patch
---
Activating an external `<label>` now picks the same focus target the overlay focus handling would: an `aria-hidden` or `aria-disabled` value with surrounding spaces or uppercase letters now excludes its content, and an image-map area counts only inside its map.
