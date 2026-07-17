---
"@aceshooting/lyra-ui": minor
---

Adds an internal `application/geo+json` document-viewer registry bridge (`<lyra-geojson-view>`,
`.geojson` filename matching included): fetches and validates a GeoJSON `Feature`/`FeatureCollection`/
bare-geometry payload, computes a bounding-box fit, and renders it through `lyra-map`'s new
`dataLayers` property with a feature-count status line. Falls back to `lyra-json-viewer` with a
missing-library callout when the optional `maplibre-gl` peer isn't installed. Not a documented public
tag this round — importing `geojson-view/geojson-view.js` opts a host into the bridge, matching how
`lyra-map`/`lyra-graph`/the chart family already stay out of the root barrel import.
