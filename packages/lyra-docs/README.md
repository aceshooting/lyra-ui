# @aceshooting/lyra-docs

Private, experimental foundations for an optional document-editor companion to
`@aceshooting/lyra-ui`. All existing viewers, including `lr-docx-viewer`, remain in
Lyra UI. This package does not provide an interactive editor or a runtime factory.

The package root is an empty ESM entry. The `@aceshooting/lyra-docs/docx` entry
exports TypeScript contracts only:

```ts
import type { DocxSession, DocxSnapshot } from '@aceshooting/lyra-docs/docx';
```

These unpublished contracts may change. The internal session and engine port are
not public entries. Deterministic tests exercise lifecycle, revisions, dirty state,
save receipts and selection ownership through a fake port; they do not establish
real DOCX admission safety, browser behavior, export coherence or interoperability.

No document engine, Lyra runtime, stylesheet, font, worker or service dependency is
installed or loaded by the package. A real adapter, bounded input admission,
stylesheet/CSP ownership and browser qualification remain future work. Future
engine installation and asset loading require explicit documentation and review.

Development uses Node 22.23.2 and pnpm 12.8.1. From the repository root:

```sh
pnpm --filter @aceshooting/lyra-docs build
pnpm --filter @aceshooting/lyra-docs lint
pnpm --filter @aceshooting/lyra-docs test
```

The test command builds its own targets and needs no core-library build or browser.
The package remains private and excluded from Changesets version preparation.

Licensed under MIT; see [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
