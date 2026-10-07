---
"@aceshooting/lyra-ui": patch
---
lr-markdown-core, lr-code-block-core: a lazy `languages` loader entry whose key differs from the grammar's own name or aliases (for example `{ tsx: () => import('@shikijs/langs/typescript') }`) now highlights, as an already-resolved entry does.
