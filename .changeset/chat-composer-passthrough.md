---
"@aceshooting/lyra-ui": minor
---

`lyra-chat-composer` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<textarea>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
