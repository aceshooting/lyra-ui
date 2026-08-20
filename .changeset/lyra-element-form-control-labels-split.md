---
"@aceshooting/lyra-ui": patch
---

`LyraElement` no longer statically imports `internal/form-control-labels.js` (the external-label
bridge + form-internals capture that only a form-associated component ever uses). Every
presentational component — `lr-flag`, `lr-popover`, and everything else that doesn't opt into form
association — no longer ships that module in its reachable bundle graph (measured previously at
~6KB gzip on `lr-flag`). Form-associated components register it themselves (the `FormAssociated`
mixin and 19 hand-rolled form controls each now import it explicitly), so every form control's
label/hint/error/reset/validity behavior is unchanged.
