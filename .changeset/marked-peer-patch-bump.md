---
"@aceshooting/lyra-ui": patch
---

Raise the optional `marked` peer dependency's lower bound to `^18.0.10` (was `^18.0.9`), picking
up an upstream patch release. Affects every Markdown-rendering component that declares `marked` as
an optional peer: `lr-agent-workspace`, `lr-dashboard-grid`, `lr-eval-run`, `lr-markdown`,
`lr-markdown-core`, `lr-message-parts`, `lr-notebook-viewer`, `lr-rag-answer`,
`lr-streaming-text`, and `lr-widget-renderer`.
