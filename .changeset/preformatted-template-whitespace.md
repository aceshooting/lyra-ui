---
"@aceshooting/lyra-ui": patch
---

lr-markdown and lr-markdown-core show exactly `content` in their plain-text fallback (streaming, loading, render failure), with no leading blank line, indent or trailing blank line. This also reaches lr-streaming-text(-core) and lr-message-parts, which additionally no longer render their own template indentation inside a container that preserves whitespace, such as a pre-wrap chat bubble. The same fix applies to lr-context-inspector segment text, to the lr-code-block(-core) activatable line-number gutter without syntax highlighting, and to lr-json-viewer placed under a preformatted ancestor such as lr-notebook-viewer JSON outputs.
