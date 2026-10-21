/** Peer-neutral subset of a MapLibre style accepted by `mapStyle`. */
export interface LyraMapStyleSpecification {
  readonly version: 8;
  readonly sources: Readonly<Record<string, unknown>>;
  readonly layers: readonly unknown[];
  readonly name?: string;
  readonly sprite?: string | readonly Readonly<{ id: string; url: string }>[];
  readonly glyphs?: string;
  readonly projection?: unknown;
  readonly terrain?: unknown;
}

/**
 * A style with no sources and no layers: a blank basemap for maps that show only their own data
 * (a choropleth, data layers, markers) and must not contact a tile provider. Assign it to
 * `mapStyle`; the object is frozen and shared, so build a new style to add to it.
 */
export const LYRA_MAP_EMPTY_STYLE: Readonly<LyraMapStyleSpecification> = Object.freeze({
  version: 8 as const,
  sources: Object.freeze({}),
  layers: Object.freeze([]) as readonly unknown[],
});
