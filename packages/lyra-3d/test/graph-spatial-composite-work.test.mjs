import assert from 'node:assert/strict';
import test from 'node:test';
import { BufferGeometry, Material, Mesh, ShaderMaterial, Texture } from 'three';
import { createGraphSpatialComposite, createGraphSpatialCompositeWork, disposeGraphSpatialCompositeResources } from '../dist/graph/spatial-composite.js';
import { createGraphSpatialNodes, createGraphSpatialNodesWork } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges, createGraphSpatialEdgesWork } from '../dist/graph/spatial-edges.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { createGraphSceneFactsWork } from '../dist/graph/scene-facts-work.js';
import { graphSpatialNodeMeshData } from '../dist/graph/spatial-appearance.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const ORACLES = {
  'opaqueCss': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [608, 608, 608, 608, 608, 608, 608, 608, 608, 608, 456, 152, 152, 0, 48, 48, 32, 12],
        'cpuBytes': 6980,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3040,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 36,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000008000000040000040c0000000000000008000000040000040c00000803d0000008000000040000040c00000003e0000008000000040000040c00000403e0000008000000040000040c00000803e0000008000000040000040c00000a03e0000008000000040000040c00000c03e0000008000000040000040c00000e03e0000008000000040000040c00000003f0000008000000040000040c00000103f0000008000000040000040c00000203f0000008000000040000040c00000303f0000008000000040000040c00000403f0000008000000040000040c00000503f0000008000000040000040c00000603f0000008000000040000040c00000703f0000008000000040000040c00000703f0000a0420000a0c00000c040000000000000a0420000a0c00000c0400000803d0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000a03e0000a0420000a0c00000c0400000c03e0000a0420000a0c00000c0400000e03e0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000703f0000008000000040000040c00000c0400000a0420000a0c00000c040000000000000e04000000041000010c100000041' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000008000000040000040c00000803d0000008000000040000040c00000003e0000008000000040000040c00000403e0000008000000040000040c00000803e0000008000000040000040c00000a03e0000008000000040000040c00000c03e0000008000000040000040c00000e03e0000008000000040000040c00000003f0000008000000040000040c00000103f0000008000000040000040c00000203f0000008000000040000040c00000303f0000008000000040000040c00000403f0000008000000040000040c00000503f0000008000000040000040c00000603f0000008000000040000040c00000703f0000008000000040000040c00000803f0000008000000040000040c00000803f0000e04000000041000010c10000803d0000e04000000041000010c10000003e0000e04000000041000010c10000403e0000e04000000041000010c10000803e0000e04000000041000010c10000a03e0000e04000000041000010c10000c03e0000e04000000041000010c10000e03e0000e04000000041000010c10000003f0000e04000000041000010c10000103f0000e04000000041000010c10000203f0000e04000000041000010c10000303f0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000603f0000e04000000041000010c10000703f0000e04000000041000010c10000803f000000000000803f0000803f000000000000803f0000803f00000000000000000000004' + '0'.repeat(89),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f890a5d3eecff513d04f1063f0000803fdfa56c3cecff513d518eef3d0000803f0000803f0000803f0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': false,
        'depthWrite': true,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 1,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [608, 608, 608, 608, 608, 608, 608, 608, 608, 608, 456, 152, 152, 0, 48, 48, 32, 12, 304],
        'cpuBytes': 7284,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3040,
        'sortKeyBytes': 0
      }
    }
  },
  'translucentCss': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1216),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [608, 608, 608, 608, 608, 608, 608, 608, 608, 608, 456, 152, 152, 0, 48, 48, 32, 12],
        'cpuBytes': 6980,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3040,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 36,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000703f0000e04000000041000010c1000000410000a0420000a0c00000c0400000e03e0000008000000040000040c00000503f0000a0420000a0c00000c0400000c03e0000008000000040000040c00000603f0000008000000040000040c00000403f0000008000000040000040c00000703f0000008000000040000040c00000303f0000008000000040000040c00000703f0000008000000040000040c00000c0400000008000000040000040c0000000000000008000000040000040c00000203f0000008000000040000040c00000803d0000008000000040000040c00000103f0000a0420000a0c00000c0400000a03e0000008000000040000040c00000003e0000008000000040000040c00000003f0000008000000040000040c00000403e0000008000000040000040c00000e03e0000008000000040000040c00000803e0000008000000040000040c00000c03e0000008000000040000040c00000a03e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000803d0000a0420000a0c00000c040000000000000a0420000a0c00000c04' + '0'.repeat(73),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000303f0000e04000000041000010c10000603f0000e04000000041000010c10000203f0000e04000000041000010c10000703f0000e04000000041000010c10000103f0000e04000000041000010c10000803f000000400000000000000000000000000000e04000000041000010c10000003f0000008000000040000040c00000603f0000e04000000041000010c10000e03e0000008000000040000040c00000703f0000008000000040000040c00000503f0000008000000040000040c00000803f0000008000000040000040c00000403f0000008000000040000040c00000803f000000000000803f0000803f000000000000008000000040000040c00000803d0000008000000040000040c00000303f0000008000000040000040c00000003e0000008000000040000040c00000203f0000e04000000041000010c10000c03e0000008000000040000040c00000403e0000008000000040000040c00000103f0000008000000040000040c00000803e0000008000000040000040c00000003f0000008000000040000040c00000a03e0000008000000040000040c00000e03e0000008000000040000040c00000c03e0000e04000000041000010c10000a03e0000e04000000041000010c10000803e0000e04000000041000010c10000403e0000e04000000041000010c10000003e0000e04000000041000010c10000803d0000803f0000803f' + '0'.repeat(80),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f0000803f0000803fcdcccc3e0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f890a5d3eecff513d04f1063f0ad7a33e0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fdfa56c3cecff513d518eef3d0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '00000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e00000000cdcc4c3e000000000000000000006040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f0000803f890a5d3e00000000cdcc4c3e9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a99194100000000000080400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000003f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 38,
            'version': 1,
            'normalized': false,
            'bytes': '000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803fcdcccc3e000000409a99993e00000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf890a5d3e890a5d3e0000803fcdcccc3e0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 152
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [608, 608, 608, 608, 608, 608, 608, 608, 608, 608, 456, 152, 152, 304, 48, 48, 32, 12, 304],
        'cpuBytes': 7588,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3040,
        'sortKeyBytes': 304
      }
    }
  },
  'customWorld': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 1,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '' + '0'.repeat(64),
              'updateRanges': []
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000003f00000000000000000000803e0000003f0000803e00000000',
              'updateRanges': []
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000000000000000000000c0000000000000000000000000000080c0',
              'updateRanges': []
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [1, 1],
            'viewWindow': [0, 0, 1, 1],
            'lyraView': [1, 1, 0.5, 10000],
            'worldSizes': 1,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 0, 48, 48, 32, 12, 16],
        'cpuBytes': 7356,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 683,
          'gpuBytes': 320,
          'accountedBytes': 1003,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 38,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000703f0000e04000000041000010c1000000410000a0420000a0c00000c0400000e03e0000e04000000041000010c1000000410000008000000040000040c00000503f0000008000000040000040c00000603f0000008000000040000040c00000403f0000a0420000a0c00000c0400000c03e0000008000000040000040c00000703f0000008000000040000040c00000303f0000008000000040000040c00000703f0000008000000040000040c00000c0400000000000000040000040c00000c0400000008000000040000040c0000000000000008000000040000040c00000203f0000008000000040000040c00000803d0000008000000040000040c00000103f0000a0420000a0c00000c0400000a03e0000008000000040000040c00000003e0000008000000040000040c00000003f0000008000000040000040c00000403e0000008000000040000040c00000e03e0000008000000040000040c00000803e0000008000000040000040c00000c03e0000008000000040000040c00000a03e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000803d0000a0420000a0c00000c040000000000000a0420000a0c00000c04' + '0'.repeat(73),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000303f0000e04000000041000010c10000603f0000e04000000041000010c10000203f0000e04000000041000010c10000703f0000e04000000041000010c10000103f0000e04000000041000010c10000803f000000c00000000000000000000000000000e04000000041000010c10000003f000080be000000bf0000803e000000000000008000000040000040c00000603f0000008000000040000040c00000703f0000008000000040000040c00000503f0000e04000000041000010c10000e03e0000008000000040000040c00000803f0000008000000040000040c00000403f0000008000000040000040c00000803f000080bf0000803f0000803f00000000000000bf000000bf00000000000000000000008000000040000040c00000803d0000008000000040000040c00000303f0000008000000040000040c00000003e0000008000000040000040c00000203f0000e04000000041000010c10000c03e0000008000000040000040c00000403e0000008000000040000040c00000103f0000008000000040000040c00000803e0000008000000040000040c00000003f0000008000000040000040c00000a03e0000008000000040000040c00000e03e0000008000000040000040c00000c03e0000e04000000041000010c10000a03e0000e04000000041000010c10000803e0000e04000000041000010c10000403e0000e04000000041000010c10000003e0000e04000000041000010c10000803d0000803f0000803f' + '0'.repeat(80),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fbd5ee53e4efe953dc736243c000000000000803f890a5d3e000000000000003f0000403f000000bf0000803e000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fdd98073da20e083e9018a33ecdcc4c3e0000003f000000bf00000000000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fdfa56c3cecff513d518eef3d0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '00000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e00000000cdcc4c3e000000000000000000006040000000000000803e0000003f0000803e000000009a9919410000000000008040000000009a9919410000000000008040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f0000803f890a5d3e00000000cdcc4c3e000000000000003f00000000cdcc4c3e9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a99194100000000000080400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000003f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803fcdcccc3e000000409a99993e00000000000080bfbd5ee53e4efe953dc736243c000088c00000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf890a5d3e890a5d3e0000803fcdcccc3edd98073da20e083e9018a33e000000c00000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 1,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '0000000000000040000040c00000c0400000e04000000041000010c100000041',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '000000000000003f00000000cdcc4c3e0000803e0000003f0000803e00000000',
              'updateRanges': [{
                'start': 0,
                'count': 4
              }]
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': 'dd98073da20e083e9018a33e000000c0bd5ee53e4efe953dc736243c000088c0',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [640, 480],
            'viewWindow': [0, 0, 640, 480],
            'lyraView': [640, 480, 0.5, 12000],
            'worldSizes': 1,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 320, 48, 48, 32, 12, 16],
        'cpuBytes': 7676,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 1003,
          'gpuBytes': 320,
          'accountedBytes': 1323,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 320
      }
    }
  },
  'customCss': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '' + '0'.repeat(64),
              'updateRanges': []
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000003f00000000000000000000803e0000003f0000803e00000000',
              'updateRanges': []
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000000000000000000000c0000000000000000000000000000080c0',
              'updateRanges': []
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [1, 1],
            'viewWindow': [0, 0, 1, 1],
            'lyraView': [1, 1, 0.5, 10000],
            'worldSizes': 0,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 0, 48, 48, 32, 12, 16],
        'cpuBytes': 7356,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 683,
          'gpuBytes': 320,
          'accountedBytes': 1003,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 38,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000703f0000e04000000041000010c1000000410000a0420000a0c00000c0400000e03e0000e04000000041000010c1000000410000008000000040000040c00000503f0000a0420000a0c00000c0400000c03e0000008000000040000040c00000603f0000008000000040000040c00000403f0000008000000040000040c00000703f0000008000000040000040c00000303f0000008000000040000040c00000703f0000008000000040000040c00000c0400000000000000040000040c00000c0400000008000000040000040c0000000000000008000000040000040c00000203f0000008000000040000040c00000803d0000008000000040000040c00000103f0000a0420000a0c00000c0400000a03e0000008000000040000040c00000003e0000008000000040000040c00000003f0000008000000040000040c00000403e0000008000000040000040c00000e03e0000008000000040000040c00000803e0000008000000040000040c00000c03e0000008000000040000040c00000a03e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000803d0000a0420000a0c00000c040000000000000a0420000a0c00000c04' + '0'.repeat(73),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000303f0000e04000000041000010c10000603f0000e04000000041000010c10000203f0000e04000000041000010c10000703f0000e04000000041000010c10000103f0000e04000000041000010c10000803f000000c00000000000000000000000000000e04000000041000010c10000003f000080be000000bf0000803e000000000000008000000040000040c00000603f0000e04000000041000010c10000e03e0000008000000040000040c00000703f0000008000000040000040c00000503f0000008000000040000040c00000803f0000008000000040000040c00000403f0000008000000040000040c00000803f000080bf0000803f0000803f00000000000000bf000000bf00000000000000000000008000000040000040c00000803d0000008000000040000040c00000303f0000008000000040000040c00000003e0000008000000040000040c00000203f0000e04000000041000010c10000c03e0000008000000040000040c00000403e0000008000000040000040c00000103f0000008000000040000040c00000803e0000008000000040000040c00000003f0000008000000040000040c00000a03e0000008000000040000040c00000e03e0000008000000040000040c00000c03e0000e04000000041000010c10000a03e0000e04000000041000010c10000803e0000e04000000041000010c10000403e0000e04000000041000010c10000003e0000e04000000041000010c10000803d0000803f0000803f' + '0'.repeat(80),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fbd5ee53e4efe953dc736243c000000000000803f890a5d3e000000000000003f0000403f000000bf0000803e000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fdd98073da20e083e9018a33ecdcc4c3e0000003f000000bf00000000000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003fdfa56c3cecff513d518eef3d0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '00000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e00000000cdcc4c3e000000000000000000006040000000000000803e0000003f0000803e000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f0000803f890a5d3e00000000cdcc4c3e000000000000003f00000000cdcc4c3e9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a99194100000000000080400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000003f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803fcdcccc3e000000409a99993e00000000000080bfbd5ee53e4efe953dc736243c000088c00000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf890a5d3e890a5d3e0000803fcdcccc3edd98073da20e083e9018a33e000000c00000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '0000000000000040000040c00000c0400000e04000000041000010c100000041',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '000000000000003f00000000cdcc4c3e0000803e0000003f0000803e00000000',
              'updateRanges': [{
                'start': 0,
                'count': 4
              }]
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': 'dd98073da20e083e9018a33e000000c0bd5ee53e4efe953dc736243c000088c0',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [640, 480],
            'viewWindow': [0, 0, 640, 480],
            'lyraView': [640, 480, 0.5, 12000],
            'worldSizes': 0,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 20,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 320, 48, 48, 32, 12, 16, 320],
        'cpuBytes': 7996,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 1019,
          'gpuBytes': 320,
          'accountedBytes': 1339,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 320
      }
    }
  },
  'opaqueCustomWorld': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 1,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '' + '0'.repeat(64),
              'updateRanges': []
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000003f00000000000000000000803e0000003f0000803e00000000',
              'updateRanges': []
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000000000000000000000c0000000000000000000000000000080c0',
              'updateRanges': []
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [1, 1],
            'viewWindow': [0, 0, 1, 1],
            'lyraView': [1, 1, 0.5, 10000],
            'worldSizes': 1,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 0, 48, 48, 32, 12, 16],
        'cpuBytes': 7356,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 683,
          'gpuBytes': 320,
          'accountedBytes': 1003,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 38,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000008000000040000040c0000000000000008000000040000040c00000803d0000008000000040000040c00000003e0000008000000040000040c00000403e0000008000000040000040c00000803e0000008000000040000040c00000a03e0000008000000040000040c00000c03e0000008000000040000040c00000e03e0000008000000040000040c00000003f0000008000000040000040c00000103f0000008000000040000040c00000203f0000008000000040000040c00000303f0000008000000040000040c00000403f0000008000000040000040c00000503f0000008000000040000040c00000603f0000008000000040000040c00000703f0000008000000040000040c00000703f0000a0420000a0c00000c040000000000000a0420000a0c00000c0400000803d0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000a03e0000a0420000a0c00000c0400000c03e0000a0420000a0c00000c0400000e03e0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000703f0000008000000040000040c00000c0400000a0420000a0c00000c040000000000000e04000000041000010c1000000410000000000000040000040c00000c0400000e04000000041000010c100000041' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000008000000040000040c00000803d0000008000000040000040c00000003e0000008000000040000040c00000403e0000008000000040000040c00000803e0000008000000040000040c00000a03e0000008000000040000040c00000c03e0000008000000040000040c00000e03e0000008000000040000040c00000003f0000008000000040000040c00000103f0000008000000040000040c00000203f0000008000000040000040c00000303f0000008000000040000040c00000403f0000008000000040000040c00000503f0000008000000040000040c00000603f0000008000000040000040c00000703f0000008000000040000040c00000803f0000008000000040000040c00000803f0000e04000000041000010c10000803d0000e04000000041000010c10000003e0000e04000000041000010c10000403e0000e04000000041000010c10000803e0000e04000000041000010c10000a03e0000e04000000041000010c10000c03e0000e04000000041000010c10000e03e0000e04000000041000010c10000003f0000e04000000041000010c10000103f0000e04000000041000010c10000203f0000e04000000041000010c10000303f0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000603f0000e04000000041000010c10000703f0000e04000000041000010c10000803f000080bf0000803f0000803f000000000000803f0000803f0000000000000000000000c0000000000000000000000000000000bf000000bf0000000000000000000080be000000bf0000803e' + '0'.repeat(72),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803fdd98073da20e083e9018a33e0000803fdfa56c3cecff513d518eef3d0000803fbd5ee53e4efe953dc736243c000000000000003f000000bf00000000000000000000403f000000bf0000803e' + '0'.repeat(72),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f0000803f890a5d3e000000000000803f000000000000003f000000000000803f0000803e0000003f0000803e' + '0'.repeat(72),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f0000803fdd98073da20e083e9018a33e000000c0bd5ee53e4efe953dc736243c000088c' + '0'.repeat(65),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': false,
        'depthWrite': true,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 1,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 1,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '0000000000000040000040c00000c0400000e04000000041000010c100000041',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '000000000000003f000000000000803f0000803e0000003f0000803e00000000',
              'updateRanges': [{
                'start': 0,
                'count': 4
              }]
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': 'dd98073da20e083e9018a33e000000c0bd5ee53e4efe953dc736243c000088c0',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [640, 480],
            'viewWindow': [0, 0, 640, 480],
            'lyraView': [640, 480, 0.5, 12000],
            'worldSizes': 1,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 0, 48, 48, 32, 12, 16],
        'cpuBytes': 7356,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 683,
          'gpuBytes': 320,
          'accountedBytes': 1003,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 0
      }
    }
  },
  'forcedCustomCss': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 0,
            'normalized': false,
            'bytes': '' + '0'.repeat(1280),
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '' + '0'.repeat(64),
              'updateRanges': []
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000003f00000000000000000000803e0000003f0000803e00000000',
              'updateRanges': []
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000000000000000000000c0000000000000000000000000000080c0',
              'updateRanges': []
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [1, 1],
            'viewWindow': [0, 0, 1, 1],
            'lyraView': [1, 1, 0.5, 10000],
            'worldSizes': 0,
            'markerArm': 5,
            'meshForcedColors': 0,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 0, 48, 48, 32, 12, 16],
        'cpuBytes': 7356,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 683,
          'gpuBytes': 320,
          'accountedBytes': 1003,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 38,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000a0420000a0c00000c0400000303f0000a0420000a0c00000c0400000403f0000a0420000a0c00000c0400000203f0000a0420000a0c00000c0400000503f0000a0420000a0c00000c0400000103f0000a0420000a0c00000c0400000603f0000a0420000a0c00000c0400000003f0000a0420000a0c00000c0400000703f0000e04000000041000010c1000000410000a0420000a0c00000c0400000e03e0000e04000000041000010c1000000410000008000000040000040c00000503f0000a0420000a0c00000c0400000c03e0000008000000040000040c00000603f0000008000000040000040c00000403f0000008000000040000040c00000703f0000008000000040000040c00000303f0000008000000040000040c00000703f0000008000000040000040c00000c0400000000000000040000040c00000c0400000008000000040000040c0000000000000008000000040000040c00000203f0000008000000040000040c00000803d0000008000000040000040c00000103f0000a0420000a0c00000c0400000a03e0000008000000040000040c00000003e0000008000000040000040c00000003f0000008000000040000040c00000403e0000008000000040000040c00000e03e0000008000000040000040c00000803e0000008000000040000040c00000c03e0000008000000040000040c00000a03e0000a0420000a0c00000c0400000803e0000a0420000a0c00000c0400000403e0000a0420000a0c00000c0400000003e0000a0420000a0c00000c0400000803d0000a0420000a0c00000c040000000000000a0420000a0c00000c04' + '0'.repeat(73),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000e04000000041000010c10000403f0000e04000000041000010c10000503f0000e04000000041000010c10000303f0000e04000000041000010c10000603f0000e04000000041000010c10000203f0000e04000000041000010c10000703f0000e04000000041000010c10000103f0000e04000000041000010c10000803f000080bf0000000000000000000000000000e04000000041000010c10000003f000080be000000bf0000803e000000000000008000000040000040c00000603f0000e04000000041000010c10000e03e0000008000000040000040c00000703f0000008000000040000040c00000503f0000008000000040000040c00000803f0000008000000040000040c00000403f0000008000000040000040c00000803f000080bf0000803f0000803f00000000000000bf000000bf00000000000000000000008000000040000040c00000803d0000008000000040000040c00000303f0000008000000040000040c00000003e0000008000000040000040c00000203f0000e04000000041000010c10000c03e0000008000000040000040c00000403e0000008000000040000040c00000103f0000008000000040000040c00000803e0000008000000040000040c00000003f0000008000000040000040c00000a03e0000008000000040000040c00000e03e0000008000000040000040c00000c03e0000e04000000041000010c10000a03e0000e04000000041000010c10000803e0000e04000000041000010c10000403e0000e04000000041000010c10000003e0000e04000000041000010c10000803d0000803f0000803f' + '0'.repeat(80),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f890a5d3e890a5d3e0000803f0000803f0000803f890a5d3e000000000000003f0000403f000000bf0000803e000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f890a5d3e890a5d3e0000803f0000803f0000003f000000bf00000000000000000000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f0000803f890a5d3e000000000000003f890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '00000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000003f000000000000000000006040000000000000803e0000003f0000803e0000803f9a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000c0403f7e39410000803f0000803f890a5d3e000000000000003f000000000000003f000000000000803f9a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a991941000000000000804000000000000000000000000000006040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a9919410000000000008040000000009a99194100000000000080400000000000000000000000000000604000000000000000000000000000006040000000000000000000000000000060400000000000000000000000000000604000000000000000000000000000006040000000000000803f890a5d3e000000000000003f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 40,
            'version': 1,
            'normalized': false,
            'bytes': '000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f000080c00000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000000000000000000000000080bf890a5d3e890a5d3e0000803f0000803f890a5d3e890a5d3e0000803f000000c00000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf0000803f0000000000000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf000000409a99993e00000000000080bf890a5d3e890a5d3e0000803f0000803f' + '0'.repeat(64),
            'updateRanges': [{
              'start': 0,
              'count': 160
            }]
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 1,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': {
        'geometry': {
          'instanceCount': 2,
          'attributes': {
            'position': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
              'updateRanges': []
            },
            'normal': {
              'arrayType': 'Float32Array',
              'itemSize': 3,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
              'updateRanges': []
            },
            'uv': {
              'arrayType': 'Float32Array',
              'itemSize': 2,
              'count': 4,
              'version': 0,
              'normalized': false,
              'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
              'updateRanges': []
            },
            'payload0': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '0000000000000040000040c00000c0400000e04000000041000010c100000041',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            },
            'payload1': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '000000bf000000bf0000000000000000000080be000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload2': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 0,
              'normalized': false,
              'bytes': '0000003f000000bf00000000000000000000403f000000bf0000803e00000000',
              'updateRanges': []
            },
            'payload3': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '000000000000003f000000000000803f0000803e0000003f0000803e0000803f',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            },
            'payload4': {
              'arrayType': 'Float32Array',
              'itemSize': 4,
              'count': 2,
              'version': 1,
              'normalized': false,
              'bytes': '890a5d3e890a5d3e0000803f000000c0890a5d3e890a5d3e0000803f000080c0',
              'updateRanges': [{
                'start': 0,
                'count': 8
              }]
            }
          },
          'index': {
            'arrayType': 'Uint16Array',
            'itemSize': 1,
            'bytes': '000002000100020003000100'
          }
        },
        'material': {
          'transparent': false,
          'depthWrite': true,
          'depthTest': true,
          'toneMapped': false,
          'side': 2,
          'forceSinglePass': true,
          'version': 0,
          'uniforms': {
            'viewportSize': [640, 480],
            'viewWindow': [0, 0, 640, 480],
            'lyraView': [640, 480, 0.5, 12000],
            'worldSizes': 0,
            'markerArm': 5,
            'meshForcedColors': 1,
            'dashAtlas': {
              'texture': 'dashAtlas'
            },
            'atlasHeight': 1
          }
        },
        'frustumCulled': false,
        'sharedUniforms': true,
        'sharedPlane': true,
        'sharedIndex': true,
        'tailByteOffsets': [608, 608, 608, 608, 608]
      },
      'allocations': {
        'bufferCount': 20,
        'bufferBytes': [640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 480, 160, 160, 320, 48, 48, 32, 12, 16, 320],
        'cpuBytes': 7996,
        'baseGeometryBytes': 140,
        'customStorage': {
          'payloadBytes': 128,
          'cpuBytes': 1019,
          'gpuBytes': 320,
          'accountedBytes': 1339,
          'primitiveCount': 40
        },
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 3360,
        'sortKeyBytes': 320
      }
    }
  },
  'empty': {
    'before': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': true,
        'depthWrite': false,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 0,
        'uniforms': {
          'viewportSize': [1, 1],
          'viewWindow': [0, 0, 1, 1],
          'lyraView': [1, 1, 0.5, 10000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 32, 12],
        'cpuBytes': 140,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 0,
        'sortKeyBytes': 0
      }
    },
    'after': {
      'geometry': {
        'instanceCount': 0,
        'attributes': {
          'position': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000080bf0000803f000000000000803f0000803f00000000000080bf000080bf000000000000803f000080bf00000000',
            'updateRanges': []
          },
          'normal': {
            'arrayType': 'Float32Array',
            'itemSize': 3,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '00000000000000000000803f00000000000000000000803f00000000000000000000803f00000000000000000000803f',
            'updateRanges': []
          },
          'uv': {
            'arrayType': 'Float32Array',
            'itemSize': 2,
            'count': 4,
            'version': 0,
            'normalized': false,
            'bytes': '000000000000803f0000803f0000803f00000000000000000000803f00000000',
            'updateRanges': []
          },
          'payload0': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload1': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload2': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload3': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          },
          'payload4': {
            'arrayType': 'Float32Array',
            'itemSize': 4,
            'count': 0,
            'version': 0,
            'normalized': false,
            'bytes': '',
            'updateRanges': []
          }
        },
        'index': {
          'arrayType': 'Uint16Array',
          'itemSize': 1,
          'bytes': '000002000100020003000100'
        }
      },
      'material': {
        'transparent': false,
        'depthWrite': true,
        'depthTest': true,
        'toneMapped': true,
        'side': 2,
        'forceSinglePass': true,
        'version': 1,
        'uniforms': {
          'viewportSize': [640, 480],
          'viewWindow': [0, 0, 640, 480],
          'lyraView': [640, 480, 0.5, 12000],
          'worldSizes': 0,
          'markerArm': 5,
          'meshForcedColors': 0,
          'dashAtlas': {
            'texture': 'dashAtlas'
          },
          'atlasHeight': 1
        }
      },
      'frustumCulled': false,
      'sharedNodeWorldSizes': true,
      'sharedNodeMarkerArm': true,
      'sharedEdgeAtlas': true,
      'sharedEdgeAtlasHeight': true,
      'customPick': null,
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 32, 12],
        'cpuBytes': 140,
        'baseGeometryBytes': 140,
        'customStorage': null,
        'transientCustomScratchBytes': 0,
        'gpuAttributeBytes': 0,
        'sortKeyBytes': 0
      }
    }
  }
};

function drain(work) {
  try {
    for (let calls = 0; calls < 100000; calls++) { const step = work.step(4096); if (step.done) return step.value; }
    assert.fail('preparation did not finish');
  } finally { work.dispose(); }
}
const empty = () => ({ nodeCount: 0, source: new Uint32Array(), target: new Uint32Array(), spatialAppearance: {} });
function owned(raw) { return drain(createGraphDataPreparationWork(raw)).data; }
function children(data, view = presentation()) {
  const facts = drain(createGraphSceneFactsWork(data, view.style.pointSize)), custom = graphSpatialNodeMeshData(data.spatialAppearance);
  const nodes = drain(createGraphSpatialNodesWork(data, view));
  try {
    const edges = drain(createGraphSpatialEdgesWork(data, facts, view));
    return { nodes, edges, custom, dispose() { try { edges.batch.dispose(); } finally { nodes.batch.dispose(); } } };
  } catch (error) { nodes.batch.dispose(); throw error; }
}
function legacyChildren(data, view = presentation()) {
  const custom = graphSpatialNodeMeshData(data.spatialAppearance), nodes = createGraphSpatialNodes(data, custom);
  let edges;
  try {
    edges = createGraphSpatialEdges(data);
    nodes.update(view, data.positions, view.state);
    edges.update(view, row => ({ x: data.positions[row * 3], y: data.positions[row * 3 + 1], z: data.positions[row * 3 + 2] }), view.state);
    return { nodes, edges, custom, dispose() { try { edges.dispose(); } finally { nodes.dispose(); } } };
  } catch (error) { try { edges?.dispose(); } finally { nodes.dispose(); } throw error; }
}
function workFor(child, view = presentation(), guard) {
  return createGraphSpatialCompositeWork(child.nodes, child.edges, { width: view.width, height: view.height, orbit: view.orbit }, child.custom, guard);
}
function finish(work, budget = 7) {
  const totals = { operations: 0, allocatedBytes: 0, visitedNodes: 0, visitedEdgePrimitives: 0, packedFaces: 0, paintedFaces: 0,
    initializedSlots: 0, orderedRows: 0, sortOperations: 0, publishedRanges: 0 };
  for (let calls = 0; calls < 1000000; calls++) {
    const step = work.step(budget);
    for (const key of Object.keys(totals)) { assert.ok(Number.isSafeInteger(step[key]) && step[key] >= 0, key); totals[key] += step[key]; }
    assert.ok(step.operations <= budget);
    if (step.done) { assert.ok(step.value); return { value: step.value, ...totals }; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('composite preparation did not finish');
}
function disposals(action, failure) {
  const originalGeometry = BufferGeometry.prototype.dispose, originalMaterial = Material.prototype.dispose, originalTexture = Texture.prototype.dispose;
  const calls = [];
  const record = (value, kind, original) => {
    calls.push({ kind, id: value.id }); original.call(value);
    const error = failure?.(kind, value.id); if (error) throw error;
  };
  BufferGeometry.prototype.dispose = function () { record(this, this.type, originalGeometry); };
  Material.prototype.dispose = function () { record(this, this.type, originalMaterial); };
  Texture.prototype.dispose = function () { record(this, 'Texture', originalTexture); };
  try { action(calls); }
  finally { BufferGeometry.prototype.dispose = originalGeometry; Material.prototype.dispose = originalMaterial; Texture.prototype.dispose = originalTexture; }
}
function withMethod(prototype, key, replace, action) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key), original = prototype[key];
  Object.defineProperty(prototype, key, { configurable: true, writable: true, value: replace(original) });
  try { action(); }
  finally { if (descriptor) Object.defineProperty(prototype, key, descriptor); else delete prototype[key]; }
}
const aborted = error => error?.name === 'AbortError';

const cases = [
  ['opaqueCss', { opaque: true }, 135], ['translucentCss', {}, 208], ['customWorld', { custom: true, world: true }, 230],
  ['customCss', { custom: true }, 231], ['opaqueCustomWorld', { custom: true, world: true, opaque: true }, 153],
  ['forcedCustomCss', { custom: true, forced: true }, 231], ['empty', {}, 22],
];
for (const [name, options, baseOperations] of cases) {
  test(`legacy composite preserves frozen ${name} constructor and initialized states`, () => {
    for (const updated of [false, true]) {
      const data = owned(name === 'empty' ? empty() : input(options)), view = presentation(options), child = legacyChildren(data, view);
      let composite;
      try {
        composite = createGraphSpatialComposite(child.nodes, child.edges, child.custom);
        if (updated) composite.update(view);
        assert.deepEqual(snapshot(composite, child.nodes, child.edges), ORACLES[name][updated ? 'after' : 'before']);
        if (updated) { composite.update(view); assert.deepEqual(snapshot(composite, child.nodes, child.edges), ORACLES[name].after); }
      } finally { try { composite?.dispose(); } finally { child.dispose(); } }
    }
  });
  test(`detached composite preserves frozen ${name} bytes caches and budgets`, () => {
    let expectedOperations;
    for (const budget of [1, 7, 4096]) {
      const data = owned(name === 'empty' ? empty() : input(options)), before = structuredClone(data), view = presentation(options), child = children(data, view);
      const work = workFor(child, view); let result;
      try {
        result = finish(work, budget); const { batch, resources, ownedBuffers } = result.value;
        assert.equal(result.operations, baseOperations + result.sortOperations);
        expectedOperations ??= result.operations; assert.equal(result.operations, expectedOperations);
        assert.equal(result.allocatedBytes, ORACLES[name].after.allocations.cpuBytes);
        assert.equal(result.visitedNodes, name === 'empty' ? 0 : options.custom ? 6 : 3);
        assert.equal(result.visitedEdgePrimitives, name === 'empty' ? 0 : 35);
        assert.equal(result.initializedSlots, name === 'empty' ? 0 : options.custom ? 40 : 38);
        assert.equal(result.packedFaces, options.custom ? 2 : 0); assert.equal(result.paintedFaces, options.custom ? 2 : 0);
        assert.equal(result.orderedRows, ORACLES[name].after.geometry.instanceCount); assert.equal(result.publishedRanges, options.custom ? 3 : 0);
        assert.ok(result.sortOperations <= 8 * result.orderedRows * (Math.ceil(Math.log2(Math.max(2, result.orderedRows))) + 1));
        assert.deepEqual(snapshot(batch, child.nodes.batch, child.edges.batch), ORACLES[name].after); assert.deepEqual(data, before);
        assert.equal(resources.mesh, batch.mesh); assert.equal(resources.geometry, batch.mesh.geometry); assert.equal(resources.material, batch.mesh.material);
        assert.equal(resources.customPick, batch.customPick); assert.equal(resources.disposed, false);
        assert.equal(batch.mesh.parent, null); assert.equal(batch.customPick?.parent ?? null, null);
        assert.equal(ownedBuffers.length, ORACLES[name].after.allocations.bufferCount);
        assert.equal(new Set(ownedBuffers).size, ownedBuffers.length); assert.equal(ownedBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0), result.allocatedBytes);
        assert.deepEqual(child.nodes.batch.takeChanges(), { full: false, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: false, rows: [] });
        batch.update(view); assert.deepEqual(snapshot(batch, child.nodes.batch, child.edges.batch), ORACLES[name].after);
        work.dispose(); assert.equal(resources.disposed, false); assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
    }
  });
}

test('composite ownership includes shared pick tails while child resources and atlas remain borrowed', () => {
  const data = owned(input({ custom: true })), view = presentation(), child = children(data, view);
  const result = finish(workFor(child, view), 1), { batch, resources, ownedBuffers, borrowedBuffers } = result.value;
  try {
    const expected = [...child.nodes.ownedBuffers, ...child.nodes.borrowedBuffers, ...child.edges.ownedBuffers, ...child.edges.borrowedBuffers];
    for (const body of child.custom.nodeMeshes) if (body) expected.push(body.positions.buffer, body.normals.buffer);
    assert.equal(new Set(borrowedBuffers).size, borrowedBuffers.length); assert.equal(borrowedBuffers.length, new Set(expected).size);
    for (const buffer of new Set(expected)) assert.ok(borrowedBuffers.includes(buffer));
    for (const buffer of borrowedBuffers) assert.equal(ownedBuffers.includes(buffer), false);
    assert.deepEqual(new Set(batch.allocations().buffers), new Set(ownedBuffers));
    for (let index = 0; index < 5; index++) {
      const payload = batch.customPick.geometry.getAttribute(`payload${index}`), visible = batch.mesh.geometry.getAttribute(`payload${index}`);
      assert.ok(ownedBuffers.includes(payload.array.buffer)); assert.notEqual(payload.array.buffer, visible.array.buffer);
      assert.equal(payload.array.byteOffset, 38 * 16); assert.equal(payload.array.length, 8); assert.notEqual(payload, visible);
    }
    const keys = Object.keys(resources).sort(); assert.deepEqual(keys, ['customPick', 'disposed', 'geometry', 'material', 'mesh']);
    disposals(calls => {
      disposeGraphSpatialCompositeResources(resources);
      assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, 2);
      assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, 2); assert.equal(calls.filter(call => call.kind === 'Texture').length, 0);
    });
    assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
  } finally { try { batch.dispose(); } finally { child.dispose(); } }
});

test('creating and closing composite work reads no inputs and invokes no guard or native allocation', () => {
  const child = children(owned(input({ custom: true }))); let reads = 0, guards = 0;
  const watch = value => new Proxy(value, { get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); } });
  try {
    disposals(calls => {
      const work = createGraphSpatialCompositeWork(watch(child.nodes), watch(child.edges), watch(presentation()), watch(child.custom), () => { guards++; return true; });
      assert.equal(reads, 0); assert.equal(guards, 0); work.dispose(); work.dispose();
      assert.equal(reads, 0); assert.equal(guards, 0); assert.equal(calls.length, 0);
      assert.throws(() => work.step(1), { name: 'InvalidStateError' });
    });
    assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
  } finally { child.dispose(); }
});

test('invalid work budgets preserve pending preparation and successful transfer survives cursor disposal', () => {
  const child = children(owned(empty())), work = workFor(child); let result;
  try {
    assert.equal(work.step(1).operations, 1);
    for (const budget of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => work.step(budget), { name: 'RangeError' });
    result = finish(work, 1); assert.equal(result.operations, 21); assert.equal(result.allocatedBytes, 140);
    work.dispose(); work.dispose(); assert.equal(result.value.resources.disposed, false);
    assert.throws(() => work.step(1), { name: 'InvalidStateError' });
  } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
});

test('custom pick initial dirty runs preserve exact sparse and promoted upload ranges', () => {
  for (const count of [128, 130]) {
    const raw = { nodeCount: count, source: new Uint32Array(), target: new Uint32Array(), sizes: new Float32Array(count),
      positions: Float32Array.from({ length: count * 3 }, (_, scalar) => scalar % 3 === 0 && Math.floor(scalar / 3) % 2 === 0 ? 1 : 0),
      spatialAppearance: { nodeMeshes: Array.from({ length: count }, () => triangle([0, 0, 0, 0])) } };
    const view = { ...presentation(), state: { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 } };
    const data = owned(raw), child = children(data, view), work = workFor(child, view); let result;
    try {
      result = finish(work, 1); const pick = result.value.batch.customPick.geometry;
      const ranges = count === 128 ? Array.from({ length: 64 }, (_, index) => ({ start: index * 8, count: 4 })) : [{ start: 0, count: 516 }];
      assert.deepEqual(pick.getAttribute('payload0').updateRanges, ranges); assert.equal(pick.getAttribute('payload0').version, 1);
      assert.deepEqual(pick.getAttribute('payload4').updateRanges, [{ start: 0, count: count * 4 }]);
      assert.equal(pick.getAttribute('payload4').version, 1); assert.equal(result.publishedRanges, ranges.length + 1);
      for (const index of [1, 2, 3]) { assert.equal(pick.getAttribute(`payload${index}`).version, 0); assert.deepEqual(pick.getAttribute(`payload${index}`).updateRanges, []); }
    } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
  }
});

test('prepared construction and its first unchanged update do not schedule timers or invalidate', () => {
  const view = presentation(), child = children(owned(input({ custom: true })), view), work = workFor(child, view);
  const original = globalThis.setTimeout; let scheduled = 0, result;
  try {
    globalThis.setTimeout = () => { scheduled++; assert.fail('initial composite must not schedule a settling timer'); };
    result = finish(work, 1); result.value.batch.update(view); assert.equal(scheduled, 0);
  } finally { globalThis.setTimeout = original; work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
});

test('quiesce cancels a queued settling callback without disposing native or borrowed resources', () => {
  const view = presentation(), child = children(owned(input({ custom: true })), view), work = workFor(child, view);
  const result = finish(work, 1), { batch, resources } = result.value;
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let scheduled, cleared = 0, invalidated = 0; const token = {};
  try {
    globalThis.setTimeout = callback => { assert.equal(scheduled, undefined); scheduled = callback; return token; };
    globalThis.clearTimeout = value => { assert.equal(value, token); cleared++; };
    const next = { ...view, orbit: { ...view.orbit, yaw: view.orbit.yaw + 0.001 }, invalidate() { invalidated++; } };
    batch.update(next); assert.equal(typeof scheduled, 'function'); const before = snapshot(batch, child.nodes.batch, child.edges.batch);
    batch.quiesce(); batch.quiesce(); assert.equal(cleared, 1); assert.equal(resources.disposed, false);
    scheduled(); batch.update({ ...next, orbit: { ...next.orbit, yaw: next.orbit.yaw + 1 } });
    assert.equal(invalidated, 0); assert.deepEqual(snapshot(batch, child.nodes.batch, child.edges.batch), before);
    assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; work.dispose(); try { batch.dispose(); } finally { child.dispose(); } }
});

test('pending composite cancellation at every operation boundary preserves fresh child change records', () => {
  const view = presentation(), data = owned(input({ custom: true })), baselineChildren = children(data, view);
  const baseline = finish(workFor(baselineChildren, view), 4096); const total = baseline.operations;
  baseline.value.batch.dispose(); baselineChildren.dispose();
  for (let completed = 0; completed < total; completed++) {
    const child = children(data, view); let current = true;
    const work = workFor(child, view, () => current);
    try {
      disposals(calls => {
        for (let index = 0; index < completed; index++) { const step = work.step(1); assert.equal(step.done, false); assert.equal(step.value, undefined); }
        current = false; assert.throws(() => work.step(1), aborted);
        assert.equal(new Set(calls.map(call => `${call.kind}:${call.id}`)).size, calls.length);
        assert.equal(calls.filter(call => call.kind === 'Texture').length, 0);
        if (completed === total - 1) {
          assert.equal(calls.filter(call => call.kind === 'PlaneGeometry').length, 1);
          assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, 2);
          assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, 2);
        }
        assert.throws(() => work.step(1), { name: 'InvalidStateError' }); work.dispose();
      });
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
      assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
    } finally { work.dispose(); child.dispose(); }
  }
});

test('the final currentness fence precedes consumption of either child change cache', () => {
  const data = owned(empty()), child = children(data); let work, final = false, calls = 0;
  work = workFor(child, presentation(), () => { if (final && ++calls === 2) return false; return true; });
  try {
    const step = work.step(21); assert.equal(step.done, false); final = true;
    assert.throws(() => work.step(1), aborted); assert.equal(calls, 2);
    assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
  } finally { work.dispose(); child.dispose(); }
});

test('same-cursor stepping rejects before budget validation and caught recursion preserves progress', () => {
  const child = children(owned(empty())); let work, nested = 0, result;
  work = workFor(child, presentation(), () => { assert.throws(() => work.step(0), { name: 'InvalidStateError' }); nested++; return true; });
  try { result = finish(work, 1); assert.equal(result.operations, 22); assert.ok(nested > 0); }
  finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
});

test('guard errors and reentrant closure preserve original failure and child ownership', () => {
  for (const mode of ['throw', 'close']) {
    const child = children(owned(input({ custom: true }))), failure = new Error('guard failed'), cleanup = new Error('cleanup failed');
    let work, trigger = false;
    work = workFor(child, presentation(), () => { if (trigger) { if (mode === 'throw') throw failure; work.dispose(); } return true; });
    try {
      disposals(calls => {
        while (true) { const step = work.step(1); assert.equal(step.done, false); if (step.paintedFaces > 0) break; }
        trigger = true; assert.throws(() => work.step(1), mode === 'throw' ? error => error === failure : aborted);
        assert.equal(calls.filter(call => call.kind === 'InstancedBufferGeometry').length, 2);
        assert.equal(calls.filter(call => call.kind === 'ShaderMaterial').length, 2);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      }, kind => kind === 'ShaderMaterial' ? cleanup : undefined);
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
    } finally { work.dispose(); child.dispose(); }
  }
});

test('resource-only composite retirement attempts every owned native object and never the borrowed atlas', () => {
  const child = children(owned(input({ custom: true }))), { batch, resources } = finish(workFor(child), 1).value;
  let visual = 0, pick = 0, materials = 0, removed = 0; const failure = new Error('resource listener failed');
  try {
    batch.quiesce();
    resources.mesh.removeFromParent = () => { removed++; disposeGraphSpatialCompositeResources(resources); throw failure; };
    resources.customPick.removeFromParent = () => { removed++; return resources.customPick; };
    resources.geometry.addEventListener('dispose', () => visual++);
    resources.customPick.geometry.addEventListener('dispose', () => pick++);
    resources.material.addEventListener('dispose', () => { materials++; batch.dispose(); throw failure; });
    resources.customPick.material.addEventListener('dispose', () => materials++);
    assert.throws(() => disposeGraphSpatialCompositeResources(resources), error => error === failure);
    assert.equal(resources.disposed, true); assert.equal(visual, 1); assert.equal(pick, 1); assert.equal(materials, 2); assert.equal(removed, 2);
    batch.dispose(); disposeGraphSpatialCompositeResources(resources); assert.equal(visual, 1); assert.equal(materials, 2);
    assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
  } finally { try { batch.dispose(); } finally { child.dispose(); } }
});

test('every initial composite backing allocation failure closes work and retires acquired resources', () => {
  for (let failureAt = 1; failureAt <= 17; failureAt++) {
    const child = children(owned(input({ custom: true }))), work = workFor(child), failure = new Error('backing allocation failed');
    const originals = { Float32Array: globalThis.Float32Array, Float64Array: globalThis.Float64Array, Uint32Array: globalThis.Uint32Array, Int32Array: globalThis.Int32Array };
    let allocations = 0;
    try {
      disposals(released => {
        try {
          for (const [name, original] of Object.entries(originals)) globalThis[name] = new Proxy(original, { construct(target, args, newTarget) {
            if (typeof args[0] === 'number' && ++allocations === failureAt) throw failure;
            return Reflect.construct(target, args, newTarget);
          } });
          assert.throws(() => finish(work, 4096), error => error === failure); assert.equal(allocations, failureAt);
          assert.equal(released.filter(call => call.kind === 'Texture').length, 0);
          assert.equal(new Set(released.map(call => `${call.kind}:${call.id}`)).size, released.length);
          if (failureAt <= 15) assert.equal(released.length, 0);
          else {
            assert.equal(released.filter(call => call.kind === 'InstancedBufferGeometry').length, 2);
            assert.equal(released.filter(call => call.kind === 'ShaderMaterial').length, 2);
          }
        } finally { for (const [name, original] of Object.entries(originals)) globalThis[name] = original; }
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      });
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] }); assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
    } finally { work.dispose(); child.dispose(); }
  }
});

test('partial material and custom-pick mesh construction failures preserve the initiating error', () => {
  for (const kind of ['material', 'mesh']) for (const failureAt of [1, 2]) {
    const child = children(owned(input({ custom: true }))), work = workFor(child), failure = new Error(`${kind} construction failed`), cleanup = new Error('retirement failed');
    let calls = 0;
    try {
      const prototype = kind === 'material' ? ShaderMaterial.prototype : Mesh.prototype, key = kind === 'material' ? 'setValues' : 'updateMorphTargets';
      withMethod(prototype, key, original => function (...args) { if (++calls === failureAt) throw failure; return original.apply(this, args); }, () => disposals(released => {
        assert.throws(() => finish(work, 4096), error => error === failure); assert.equal(calls, failureAt);
        assert.equal(released.filter(call => call.kind === 'PlaneGeometry').length, 1);
        assert.equal(released.filter(call => call.kind === 'InstancedBufferGeometry').length, kind === 'material' && failureAt === 1 ? 1 : 2);
        assert.equal(released.filter(call => call.kind === 'ShaderMaterial').length, kind === 'material' ? failureAt - 1 : 2);
        assert.equal(released.filter(call => call.kind === 'Texture').length, 0);
        assert.equal(new Set(released.map(call => `${call.kind}:${call.id}`)).size, released.length);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      }, nativeKind => nativeKind === 'ShaderMaterial' ? cleanup : undefined));
    } finally { work.dispose(); child.dispose(); }
  }
});

test('plane release failure is attempted once and retires the attached composite geometry', () => {
  const child = children(owned(input({ custom: true }))), work = workFor(child), failure = new Error('plane release failed');
  try {
    disposals(released => {
      assert.throws(() => finish(work, 4096), error => error === failure);
      assert.equal(released.filter(call => call.kind === 'PlaneGeometry').length, 1);
      assert.equal(released.filter(call => call.kind === 'InstancedBufferGeometry').length, 1);
      assert.equal(released.filter(call => call.kind === 'ShaderMaterial').length, 0);
    }, kind => kind === 'PlaneGeometry' ? failure : undefined);
  } finally { work.dispose(); child.dispose(); }
});

test('prepared packing and unchanged update avoid native sort full-map fill and bulk payload copies', () => {
  const child = children(owned(input({ custom: true }))), work = workFor(child); let result;
  try {
    withMethod(Float64Array.prototype, 'sort', () => function () { assert.fail('prepared order must not call native sort'); }, () =>
      withMethod(Int32Array.prototype, 'fill', original => function (...args) {
        assert.ok(this.length <= 1, 'slot maps must be initialized through counted visits'); return original.apply(this, args);
      }, () => withMethod(Float32Array.prototype, 'set', original => function (source, ...args) {
        assert.ok(source.length <= 4, 'payload copies must stay within one vec4'); return original.call(this, source, ...args);
      }, () => {
        result = finish(work, 1); result.value.batch.update(presentation());
        assert.deepEqual(snapshot(result.value.batch, child.nodes.batch, child.edges.batch), ORACLES.customCss.after);
      })));
  } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
});

function triangle(color, shifted = false) {
  return { positions: new Float32Array(shifted ? [-0.25, -0.5, 0.25, 0.75, -0.5, 0.25, 0.25, 0.5, 0.25] : [-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]),
    normals: new Float32Array([0, 0, 1]), color };
}
function input({ custom = false, world = false, opaque = false } = {}) {
  return { nodeCount: 3, source: new Uint32Array([0, 1, 2]), target: new Uint32Array([0, 2, 2]),
    positions: new Float32Array([-0, 2, -3, 80, -5, 6, 7, 8, -9]), sizes: new Float32Array([12, 0, 16]), directed: new Uint8Array([1, 0, 1]),
    categories: new Uint16Array([0, 1, 2]), spatialAppearance: { sizeUnits: world ? 'world' : 'css', dimmedOpacity: opaque ? 1 : 0.4,
      nodeShapes: new Uint8Array([0, 1, 2]), expandable: new Uint8Array([1, 0, 0]),
      dangling: new Uint8Array([0, 0, 1]), edgeCurvatures: new Float32Array([0.9, 0.3, 0.7]), edgeWidths: new Float32Array([2, 1.5, 3]),
      edgeColors: new Float32Array([0.2, 0.4, 0.6, opaque ? 1 : 0.8, 0.3, 0.7, 0.9, 1, 0.1, 0.3, 0.5, 0]),
      edgeDashes: [[3, 1, 0], [4, 4], [99]],
      ...(custom ? { nodeMeshes: [triangle([0.2, 0.4, 0.6, opaque ? 1 : 0.5]), null, triangle([0.7, 0.3, 0.1, 0], true)] } : {}),
    } };
}
function presentation({ opaque = false, forced = false } = {}) {
  return { width: 640, height: 480, orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: 0.3, pitch: -0.2 },
    style: resolveLyra3dStyle({ foreground: '#8080ff', accent: opaque ? '#ff8000' : 'rgba(255, 128, 0, 0.5)',
      palette: opaque ? ['#8040c0', '#204060', '#ffffff'] : ['rgba(128, 64, 192, 0.8)', '#204060', '#ffffff'],
      muted: '#204060', fontSize: 20, pointSize: 8, lineWidth: 2, forcedColors: forced }),
    state: { selected: new Set([0, 3]), dimmed: new Set([0, 2]), hover: 4, focus: 1 },
    invalidate() { throw new Error('Initial preparation must not invalidate'); },
  };
}
function bytes(view) { return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('hex'); }
function uniform(value) {
  if (value?.isDataTexture) return { texture: 'dashAtlas' };
  return value && typeof value.toArray === 'function' ? value.toArray() : value;
}
function material(value) {
  return { transparent: value.transparent, depthWrite: value.depthWrite, depthTest: value.depthTest, toneMapped: value.toneMapped,
    side: value.side, forceSinglePass: value.forceSinglePass, version: value.version,
    uniforms: Object.fromEntries(Object.entries(value.uniforms).map(([key, entry]) => [key, uniform(entry.value)])) };
}
function geometry(value) {
  return { instanceCount: value.instanceCount,
    attributes: Object.fromEntries(Object.entries(value.attributes).map(([name, attribute]) => [name, {
      arrayType: attribute.array.constructor.name, itemSize: attribute.itemSize, count: attribute.count, version: attribute.version,
      normalized: attribute.normalized, bytes: bytes(attribute.array), updateRanges: attribute.updateRanges.map(range => ({ ...range })),
    }])), index: { arrayType: value.index.array.constructor.name, itemSize: value.index.itemSize, bytes: bytes(value.index.array) } };
}
function snapshot(batch, nodes, edges) {
  const allocation = batch.allocations(), pick = batch.customPick, visual = batch.mesh;
  return { geometry: geometry(visual.geometry), material: material(visual.material), frustumCulled: visual.frustumCulled,
    sharedNodeWorldSizes: visual.material.uniforms.worldSizes === nodes.mesh.material.uniforms.worldSizes,
    sharedNodeMarkerArm: visual.material.uniforms.markerArm === nodes.mesh.material.uniforms.markerArm,
    sharedEdgeAtlas: visual.material.uniforms.dashAtlas === edges.mesh.material.uniforms.dashAtlas,
    sharedEdgeAtlasHeight: visual.material.uniforms.atlasHeight === edges.mesh.material.uniforms.atlasHeight,
    customPick: pick ? { geometry: geometry(pick.geometry), material: material(pick.material), frustumCulled: pick.frustumCulled,
      sharedUniforms: pick.material.uniforms === visual.material.uniforms,
      sharedPlane: ['position', 'normal', 'uv'].every(name => pick.geometry.getAttribute(name) === visual.geometry.getAttribute(name)),
      sharedIndex: pick.geometry.index === visual.geometry.index,
      tailByteOffsets: Array.from({ length: 5 }, (_, index) => pick.geometry.getAttribute(`payload${index}`).array.byteOffset),
    } : null,
    allocations: { bufferCount: allocation.buffers.length, bufferBytes: allocation.buffers.map(buffer => buffer.byteLength),
      cpuBytes: allocation.cpuBytes, baseGeometryBytes: allocation.baseGeometryBytes, customStorage: allocation.customStorage ?? null,
      transientCustomScratchBytes: allocation.transientCustomScratchBytes, gpuAttributeBytes: allocation.gpuAttributeBytes, sortKeyBytes: allocation.sortKeyBytes } };
}

for (const [name, options, baseOperations] of cases) {
  test(`deferred initial changes preserve frozen ${name} native output and fresh children`, () => {
    let expectedOperations, expectedSortOperations;
    for (const budget of [1, 7, 4096]) {
      const data = owned(name === 'empty' ? empty() : input(options)), view = presentation(options), child = children(data, view);
      const work = createGraphSpatialCompositeWork(child.nodes, child.edges, view, child.custom, undefined, true); let result;
      try {
        assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
        result = finish(work, budget);
        assert.equal(result.operations, baseOperations + result.sortOperations);
        expectedOperations ??= result.operations; expectedSortOperations ??= result.sortOperations;
        assert.equal(result.operations, expectedOperations); assert.equal(result.sortOperations, expectedSortOperations);
        assert.equal(result.allocatedBytes, ORACLES[name].after.allocations.cpuBytes);
        assert.deepEqual(snapshot(result.value.batch, child.nodes.batch, child.edges.batch), ORACLES[name].after);
        assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
        assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] });
        assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
        assert.deepEqual(child.nodes.batch.takeChanges(), { full: false, rows: [] });
        assert.deepEqual(child.edges.batch.takeChanges(), { full: false, rows: [] });
        work.dispose(); assert.equal(result.value.resources.disposed, false);
        assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
    }
  });
}

test('an explicit false sixth argument preserves the default initial child consumption', () => {
  for (const name of ['empty', 'customCss']) for (const budget of [1, 7, 4096]) {
    const options = name === 'customCss' ? { custom: true } : {}, view = presentation(options);
    const child = children(owned(name === 'empty' ? empty() : input(options)), view);
    const work = createGraphSpatialCompositeWork(child.nodes, child.edges, view, child.custom, undefined, false); let result;
    try {
      result = finish(work, budget);
      assert.deepEqual(snapshot(result.value.batch, child.nodes.batch, child.edges.batch), ORACLES[name].after);
      assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: false, rows: [] });
      assert.deepEqual(child.edges.batch.takeChanges(), { full: false, rows: [] });
    } finally { work.dispose(); try { result?.value.batch.dispose(); } finally { child.dispose(); } }
  }
});

for (const [name, options] of [['customWorld', { custom: true, world: true }], ['opaqueCustomWorld', { custom: true, world: true, opaque: true }]]) {
  test(`two deferred ${name} views share children until one coordinator consumption`, () => {
    for (const budget of [1, 7, 4096]) {
      const primaryView = presentation(options), child = children(owned(input(options)), primaryView);
      const fittedView = { ...primaryView, width: 800, height: 600 };
      const primaryWork = createGraphSpatialCompositeWork(child.nodes, child.edges, primaryView, child.custom, undefined, true);
      const fittedWork = createGraphSpatialCompositeWork(child.nodes, child.edges, fittedView, child.custom, undefined, true);
      const childBefore = [geometry(child.nodes.resources.geometry), geometry(child.edges.resources.geometry)];
      const expectedFitted = structuredClone(ORACLES[name].after);
      // World-sized payloads keep their order at this unchanged view direction.
      for (const entry of [expectedFitted.material, expectedFitted.customPick.material]) {
        entry.uniforms.viewportSize = [800, 600]; entry.uniforms.viewWindow = [0, 0, 800, 600];
        entry.uniforms.lyraView = [800, 600, 0.5, 12000];
      }
      let primary, fitted, nodeConsumptions = 0, edgeConsumptions = 0;
      try {
        withMethod(child.nodes.batch, 'takeChanges', original => function (...args) {
          nodeConsumptions++; return original.apply(this, args);
        }, () => withMethod(child.edges.batch, 'takeChanges', original => function (...args) {
          edgeConsumptions++; return original.apply(this, args);
        }, () => {
          primary = finish(primaryWork, budget); assert.equal(nodeConsumptions, 0); assert.equal(edgeConsumptions, 0);
          fitted = finish(fittedWork, budget); assert.equal(nodeConsumptions, 0); assert.equal(edgeConsumptions, 0);
          assert.deepEqual(snapshot(primary.value.batch, child.nodes.batch, child.edges.batch), ORACLES[name].after);
          assert.deepEqual(snapshot(fitted.value.batch, child.nodes.batch, child.edges.batch), expectedFitted);
          assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
          assert.deepEqual([geometry(child.nodes.resources.geometry), geometry(child.edges.resources.geometry)], childBefore);
          assert.notEqual(primary.value.resources.geometry, fitted.value.resources.geometry);
          assert.notEqual(primary.value.resources.material, fitted.value.resources.material);
          assert.notEqual(primary.value.resources.customPick, fitted.value.resources.customPick);
          for (const buffer of primary.value.ownedBuffers) assert.equal(fitted.value.ownedBuffers.includes(buffer), false);
          assert.deepEqual(new Set(primary.value.borrowedBuffers), new Set(fitted.value.borrowedBuffers));
          assert.equal(primary.value.resources.material.uniforms.dashAtlas.value, child.edges.resources.texture);
          assert.equal(fitted.value.resources.material.uniforms.dashAtlas.value, child.edges.resources.texture);
          assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] });
          assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
          assert.equal(nodeConsumptions, 1); assert.equal(edgeConsumptions, 1);
          primary.value.batch.update(primaryView); fitted.value.batch.update(fittedView);
          assert.equal(nodeConsumptions, 1); assert.equal(edgeConsumptions, 1);
          assert.deepEqual(snapshot(primary.value.batch, child.nodes.batch, child.edges.batch), ORACLES[name].after);
          assert.deepEqual(snapshot(fitted.value.batch, child.nodes.batch, child.edges.batch), expectedFitted);
        }));
        primary.value.batch.dispose(); assert.equal(primary.value.resources.disposed, true);
        assert.equal(fitted.value.resources.disposed, false);
        assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
        assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
        assert.deepEqual(snapshot(fitted.value.batch, child.nodes.batch, child.edges.batch), expectedFitted);
      } finally {
        primaryWork.dispose(); fittedWork.dispose();
        try { primary?.value.batch.dispose(); } finally { try { fitted?.value.batch.dispose(); } finally { child.dispose(); } }
      }
    }
  });
}

test('deferred closure currentness loss and child revision staleness leave child changes unconsumed', () => {
  for (const mode of ['close', 'stale', 'revision']) for (const budget of [1, 7, 4096]) {
    const view = presentation(), child = children(owned(input({ custom: true })), view); let current = true;
    const work = createGraphSpatialCompositeWork(child.nodes, child.edges, view, child.custom, () => current, true);
    try {
      let pending = false;
      for (let calls = 0; calls < 100000; calls++) {
        const step = work.step(1); assert.equal(step.done, false); assert.equal(step.value, undefined);
        if (step.paintedFaces > 0) { pending = true; break; }
      }
      assert.equal(pending, true);
      if (mode === 'close') { work.dispose(); assert.throws(() => work.step(budget), { name: 'InvalidStateError' }); }
      else {
        if (mode === 'stale') current = false; else child.nodes.batch.updateStyle(view, view.state);
        assert.throws(() => finish(work, budget), aborted);
        assert.throws(() => work.step(1), { name: 'InvalidStateError' });
      }
      assert.equal(child.nodes.batch.revision, mode === 'revision' ? 2 : 1); assert.equal(child.edges.batch.revision, 1);
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] });
      assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
      assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
    } finally { work.dispose(); child.dispose(); }
  }
});

test('deferred final currentness fence rejects before child consumption at every budget', () => {
  for (const budget of [1, 7, 4096]) {
    const view = presentation(), child = children(owned(empty()), view); let final = false, calls = 0;
    const work = createGraphSpatialCompositeWork(child.nodes, child.edges, view, child.custom,
      () => !(final && ++calls === 2), true);
    try {
      let remaining = 21;
      while (remaining > 0) {
        const step = work.step(Math.min(budget, remaining)); assert.equal(step.done, false); assert.equal(step.value, undefined);
        assert.ok(step.operations > 0 && step.operations <= remaining); remaining -= step.operations;
      }
      final = true; assert.throws(() => work.step(budget), aborted); assert.equal(calls, 2);
      assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
      assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] });
      assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
      assert.equal(child.nodes.resources.disposed, false); assert.equal(child.edges.resources.disposed, false);
      assert.throws(() => work.step(1), { name: 'InvalidStateError' });
    } finally { work.dispose(); child.dispose(); }
  }
});

test('deferred composites at distinct orbits match separate legacy owners and seed unchanged caches', () => {
  for (const budget of [1, 7, 4096]) {
    const data = owned(input({ custom: true })), primaryView = presentation();
    const secondView = { ...primaryView, width: 800, height: 600,
      orbit: { ...primaryView.orbit, yaw: 1.1, pitch: 0.35, distance: 750, target: { x: 5, y: -3, z: 7 } } };
    const child = children(data, primaryView), primaryReferenceChildren = legacyChildren(data, primaryView), secondReferenceChildren = legacyChildren(data, secondView);
    const primaryWork = createGraphSpatialCompositeWork(child.nodes, child.edges, primaryView, child.custom, undefined, true);
    const secondWork = createGraphSpatialCompositeWork(child.nodes, child.edges, secondView, child.custom, undefined, true);
    let primaryReference, secondReference, primary, second, nodeConsumptions = 0, edgeConsumptions = 0;
    try {
      primaryReference = createGraphSpatialComposite(primaryReferenceChildren.nodes, primaryReferenceChildren.edges, primaryReferenceChildren.custom);
      secondReference = createGraphSpatialComposite(secondReferenceChildren.nodes, secondReferenceChildren.edges, secondReferenceChildren.custom);
      primaryReference.update(primaryView); secondReference.update(secondView);
      const expectedPrimary = snapshot(primaryReference, primaryReferenceChildren.nodes, primaryReferenceChildren.edges);
      const expectedSecond = snapshot(secondReference, secondReferenceChildren.nodes, secondReferenceChildren.edges);
      assert.notDeepEqual(expectedPrimary.geometry, expectedSecond.geometry);
      assert.notEqual(child.nodes.batch, primaryReferenceChildren.nodes); assert.notEqual(child.nodes.batch, secondReferenceChildren.nodes);
      assert.notEqual(child.edges.batch, primaryReferenceChildren.edges); assert.notEqual(child.edges.batch, secondReferenceChildren.edges);
      withMethod(child.nodes.batch, 'takeChanges', original => function (...args) {
        nodeConsumptions++; return original.apply(this, args);
      }, () => withMethod(child.edges.batch, 'takeChanges', original => function (...args) {
        edgeConsumptions++; return original.apply(this, args);
      }, () => {
        primary = finish(primaryWork, budget); assert.equal(nodeConsumptions, 0); assert.equal(edgeConsumptions, 0);
        second = finish(secondWork, budget); assert.equal(nodeConsumptions, 0); assert.equal(edgeConsumptions, 0);
        assert.deepEqual(snapshot(primary.value.batch, child.nodes.batch, child.edges.batch), expectedPrimary);
        assert.deepEqual(snapshot(second.value.batch, child.nodes.batch, child.edges.batch), expectedSecond);
        assert.equal(child.nodes.batch.revision, 1); assert.equal(child.edges.batch.revision, 1);
        assert.deepEqual(child.nodes.batch.takeChanges(), { full: true, rows: [] });
        assert.deepEqual(child.edges.batch.takeChanges(), { full: true, rows: [] });
        primary.value.batch.update(primaryView); second.value.batch.update(secondView);
        assert.equal(nodeConsumptions, 1); assert.equal(edgeConsumptions, 1);
        assert.deepEqual(snapshot(primary.value.batch, child.nodes.batch, child.edges.batch), expectedPrimary);
        assert.deepEqual(snapshot(second.value.batch, child.nodes.batch, child.edges.batch), expectedSecond);
      }));
    } finally {
      primaryWork.dispose(); secondWork.dispose();
      try { primary?.value.batch.dispose(); } finally {
        try { second?.value.batch.dispose(); } finally {
          try { primaryReference?.dispose(); } finally {
            try { secondReference?.dispose(); } finally {
              try { primaryReferenceChildren.dispose(); } finally { try { secondReferenceChildren.dispose(); } finally { child.dispose(); } }
            }
          }
        }
      }
    }
  }
});
