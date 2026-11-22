---
'@aceshooting/lyra-ui': patch
---

Server-rendered pages keep their localized text through hydration. A component under an ancestor
`lang` the server could not see (the server renderer gives a component no ancestors) now
reproduces the server's text on its hydrating render and commits the inherited locale on the next
update, instead of leaving the server's text in place while reporting the translated value. A
server that renders with `setLyraLocale(requestLocale)` matching the page's `lang` serves
translated text that hydration keeps with no flash.

`lr-checkbox` now shows its slotted label in server-rendered markup, so a page whose JavaScript
never runs still displays it; an empty label collapses after hydration as before. `lr-radio`
renders its label the same way where its shadow root is rendered. Parts and slots are unchanged.
