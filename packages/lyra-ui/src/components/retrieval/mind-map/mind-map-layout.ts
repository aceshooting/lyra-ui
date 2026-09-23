import { minMax } from '../../data/heatmap/heatmap-scale.js';
import { isNonBlankIdentity } from '../retrieval-identity.js';

/** One topic in the hierarchy. Owns the shared `LyraTopic` shape for the whole component, the same
 *  way `word-cloud-layout.ts` owns `WordCloudWord`. */
export interface LyraTopic {
  id: string;
  label: string;
  children?: readonly LyraTopic[];
}

/** A topic after radial layout — original id/label plus computed geometry. */
export interface PlacedTopic {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  /** Radians, measured clockwise from 12 o'clock (0) in LTR -- used both to draw a parent-child
   *  connector's control point and, in tests, to verify arc subdivision independent of the
   *  bounding-box-shifted x/y. */
  angle: number;
  parentId: string | null;
  hasChildren: boolean;
  /** Always `false` for a leaf (`hasChildren: false`). */
  expanded: boolean;
}

export interface MindMapLayoutOptions {
  /** Radius step per depth ring, in px. */
  ringGap: number;
  rtl: boolean;
  isExpanded: (id: string, depth: number) => boolean;
}

export interface MindMapLayoutResult {
  placed: PlacedTopic[];
  links: { fromId: string; toId: string }[];
  /** viewBox width/height, auto-fit to the laid-out extent with padding. */
  width: number;
  height: number;
  /** The root/hub's position within the shifted (viewBox-relative) coordinate space. */
  centerX: number;
  centerY: number;
}

export interface DecimatedMindMapLayout {
  placed: readonly PlacedTopic[];
  links: readonly { fromId: string; toId: string }[];
  /** The full currently-visible node count before decimation (what "of M" reports). */
  totalCount: number;
  truncated: boolean;
}

/** Returns the first occurrence of each nonblank topic identity across the complete hierarchy.
 * Invalid/duplicate roots drop their subtree; duplicate descendants are omitted from the later
 * parent. Retained ids and labels are never trimmed or rewritten. */
function normalizeMindMapTopics(
  topics: readonly LyraTopic[]
): readonly LyraTopic[] {
  const seen = new Set<string>();
  const normalize = (values: readonly LyraTopic[]): readonly LyraTopic[] => {
    const source = Array.isArray(values) ? values : [];
    const retained: LyraTopic[] = [];
    for (const topic of source) {
      if (
        topic === null ||
        typeof topic !== 'object' ||
        !isNonBlankIdentity(topic.id) ||
        seen.has(topic.id)
      ) {
        continue;
      }
      seen.add(topic.id);
      const children = normalize(topic.children ?? []);
      retained.push(
        Object.freeze({
          ...topic,
          ...(topic.children === undefined ? {} : { children }),
        })
      );
    }
    return Object.freeze(retained);
  };
  return normalize(topics);
}

interface InternalNode {
  id: string;
  label: string;
  children: readonly LyraTopic[];
}

const LAYOUT_PADDING = 60;

function syntheticHubIdentity(topics: readonly LyraTopic[]): string {
  const ids = new Set<string>();
  const collect = (values: readonly LyraTopic[]): void => {
    for (const topic of values) {
      ids.add(topic.id);
      collect(topic.children ?? []);
    }
  };
  collect(topics);
  let identity = '__hub__';
  while (ids.has(identity)) identity = `_${identity}`;
  return identity;
}

function visibleLeafCount(node: LyraTopic, depth: number, opts: MindMapLayoutOptions): number {
  const children = node.children ?? [];
  if (children.length === 0 || !opts.isExpanded(node.id, depth)) return 1;
  return Math.max(1, children.reduce((sum, c) => sum + visibleLeafCount(c, depth + 1, opts), 0));
}

function place(
  node: InternalNode,
  depth: number,
  angleStart: number,
  angleEnd: number,
  parentId: string | null,
  cx: number,
  cy: number,
  opts: MindMapLayoutOptions,
  out: PlacedTopic[],
  links: { fromId: string; toId: string }[],
): void {
  const angle = (angleStart + angleEnd) / 2;
  const r = depth * opts.ringGap;
  const dir = opts.rtl ? -1 : 1;
  const x = cx + dir * r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && opts.isExpanded(node.id, depth);
  out.push({ id: node.id, label: node.label, depth, x, y, angle, parentId, hasChildren, expanded });
  if (parentId) links.push({ fromId: parentId, toId: node.id });
  if (!hasChildren || !expanded) return;

  const counts = node.children.map((c) => visibleLeafCount(c, depth + 1, opts));
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const span = angleEnd - angleStart;
  let cursor = angleStart;
  node.children.forEach((child, i) => {
    const childSpan = (counts[i]! / total) * span;
    place(
      { id: child.id, label: child.label, children: child.children ?? [] },
      depth + 1,
      cursor,
      cursor + childSpan,
      node.id,
      cx,
      cy,
      opts,
      out,
      links,
    );
    cursor += childSpan;
  });
}

/**
 * Lays out `topics` as a radial tree: root at the center, each depth ring at radius `depth *
 * ringGap`, each parent's children dividing its own inherited angular arc proportionally to their
 * visible leaf counts (a collapsed subtree counts as one leaf), sibling order running clockwise
 * from 12 o'clock in LTR (counter-clockwise in RTL, via `rtl`). Multiple roots hang off an
 * implicit `'__hub__'`-id center node labeled `hubLabel`. Pure function, no DOM access -- see
 * `<lr-mind-map>` for the component wrapping this.
 */
export function layoutMindMap(
  topics: readonly LyraTopic[],
  hubLabel: string,
  opts: MindMapLayoutOptions
): MindMapLayoutResult {
  const normalizedTopics = normalizeMindMapTopics(topics);
  if (normalizedTopics.length === 0)
    return {
      placed: [],
      links: [],
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };

  const root: InternalNode =
    normalizedTopics.length === 1
      ? {
          id: normalizedTopics[0]!.id,
          label: normalizedTopics[0]!.label,
          children: normalizedTopics[0]!.children ?? [],
        }
      : {
          id: syntheticHubIdentity(normalizedTopics),
          label: hubLabel,
          children: normalizedTopics,
        };

  const placed: PlacedTopic[] = [];
  const links: { fromId: string; toId: string }[] = [];
  place(root, 0, 0, 2 * Math.PI, null, 0, 0, opts, placed, links);

  // `placed` always has >= 1 entry here (the `topics.length === 0` guard above already returned,
  // and `place()` unconditionally pushes the root), so `minMax` never returns `null` below. Using
  // `minMax()` instead of `Math.min(...xs)`/`Math.max(...xs)` avoids spreading a potentially huge
  // array as call arguments -- see heatmap-scale.ts's `minMax()` doc comment for the
  // `RangeError: Maximum call stack size exceeded` this sidesteps once topic counts get large.
  const [xLo, xHi] = minMax(placed.map((p) => p.x)) ?? [0, 0];
  const [yLo, yHi] = minMax(placed.map((p) => p.y)) ?? [0, 0];
  const minX = xLo - LAYOUT_PADDING;
  const maxX = xHi + LAYOUT_PADDING;
  const minY = yLo - LAYOUT_PADDING;
  const maxY = yHi + LAYOUT_PADDING;

  return {
    placed: placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })),
    links,
    width: maxX - minX,
    height: maxY - minY,
    centerX: -minX,
    centerY: -minY,
  };
}

/**
 * Largest-share-first proportional apportionment of `budget` unit picks across `weights`, via
 * systematic (evenly spaced) sampling along the cumulative-weight axis: `budget` points spaced
 * `total / budget` apart along `[0, total)` each fall into exactly one weight's bucket and
 * increment its share. A branch's share is therefore proportional to its own weight (a much
 * larger branch gets proportionally more of the budget), and -- unlike floor-then-remainder
 * rounding -- ties among equal-weight entries (e.g. a flat list of same-size leaf branches) select
 * evenly spaced entries across the whole list rather than clustering the extra shares at the
 * front. Always sums to `min(budget, total)`.
 */
function apportionByWeight(
  weights: readonly number[],
  budget: number
): number[] {
  const shares = weights.map(() => 0);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || budget <= 0 || weights.length === 0) return shares;
  const sampleCount = Math.min(budget, total);
  const step = total / sampleCount;
  let childIndex = 0;
  let boundary = weights[0]!;
  for (let sample = 0; sample < sampleCount; sample++) {
    const target = (sample + 0.5) * step;
    while (target >= boundary && childIndex < weights.length - 1) {
      childIndex += 1;
      boundary += weights[childIndex]!;
    }
    shares[childIndex] = shares[childIndex]! + 1;
  }
  return shares;
}

/**
 * Deterministically decimates an already-laid-out, currently-visible topic set (`placed`, in the
 * depth-first order `place()` produces) down to at most `maxNodes`, two invariants held
 * throughout: a kept node's parent (if any) is always kept too -- so the surviving set is always
 * a connected sub-tree, never floating orphans with a dangling `link` or a gap in the semantic
 * `role="tree"` walk -- and each parent's own child budget is apportioned to its children in
 * proportion to each child's subtree size via `apportionByWeight()`, so a large branch keeps
 * proportionally more of its own nodes than a small one and a flat/wide branch is sampled evenly
 * across its whole child list, rather than the tail of the array being dropped outright. Geometry
 * (`x`/`y`/`angle`) on a surviving node is untouched -- it keeps the position the full layout gave
 * it, so the decimated result still reads as a sample of the true radial density rather than
 * nodes redrawn to fill the resulting gaps.
 */
export function decimateMindMapLayout(
  placed: readonly PlacedTopic[],
  links: readonly { fromId: string; toId: string }[],
  maxNodes: number
): DecimatedMindMapLayout {
  const totalCount = placed.length;
  if (totalCount <= maxNodes || maxNodes <= 0) {
    return { placed: [...placed], links: [...links], totalCount, truncated: false };
  }

  const childrenByParent = new Map<string | null, PlacedTopic[]>();
  for (const node of placed) {
    const siblings = childrenByParent.get(node.parentId);
    if (siblings) siblings.push(node);
    else childrenByParent.set(node.parentId, [node]);
  }

  const subtreeSizeCache = new Map<string, number>();
  const subtreeSize = (id: string): number => {
    const cached = subtreeSizeCache.get(id);
    if (cached !== undefined) return cached;
    // Pre-seed before recursing so a (structurally impossible, but defensive) cycle can't loop.
    subtreeSizeCache.set(id, 1);
    const children = childrenByParent.get(id) ?? [];
    let total = 1;
    for (const child of children) total += subtreeSize(child.id);
    subtreeSizeCache.set(id, total);
    return total;
  };

  const kept = new Set<string>();
  const visit = (node: PlacedTopic, budget: number): void => {
    if (budget <= 0) return;
    kept.add(node.id);
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0 || budget <= 1) return;
    const shares = apportionByWeight(
      children.map((child) => subtreeSize(child.id)),
      budget - 1
    );
    children.forEach((child, index) => visit(child, shares[index]!));
  };

  const roots = childrenByParent.get(null) ?? [];
  const rootShares = apportionByWeight(
    roots.map((root) => subtreeSize(root.id)),
    maxNodes
  );
  roots.forEach((root, index) => visit(root, rootShares[index]!));

  return {
    placed: placed.filter((node) => kept.has(node.id)),
    links: links.filter((link) => kept.has(link.fromId) && kept.has(link.toId)),
    totalCount,
    truncated: true,
  };
}
