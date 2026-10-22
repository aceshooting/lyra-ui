/** Requirements to prepare before an imperative source, layer, projection, or terrain mutation. */
export interface MapFeatureRequirements {
  sources?: Record<string, SourceSpecification | CanvasSourceSpecification>;
  layers?: Array<LayerSpecification | CustomLayerInterface>;
  projection?: ProjectionSpecification;
  terrain?: TerrainSpecification;
}

export interface MapFeaturePreparationOptions {
  signal?: AbortSignal;
}

/** Warms main-thread modules. Use map.prepareFeatures() for worker and empty-style readiness. */
export declare function prepareStyle(style: StyleSpecification): Promise<void>;

/**
 * Add-only source/layer descriptors; missing anchors and dependency cycles reject.
 * At most 64 sources and 256 new layers. Layer batches require at most 4096 combined
 * native/new layer IDs; source-only batches do not inspect unrelated layer order.
 */
export interface MapPreparedFeatures {
  sources?: Record<string, SourceSpecification | CanvasSourceSpecification>;
  layers?: Array<{ layer: LayerSpecification | CustomLayerInterface; before?: string }>;
}
