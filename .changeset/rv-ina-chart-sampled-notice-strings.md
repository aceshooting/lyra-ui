---
"@aceshooting/lyra-ui": minor
---
Localization: new message key `chartPlotSampled` ("The chart shows a sample of up to 1,000 records; the data table lists all data.") for a chart whose plot is sampled while a host-supplied data table lists every record, and `chartDataSampled` now reads "The chart and its generated data table show a sample of up to 1,000 records. Provide a custom data table to access all chart data." Every shipped translation catalog carries both. Applications that register their own catalogs with `registerLyraLocale()` should add `chartPlotSampled` and update `chartDataSampled`.
