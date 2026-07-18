---
"@aceshooting/lyra-ui": minor
---

`lyra-thread-list` gains `wrapRow?: (thread: ChatThread, row: TemplateResult) => TemplateResult`
(data mode only): wraps each row's built-in `lyra-conversation-item` with host-supplied content
that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface — most notably a
leading purpose icon, since `lyra-conversation-item` has no default slot to receive one at all.
Previously data mode forced an all-or-nothing choice between its built-in grouping/virtualization
and a host's need for row content outside that surface, which only slotted mode (no grouping, no
virtualization) could accommodate.
