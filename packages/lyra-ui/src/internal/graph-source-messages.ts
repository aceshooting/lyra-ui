import type { LyraMessageKey } from './localization-types.js';

type Localize = (key: LyraMessageKey, values: Record<string, string | number>) => string;

/** Node and edge counts of a graph source, as reported by its summary or scene. */
export interface GraphSourceCounts {
  readonly nodes: number;
  readonly edges: number;
}

/**
 * The record-total or scene-coverage line of a graph source navigator. Each count selects the
 * plural form of its own noun, so neither sentence fixes the English one/other rule for both.
 * Without `scene`, the line states the source totals.
 */
export function graphSourceCountText(
  localize: Localize,
  format: (value: number) => string,
  total: GraphSourceCounts,
  scene?: { readonly coverage: 'complete' | 'neighborhood' | 'aggregate'; readonly shown: GraphSourceCounts },
): string {
  if (!scene || scene.coverage === 'complete') {
    const values = {
      nodes: localize('graphSourceNodeCount', { count: format(total.nodes), pluralCount: total.nodes }),
      edges: localize('graphSourceEdgeCount', { count: format(total.edges), pluralCount: total.edges }),
    };
    return scene ? localize('graphSourceCoverageComplete', values) : localize('graphSourceTotals', values);
  }
  const values = {
    nodes: localize('graphSourceShownNodes', { shown: format(scene.shown.nodes), count: format(total.nodes), pluralCount: total.nodes }),
    edges: localize('graphSourceShownEdges', { shown: format(scene.shown.edges), count: format(total.edges), pluralCount: total.edges }),
  };
  return scene.coverage === 'aggregate'
    ? localize('graphSourceCoverageAggregate', values)
    : localize('graphSourceCoverageNeighborhood', values);
}
