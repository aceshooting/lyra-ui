---
"@aceshooting/lyra-ui": patch
---
lr-flow-canvas: rendering, decoration updates and arrow-key moves no longer sort every node once per node and edge, so a flow with hundreds or thousands of nodes renders and updates without freezing the page.
