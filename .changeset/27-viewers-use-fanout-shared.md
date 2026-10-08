---
'@aceshooting/lyra-ui': patch
---

The passive SVG sanitizer now refuses SVG whose nested `<use>` references fan out past a rendering ceiling, so `<lr-notebook-viewer>` SVG outputs and `<lr-include>` content get the same protection as `<lr-svg-viewer>`. EPUB and PPTX archive guards now node-count package, content and slide parts reached through the container, manifest and relationships under any file name, as the DOCX guard already did. `<lr-ebook-viewer>` keeps keyboard focus when its chapter buttons disable, and `<lr-html-viewer>`, `<lr-contact-viewer>` and `<lr-calendar-viewer>` search only loaded content, never their empty-state, spinner or error text.
