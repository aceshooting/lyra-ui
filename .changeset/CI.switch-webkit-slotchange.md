---
'@aceshooting/lyra-ui': patch
---

Fixed a WebKit-only regression where a consumer's forwarding-slot wrapper around optional named
slot content (hint, footer, avatar, and similar chrome slots) could make that chrome disappear
after an unrelated text mutation deep inside the forwarding chain.

The affected components (`<lr-switch>`, `<lr-checkbox>`, `<lr-agent-run>`, `<lr-artifact-panel>`,
`<lr-browser-frame>`, `<lr-result-card>`, `<lr-tool-result-dialog>`, `<lr-tool-select-dialog>`,
`<lr-chat-message>`, `<lr-handoff-divider>`, `<lr-usage-badge>`, `<lr-flow-node>`, `<lr-stat>`,
`<lr-color-picker>`, `<lr-emoji-picker>`, `<lr-locale-picker>`, `<lr-phone-input>`, `<lr-app-rail>`,
`<lr-menu-item>`, `<lr-chip>`, `<lr-dialog>`, `<lr-source-card>`, and `<lr-document-preview>`)
tracked a named slot's presence by re-reading `HTMLSlotElement.assignedElements()` inside that
slot's own `slotchange` handler. WebKit has been observed reporting that live snapshot as
transiently empty when a mutation happens deep inside a nested forwarding `<slot>` placed inside
the assigned element, even though the assigned element's own `slot` attribute never changed. Every
listed component now re-derives presence from the light-DOM `slot` attribute directly, the same
technique each of them already used for its own initial mount/reconnect computation, so the two
now agree and neither depends on the browser's live slot-assignment snapshot.
