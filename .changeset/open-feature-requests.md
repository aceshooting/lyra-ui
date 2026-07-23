---
"@aceshooting/lyra-ui": minor
---

Resolve the current feature-request backlog:

- add configurable no-flash theme bootstraps and a Lit-free gemstone palette entry;
- expose a pre-mount chart `seriesPalette()` helper and document its theme-token indirection;
- let `lr-app-rail` select persisted fields, including `preferredMode`, without restoring transient
  mobile-open state;
- add `lr-icon-button` border and hover-foreground tokens;
- size gemstone swatches from their fill token and keep `lr-table`'s unnamed-grid warning out of
  production; and
- document the supported SheetJS CDN install path and the unsafe npm-audit downgrade suggestion.
