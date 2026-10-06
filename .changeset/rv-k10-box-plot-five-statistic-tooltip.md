---
"@aceshooting/lyra-ui": major
---
lr-box-plot: with a `formatter` or `valueFormatter` installed, the tooltip no longer collapses to the median alone. It lists the series name and then min, Q1, median, Q3 and max on separate lines, and the formatter is called once per statistic with that `statistic` (`min`, `q1`, `median`, `q3`, `max`) instead of once with `statistic: 'median'`. Migration: a formatter that assumed every tooltip call was the median should branch on `context.statistic`; code reading the tooltip label callback's return value now receives an array of lines.
