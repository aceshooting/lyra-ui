---
"@aceshooting/lyra-ui": patch
---

Fixed `lyra-select`'s `size="xs"`/`"s"`/`"l"`/`"xl"` to actually enforce their documented
per-size minimum trigger height. A `var()` fallback bug meant `--lyra-select-trigger-min-height`
was silently dead code at every size — only padding and font-size ever varied, height did not.
The default (`m`) tier's rendering is unchanged; a consumer-set `--lyra-select-trigger-height`
override still wins over the per-size floor, as before.
