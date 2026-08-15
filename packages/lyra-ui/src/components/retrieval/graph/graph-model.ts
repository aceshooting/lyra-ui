import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import {
  canonicalIdentityList,
  firstByRetrievalIdentity,
  isNonBlankIdentity,
} from '../retrieval-identity.js';
import type {
  LyraGraphCommunity,
  LyraGraphLink,
  LyraGraphNode,
} from './graph.class.js';

export interface NormalizedGraphModel {
  readonly nodes: readonly LyraGraphNode[];
  readonly links: readonly LyraGraphLink[];
  readonly nodeTypes: readonly LyraNodeTypeStyle[];
  readonly communities: readonly LyraGraphCommunity[];
}

/** The stable controlled identity used by selection/dimming and by the graph's keyed render. */
export function graphLinkIdentity(link: LyraGraphLink): string {
  return link.id ?? `${link.source}->${link.target}`;
}

function normalizeLinks(
  values: readonly LyraGraphLink[]
): readonly LyraGraphLink[] {
  const source = Array.isArray(values) ? values : [];
  return Object.freeze(
    firstByRetrievalIdentity(
      source.filter((value) => {
        if (value === null || typeof value !== 'object') return false;
        return (
          isNonBlankIdentity(value.source) &&
          isNonBlankIdentity(value.target) &&
          (value.id === undefined || isNonBlankIdentity(value.id))
        );
      }),
      graphLinkIdentity
    )
  );
}

function normalizeCommunities(
  values: readonly LyraGraphCommunity[]
): readonly LyraGraphCommunity[] {
  return Object.freeze(
    firstByRetrievalIdentity(values, (community) => community?.id).map(
      (community) =>
        Object.freeze({
          ...community,
          memberIds: canonicalIdentityList(community.memberIds ?? []),
        })
    )
  );
}

/** One deterministic graph projection shared by graph rendering and orchestration consumers.
 * Empty/blank identities and later duplicates are omitted first-wins before any keyed lookup,
 * layout, selection, community, legend, or event path. Retained identity spelling is unchanged. */
export function normalizeGraphModel(
  nodes: readonly LyraGraphNode[],
  links: readonly LyraGraphLink[],
  nodeTypes: readonly LyraNodeTypeStyle[],
  communities: readonly LyraGraphCommunity[]
): NormalizedGraphModel {
  return Object.freeze({
    nodes: Object.freeze(firstByRetrievalIdentity(nodes, (node) => node?.id)),
    links: normalizeLinks(links),
    nodeTypes: Object.freeze(
      firstByRetrievalIdentity(nodeTypes, (type) => type?.id)
    ),
    communities: normalizeCommunities(communities),
  });
}
