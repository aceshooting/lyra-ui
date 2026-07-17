---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-xml-viewer>`: a `DOMParser`-based collapsible XML tree view mirroring
`lyra-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path expand state that
survives a same-shape `xml` reassignment), with an imperative `search()`/`searchNext()`/
`searchPrevious()`/`clearSearch()` API and `node-path` anchors (element indices plus an optional
trailing `'@attrName'` segment for attribute-level targeting). Self-registers into the
document-viewer registry for `application/xml`/`text/xml` and `.xml`/`.xsd`/`.xsl`/`.xslt`/`.rss`/
`.atom` files. No XPath/XSLT evaluation, no editing, no schema validation.
