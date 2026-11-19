---
'@aceshooting/lyra-ui': patch
---

Conversation list, feedback and message-item controls ignore Alt/Ctrl/Meta-modified and IME-composing keys, so browser zoom, history and composition shortcuts keep working.
A conversation row stops a rename draft when it is handed a different conversation, instead of committing the old draft under the new id.
Message feedback skips its persistence request when a change listener disables, detaches or re-rates the control, and message parts retry only the part that is still rendered.
Blank or whitespace-only labels on checkpoint, handoff divider, conversation item, chat message, branch picker and suggestion chips fall back to the localized name and never write an empty aria-label.
Branch picker announces the next navigation after an unchanged reparent, and typing indicator no longer re-announces an unchanged label when moved.
Stream status restores its 10000 ms stall threshold when the attribute is removed, and generation metrics freezes the true elapsed time when a run completes.
Streaming text core keeps a stable empty languages object so the composed Markdown keeps its highlight state, and message actions reveal on interaction when placed directly in a shadow root.
Chat viewport announces a message whose markup stays busy forever after a bounded wait, thread-list sticky group headers expose a background token, suggestion chips wrap an unbroken label token, and decorative middot separators are no longer spoken.
Thread list search ignores accents and treats a throwing custom filter as no match, message parts fall back to the built-in rendering when a custom part renderer throws, and transcript feed isolates speaker names for mixed-direction text.
