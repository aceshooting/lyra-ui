---
"@aceshooting/lyra-ui": minor
---

Resolve public integration gaps:

- add the side-effect-free `@aceshooting/lyra-ui/localization.js` runtime entry;
- add `--lr-icon-button-border-hover`, falling back to the base border;
- document and test the reflected `ariaControlsElements` contract for menu triggers;
- make popover/dropdown `aria-controls` target their public host so native and Lyra triggers can
  resolve it;
- make tooltip and checkbox descriptions resolvable across their trigger/control shadow
  boundaries; and
- accept MapLibre GL JS v5 or v6, with version-specific worker guidance.
