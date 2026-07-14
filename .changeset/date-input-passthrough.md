---
"@aceshooting/lyra-ui": minor
---

`lyra-date-input` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
