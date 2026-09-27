---
"@aceshooting/lyra-ui": patch
---

`lr-table` no longer freezes the page when `layout="fixed"` (or a declared column `width`) is combined with `priority` columns whose content spills out of its column. The table used to hide the priority columns, see the remaining columns fit, show them again, and repeat without ever yielding to the browser. The same loop could also happen in the default layout when showing the columns shrank the table's own width, for example because a page scrollbar appeared. A hidden priority column now comes back only once the table gets wider than it was when the column was hidden. In the default layout, resizing the table still hides and restores priority columns at the same widths as before. With `layout="fixed"`, a narrowing table can keep a `medium` column hidden until it widens again, and the reveal button still shows it.
