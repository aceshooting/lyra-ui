---
'@aceshooting/lyra-ui': patch
---

Fire `lr-slide-change` when a `slidesPerPage` change or a slide removal clamps the carousel's active slide, `lr-sources-change` when a `sources` reassignment prunes the source picker's selection, and `lr-view-change` when a `views` reassignment drops the widget's active view, so consumers tracking these components purely through their change events no longer go silently out of sync. Restore `lr-entity-dossier` and `lr-source-picker`'s documented JS-only `accessibleLabel` override so it actually reaches the internal tab strip and tree.
