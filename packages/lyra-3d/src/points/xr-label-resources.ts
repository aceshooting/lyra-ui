import { BufferAttribute, CanvasTexture, ClampToEdgeWrapping, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry,
  InstancedInterleavedBuffer, InterleavedBufferAttribute, LinearFilter, Mesh, NormalBlending, ShaderMaterial, SRGBColorSpace } from 'three';
import type { PointBatchResources } from './resources.js';
import type { PointsXrAllocationAccount, PointsXrLabelLayout } from './xr-label-layout.js';

type PointsXrLabelMesh = Mesh<InstancedBufferGeometry, ShaderMaterial>;
export interface PointsXrLabelResources {
  canvas: HTMLCanvasElement | undefined;
  texture: CanvasTexture | undefined;
  geometries: InstancedBufferGeometry[] | undefined;
  materials: ShaderMaterial[] | undefined;
  meshes: PointsXrLabelMesh[] | undefined;
  disposed: boolean;
}

function inactiveDraw(): void {}

/** Retire owned wrappers without disposing any borrowed inline resource. */
export function disposePointsXrLabelResources(resources: PointsXrLabelResources): void {
  if (resources.disposed) return;
  const { canvas, texture, geometries, materials, meshes } = resources;
  resources.disposed = true;
  resources.canvas = undefined; resources.texture = undefined; resources.geometries = undefined;
  resources.materials = undefined; resources.meshes = undefined;
  for (const mesh of meshes ?? []) { mesh.onBeforeRender = inactiveDraw; mesh.onAfterRender = inactiveDraw; }
  let failed = false, failure: unknown;
  const cleanup = (run: () => void): void => { try { run(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
  for (const mesh of meshes ?? []) cleanup(() => { mesh.removeFromParent(); });
  for (const [index, geometry] of (geometries ?? []).entries()) if (geometries!.indexOf(geometry) === index) cleanup(() => { geometry.dispose(); });
  for (const [index, material] of (materials ?? []).entries()) if (materials!.indexOf(material) === index) cleanup(() => { material.dispose(); });
  cleanup(() => { texture?.dispose(); });
  cleanup(() => { if (canvas) canvas.width = 1; });
  cleanup(() => { if (canvas) canvas.height = 1; });
  if (failed) throw failure;
}

function labelMaterial(texture: CanvasTexture, point: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { atlas: { value: texture } },
    transparent: true, depthTest: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, blending: NormalBlending,
    vertexShader: `
      attribute vec3 labelAnchor;
      ${point ? 'attribute float labelRadius;' : ''}
      attribute vec4 labelRect;
      attribute vec4 labelUv;
      attribute float labelDim;
      varying vec2 atlasUv;
      varying float dim;
      void main() {
        vec2 corner = position.xy;
        vec2 offset = mix(labelRect.xy, labelRect.zw, corner);
        offset.x += 0.008${point ? ' + labelRadius * 0.001' : ''};
        vec4 eye = modelViewMatrix * vec4(labelAnchor, 1.0);
        eye.xy += vec2(offset.x, -offset.y);
        gl_Position = projectionMatrix * eye;
        vec2 topUv = mix(labelUv.xy, labelUv.zw, corner);
        atlasUv = vec2(topUv.x, 1.0 - topUv.y);
        dim = labelDim;
      }
    `,
    fragmentShader: `
      uniform sampler2D atlas;
      varying vec2 atlasUv;
      varying float dim;
      void main() {
        gl_FragColor = texture2D(atlas, atlasUv);
        gl_FragColor.a *= dim;
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Create detached label resources using only numeric layout and borrowed point arrays. */
export function createPointsXrLabelResources(
  layout: PointsXrLabelLayout,
  pointResources: PointBatchResources | undefined,
  atlasCanvas: HTMLCanvasElement | undefined,
  account: PointsXrAllocationAccount,
): PointsXrLabelResources {
  const resources: PointsXrLabelResources = { canvas: atlasCanvas, texture: undefined, geometries: [], materials: [], meshes: [], disposed: false };
  let positionsBuffer: ArrayBuffer | undefined, indicesBuffer: ArrayBuffer | undefined;
  try {
    if (layout.inkRows === 0) {
      disposePointsXrLabelResources(resources);
      return { canvas: undefined, texture: undefined, geometries: undefined, materials: undefined, meshes: undefined, disposed: false };
    }
    if (!atlasCanvas) throw new TypeError('Label atlas is unavailable.');
    const texture = new CanvasTexture(atlasCanvas); resources.texture = texture;
    texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false;
    texture.minFilter = LinearFilter; texture.magFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping; texture.wrapT = ClampToEdgeWrapping; texture.flipY = true;
    positionsBuffer = account.allocate(48); indicesBuffer = account.allocate(12);
    const positions = new Float32Array(positionsBuffer), indices = new Uint16Array(indicesBuffer);
    positions.set([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]); indices.set([0, 1, 2, 0, 2, 3]);
    for (const point of [true, false]) {
      const count = point ? layout.pointRows : layout.axisRows;
      if (count === 0) continue;
      const geometry = new InstancedBufferGeometry(); resources.geometries!.push(geometry);
      geometry.setAttribute('position', new BufferAttribute(positions, 3)); geometry.setIndex(new BufferAttribute(indices, 1));
      const start = point ? 0 : layout.pointRows * 9;
      const rows = new Float32Array(layout.instanceData.buffer, layout.instanceData.byteOffset + start * 4, count * 9);
      const instances = new InstancedInterleavedBuffer(rows, 9, 1);
      geometry.setAttribute('labelRect', new InterleavedBufferAttribute(instances, 4, 0));
      geometry.setAttribute('labelUv', new InterleavedBufferAttribute(instances, 4, 4));
      geometry.setAttribute('labelDim', new InterleavedBufferAttribute(instances, 1, 8));
      if (point) {
        const anchor = pointResources?.geometry?.getAttribute('pointPosition');
        const radius = pointResources?.geometry?.getAttribute('pointSize');
        if (!anchor || !radius) throw new TypeError('Point label anchors are unavailable.');
        geometry.setAttribute('labelAnchor', new InstancedBufferAttribute(anchor.array, 3));
        geometry.setAttribute('labelRadius', new InstancedBufferAttribute(radius.array, 1));
      } else geometry.setAttribute('labelAnchor', new InstancedBufferAttribute(layout.axisAnchors, 3));
      geometry.instanceCount = count;
      const material = labelMaterial(texture, point); resources.materials!.push(material);
      const mesh = new Mesh(geometry, material); resources.meshes!.push(mesh);
      mesh.frustumCulled = false; mesh.renderOrder = 100;
    }
    return resources;
  } catch (error) {
    try { disposePointsXrLabelResources(resources); } catch { /* Preserve the construction failure. */ }
    try { if (positionsBuffer) account.release(positionsBuffer); } catch { /* Continue independent charge cleanup. */ }
    try { if (indicesBuffer) account.release(indicesBuffer); } catch { /* Preserve the construction failure. */ }
    throw error;
  }
}
