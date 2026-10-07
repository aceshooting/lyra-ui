---
"@aceshooting/lyra-ui": patch
---
lr-page: no longer declares inline-size containment, so it sizes to its content in shrink-to-fit parents (grid-centred, flex row) instead of collapsing to 20rem and switching to the mobile layout; container queries inside page content now resolve against the next ancestor container.
