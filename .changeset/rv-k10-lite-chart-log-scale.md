---
"@aceshooting/lyra-ui": patch
---
lr-lite-chart: a `scale="logarithmic"` chart no longer rescans every value of every series for each plotted coordinate (a 2,000-point line did about 8 million checks per render and per arrow key), and its logarithmic and fallback axis ticks no longer hand `tickFormat`/`formatter` float noise such as `0.6000000000000001`.
