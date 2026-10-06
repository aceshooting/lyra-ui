---
"@aceshooting/lyra-ui": patch
---
`lr-input` keeps `min`/`max` attributes as strings for date and time types instead of turning them into `NaN`; numeric bounds still read back as numbers.
