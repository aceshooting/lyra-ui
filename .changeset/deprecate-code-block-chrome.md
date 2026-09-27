---
"@aceshooting/lyra-ui": minor
---

The `code-block-chrome` attribute (`codeBlockChrome` property) of `lr-markdown`, `lr-markdown-core`, `lr-streaming-text`, `lr-streaming-text-core` and `lr-message-parts` is deprecated in favour of `code-block-header` (`codeBlockHeader`), which it already duplicated exactly, with removal no earlier than 23.0.0. Either spelling still enables the code-block header until then, and setting `code-block-chrome` logs one development-mode warning per page. `lr-streaming-text`, `lr-streaming-text-core` and `lr-message-parts` now pass either option to their composed Markdown elements as `codeBlockHeader`, so only the element the application configured warns; rendering is unchanged. `lr-streaming-text` and `lr-streaming-text-core` now declare both options on their own classes, so their manifest entries and editor data list them.
