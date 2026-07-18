/** One topic in the hierarchy. Owns the shared `LyraTopic` shape for the whole component, the same
 *  way `word-cloud-layout.ts` owns `WordCloudWord`. */
export interface LyraTopic {
  id: string;
  label: string;
  children?: LyraTopic[];
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

interface InternalNode {
  id: string;
  label: string;
  children: LyraTopic[];
}

const LAYOUT_PADDING = 60;

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
 * `<lyra-mind-map>` for the component wrapping this.
 */
export function layoutMindMap(topics: LyraTopic[], hubLabel: string, opts: MindMapLayoutOptions): MindMapLayoutResult {
  if (topics.length === 0) return { placed: [], links: [], width: 0, height: 0, centerX: 0, centerY: 0 };

  const root: InternalNode =
    topics.length === 1
      ? { id: topics[0]!.id, label: topics[0]!.label, children: topics[0]!.children ?? [] }
      : { id: '__hub__', label: hubLabel, children: topics };

  const placed: PlacedTopic[] = [];
  const links: { fromId: string; toId: string }[] = [];
  place(root, 0, 0, 2 * Math.PI, null, 0, 0, opts, placed, links);

  const xs = placed.map((p) => p.x);
  const ys = placed.map((p) => p.y);
  const minX = Math.min(...xs) - LAYOUT_PADDING;
  const maxX = Math.max(...xs) + LAYOUT_PADDING;
  const minY = Math.min(...ys) - LAYOUT_PADDING;
  const maxY = Math.max(...ys) + LAYOUT_PADDING;

  return {
    placed: placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })),
    links,
    width: maxX - minX,
    height: maxY - minY,
    centerX: -minX,
    centerY: -minY,
  };
}
