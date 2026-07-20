---
"@aceshooting/lyra-ui": minor
---

`lr-table`: give a persistent (`editable: 'always'`) cell editor its own Enter/Escape semantics.
Enter commits and keeps focus in the field rather than closing an editor that has no closed state,
and Escape — which has nothing to cancel back to — is no longer cancelled, so an ancestor
dialog/popover still acts on it. A double-click editor's Enter-commits-and-closes and
Escape-cancels behavior is unchanged. Adds the accompanying `AlwaysOnEditors` story.
