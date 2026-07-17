---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-notebook-viewer>`: a read-only Jupyter notebook (nbformat 4.x) renderer that parses
`.ipynb` JSON natively and composes `lyra-markdown`/`lyra-code-block`/`lyra-json-viewer` per cell,
with `node-path`/`fragment` cell anchors and imperative search over cell sources and text outputs.
Self-registers into the document-viewer registry for `application/x-ipynb+json`. Execution, kernels,
and ipywidgets are out of scope; stream/error outputs render as plain preformatted text this round.
