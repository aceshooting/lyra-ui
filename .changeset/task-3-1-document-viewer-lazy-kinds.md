---
"@aceshooting/lyra-ui": minor
---

Every built-in `<lr-document-viewer>` kind now ships a lazy, register-only entry
(`archive-viewer-register.js`, `ebook-viewer-register.js`, and five new ones:
`pdf-viewer-register.js`, `docx-viewer-register.js`, `pptx-viewer-register.js`,
`spreadsheet-viewer-register.js`, `csv-viewer-register.js`, `xml-viewer-register.js`) that installs
that kind's file-matching and capability declaration without pulling its viewer element's class
module into the importing graph until a matching file is actually opened. Each entry also exports a
`<KIND>_VIEWER_TAG` string constant naming the tag it eventually registers, so a consumer can
reference or query for it without a deep import. A new `document-viewer-kinds.js` entry imports and
re-exports all eight at once. Every existing `<kind>-viewer.js` entry point is unchanged and keeps
working exactly as before for a consumer who wants the tag available immediately.
