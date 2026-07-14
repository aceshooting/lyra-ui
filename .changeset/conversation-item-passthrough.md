---
"@aceshooting/lyra-ui": minor
---

`lyra-conversation-item` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its in-place rename `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary while a rename is in progress.
