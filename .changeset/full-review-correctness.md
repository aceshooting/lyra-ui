---
"@aceshooting/lyra-ui": patch
---

Correct accessibility, localization, lifecycle, security, responsive-layout, and rendering defects
across the component families.

- Reconcile accessible names, stateful ARIA, roving focus, focus return, wrapped-child event
  suppression, live regions, disabled behavior, and native control forwarding.
- Make inherited locale and direction reactive through composed trees, use locale-aware text
  folding and sparse highlight offsets, and localize the remaining viewer and status messages.
- Harden remote viewer loading, sanitization, generation ownership, size/resource guards, and
  reconnect behavior while preserving empty and error states.
- Fix container-responsive layouts, hover/focus parity, reduced-motion behavior, theme-token
  resolution, and viewer allocation/geometry updates.
