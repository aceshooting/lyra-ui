---
"@aceshooting/lyra-ui": patch
---
lr-chart family, lr-box-plot, lr-lite-chart and lr-sparkline: default value text in data tables, legends, data labels, mark names, tooltips and spoken announcements no longer rounds small values such as 0.0004 to "0" while the axis shows them; values below one keep their significant digits (formatter output is unchanged).
