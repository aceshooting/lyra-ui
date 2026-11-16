---
'@aceshooting/lyra-ui': patch
---

Data-source CSV, dataset and spreadsheet viewers no longer leave the visible rows blank when a cell reveal is cancelled (for example by `clearSearch()`) after it has started loading the target rows but before the list scrolled to them; the cell window returns to the rows on screen.
