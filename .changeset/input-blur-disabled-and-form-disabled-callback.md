---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-input>` marking a field touched from a blur the platform forces when the control becomes disabled while focused (fr_asxOgk4UhNB07xevCWwFVQ), and stop `formDisabledCallback()` redoing validity/render work that a same-tick `disabled` write already performed — together these could trip Lit's dev-mode "scheduled an update after an update completed" warning inside a real `<lr-dialog>` for a re-render nothing observable needed.
