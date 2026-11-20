import type { LyraMapOverlayLayer } from './map-overlay-admission.js';

// Label-layer descriptors and the numeric admission shared by GeoJSON rows and external layers.

export type LyraMapLabelValue = null | boolean | number | string | readonly LyraMapLabelValue[] | { readonly [key: string]: LyraMapLabelValue };
/** Physical native text anchor, independent of the surrounding UI direction. */
export type LyraMapLabelAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export interface CanonicalMapLabel {
  readonly expression: readonly LyraMapLabelValue[];
  readonly placement: 'point' | 'line';
  readonly anchor?: LyraMapLabelAnchor;
  readonly offset?: readonly [number, number];
  readonly size: number;
  readonly color?: string;
  readonly haloColor?: string;
  readonly haloWidth: number;
  readonly minZoom: number;
  readonly font?: readonly string[];
  readonly allowOverlap: boolean;
  readonly ignorePlacement: boolean;
}

export function invalidDataLayer(): never { throw new Error('Invalid map data layer.'); }
export function numeric(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalidDataLayer();
  return Math.min(max, Math.max(min, value));
}

export function buildMapLabelLayer(id: string, source: string, label: CanonicalMapLabel,
  color: (value: string | undefined) => string): LyraMapOverlayLayer['layer'] {
  return { id, type: 'symbol', source, minzoom: label.minZoom,
    layout: { 'text-field': label.expression, 'text-size': label.size, 'symbol-placement': label.placement,
      'text-allow-overlap': label.allowOverlap, 'text-ignore-placement': label.ignorePlacement,
      ...(label.font ? { 'text-font': label.font } : {}),
      ...(label.anchor === undefined ? {} : { 'text-anchor': label.anchor }),
      ...(label.offset === undefined ? {} : { 'text-offset': label.offset }) },
    paint: { 'text-color': color(label.color), 'text-halo-color': color(label.haloColor ?? (label.haloWidth > 0 ? 'var(--lr-color-surface)' : undefined)), 'text-halo-width': label.haloWidth } };
}
