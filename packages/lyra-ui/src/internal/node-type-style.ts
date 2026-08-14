/**
 * Shared presentation metadata for a typed graph or drilldown node.
 *
 * Consumers match a node's `type` to {@linkcode id}. Colors are sanitized by the rendering
 * component before they reach CSS or canvas paint.
 */
export interface LyraNodeTypeStyle {
  readonly id: string;
  readonly label: string;
  /** A CSS color. Invalid values and paint servers use the consumer's categorical fallback. */
  readonly color?: string;
  readonly shape?: 'circle' | 'square' | 'diamond';
}
