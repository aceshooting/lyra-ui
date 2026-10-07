---
"@aceshooting/lyra-ui": patch
---
lr-spreadsheet-viewer: a small workbook declaring a huge sheet range no longer freezes the page; each sheet's range is checked against the row, column and cell ceilings before the grid is expanded, and a bloated range around a few cells renders just those cells.
