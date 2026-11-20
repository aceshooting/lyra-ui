import type { CanonicalMapExternalLayer, LyraMapSourceCoordinates } from './map-data-layer-model.js';
import { buildMapLabelLayer, numeric } from './map-label-layer.js';
import type { LyraMapOverlayLayer, LyraMapOverlaySource } from './map-overlay-admission.js';
import { resolveMapVectorStyle } from './map-vector-style-compiler.js';

/** Native source/layer descriptors for the separate generated external-resource owner. */
export function buildMapExternalLayers(rows: readonly CanonicalMapExternalLayer[], context: {
  readonly nativeId: (row: CanonicalMapExternalLayer) => string;
  readonly color: (value: string | undefined) => string;
  /** Strict resolution for authored typed color leaves; invalid colors must throw. */
  readonly styleColor?: (value: string) => string;
  readonly hidden: ReadonlySet<string>;
  readonly glyphs: boolean;
  readonly mutedOpacity?: number;
}): { readonly sources: readonly LyraMapOverlaySource[]; readonly layers: readonly LyraMapOverlayLayer[];
  readonly hits: ReadonlyMap<string, { readonly sourceId: string; readonly sourceLayer?: string }> } {
  const sources: LyraMapOverlaySource[] = []; const layers: LyraMapOverlayLayer[] = [];
  const hits = new Map<string, { readonly sourceId: string; readonly sourceLayer?: string }>();
  const muted = numeric(context.mutedOpacity, 0.15, 0, 1);
  for (const row of rows) {
    if (row.label && !context.glyphs) throw new Error('Map labels require a glyph provider.');
    const sourceId = context.nativeId(row);
    sources.push({ id: sourceId, source: row.source });
    const opacity = row.category && context.hidden.has(row.category) ? row.opacity * muted : row.opacity;
    const alpha = !(row.category && context.hidden.has(row.category)) && row.categoryField && context.hidden.size ? ['case', ['in', ['to-string', ['get', row.categoryField]],
      ['literal', [...context.hidden]]], opacity * muted, opacity] : opacity;
    const sourceLayer = row.sourceLayer ? { 'source-layer': row.sourceLayer } : {};
    const style = row.style ? resolveMapVectorStyle(row.style, context.styleColor ?? (() => { throw new Error('Strict map color resolution is unavailable.'); })) : undefined;
    const push = (layer: LyraMapOverlayLayer['layer']): void => {
      const filter = style?.filter;
      const filtered = filter === undefined ? layer : { ...layer, filter };
      layers.push({ layer: { ...filtered, ...sourceLayer, minzoom: Math.max(row.minZoom, typeof layer['minzoom'] === 'number' ? layer['minzoom'] : 0), maxzoom: row.maxZoom },
        ...(row.before ? { before: row.before } : {}) });
      if (row.sourceLayer) hits.set(layer.id, { sourceId: row.sourceId, sourceLayer: row.sourceLayer });
    };
    const color = context.color(row.color); const stroke = context.color(row.strokeColor ?? row.color);
    if (row.render !== 'symbol') {
      const paint = row.render === 'line' ? { 'line-color': color, 'line-width': row.width, 'line-opacity': alpha }
        : row.render === 'circle' ? { 'circle-color': color, 'circle-radius': row.radius, 'circle-stroke-color': stroke, 'circle-stroke-width': row.width, 'circle-opacity': alpha, 'circle-stroke-opacity': alpha }
          : row.render === 'fill' ? { 'fill-color': color, 'fill-outline-color': stroke, 'fill-opacity': alpha } : { 'raster-opacity': opacity };
      push({ id: `${sourceId}-render`, type: row.render, source: sourceId,
        paint: style ? { ...paint, ...style.paint } : paint,
        ...(style && Object.keys(style.layout).length ? { layout: style.layout } : {}) });
      if ((row.kind === 'image' || row.kind === 'canvas') && row.interactive) {
        const corners = row.source['coordinates'] as LyraMapSourceCoordinates;
        const ring = Object.freeze([...corners.map(point => Object.freeze([...point])), Object.freeze([...corners[0]!])]);
        const geometry = Object.freeze({ type: 'Polygon', coordinates: Object.freeze([ring]) });
        const feature = Object.freeze({ type: 'Feature', properties: Object.freeze({}), geometry });
        const hitSource = `${sourceId}-hit-source`, hitLayer = `${sourceId}-hit`;
        sources.push({ id: hitSource, source: Object.freeze({ type: 'geojson', data: feature }) });
        push({ id: hitLayer, type: 'fill', source: hitSource, paint: { 'fill-opacity': 0, 'fill-antialias': false } });
        hits.set(hitLayer, Object.freeze({ sourceId: row.sourceId }));
      }
    }
    if (row.render === 'symbol') {
      const icon = style?.layout['icon-image'] !== undefined;
      const layer: LyraMapOverlayLayer['layer'] = row.label
        ? buildMapLabelLayer(`${sourceId}-render`, sourceId, row.label, context.color)
        : { id: `${sourceId}-render`, type: 'symbol', source: sourceId };
      push({ ...layer,
        layout: { ...layer['layout'] as Record<string, unknown>,
          ...(icon ? { 'icon-size': 1, 'icon-allow-overlap': false, 'icon-ignore-placement': false } : {}), ...style?.layout },
        paint: { ...layer['paint'] as Record<string, unknown>, ...style?.paint,
          ...(row.label ? { 'text-opacity': alpha } : {}), ...(icon ? { 'icon-opacity': alpha } : {}) } });
    } else if (row.label) {
      const layer = buildMapLabelLayer(`${sourceId}-label`, sourceId, row.label, context.color);
      push({ ...layer, paint: { ...layer['paint'] as Record<string, unknown>, 'text-opacity': alpha } });
    }
    if (layers.length > 128) throw new Error('Map data layer limit exceeded.');
  }
  return { sources: Object.freeze(sources), layers: Object.freeze(layers), hits };
}
