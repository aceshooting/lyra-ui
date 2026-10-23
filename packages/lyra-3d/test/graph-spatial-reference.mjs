// CPU reference math for shader projection tests, kept outside the production renderer.
import { graphScale, GRAPH_ARROW_HALF_ANGLE } from '../dist/graph/spatial-paths.js';
export const GRAPH_EDGE_DEPTH_BIAS = 2 ** -21;
export const GRAPH_RESORT_ANGLE = 0.02;
const SQUARE = Math.sqrt(Math.PI) / 2;
const DIAMOND = Math.sqrt(Math.PI / 2);
/** Perspective NDC depth in [-1, 1] of eye depth `depth`; window depth is `ndc * 0.5 + 0.5`. */
export function graphNdcDepth(depth, view) {
  const { near, far } = view;
  return (far + near) / (far - near) - (2 * far * near) / ((far - near) * depth);
}
export function graphScreen(eye, view) {
  const scale = graphScale(eye.z, view);
  return { x: view.width * 0.5 + eye.x * scale, y: view.height * 0.5 + eye.y * scale, z: graphNdcDepth(eye.z, view) };
}
/** Clips an eye-space segment at the near plane; `null` when it lies wholly behind it. */
export function graphClipSegment(a, b, near) {
  if (a.z < near && b.z < near) return null;
  const toward = (from, to) => {
    const t = (near - from.z) / (to.z - from.z);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: near };
  };
  return [a.z < near ? toward(a, b) : a, b.z < near ? toward(b, a) : b];
}
/** Orbit eye space of a world point, matching the shader's model-view transform. */
export function graphEye(point, camera) {
  const dx = point.x - camera.target.x, dy = point.y - camera.target.y, dz = point.z - camera.target.z;
  const x = Math.cos(camera.yaw) * dx - Math.sin(camera.yaw) * dz, z = Math.sin(camera.yaw) * dx + Math.cos(camera.yaw) * dz;
  return { x, y: Math.cos(camera.pitch) * dy - Math.sin(camera.pitch) * z, z: camera.distance - (Math.sin(camera.pitch) * dy + Math.cos(camera.pitch) * z) };
}
/** Glyph radius and quad half-extents (paint, pick) for a node; all zero behind the near plane. */
export function graphNodeExtents(eye, size, shape, selected, expanded, worldSizes, markerArm, view) {
  if (eye.z < view.near) return { radius: 0, paint: 0, pick: 0 };
  const radius = Math.min(Math.max(view.width, view.height) * 2, worldSizes ? size * graphScale(eye.z, view) : size);
  const body = shape > 1.5 ? radius * DIAMOND : shape > 0.5 ? radius * SQUARE : radius;
  const pick = shape > 1.5 ? Math.max(12, radius) * DIAMOND : shape > 0.5 ? Math.max(12, radius * SQUARE) : Math.max(12, radius);
  return { radius, paint: Math.max(body, selected ? radius + 5 : 0, expanded ? radius + markerArm : 0), pick };
}
/** World point `t` of a straight (`loopRadius <= 0`) or self-loop path; loop radii in CSS pixels
 * resolve at the loop centre's depth. */
export function graphPathPoint(start, end, loopRadius, t, centreDepth, worldSizes, view) {
  if (loopRadius <= 0) return t <= 0 ? start : t >= 1 ? end : { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t };
  if (t <= 0 || t >= 1) return start;
  const radius = worldSizes ? loopRadius : centreDepth < view.near ? 0 : loopRadius / graphScale(centreDepth, view);
  const angle = t * Math.PI * 2;
  return { x: start.x + Math.sin(angle) * radius, y: start.y - (1 - Math.cos(angle)) * radius, z: start.z };
}
/** Screen endpoints of a stroke segment, or `null` when it is behind the camera. */
export function graphSegmentScreen(a, b, view) {
  const clip = graphClipSegment(a, b, view.near);
  return clip ? [graphScreen(clip[0], view), graphScreen(clip[1], view)] : null;
}
/** Arrow quad (tail, tip) for the terminal segment `a`→`b`, inset by a node radius in CSS pixels
 * (`worldSizes`: world units at the tip's depth), or `null` when hidden. */
export function graphArrowScreen(a, b, inset, width, worldSizes, view) {
  if (b.z < view.near) return null;
  const clip = graphClipSegment(a, b, view.near);
  const tail = graphScreen(clip[0], view), head = graphScreen(b, view);
  const dx = head.x - tail.x, dy = head.y - tail.y, span = Math.hypot(dx, dy);
  if (!(span > 0)) return null;
  const height = width / (2 * Math.tan(GRAPH_ARROW_HALF_ANGLE)), pixels = worldSizes ? inset * graphScale(b.z, view) : inset;
  const tipX = head.x - dx / span * pixels, tipY = head.y - dy / span * pixels;
  return [{ x: tipX - dx / span * height, y: tipY - dy / span * height, z: head.z }, { x: tipX, y: tipY, z: head.z }];
}
