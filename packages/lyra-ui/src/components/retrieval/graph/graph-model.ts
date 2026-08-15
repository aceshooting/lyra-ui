import type { LyraNodeTypeStyle } from '../../../internal/node-type-style.js';
import {
  canonicalIdentityList,
  firstByRetrievalIdentity,
  isNonBlankIdentity,
} from '../retrieval-identity.js';

export interface LyraGraphNode {
  readonly id: string;
  readonly label?: string;
  /** Spoken label when it needs more context than the visible label. */
  readonly accessibleLabel?: string;
  /** Preferred bounded tooltip/summary text in both renderers. */
  readonly description?: string;
  /** Clamped to [6, 24] (a non-finite/missing value uses the midpoint, 15) — never rendered smaller/larger. */
  readonly radius?: number;
  /** A CSS color. Invalid values and `url()` paint servers use the type/default fallback. */
  readonly color?: string;
  /** Key into `nodeTypes` (by `LyraNodeTypeStyle.id`) and `hiddenTypes`. Unknown/absent = untyped
   *  (renders as a default circle with the token fill, but still participates in `hiddenTypes`
   *  filtering by its raw string value even with no matching `nodeTypes` entry). */
  readonly type?: string;
  /** Renders a '+' adornment (`part='expand-indicator'`) and marks the node expandable in spoken
   *  text via `graphExpandableItem`. Controlled -- the component never clears this on its own; a
   *  consumer flips it (or leaves it) after appending neighbors in response to a `lr-node-expand`.
   *  Does not gate the `lr-node-expand` event itself, which fires for any node's double-activate. */
  readonly expandable?: boolean;
  /** Community membership shorthand, unioned with any `LyraGraphCommunity.memberIds` that also lists
   *  this node's id. */
  readonly communityId?: string;
}

/** One entry in `communities` — declares a hull's id, optional label/fill color (sanitized like
 *  `LyraGraphNode.color`), and explicit membership. A node also joins this hull when its own
 *  `LyraGraphNode.communityId` matches this entry's `id`, so `memberIds` and `communityId` are two
 *  ways to express the same membership relationship. */
export interface LyraGraphCommunity {
  readonly id: string;
  readonly label?: string;
  readonly memberIds: readonly string[];
  /** A CSS color. Invalid values and `url()` paint servers use the hull token. */
  readonly color?: string;
}

/** A link whose `target` id has no matching node renders as a short dashed stub off `source`'s
 *  own position instead of being silently dropped -- e.g. for a wiki-style `[[link]]` reference to
 *  a not-yet-created page. A link whose `source` id has no matching node is still dropped
 *  entirely (there is no position to draw a stub from). */
export interface LyraGraphLink {
  /** Optional stable id returned by `lr-link-click`. */
  readonly id?: string;
  readonly source: string;
  readonly target: string;
  /** Stroke/picking width. Negative values clamp to 0; non-finite or unset values use 1.5. */
  readonly width?: number;
  /** Optional spoken-name and SVG-tooltip fallback used before the generated source/target text.
   * It is not rendered as a visible edge label. */
  readonly label?: string;
  /** Spoken label for the keyboard-operable link. */
  readonly accessibleLabel?: string;
  /** Preferred bounded tooltip/summary text in both renderers. */
  readonly description?: string;
  /** Draw an arrowhead at the target end. */
  readonly directed?: boolean;
  /** Per-link CSS stroke color; invalid values and `url()` paint servers are ignored. */
  readonly color?: string;
  /** SVG stroke-dash sequence. Invalid/negative entries are rejected as a whole. */
  readonly dash?: readonly number[];
}

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
