/** Bounded counterclockwise XY faces with an outward +Z normal. */
export function triangleMesh(count = 1, color) {
  const positions = new Float32Array(count * 9), normals = new Float32Array(count * 3);
  for (let row = 0; row < count; row++) {
    positions.set([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0], row * 9);
    normals.set([0, 0, 1], row * 3);
  }
  return { positions, normals, ...(color === undefined ? {} : { color }) };
}
