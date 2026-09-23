---
'@aceshooting/lyra-ui': minor
---

Treat an explicitly blank (or whitespace-only) label as absent instead of rendering an unnamed, still-interactive control: lr-locale-picker option rows and lr-data-grid column headers now fall back the same way an omitted label already does, and lr-table column headers gain an optional per-column `ariaLabel` so a blank visible header still gets an accessible name (falling back to the column key when neither is set).
