---
"@aceshooting/lyra-ui": patch
---
While a library modal (`lr-dialog`, `lr-drawer`, `lr-lightbox`, `lr-command-palette`, the tool dialogs, and the modal states of `lr-page`, `lr-app-rail`, `lr-responsive-panel`, `lr-multi-split` and `lr-tour`) is open, the shared announcement regions and toast stacks are no longer made inert with the rest of the page: announcements from inside the modal (such as "Copied" or "Image 2 of 3") reach assistive technology, and toasts raised meanwhile can be read and used. Announcements from content behind the modal stay silent.
