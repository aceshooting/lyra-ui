---
"@aceshooting/lyra-ui": minor
---

`<lr-map>` legend rows can now show the glyph their point layer draws, instead of describing it in
color alone.

- A `legend` entry accepts an optional `icon`, deliberately the same record `point.icons` already
  carries: pass the very icon object the layer renders and the key reproduces the symbol on the
  map. Because a legend row has no category to match, the point icon's `value` is accepted (so a
  pass-through needs no reshaping) and left out of the canonical readback; every other field —
  `path`, `viewBox`, `mode`, `strokeWidth`, `lineCap`, `lineJoin` — keeps its point-icon meaning
  and its point-icon default.
- The glyph renders inside the existing `[part="legend-swatch"]`, which carries `data-icon="true"`
  and paints the shape in the entry's own `color`; the solid color block and the `pattern` overlay
  are dropped for that row, since both would sit on top of the shape they are meant to identify.
  The `pattern` border is not: it frames the swatch rather than covering it, so a glyph row keeps
  the same solid/dashed/dotted/double edge a color-only row carries. That matters under
  `forced-colors: active`, where every authored color collapses to one system color and the border
  is the only non-color differentiator left — and in normal mode for two rows that share one glyph
  and differ only by category color. The glyph is decorative: the row's own visible label carries
  its meaning, and the swatch stays `aria-hidden` and `inert`.
- Validation is the point icon's own, now literally shared with it: path data only, at most 8192
  characters, positive `viewBox` dimensions, everything else bounded and defaulted. An unusable
  record is dropped and that row keeps rendering exactly the color swatch it renders today — as
  does every entry that supplies no `icon` at all, down to the byte.
- Fixes an accessibility defect the new coverage surfaced: the legend advertised
  `aria-controls="map-container"` unconditionally, including while the optional `maplibre-gl` peer
  was still loading and after any failure — states in which no map container is in the tree at all.
  A dangling idref is a critical ARIA violation, so the attribute is now withheld until the
  container it names actually exists.
