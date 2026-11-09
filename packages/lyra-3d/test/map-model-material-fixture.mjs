export const attribute = (values, itemSize) => ({ array: new Float32Array(values), itemSize, normalized: false,
  count: values.length / itemSize, stride: itemSize, offset: 0 });
export function fixture() {
  return {
    geometry: { attributes: { position: attribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      normal: attribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3), uv: attribute([0, 0, 1, 0, 0, 1], 2) },
    index: new Uint16Array([0, 1, 2]), groups: [{ start: 0, count: 3, materialIndex: 0 }], drawRange: { start: 0, count: 3 } },
    material: { kind: 'mesh-standard', name: 'Paint', color: [1, 1, 1], opacity: 1, transparent: false,
      alphaTest: 0.5, depthWrite: true, side: 0, vertexColors: false, flatShading: false,
      roughness: 0.5, metalness: 0, emissive: [0, 0, 0], normalScale: [1, 1], aoMapIntensity: 1,
      maps: { baseColor: 0, normal: null, metalness: null, roughness: null, emissive: null, ao: null } },
    textures: [{ name: 'Color', resource: 0, magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497,
      texCoord: 0, colorSpace: 'srgb', flipY: false, generateMipmaps: true }]
  };
}
export const frame = () => ({ key: 'origin-1', vertexPrelude: 'vec4 lrProjectPosition(vec3 p){return vec4(p,1.0);} vec3 lrHorizonPosition(vec3 p){return p;}',
  fragmentPrelude: 'bool lrHorizonOccluded(vec3 p){return false;}', defines: '#define PROJECTION_MERCATOR',
  positionEncoding: 'tile-xy-meters-z', projectFunction: 'lrProjectPosition', horizonPositionFunction: 'lrHorizonPosition',
  horizonOccludedFunction: 'lrHorizonOccluded', horizonMode: 'none', uniforms: [{ name: 'test', type: 'float', value: 0 }] });

