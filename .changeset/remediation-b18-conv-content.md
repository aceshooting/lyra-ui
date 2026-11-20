---
'@aceshooting/lyra-ui': minor
---

Failed syntax and math imports can be retried. Custom grammar loaders should support a second call after rejection.
Code blocks load bundled syntax support on demand and retain plain source when a highlighter fails.
Code blocks and Markdown retain highlighting across moves and restore annotations after reconnection.
Code block gutters respect browser shortcuts, input composition, and held activation keys.
Highlighted and active code lines have localized descriptions and a visible edge.
Code block copy actions announce clipboard outcomes. Markdown fences also emit the generic clipboard error before the detailed failure.
Markdown reports property-driven render errors after displaying the fallback, allowing listeners to supply replacement content.
Code blocks expose padding, corner radius, header colors, and gutter color for theming.
Numbered code rows keep their spacing when the gutter becomes interactive.
Plain Markdown fences support separate background colors and use code line spacing in both palettes.
Markdown copy controls honor icon-button styling, and text highlights remain visible in forced colors.
Whitespace-only labels fall back to the code region name or the document's implicit naming.
Markdown preserves focus when the containing document cannot report its active element.
Core code blocks accept a missing grammar map and start highlighting when a map is supplied.
Markdown reads initial script content through its first render and preserves explicitly cleared content across moves.
Collapsed code blocks paint a single lower border, and short language labels remain legible beside long filenames.
Markdown applies link-target protections to authored forms.
Markdown limits explicit math sizes to 20 em and macro expansion to 1,000.
Code block disclosures expose their state through `aria-expanded`. Supply a `codeBlockToggle` string to give them one stable accessible name; `expandCode` and `collapseCode` keep working otherwise.
Code block disclosure requests respect synchronous writes to `collapsed` and stop if the listener removes the disclosure.
Code block headers track slotted controls in the code block's current document.
Style Markdown's minimum content size and the resting, hovered, and pressed backgrounds of fenced copy buttons, code block disclosures, and line buttons.
Markdown paints neutral highlights on the raised surface color so they remain visible against the document background.
Plain Markdown streaming updates without animation frames. Progressive streaming continues when the browser pauses those frames.
Fenced Markdown copy feedback stays independent for each fence, and a later click supersedes an earlier write for that fence.
Markdown and code blocks distinguish unresolved optional peers from import failures in development.
Markdown requires spaces or tabs after closing fence markers.
