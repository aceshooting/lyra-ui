const encode = value => new TextEncoder().encode(value);

function makePlyGpuInput({ name, variant = 'ascii', mesh = false, position = 'float', normal = 'float', uv = 'float' }) {
  const properties = [[position, 'x'], [position, 'y'], [position, 'z'], [normal, 'nx'], [normal, 'ny'], [normal, 'nz'], [uv, 's'], [uv, 't'], ['uchar', 'red'], ['uchar', 'green'], ['uchar', 'blue']];
  const vertices = [
    [-0.750000000125, -0.500000000125, 0, 0, 0, 1, 0.125000000125, 0.250000000125, 255, 64, 32],
    [0.750000000125, -0.500000000125, 0, 0, 0, 1, 0.875000000125, 0.250000000125, 64, 255, 32],
    [0.750000000125, 0.500000000125, 0, 0, 0, 1, 0.875000000125, 0.750000000125, 32, 64, 255],
    [-0.750000000125, 0.500000000125, 0, 0, 0, 1, 0.125000000125, 0.750000000125, 255, 128, 64],
  ];
  const format = { ascii: 'ascii', 'binary-le': 'binary_little_endian', 'binary-be': 'binary_big_endian' }[variant];
  const header = ['ply', `format ${format} 1.0`, `element vertex ${vertices.length}`, ...properties.map(([type, key]) => `property ${type} ${key}`), ...(mesh ? ['element face 1', 'property list uchar int vertex_indices'] : []), 'end_header', ''].join('\n');
  const prefix = encode(header);
  let bytes;
  if (variant === 'ascii') bytes = encode(header + vertices.map(row => row.join(' ')).join('\n') + (mesh ? '\n4 0 1 2 3\n' : '\n'));
  else {
    const size = type => type === 'double' ? 8 : type === 'float' ? 4 : 1;
    bytes = new Uint8Array(prefix.length + vertices.length * properties.reduce((total, [type]) => total + size(type), 0) + (mesh ? 17 : 0));
    bytes.set(prefix); const view = new DataView(bytes.buffer); let offset = prefix.length; const little = variant === 'binary-le';
    for (const row of vertices) for (let i = 0; i < properties.length; i++) {
      const type = properties[i][0];
      if (type === 'double') view.setFloat64(offset, row[i], little);
      else if (type === 'float') view.setFloat32(offset, row[i], little);
      else view.setUint8(offset, row[i]);
      offset += size(type);
    }
    if (mesh) { view.setUint8(offset++, 4); for (const index of [0, 1, 2, 3]) { view.setInt32(offset, index, little); offset += 4; } }
  }
  return {
    name: `${name}-${variant}`, data: { format: 'ply', bytes },
    expectedParsed: { primitive: mesh ? 'mesh' : 'points', vertices: 4, indices: mesh ? [0, 1, 3, 1, 2, 3] : null,
      positionArray: position === 'double' ? 'Float64Array' : 'Float32Array', normalArray: normal === 'double' ? 'Float64Array' : 'Float32Array', uvArray: uv === 'double' ? 'Float64Array' : 'Float32Array', colorArray: 'Uint8Array', normalizedColor: true },
  };
}

export function plyGpuFixtures() {
  const specifications = [
    { name: 'float-points' },
    { name: 'double-points', position: 'double', normal: 'double', uv: 'double' },
    { name: 'float-mesh', mesh: true },
    { name: 'double-position-mesh', mesh: true, position: 'double' },
    { name: 'double-normal-mesh', mesh: true, normal: 'double' },
    { name: 'double-uv-mesh', mesh: true, uv: 'double' },
    { name: 'double-all-mesh', mesh: true, position: 'double', normal: 'double', uv: 'double' },
  ];
  const cases = specifications.map(spec => makePlyGpuInput(spec));
  for (const variant of ['binary-le', 'binary-be']) {
    cases.push(makePlyGpuInput({ name: 'double-points', variant, position: 'double', normal: 'double', uv: 'double' }));
    cases.push(makePlyGpuInput({ name: 'double-position-mesh', variant, mesh: true, position: 'double' }));
  }
  return cases;
}

const base64 = bytes => btoa(String.fromCharCode(...bytes));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAJgABAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwA//9k=';

function triangle(texture) {
  const bytes = new Uint8Array(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 1]).buffer);
  const document = {
    asset: { version: '2.0' }, buffers: [{ byteLength: bytes.length, uri: `data:application/octet-stream;base64,${base64(bytes)}` }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  if (texture) {
    document.images = [{ uri: texture }]; document.textures = [{ source: 0 }];
    document.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  }
  return document;
}

function glb() {
  const document = triangle();
  const binary = Uint8Array.from(atob(document.buffers[0].uri.split(',')[1]), character => character.charCodeAt(0));
  delete document.buffers[0].uri;
  const source = JSON.stringify(document); const json = encode(source.padEnd(Math.ceil(source.length / 4) * 4, ' '));
  const bytes = new Uint8Array(28 + json.length + binary.length); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, json.length, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(json, 20);
  view.setUint32(20 + json.length, binary.length, true); view.setUint32(24 + json.length, 0x004e4942, true); bytes.set(binary, 28 + json.length);
  return bytes;
}

export function modelAsyncFixtures() {
  return [
    { name: 'gltf', data: { format: 'gltf', bytes: encode(JSON.stringify(triangle())) } },
    { name: 'glb', data: { format: 'glb', bytes: glb() } },
    { name: 'obj', data: { format: 'obj', bytes: encode('v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n') } },
    { name: 'stl', data: { format: 'stl', bytes: encode('solid triangle\nfacet normal 0 0 1\nouter loop\nvertex -1 -1 0\nvertex 1 -1 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle\n') } },
    { name: 'ply', data: { format: 'ply', bytes: encode('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n-1 -1 0\n1 -1 0\n0 1 0\n3 0 1 2\n') } },
    { name: 'xyz', data: { format: 'xyz', bytes: encode('-1 -1 0 255 0 0\n1 -1 0 0 255 0\n0 1 0 0 0 255\n') } },
    { name: 'pcd', data: { format: 'pcd', bytes: encode('VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n-1 -1 0\n1 -1 0\n0 1 0\n') } },
    { name: 'gltf-png', data: { format: 'gltf', bytes: encode(JSON.stringify(triangle(png))) } },
    { name: 'gltf-jpeg', data: { format: 'gltf', bytes: encode(JSON.stringify(triangle(jpeg))) } },
  ];
}
