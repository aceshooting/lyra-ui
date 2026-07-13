---
"@aceshooting/lyra-ui": minor
---

Fixed 'confirm()''s own usage example to import from the granular subpath
('@aceshooting/lyra-ui/components/dialog/confirm.js') instead of the root barrel
('@aceshooting/lyra-ui') — following the root-barrel example as written previously pulled in the
library's entire ~80-component side-effect-import chain into a consumer's eager bundle
(confirmed via a real build: +79 KB gzip regression, fixed by switching to the subpath import).
No code changed, documentation only.
