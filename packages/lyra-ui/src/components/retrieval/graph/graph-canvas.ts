/**
 * Renderer-agnostic, side-effect-free drawing primitives for `lr-graph`'s `renderer="canvas"`
 * scale path -- a plain 2D-canvas replacement for the per-node/per-link SVG DOM. Every value here
 * is already resolved (colors, fonts, world-space positions) by the caller; nothing in this module
 * touches `getComputedStyle()`, custom elements, or Lit -- it's a pure function library over a
 * `CanvasRenderingContext2D`, kept independent of `graph.class.ts` so it stays trivially testable
 * against a bare detached `<canvas>`.
 */

export interface CanvasCamera {
  k: number;
  x: number;
  y: number;
}

export interface CanvasHull {
  d: string;
  fill: string;
}
export interface CanvasLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  dash?: number[];
  directed?: boolean;
  selected?: boolean;
  dimmed?: boolean;
}
export interface CanvasEdgeLabel {
  x: number;
  y: number;
  text: string;
}
export interface CanvasNode {
  x: number;
  y: number;
  r: number;
  shape: 'circle' | 'square' | 'diamond';
  fill: string;
  selected?: boolean;
  dimmed?: boolean;
}
export interface CanvasNodeLabel {
  x: number;
  y: number;
  text: string;
}
export interface CanvasRing {
  x: number;
  y: number;
  r: number;
}

export interface CanvasScene {
  hulls: CanvasHull[];
  links: CanvasLink[];
  edgeLabels: CanvasEdgeLabel[];
  nodes: CanvasNode[];
  nodeLabels: CanvasNodeLabel[];
  focusHalo?: CanvasRing;
  keyboardFocusRing?: CanvasRing;
  showNodeLabels: boolean;
  haloColor: string;
  selectedColor: string;
  dimmedOpacity?: number;
  labelColor: string;
  labelHaloColor: string;
  font: string;
}

/** Matches the SVG renderer's community-hull stroke width (`2 * --lr-size-24px`, i.e. 2x a 24
 *  world-px padding) so a hull reads identically thick in either renderer. */
const HULL_STROKE_WIDTH = 48;
/** Matches the SVG renderer's edge/community label halo stroke width (`--lr-size-3px`). */
const LABEL_HALO_WIDTH = 3;

function pathForShape(x: number, y: number, r: number, shape: CanvasNode['shape']): Path2D {
  const path = new Path2D();
  if (shape === 'circle') {
    path.arc(x, y, r, 0, Math.PI * 2);
    return path;
  }
  // side = r * sqrt(pi), area-matched to a circle of radius r -- mirrors graph.class.ts's own
  // shapeHalfSide()/squarePath()/diamondPath() math, reimplemented locally so this module stays
  // independent of graph.class.ts.
  const s = (r * Math.sqrt(Math.PI)) / 2;
  if (shape === 'square') {
    path.rect(x - s, y - s, s * 2, s * 2);
    return path;
  }
  const d = s * Math.SQRT2;
  path.moveTo(x, y - d);
  path.lineTo(x + d, y);
  path.lineTo(x, y + d);
  path.lineTo(x - d, y);
  path.closePath();
  return path;
}

function drawArrowhead(ctx: CanvasRenderingContext2D, link: CanvasLink): void {
  const dx = link.x2 - link.x1;
  const dy = link.y2 - link.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = Math.max(6, link.width * 3);
  const bx = link.x2 - ux * size;
  const by = link.y2 - uy * size;
  const px = -uy;
  const py = ux;
  ctx.beginPath();
  ctx.moveTo(link.x2, link.y2);
  ctx.lineTo(bx + px * size * 0.4, by + py * size * 0.4);
  ctx.lineTo(bx - px * size * 0.4, by - py * size * 0.4);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle as string;
  ctx.fill();
}

function drawRing(ctx: CanvasRenderingContext2D, ring: CanvasRing, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draws one full frame: hulls -> links (+arrowheads) -> edge labels (halo then fill) -> nodes
 * (+selection stroke) -> node labels -> focus halo -> keyboard focus ring. `ctx` is expected to
 * already have the caller's own DPR scale applied; this function applies `camera` (pan/zoom) on
 * top via `ctx.transform()`, scoped to a `save()`/`restore()` pair so it never leaks into the
 * caller's own transform state.
 */
export function drawGraphScene(ctx: CanvasRenderingContext2D, camera: CanvasCamera, scene: CanvasScene): void {
  ctx.save();
  ctx.transform(camera.k, 0, 0, camera.k, camera.x, camera.y);

  for (const hull of scene.hulls) {
    const path = new Path2D(hull.d);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = hull.fill;
    ctx.strokeStyle = hull.fill;
    ctx.lineWidth = HULL_STROKE_WIDTH;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fill(path);
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  const dimmedOpacity = scene.dimmedOpacity ?? 1;
  for (const link of scene.links) {
    ctx.strokeStyle = link.selected ? scene.selectedColor : link.color;
    ctx.lineWidth = link.width;
    ctx.setLineDash(link.dash ?? []);
    ctx.globalAlpha = link.dimmed ? dimmedOpacity : 1;
    ctx.beginPath();
    ctx.moveTo(link.x1, link.y1);
    ctx.lineTo(link.x2, link.y2);
    ctx.stroke();
    if (link.directed) drawArrowhead(ctx, link);
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  if (scene.edgeLabels.length) {
    ctx.font = scene.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = LABEL_HALO_WIDTH;
    for (const label of scene.edgeLabels) {
      ctx.strokeStyle = scene.labelHaloColor;
      ctx.strokeText(label.text, label.x, label.y);
      ctx.fillStyle = scene.labelColor;
      ctx.fillText(label.text, label.x, label.y);
    }
  }

  for (const node of scene.nodes) {
    const path = pathForShape(node.x, node.y, node.r, node.shape);
    ctx.globalAlpha = node.dimmed ? dimmedOpacity : 1;
    ctx.fillStyle = node.fill;
    ctx.fill(path);
    if (node.selected) {
      ctx.strokeStyle = scene.selectedColor;
      ctx.lineWidth = 2;
      ctx.stroke(path);
    }
  }
  ctx.globalAlpha = 1;

  if (scene.showNodeLabels && scene.nodeLabels.length) {
    ctx.font = scene.font;
    // Label coordinates are physical canvas positions immediately after each node. `start`
    // mirrors under an inherited RTL direction and paints back across the node; `left` keeps the
    // anchor physical while the canvas bidi algorithm still shapes the label text itself.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = scene.labelColor;
    for (const label of scene.nodeLabels) ctx.fillText(label.text, label.x, label.y);
  }

  if (scene.focusHalo) drawRing(ctx, scene.focusHalo, scene.haloColor);
  if (scene.keyboardFocusRing) drawRing(ctx, scene.keyboardFocusRing, scene.haloColor);

  ctx.restore();
}

/** `0` (`rgb(0,0,0)`, a cleared/transparent canvas's default readback) is reserved for "no hit" --
 *  every real pick index is offset by +1 so index 0 (the first drawn item) never collides with it. */
export function indexToPickColor(index: number): string {
  const v = index + 1;
  return `rgb(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff})`;
}

export function pickColorToIndex(r: number, g: number, b: number): number {
  return ((r << 16) | (g << 8) | b) - 1;
}

export interface PickableHull {
  d: string;
}
export interface PickableLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}
export interface PickableNode {
  x: number;
  y: number;
  r: number;
  shape: CanvasNode['shape'];
}

/**
 * Draws the offscreen, same-camera-transform picking canvas: same z-order as `drawGraphScene`
 * (hulls -> links -> nodes, so overlap resolution matches the visible scene -- later draws
 * overwrite earlier pixels, giving "topmost wins"), each item filled with its
 * `indexToPickColor(pickIndex)` (a flat 0-based index across hulls-then-links-then-nodes, the
 * caller's responsibility to keep in sync with the same ordering it fed to `drawGraphScene`).
 * Picking geometry is drawn slightly fat (a caller typically pads node radius/link width a couple
 * of px) for touch/pointer comfort. `imageSmoothingEnabled = false` so only exact color matches
 * map back to an item -- no anti-aliased edge pixel is ever misread as a different item's color.
 */
export function drawPickingScene(
  ctx: CanvasRenderingContext2D,
  camera: CanvasCamera,
  scene: { hulls: PickableHull[]; links: PickableLink[]; nodes: PickableNode[] },
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.transform(camera.k, 0, 0, camera.k, camera.x, camera.y);
  let idx = 0;
  for (const hull of scene.hulls) {
    ctx.fillStyle = indexToPickColor(idx++);
    ctx.fill(new Path2D(hull.d));
  }
  for (const link of scene.links) {
    ctx.strokeStyle = indexToPickColor(idx++);
    ctx.lineWidth = Math.max(link.width + 6, 8);
    ctx.beginPath();
    ctx.moveTo(link.x1, link.y1);
    ctx.lineTo(link.x2, link.y2);
    ctx.stroke();
  }
  for (const node of scene.nodes) {
    ctx.fillStyle = indexToPickColor(idx++);
    ctx.fill(pathForShape(node.x, node.y, node.r, node.shape));
  }
  ctx.restore();
}
