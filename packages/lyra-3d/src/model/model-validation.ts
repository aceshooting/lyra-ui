import { Box3, BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Object3D, Vector3 } from 'three';
import { ModelAdmissionError } from './admission.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import type { ModelAdmission } from './types.js';
interface ParsedMeasurements { bounds: Box3 | null; vertices: number; indices: number }
function requireValid(value: unknown): asserts value { if (!value) throw new ModelAdmissionError('invalid'); }
function finite(value: number): void { requireValid(Number.isFinite(value) && Math.abs(value) <= LIMIT.coordinate); }
function geometryObject(value: Object3D): value is Object3D & { geometry: BufferGeometry } { return 'geometry' in value && value.geometry instanceof BufferGeometry && 'material' in value; }

/** Independently verify the loader's result before any camera calculation or GPU upload. */
export function validateParsedModel(roots: readonly Object3D[], admission: ModelAdmission): ParsedMeasurements {
  let vertices = 0; let indices = 0; let objects = 0; let drawables = 0; let bytes = 0;
  const visited = new Set<Object3D>(); const geometries = new Set<BufferGeometry>(); const buffers = new Set<ArrayBufferLike>();
  const bounds = new Box3(); const point = new Vector3();
  const charge = (buffer: ArrayBufferLike): void => {
    if (buffers.has(buffer)) return;
    buffers.add(buffer); bytes += buffer.byteLength; requireValid(bytes <= admission.decodedBytes && bytes <= LIMIT.decodedBytes);
  };
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      if (visited.has(object)) return;
      visited.add(object); requireValid(++objects <= LIMIT.entries * 3);
      object.matrixWorld.elements.forEach(finite);
      if (!geometryObject(object)) return;
      requireValid(++drawables <= LIMIT.entries);
      const geometry = object.geometry; const position = geometry.getAttribute('position');
      requireValid(position && position.itemSize === 3 && Number.isSafeInteger(position.count) && position.count >= 0);
      vertices += position.count; indices += geometry.index?.count ?? 0;
      requireValid(vertices <= admission.vertices && indices <= admission.indices);
      if (!geometries.has(geometry)) {
        geometries.add(geometry);
        for (const attribute of Object.values(geometry.attributes)) {
          requireValid(attribute instanceof BufferAttribute || attribute instanceof InterleavedBufferAttribute);
          requireValid(Number.isSafeInteger(attribute.count) && attribute.count === position.count && attribute.itemSize >= 1 && attribute.itemSize <= 4);
          charge(attribute instanceof InterleavedBufferAttribute ? attribute.data.array.buffer : attribute.array.buffer);
          for (let i = 0; i < attribute.count; i++) for (let axis = 0; axis < attribute.itemSize; axis++) finite(attribute.getComponent(i, axis));
        }
        if (geometry.index) {
          charge(geometry.index.array.buffer);
          for (let i = 0; i < geometry.index.count; i++) {
            const index = geometry.index.getX(i); requireValid(Number.isSafeInteger(index) && index >= 0 && index < position.count);
          }
        }
        requireValid(Object.keys(geometry.morphAttributes).length === 0);
        // Loader-provided extrema may originate in untrusted glTF accessor metadata.
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      }
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        finite(point.x); finite(point.y); finite(point.z); bounds.expandByPoint(point);
      }
    });
  }
  return { bounds: bounds.isEmpty() ? null : bounds, vertices, indices };
}
