import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Material, Mesh, PerspectiveCamera, ShaderMaterial } from 'three';
import { createGraphSpatialNodes, createGraphSpatialNodesWork, disposeGraphSpatialNodeResources } from '../dist/graph/spatial-nodes.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

// Literal bytes cover factory identity initialization and one complete paint update.
const ORACLES = {
  mixedCss: {
    before: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000', 'updateRanges': []},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000803f00000040', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': false, 'depthWrite': true, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 0, 'markerArm': 3, 'viewportSize': [1, 1]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 0, 'markerArm': 3, 'viewportSize': [1, 1]}},
      translucent: false,
      forcedColors: false,
      revision: 0,
      bodyPickable: [false, false, false],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
    after: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000008000000040000040c0000080400000a0c00000c0400000e04000000041000010c1', 'updateRanges': [{'start': 0, 'count': 9}]},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '000080400000804000008040', 'updateRanges': [{'start': 0, 'count': 3}]},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000803f00000040', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f0000803f0000803f000000000000803f0000803f', 'updateRanges': [{'start': 0, 'count': 6}]},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': 'dfa56c3cecff513d518eef3dcdcccc3e890a5d3eecff513d04f1063fcdcc4c3f0000803f0000803f0000803f00000000', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f890a5d3e00000000cdcc4c3e0000803f890a5d3e000000000000003f0000803f890a5d3e00000000cdcc4c3e', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '890a5d3e890a5d3e0000803fcdcccc3e890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803fcdcccc3e', 'updateRanges': [{'start': 0, 'count': 12}]},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': true, 'depthWrite': false, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 1, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 0, 'markerArm': 5, 'viewportSize': [640, 480]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 0, 'markerArm': 5, 'viewportSize': [1, 1]}},
      translucent: true,
      forcedColors: false,
      revision: 1,
      bodyPickable: [false, false, false],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
  },
  customWorld: {
    before: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000', 'updateRanges': []},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000080bf', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': false, 'depthWrite': true, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 1, 'markerArm': 3, 'viewportSize': [1, 1]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 1, 'markerArm': 3, 'viewportSize': [1, 1]}},
      translucent: false,
      forcedColors: false,
      revision: 0,
      bodyPickable: [true, false, true],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
    after: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000008000000040000040c0000080400000a0c00000c0400000e04000000041000010c1', 'updateRanges': [{'start': 0, 'count': 9}]},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '00002041000000000000c040', 'updateRanges': [{'start': 0, 'count': 3}]},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '000080bf0000803f000000c0', 'updateRanges': [{'start': 0, 'count': 3}]},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f0000803f0000803f000000000000803f0000803f', 'updateRanges': [{'start': 0, 'count': 6}]},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': 'dd98073da20e083e9018a33ecdcc4c3e890a5d3eecff513d04f1063fcdcc4c3f6e941a3fa20e083edd98073d00000000', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f890a5d3e00000000cdcc4c3e0000803f890a5d3e000000000000003f0000803f890a5d3e00000000cdcc4c3e', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '890a5d3e890a5d3e0000803fcdcccc3e890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803fcdcccc3e', 'updateRanges': [{'start': 0, 'count': 12}]},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': true, 'depthWrite': false, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 1, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 1, 'markerArm': 5, 'viewportSize': [640, 480]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 1, 'markerArm': 5, 'viewportSize': [1, 1]}},
      translucent: true,
      forcedColors: false,
      revision: 1,
      bodyPickable: [true, false, false],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
  },
  forcedCustomWorld: {
    before: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000', 'updateRanges': []},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000080bf', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000', 'updateRanges': []},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': false, 'depthWrite': true, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 1, 'markerArm': 3, 'viewportSize': [1, 1]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 1, 'markerArm': 3, 'viewportSize': [1, 1]}},
      translucent: false,
      forcedColors: false,
      revision: 0,
      bodyPickable: [true, false, true],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
    after: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000008000000040000040c0000080400000a0c00000c0400000e04000000041000010c1', 'updateRanges': [{'start': 0, 'count': 9}]},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '00002041000000000000c040', 'updateRanges': [{'start': 0, 'count': 3}]},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '000080bf0000803f000080bf', 'updateRanges': [{'start': 0, 'count': 3}]},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f0000803f0000803f000000000000803f0000803f', 'updateRanges': [{'start': 0, 'count': 6}]},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f', 'updateRanges': [{'start': 0, 'count': 12}]},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 3, 'version': 1, 'normalized': false, 'bytes': '890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f', 'updateRanges': [{'start': 0, 'count': 12}]},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 3, 'version': 0, 'normalized': false, 'bytes': '8180803b00000000000000008180003c0000000000000000c1c0403c0000000000000000', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 3,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': true, 'depthWrite': false, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 1, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 1, 'markerArm': 5, 'viewportSize': [640, 480]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 1, 'markerArm': 5, 'viewportSize': [1, 1]}},
      translucent: true,
      forcedColors: true,
      revision: 1,
      bodyPickable: [true, false, true],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
  },
  empty: {
    before: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 0,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': false, 'depthWrite': true, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 0, 'markerArm': 3, 'viewportSize': [1, 1]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [1, 1, 0.5, 10000], 'worldSizes': 0, 'markerArm': 3, 'viewportSize': [1, 1]}},
      translucent: false,
      forcedColors: false,
      revision: 0,
      bodyPickable: [],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
    after: {
      attributes: {
        position: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000', 'updateRanges': []},
        normal: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f', 'updateRanges': []},
        uv: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 4, 'version': 0, 'normalized': false, 'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000', 'updateRanges': []},
        nodePosition: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeSize: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeShape: {'arrayType': 'Float32Array', 'itemSize': 1, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeFlags: {'arrayType': 'Float32Array', 'itemSize': 2, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeFill: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeRing: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        nodeMarker: {'arrayType': 'Float32Array', 'itemSize': 4, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
        pickColor: {'arrayType': 'Float32Array', 'itemSize': 3, 'count': 0, 'version': 0, 'normalized': false, 'bytes': '', 'updateRanges': []},
      },
      index: {'arrayType': 'Uint16Array', 'itemSize': 1, 'bytes': '000002000100020003000100'},
      fixedGeometryBytes: 140,
      instanceCount: 0,
      sameGeometry: true,
      frustumCulled: [false, false],
      material: {'transparent': false, 'depthWrite': true, 'toneMapped': true, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 0, 'markerArm': 5, 'viewportSize': [640, 480]}},
      pickMaterial: {'transparent': false, 'depthWrite': true, 'toneMapped': false, 'side': 2, 'forceSinglePass': true, 'version': 0, 'uniforms': {'lyraView': [640, 480, 0.5, 12000], 'worldSizes': 0, 'markerArm': 5, 'viewportSize': [1, 1]}},
      translucent: false,
      forcedColors: false,
      revision: 1,
      bodyPickable: [],
      firstChanges: {'full': true, 'rows': []},
      secondChanges: {'full': false, 'rows': []},
    },
  },
};

function triangle(color) {
  return { positions: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]), normals: new Float32Array([0, 0, 1]), color };
}
function input(custom = false) {
  return { nodeCount: 3, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array([-0, 2, -3, 4, -5, 6, 7, 8, -9]),
    ...(custom ? { sizes: new Float32Array([20, 0, 12]) } : {}), categories: new Uint16Array([1, 0, 2]),
    spatialAppearance: { sizeUnits: custom ? 'world' : 'css', nodeShapes: new Uint8Array([0, 1, 2]), expandable: new Uint8Array([1, 0, 1]), dimmedOpacity: 0.4,
      ...(custom ? { nodeMeshes: [triangle([0.2, 0.4, 0.6, 0.5]), null, triangle([0.8, 0.4, 0.2, 0])] } : {}) } };
}
const empty = () => ({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array(), spatialAppearance: {} });
function owned(raw) {
  const work = createGraphDataPreparationWork(raw);
  for (let calls = 0; calls < 10000; calls++) { const step = work.step(4096); if (step.done) return step.value.data; }
  assert.fail('data preparation did not finish');
}
function presentation(forcedColors = false) {
  return { width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA,
    style: resolveLyra3dStyle({ foreground: '#8080ff', accent: 'rgba(255, 128, 0, 0.5)', fontSize: 20, pointSize: 8,
      palette: ['rgba(128, 64, 192, 0.8)', '#204060', 'rgba(255, 255, 255, 0)'], forcedColors }),
    state: { selected: new Set([0]), dimmed: new Set([0, 2]), hover: 1, focus: 2 } };
}
function finish(work, budget = 7) {
  const totals = { operations: 0, allocatedBytes: 0, initializedRows: 0 };
  for (let calls = 0; calls < 1000000; calls++) {
    const step = work.step(budget);
    for (const key of Object.keys(totals)) { assert.ok(Number.isSafeInteger(step[key]) && step[key] >= 0, key); totals[key] += step[key]; }
    assert.ok(step.operations <= budget);
    if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('spatial node preparation did not finish');
}
function bytes(view) { return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('hex'); }
function material(value) {
  return { transparent: value.transparent, depthWrite: value.depthWrite, toneMapped: value.toneMapped, side: value.side,
    forceSinglePass: value.forceSinglePass, version: value.version,
    uniforms: Object.fromEntries(Object.entries(value.uniforms).map(([key, entry]) => [key, entry.value && typeof entry.value.toArray === 'function' ? entry.value.toArray() : entry.value])) };
}
function snapshot(batch) {
  const geometry = batch.mesh.geometry;
  return {
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name,
      { arrayType: attribute.array.constructor.name, itemSize: attribute.itemSize, count: attribute.count, version: attribute.version,
        normalized: attribute.normalized, bytes: bytes(attribute.array), updateRanges: attribute.updateRanges.map(range => ({ ...range })) }])),
    index: { arrayType: geometry.index.array.constructor.name, itemSize: geometry.index.itemSize, bytes: bytes(geometry.index.array) },
    fixedGeometryBytes: ['position', 'normal', 'uv'].reduce((sum, name) => sum + geometry.attributes[name].array.byteLength, geometry.index.array.byteLength),
    instanceCount: geometry.instanceCount, sameGeometry: batch.pick.geometry === geometry, frustumCulled: [batch.mesh.frustumCulled, batch.pick.frustumCulled],
    material: material(batch.mesh.material), pickMaterial: material(batch.pick.material), translucent: batch.translucent, forcedColors: batch.forcedColors,
    revision: batch.revision, bodyPickable: Array.from({ length: geometry.instanceCount }, (_, row) => batch.bodyPickable(row)),
    firstChanges: batch.takeChanges(), secondChanges: batch.takeChanges(),
  };
}
function disposals(action, failure) {
  const originalGeometry = BufferGeometry.prototype.dispose, originalMaterial = Material.prototype.dispose;
  const calls = [];
  BufferGeometry.prototype.dispose = function () {
    calls.push({ kind: this.type, id: this.id }); originalGeometry.call(this);
    const error = failure?.(this.type, this.id); if (error) throw error;
  };
  Material.prototype.dispose = function () {
    calls.push({ kind: this.type, id: this.id }); originalMaterial.call(this);
    const error = failure?.(this.type, this.id); if (error) throw error;
  };
  try { action(calls); }
  finally { BufferGeometry.prototype.dispose = originalGeometry; Material.prototype.dispose = originalMaterial; }
}
const aborted = error => error?.name === 'AbortError';

for (const [name, createInput, forcedColors] of [
  ['mixedCss', () => input(), false], ['customWorld', () => input(true), false], ['forcedCustomWorld', () => input(true), true], ['empty', empty, false],
]) {
  test(`legacy node factory preserves both frozen ${name} initialization states`, () => {
    for (const updated of [false, true]) {
      const data = owned(createInput()), view = presentation(forcedColors), batch = createGraphSpatialNodes(data, graphSpatialNodeMeshData(data.spatialAppearance));
      try {
        if (updated) batch.update(view, data.positions, view.state);
        assert.deepEqual(snapshot(batch), ORACLES[name][updated ? 'after' : 'before']);
      } finally { batch.dispose(); }
    }
  });
  test(`detached node work prepares frozen ${name} bytes and caches at every budget`, () => {
    for (const budget of [1, 7, 4096]) {
      const data = owned(createInput()), before = structuredClone(data), view = presentation(forcedColors), work = createGraphSpatialNodesWork(data, view);
      const result = finish(work, budget), { batch, resources } = result.value;
      try {
        assert.equal(result.operations, 19 + data.nodeCount); assert.equal(result.initializedRows, data.nodeCount);
        assert.equal(result.allocatedBytes, 140 + 89 * data.nodeCount);
        assert.deepEqual(snapshot(batch), ORACLES[name].after); assert.deepEqual(data, before);
        assert.equal(batch.mesh.parent, null); assert.equal(batch.pick.parent, null);
        assert.equal(resources.mesh, batch.mesh); assert.equal(resources.pick, batch.pick); assert.equal(resources.geometry, batch.mesh.geometry);
        assert.equal(resources.material, batch.mesh.material); assert.equal(resources.pickMaterial, batch.pick.material); assert.equal(resources.disposed, false);
        work.dispose(); assert.equal(resources.disposed, false); assert.equal(batch.revision, 1);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      } finally { batch.dispose(); }
    }
  });
}

test('owned and borrowed backing inventories are exact without recopying node columns', () => {
  const raw = { ...input(true), spatialAppearance: { ...input(true).spatialAppearance, nodeColors: new Float32Array(12).fill(0.5) } };
  const data = owned(raw), result = finish(createGraphSpatialNodesWork(data, presentation()), 1);
  const { batch, ownedBuffers, borrowedBuffers, resources } = result.value;
  try {
    const expectedBorrowed = [data.spatialAppearance.nodeShapes, data.spatialAppearance.expandable, data.spatialAppearance.nodeColors, data.sizes, data.categories].map(array => array.buffer);
    assert.equal(borrowedBuffers.length, 5); assert.equal(new Set(borrowedBuffers).size, 5);
    for (const backing of expectedBorrowed) assert.ok(borrowedBuffers.includes(backing));
    assert.equal(ownedBuffers.length, 13); assert.equal(new Set(ownedBuffers).size, 13);
    assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.allocatedBytes);
    for (const attribute of Object.values(batch.mesh.geometry.attributes)) assert.ok(ownedBuffers.includes(attribute.array.buffer));
    assert.ok(ownedBuffers.includes(batch.mesh.geometry.index.array.buffer));
    assert.equal(ownedBuffers.filter(buffer => !Object.values(batch.mesh.geometry.attributes).some(attribute => attribute.array.buffer === buffer)
      && batch.mesh.geometry.index.array.buffer !== buffer).length, 1, 'only the private partial-translucency mask supplements geometry backing');
    for (const backing of borrowedBuffers) assert.equal(ownedBuffers.includes(backing), false);
    assert.notEqual(batch.mesh.geometry.attributes.nodePosition.array.buffer, data.positions.buffer);
    for (const body of data.spatialAppearance.nodeMeshes) if (body) for (const backing of [body.positions.buffer, body.normals.buffer]) {
      assert.equal(ownedBuffers.includes(backing), false); assert.equal(borrowedBuffers.includes(backing), false);
    }
    assert.deepEqual(Object.keys(resources).sort(), ['disposed', 'geometry', 'material', 'mesh', 'pick', 'pickMaterial']);
  } finally { disposeGraphSpatialNodeResources(resources); }
});

test('work factory performs no data or presentation reads and no native resource creation', () => {
  let reads = 0, guards = 0;
  const watch = value => new Proxy(value, { get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); } });
  disposals(calls => {
    const work = createGraphSpatialNodesWork(watch(owned(input())), watch(presentation()), () => { guards++; return true; });
    assert.equal(reads, 0); assert.equal(guards, 0); work.dispose(); work.dispose();
    assert.equal(reads, 0); assert.equal(guards, 0); assert.equal(calls.length, 0);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  });
});

test('ordinary data is rejected at setup before any node resource exists', () => {
  const data = owned({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array() });
  disposals(calls => {
    const work = createGraphSpatialNodesWork(data, presentation());
    assert.throws(() => work.step(1), { name: 'TypeError', message: 'Invalid spatial node appearance' });
    assert.equal(calls.length, 0); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  });
});

test('initial node radii preserve negative zero and high row pick IDs retain their full identity', () => {
  const count = 65538, sizes = new Float32Array(count); sizes[0] = -0;
  const data = owned({ nodeCount: count, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array(count * 3), sizes, spatialAppearance: {} });
  const result = finish(createGraphSpatialNodesWork(data, presentation()), 4096), batch = result.value.batch;
  try {
    assert.equal(result.initializedRows, count); assert.equal(result.operations, 19 + count); assert.equal(result.allocatedBytes, 140 + 89 * count);
    assert.ok(Object.is(batch.mesh.geometry.attributes.nodeSize.array[0], -0));
    const colors = batch.mesh.geometry.attributes.pickColor.array;
    for (const row of [0, 254, 255, 256, 65534, 65535, 65536, 65537]) {
      const r = Math.round(colors[row * 3] * 255), g = Math.round(colors[row * 3 + 1] * 255), b = Math.round(colors[row * 3 + 2] * 255);
      assert.equal(r + (g << 8) + (b << 16) - 1, row);
    }
  } finally { batch.dispose(); }
});

test('camera-only uniform changes and the native one-pixel pick hook do not rewrite prepared attributes', () => {
  const { batch } = finish(createGraphSpatialNodesWork(owned(input()), presentation()), 1).value;
  try {
    const versions = Object.values(batch.mesh.geometry.attributes).map(attribute => attribute.version), revision = batch.revision;
    batch.setView({ width: 320, height: 200, orbit: { ...DEFAULT_ORBIT_CAMERA, distance: 2000, pitch: 0.5 } });
    assert.deepEqual(Object.values(batch.mesh.geometry.attributes).map(attribute => attribute.version), versions); assert.equal(batch.revision, revision);
    assert.deepEqual(batch.mesh.material.uniforms.lyraView.value.toArray(), [320, 200, 2, 18000]);
    const camera = new PerspectiveCamera(); camera.setViewOffset(320, 200, 50, 60, 1, 1);
    batch.pick.onBeforeRender(null, null, camera);
    assert.deepEqual(batch.pick.material.uniforms.viewportSize.value.toArray(), [1, 1]);
    camera.clearViewOffset(); batch.pick.onBeforeRender(null, null, camera);
    assert.deepEqual(batch.pick.material.uniforms.viewportSize.value.toArray(), [320, 200]);
  } finally { batch.dispose(); }
});

test('prepared partial-transparency and dirty-row caches support the same sparse updates as the legacy batch', () => {
  const data = owned(input(true)), view = presentation(), prepared = finish(createGraphSpatialNodesWork(data, view), 1).value.batch;
  const legacy = createGraphSpatialNodes(data, graphSpatialNodeMeshData(data.spatialAppearance)); legacy.update(view, data.positions, view.state);
  try {
    assert.deepEqual(prepared.takeChanges(), legacy.takeChanges());
    for (const [nextView, state, rows] of [
      [view, { selected: new Set([2]), dimmed: new Set([1]), hover: -1, focus: -1 }, [0, 1, 2]],
      [presentation(true), { selected: new Set(), dimmed: new Set([0, 1, 2]), hover: -1, focus: 0 }, null],
      [view, { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 }, [0]],
    ]) {
      prepared.updateState(nextView, state, rows); legacy.updateState(nextView, state, rows);
      assert.deepEqual(snapshot(prepared), snapshot(legacy));
    }
  } finally { prepared.dispose(); legacy.dispose(); }
});

test('invalid budgets preserve pending allocations and work disposal never revokes transferred ownership', () => {
  const work = createGraphSpatialNodesWork(owned(input()), presentation());
  assert.equal(work.step(1).operations, 1);
  for (const budget of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), { name: 'RangeError' });
  const result = finish(work, 1); assert.equal(result.operations, 21); assert.equal(result.allocatedBytes, 407);
  work.dispose(); work.dispose(); assert.equal(result.value.resources.disposed, false);
  assert.throws(() => work.step(1), { name: 'InvalidStateError' }); result.value.batch.dispose();
});

test('cancellation at every allocation wrapper row and finalization boundary releases every acquired native handle once', () => {
  for (let completed = 0; completed < 22; completed++) disposals(calls => {
    let current = true;
    const work = createGraphSpatialNodesWork(owned(input()), presentation(), () => current);
    for (let index = 0; index < completed; index++) { const step = work.step(1); assert.equal(step.done, false); assert.equal(step.value, undefined); }
    current = false;
    assert.throws(() => work.step(1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
    const counts = new Map(); for (const call of calls) counts.set(`${call.kind}:${call.id}`, (counts.get(`${call.kind}:${call.id}`) ?? 0) + 1);
    for (const count of counts.values()) assert.equal(count, 1);
    assert.equal(calls.filter(call => call.kind === 'PlaneGeometry').length, completed >= 11 ? 1 : 0);
    assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, completed >= 12 ? 1 : 0);
    assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, completed >= 15 ? 2 : completed >= 14 ? 1 : 0);
  });
});

test('a failing temporary-plane release is attempted once and still retires the attached geometry', () => {
  const failure = new Error('plane release failed');
  disposals(calls => {
    const work = createGraphSpatialNodesWork(owned(input()), presentation());
    assert.throws(() => finish(work, 4096), error => error === failure);
    assert.equal(calls.filter(call => call.kind === 'PlaneGeometry').length, 1);
    assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, 1);
    assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, 0);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }, kind => kind === 'PlaneGeometry' ? failure : undefined);
});

test('guard errors survive cleanup errors and reentrant close cannot transfer partial rows', () => {
  const failure = new Error('guard failed'), cleanup = new Error('material cleanup failed');
  disposals(calls => {
    let trigger = false;
    const work = createGraphSpatialNodesWork(owned(input()), presentation(), () => { if (trigger) throw failure; return true; });
    const pending = work.step(19); assert.equal(pending.done, false); assert.equal(pending.initializedRows, 1);
    trigger = true; assert.throws(() => work.step(1), error => error === failure);
    assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, 2);
    assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, 1);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  }, kind => kind === 'ShaderMaterial' ? cleanup : undefined);
  let work, close = false;
  work = createGraphSpatialNodesWork(owned(input()), presentation(), () => { if (close) work.dispose(); return true; });
  assert.equal(work.step(19).done, false); close = true;
  assert.throws(() => work.step(1), aborted); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('nested stepping refuses before budget validation without disturbing a caught outer operation', () => {
  let work, nested = 0;
  work = createGraphSpatialNodesWork(owned(empty()), presentation(), () => {
    assert.throws(() => work.step(0), { name: 'InvalidStateError' }); nested++; return true;
  });
  const result = finish(work, 1); assert.equal(result.operations, 19); assert.ok(nested > 0); result.value.batch.dispose();
});

test('resource-only retirement blocks later batch updates and attempts all resources despite reentrant disposal errors', () => {
  const data = owned(input()), view = presentation(), { batch, resources } = finish(createGraphSpatialNodesWork(data, view), 1).value;
  let geometry = 0, materials = 0;
  const failure = new Error('material listener failed');
  resources.geometry.addEventListener('dispose', () => geometry++);
  resources.material.addEventListener('dispose', () => { materials++; batch.dispose(); throw failure; });
  resources.pickMaterial.addEventListener('dispose', () => materials++);
  assert.throws(() => disposeGraphSpatialNodeResources(resources), error => error === failure);
  assert.equal(resources.disposed, true); assert.equal(geometry, 1); assert.equal(materials, 2);
  batch.takeChanges();
  const before = snapshot(batch);
  batch.update(presentation(true), new Float32Array(9).fill(90), view.state);
  batch.updateState(view, { ...view.state, focus: -1 }, null); batch.setView({ ...view, width: 20 });
  assert.deepEqual(snapshot(batch), before);
  batch.dispose(); disposeGraphSpatialNodeResources(resources); assert.equal(geometry, 1); assert.equal(materials, 2);
});

test('owned node columns do not pass through synchronous whole-array admission or copies', () => {
  const data = owned(input(true));
  const arrays = [data.positions, data.sizes, data.categories, data.spatialAppearance.nodeShapes, data.spatialAppearance.expandable];
  for (const array of arrays) for (const method of ['slice', 'every', 'map']) Object.defineProperty(array, method, {
    configurable: true, value() { assert.fail(`owned columns must not call ${method}`); },
  });
  const result = finish(createGraphSpatialNodesWork(data, presentation()), 1);
  try { assert.deepEqual(snapshot(result.value.batch), ORACLES.customWorld.after); }
  finally { result.value.batch.dispose(); }
});

test('uncaught nested stepping preserves its exception and closes the outer work', () => {
  let work, failure;
  work = createGraphSpatialNodesWork(owned(input()), presentation(), () => {
    try { work.step(1); } catch (error) { failure = error; throw error; }
    return true;
  });
  assert.throws(() => work.step(1), error => error === failure && error.name === 'InvalidStateError');
  assert.throws(() => work.step(1), { name: 'InvalidStateError' });
});

test('every proportional backing allocation failure closes without constructing native wrappers', () => {
  for (let failureAt = 1; failureAt <= 9; failureAt++) {
    const data = owned(input()), view = presentation(), failure = new Error('backing allocation failed');
    const OriginalFloat32Array = globalThis.Float32Array, OriginalUint8Array = globalThis.Uint8Array;
    let allocations = 0;
    const trap = { construct(target, args, newTarget) {
      if (typeof args[0] === 'number' && ++allocations === failureAt) throw failure;
      return Reflect.construct(target, args, newTarget);
    } };
    disposals(calls => {
      const work = createGraphSpatialNodesWork(data, view);
      try {
        globalThis.Float32Array = new Proxy(OriginalFloat32Array, trap);
        globalThis.Uint8Array = new Proxy(OriginalUint8Array, trap);
        assert.throws(() => finish(work, 4096), error => error === failure);
        assert.equal(allocations, failureAt); assert.equal(calls.length, 0);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
      } finally { globalThis.Float32Array = OriginalFloat32Array; globalThis.Uint8Array = OriginalUint8Array; }
    });
  }
});

function withMethod(prototype, key, replace, action) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key), original = prototype[key];
  Object.defineProperty(prototype, key, { configurable: true, writable: true, value: replace(original) });
  try { action(); }
  finally { if (descriptor) Object.defineProperty(prototype, key, descriptor); else delete prototype[key]; }
}

test('visual and pick material or mesh construction failures release all earlier acquired native resources', () => {
  for (const kind of ['material', 'mesh']) for (const failureAt of [1, 2]) {
    const data = owned(input()), view = presentation(), failure = new Error(`${kind} construction failed`);
    let calls = 0;
    const prototype = kind === 'material' ? ShaderMaterial.prototype : Mesh.prototype, key = kind === 'material' ? 'setValues' : 'updateMorphTargets';
    withMethod(prototype, key, original => function (...args) {
      if (++calls === failureAt) throw failure;
      return original.apply(this, args);
    }, () => disposals(released => {
      const work = createGraphSpatialNodesWork(data, view);
      assert.throws(() => finish(work, 4096), error => error === failure);
      assert.equal(calls, failureAt);
      assert.equal(released.filter(entry => entry.kind === 'PlaneGeometry').length, 1);
      assert.equal(released.filter(entry => entry.kind === 'InstancedBufferGeometry').length, 1);
      assert.equal(released.filter(entry => entry.kind === 'ShaderMaterial').length, kind === 'material' ? failureAt - 1 : 2);
      assert.equal(new Set(released.map(entry => `${entry.kind}:${entry.id}`)).size, released.length);
      assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
    }));
  }
});

test('a post-construction guard can dispose reentrantly after the new material has been acquired', () => {
  const data = owned(input()), view = presentation(); let materialCreated = false, work;
  withMethod(ShaderMaterial.prototype, 'setValues', original => function (...args) {
    const result = original.apply(this, args); materialCreated = true; return result;
  }, () => disposals(released => {
    work = createGraphSpatialNodesWork(data, view, () => { if (materialCreated) work.dispose(); return true; });
    assert.throws(() => finish(work, 4096), aborted);
    assert.equal(materialCreated, true);
    assert.equal(released.filter(entry => entry.kind === 'PlaneGeometry').length, 1);
    assert.equal(released.filter(entry => entry.kind === 'InstancedBufferGeometry').length, 1);
    assert.equal(released.filter(entry => entry.kind === 'ShaderMaterial').length, 1);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
  }));
});
