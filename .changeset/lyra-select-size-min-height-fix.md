---
"@aceshooting/lyra-ui": patch
---

Fixed `lr-select`'s `size="xs"`/`"s"`/`"l"`/`"xl"` to actually enforce their documented
per-size minimum trigger height. A `var()` fallback bug meant `--lr-select-trigger-min-height`
was silently dead code at every size — only padding and font-size ever varied, height did not.
The default (`m`) tier's rendering is unchanged; a consumer-set `--lr-select-trigger-height`
override still wins over the per-size floor, as before.
