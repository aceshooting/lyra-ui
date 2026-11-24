---
"@aceshooting/lyra-gen": minor
---

`lr-gen-view.partial` renders a progressive parser's partial view as a streaming preview: the surface is inert, no `lr-gen-ready` fires, state is not reconciled, and nodes whose subtree is still open carry the `partial` part and `aria-busy`; the committed `document` for the same surface and revision replaces it while keeping every shown element.
