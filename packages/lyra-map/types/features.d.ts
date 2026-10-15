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
