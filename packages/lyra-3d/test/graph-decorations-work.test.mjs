import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { BufferGeometry, Group, InstancedMesh, Material, Mesh, Scene, Texture } from 'three';
import { createGraphDecorations, createGraphDecorationsWork, disposeGraphDecorationResources } from '../dist/graph/decorations.js';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const hash = value => createHash('sha256').update(value).digest('hex');

const ORACLES = {
  'empty': {
    'before': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2272,
        'attachedGpuAttributeBytes': 0
      }
    },
    'initial': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2272,
        'attachedGpuAttributeBytes': 0
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  },
  'ordinary': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'undirected': {
    'before': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2272,
        'attachedGpuAttributeBytes': 0
      }
    },
    'initial': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2272,
        'attachedGpuAttributeBytes': 0
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  },
  'emptyLabels': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 13,
        'bufferBytes': [
          8,
          24,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2944,
        'attachedGpuAttributeBytes': 2936
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 15,
        'bufferBytes': [
          8,
          24,
          24,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3040,
        'attachedGpuAttributeBytes': 3032
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  },
  'hiddenLabels': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'zoomGated': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '9adf0b2ccee4f777022ebf88bb1b1fcb983984690fdceb757ad54dfe78b7712f'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '9adf0b2ccee4f777022ebf88bb1b1fcb983984690fdceb757ad54dfe78b7712f'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '337cdd6797539beaa9fe859fafaf2816d6459aa2ec8ca56f96f618af18dc1c53'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          43.66651509613287,
          34.35951014253243,
          2.07933776735896
        ],
        'radius': 57.64476957035211
      },
      {
        'center': [
          43.66651509613287,
          34.35951014253243,
          2.07933776735896
        ],
        'radius': 57.64476957035211
      },
      {
        'center': [
          -0.08204108974049973,
          -2.517946488380735,
          4.994872431891219
        ],
        'radius': 88.92988087130405
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'nullContext': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': true,
        'width': 19,
        'height': 23,
        'contextPresent': false,
        'contextState': null,
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 13,
        'bufferBytes': [
          8,
          24,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2944,
        'attachedGpuAttributeBytes': 2936
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': true,
        'width': 19,
        'height': 23,
        'contextPresent': false,
        'contextState': null,
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 15,
        'bufferBytes': [
          8,
          24,
          24,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3040,
        'attachedGpuAttributeBytes': 3032
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'reducedMotion': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': false,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3108,
        'attachedGpuAttributeBytes': 3100
      }
    },
    'unchangedPatches': [],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'forcedColors': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': false,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          }
        ]
      },
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3108,
        'attachedGpuAttributeBytes': 3100
      }
    },
    'unchangedPatches': [],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'zeroLineWidth': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '357e3283e80648049ced8f7486b626aba5b137f1343dfedd0cda930bcd9b2596'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '357e3283e80648049ced8f7486b626aba5b137f1343dfedd0cda930bcd9b2596'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': false,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 18,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3108,
        'attachedGpuAttributeBytes': 3100
      }
    },
    'unchangedPatches': [],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          40,
          42.5,
          0
        ],
        'radius': 49.56056900399752
      },
      {
        'center': [
          40,
          42.5,
          0
        ],
        'radius': 49.56056900399752
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'stationary': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'wideCanvas': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '6c5d4ad2b1d7b372d9b6c1c95084884710de7f0f3d8881e80e029eca0156c225'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '6c5d4ad2b1d7b372d9b6c1c95084884710de7f0f3d8881e80e029eca0156c225'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'dfe801c0660d820db70c8565b6bcb6e01e9f9b8b765e052f44f4d5b975b1de5e'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 2048,
        'height': 1024,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            2048
          ],
          [
            'height',
            1024
          ],
          [
            'setTransform',
            0.2048,
            0,
            0,
            0.2048,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            10000,
            5000
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                5946.5956098947845,
                2773.2119305279584,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                5034.086092341186,
                3253.4129468097717,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                4121.556332235368,
                2217.5396006186807,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                5048.086092341186,
                3269.4129468097717,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                4981.977127812067,
                2465.689451133005,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                5464.194008584457,
                3018.5007295713067,
                512
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              5946.5956098947845,
              2773.2119305279584,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              5034.086092341186,
              3253.4129468097717,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              4121.556332235368,
              2217.5396006186807,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              5048.086092341186,
              3269.4129468097717,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              4981.977127812067,
              2465.689451133005,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              5464.194008584457,
              3018.5007295713067,
              512
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.09673674388539,
          42.329629379069104,
          0.04567326248818837
        ],
        'radius': 49.74246937079817
      },
      {
        'center': [
          40.09673674388539,
          42.329629379069104,
          0.04567326248818837
        ],
        'radius': 49.74246937079817
      },
      {
        'center': [
          -0.00787594711422912,
          -2.5017228634312367,
          4.999507753305361
        ],
        'radius': 82.20816494669938
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'sameSizeCanvas': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7501b1838edb3241a6118408af5ebd938e932969bd3e9fca482810d08a44be86'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '5bd666ce2bb9c52b414db67da2c98c591123898e1d5d9dc1b802a28395b7c398'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                414.4891785498993,
                266.228345330684,
                225.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                323.2722648647539,
                297.8636428937381,
                316.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                318.2698042699584,
                222.24218730876848,
                321.7301957300416
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                364.56262482410784,
                275.31207003884543,
                275.43737517589216
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              414.4891785498993,
              266.228345330684,
              225.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              323.2722648647539,
              297.8636428937381,
              316.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              318.2698042699584,
              222.24218730876848,
              321.7301957300416
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              364.56262482410784,
              275.31207003884543,
              275.43737517589216
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          40.98108935857906,
          40.68913615061017,
          0.4803826520009988
        ],
        'radius': 51.46275201682934
      },
      {
        'center': [
          -0.08204120597959985,
          -2.5179465138080346,
          4.994872424626275
        ],
        'radius': 83.75221145009017
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'legacyProjection': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'b026faa922fd1e377783cf667c01553be3df162de949e9768b882f23ad43af14'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'b026faa922fd1e377783cf667c01553be3df162de949e9768b882f23ad43af14'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '3ceda18378f7f595646bb3f26e2d276268412f219bd63ff36a4ae4c315f22c68'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                204,
                127.5,
                436
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                160,
                139,
                480
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                130,
                110,
                510
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                174,
                155,
                466
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'link',
                160,
                102.75,
                480
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                180,
                125.25,
                460
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              204,
              127.5,
              436
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              160,
              139,
              480
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              130,
              110,
              510
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'loop',
              174,
              155,
              466
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'link',
              160,
              102.75,
              480
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              180,
              125.25,
              460
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          40.61122909379797,
          41.394370027842854,
          0.2946159607182334
        ],
        'radius': 50.73000209335292
      },
      {
        'center': [
          40.61122909379797,
          41.394370027842854,
          0.2946159607182334
        ],
        'radius': 50.73000209335292
      },
      {
        'center': [
          -7.105427357601002e-15,
          -2.5,
          5
        ],
        'radius': 83.04419541006018
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'clipped': {
    'before': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '59160118b6ec92c768dbf108f969dc12d786fa19935201e3a3755ee1a000ff74'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          8,
          12,
          24,
          32,
          48,
          48,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3084,
        'attachedGpuAttributeBytes': 3076
      }
    },
    'initial': {
      'roots': {
        'world': [
          'arrows',
          'particles'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7a52d772a8b93b3d0252b81dbe880b90eb8650671f5903c937fac0134ffa78f3'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '7a52d772a8b93b3d0252b81dbe880b90eb8650671f5903c937fac0134ffa78f3'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '38e5330da9862ccbb534bf6d84da624cb0eca5885543d8eed20fdf9245d9685f'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                320,
                224,
                320
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                334,
                240,
                306
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'diagonal',
                320,
                224,
                320
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'self',
              320,
              224,
              320
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'loop',
              334,
              240,
              306
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'diagonal',
              320,
              224,
              320
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          }
        ]
      },
      'allocations': {
        'bufferCount': 19,
        'bufferBytes': [
          8,
          12,
          24,
          24,
          32,
          48,
          48,
          72,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 3180,
        'attachedGpuAttributeBytes': 3172
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          0,
          0,
          250
        ],
        'radius': 250
      },
      {
        'center': [
          0,
          0,
          250
        ],
        'radius': 250
      },
      {
        'center': [
          5000.861868240729,
          0,
          249.95690658796357
        ],
        'radius': 5007.1090435287315
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'spatialCss': {
    'before': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 16,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2796,
        'attachedGpuAttributeBytes': 1860
      }
    },
    'initial': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '6baa01b760c7b0d860e59d4d4f3bb6b5ecc42981dbe5d56f658d337a22e5755d'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                419.4891785498993,
                266.228345330684,
                220.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                338.3213006892242,
                284.369421678829,
                301.6786993107758
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.4
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.4
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              419.4891785498993,
              266.228345330684,
              220.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              338.3213006892242,
              284.369421678829,
              301.6786993107758
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.4
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          }
        ]
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2868,
        'attachedGpuAttributeBytes': 1932
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0.415100052885109,
          -19.965283269382255,
          4.291630838971081
        ],
        'radius': 92.90053249869598
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'spatialWorld': {
    'before': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 16,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2796,
        'attachedGpuAttributeBytes': 1860
      }
    },
    'initial': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '9b6ae32a19792bf0661fe0a5f2810bfeed064b69971a130fbda6aa6070dcf26a'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                420.64727462867825,
                266.228345330684,
                219.35272537132175
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                338.3213006892242,
                284.369421678829,
                301.6786993107758
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.4
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                245.40526268578014,
                212.88380165939336,
                394.59473731421986
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.4
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                338.3451620507788,
                313.8636428937381,
                301.6548379492212
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              420.64727462867825,
              266.228345330684,
              219.35272537132175
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              338.3213006892242,
              284.369421678829,
              301.6786993107758
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              245.40526268578014,
              212.88380165939336,
              394.59473731421986
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.4
          },
          {
            'args': [
              'loop',
              338.3451620507788,
              313.8636428937381,
              301.6548379492212
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          }
        ]
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2868,
        'attachedGpuAttributeBytes': 1932
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0.415100052885109,
          -19.965283269382255,
          4.291630838971081
        ],
        'radius': 92.90053249869598
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'spatialHidden': {
    'before': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 16,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2796,
        'attachedGpuAttributeBytes': 1860
      }
    },
    'initial': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '4a87eb71145e77b7c5f3059689ef115984075f0782a8c9b948f40b9443f267cd'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'right',
                419.4891785498993,
                266.228345330684,
                220.5108214501007
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'self',
                338.3213006892242,
                284.369421678829,
                301.6786993107758
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.4
          ],
          [
            'fillText',
            {
              'args': [
                '<b>left</b>',
                244.70940789459536,
                212.88380165939336,
                395.29059210540464
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.4
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'loop',
                337.2722648647539,
                313.8636428937381,
                302.7277351352461
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'right',
              419.4891785498993,
              266.228345330684,
              220.5108214501007
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'self',
              338.3213006892242,
              284.369421678829,
              301.6786993107758
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              '<b>left</b>',
              244.70940789459536,
              212.88380165939336,
              395.29059210540464
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.4
          },
          {
            'args': [
              'loop',
              337.2722648647539,
              313.8636428937381,
              302.7277351352461
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          }
        ]
      },
      'allocations': {
        'bufferCount': 17,
        'bufferBytes': [
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2868,
        'attachedGpuAttributeBytes': 1932
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0.4887183352814971,
          -19.127038852611555,
          4.16303666288372
        ],
        'radius': 92.05287133387412
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'labelCap': {
    'before': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 1,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 300,
        'height': 150,
        'contextPresent': true,
        'contextState': {
          'font': '10px sans-serif',
          'textBaseline': 'alphabetic',
          'textAlign': 'start',
          'fillStyle': '#000000',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ]
        ],
        'painted': []
      },
      'allocations': {
        'bufferCount': 16,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2412,
        'attachedGpuAttributeBytes': 140
      }
    },
    'initial': {
      'roots': {
        'world': [],
        'pick': [],
        'overlay': [
          'labels'
        ]
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry',
        'PlaneGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'labels',
          'type': 'Mesh',
          'geometry': 2,
          'count': null,
          'material': {
            'type': 'ShaderMaterial',
            'transparent': true,
            'depthWrite': false,
            'depthTest': false,
            'toneMapped': true,
            'fog': false,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': null
          },
          'frustumCulled': false,
          'renderOrder': 100,
          'visible': true
        }
      ],
      'texture': {
        'version': 2,
        'colorSpace': 'srgb',
        'generateMipmaps': false,
        'flipY': true,
        'imageIsCanvas': true
      },
      'canvas': {
        'acquired': true,
        'width': 960,
        'height': 720,
        'contextPresent': true,
        'contextState': {
          'font': '16px Example Sans, monospace',
          'textBaseline': 'middle',
          'textAlign': 'left',
          'fillStyle': 'rgba(128, 96, 192, 1)',
          'globalAlpha': 1
        },
        'trace': [
          [
            'createCanvas'
          ],
          [
            'getContext',
            '2d'
          ],
          [
            'width',
            960
          ],
          [
            'height',
            720
          ],
          [
            'setTransform',
            1.5,
            0,
            0,
            1.5,
            0,
            0
          ],
          [
            'clearRect',
            0,
            0,
            640,
            480
          ],
          [
            'font',
            '16px Example Sans, monospace'
          ],
          [
            'textBaseline',
            'middle'
          ],
          [
            'textAlign',
            'left'
          ],
          [
            'fillStyle',
            'rgba(128, 96, 192, 1)'
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'label-299',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-298',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            0.3
          ],
          [
            'fillText',
            {
              'args': [
                'label-0',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 0.3
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-1',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-2',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-3',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-4',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-5',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-6',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-7',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-8',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-9',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-10',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-11',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-12',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-13',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-14',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-15',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-16',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-17',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-18',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-19',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-20',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-21',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-22',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-23',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-24',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-25',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-26',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-27',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-28',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-29',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-30',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-31',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-32',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-33',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-34',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-35',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-36',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-37',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-38',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-39',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-40',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-41',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-42',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-43',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-44',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-45',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-46',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-47',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-48',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-49',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-50',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-51',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-52',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-53',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-54',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-55',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-56',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-57',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-58',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-59',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-60',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-61',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-62',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-63',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-64',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-65',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-66',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-67',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-68',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-69',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-70',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-71',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-72',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-73',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-74',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-75',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-76',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-77',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-78',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-79',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-80',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-81',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-82',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-83',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-84',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-85',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-86',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-87',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-88',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-89',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-90',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-91',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-92',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-93',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-94',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-95',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-96',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-97',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-98',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-99',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-100',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-101',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-102',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-103',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-104',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-105',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-106',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-107',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-108',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-109',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-110',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-111',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-112',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-113',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-114',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-115',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-116',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-117',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-118',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-119',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-120',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-121',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-122',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-123',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-124',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-125',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-126',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-127',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-128',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-129',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-130',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-131',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-132',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-133',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-134',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-135',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-136',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-137',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-138',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-139',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-140',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-141',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-142',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-143',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-144',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-145',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-146',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-147',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-148',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-149',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-150',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-151',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-152',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-153',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-154',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-155',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-156',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-157',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-158',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-159',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-160',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-161',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-162',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-163',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-164',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-165',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-166',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-167',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-168',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-169',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-170',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-171',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-172',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-173',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-174',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-175',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-176',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-177',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-178',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-179',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-180',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-181',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-182',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-183',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-184',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-185',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-186',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-187',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-188',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-189',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-190',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-191',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-192',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-193',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-194',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-195',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-196',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-197',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-198',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-199',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-200',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-201',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-202',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-203',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-204',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-205',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-206',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-207',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-208',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-209',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-210',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-211',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-212',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-213',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-214',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-215',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-216',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-217',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-218',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-219',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-220',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-221',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-222',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-223',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-224',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-225',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-226',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-227',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-228',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-229',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-230',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-231',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-232',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-233',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-234',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-235',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-236',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-237',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-238',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-239',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-240',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-241',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-242',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-243',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-244',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-245',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-246',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-247',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-248',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-249',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-250',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-251',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-252',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ],
          [
            'fillText',
            {
              'args': [
                'label-253',
                328,
                240,
                312
              ],
              'font': '16px Example Sans, monospace',
              'textBaseline': 'middle',
              'textAlign': 'left',
              'fillStyle': 'rgba(128, 96, 192, 1)',
              'globalAlpha': 1
            }
          ],
          [
            'globalAlpha',
            1
          ]
        ],
        'painted': [
          {
            'args': [
              'label-299',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'label-298',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-0',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 0.3
          },
          {
            'args': [
              'label-1',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-2',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-3',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-4',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-5',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-6',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-7',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-8',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-9',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-10',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-11',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-12',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-13',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-14',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-15',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-16',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-17',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-18',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-19',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-20',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-21',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-22',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-23',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-24',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-25',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-26',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-27',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-28',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-29',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-30',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-31',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-32',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-33',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-34',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-35',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-36',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-37',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-38',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-39',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-40',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-41',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-42',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-43',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-44',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-45',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-46',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-47',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-48',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-49',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-50',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-51',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-52',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-53',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-54',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-55',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-56',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-57',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-58',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-59',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-60',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-61',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-62',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-63',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-64',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-65',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-66',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-67',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-68',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-69',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-70',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-71',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-72',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-73',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-74',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-75',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-76',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-77',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-78',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-79',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-80',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-81',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-82',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-83',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-84',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-85',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-86',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-87',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-88',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-89',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-90',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-91',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-92',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-93',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-94',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-95',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-96',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-97',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-98',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-99',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-100',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-101',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-102',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-103',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-104',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-105',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-106',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-107',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-108',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-109',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-110',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-111',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-112',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-113',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-114',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-115',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-116',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-117',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-118',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-119',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-120',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-121',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-122',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-123',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-124',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-125',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-126',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-127',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-128',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-129',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-130',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-131',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-132',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-133',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-134',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-135',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-136',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-137',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-138',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-139',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-140',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-141',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-142',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-143',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-144',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-145',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-146',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-147',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-148',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-149',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-150',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-151',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-152',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-153',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-154',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-155',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-156',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-157',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-158',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-159',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-160',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-161',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-162',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-163',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-164',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-165',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-166',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-167',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-168',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-169',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-170',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-171',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-172',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-173',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-174',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-175',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-176',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-177',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-178',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-179',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-180',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-181',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-182',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-183',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-184',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-185',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-186',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-187',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-188',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-189',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-190',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-191',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-192',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-193',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-194',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-195',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-196',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-197',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-198',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-199',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-200',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-201',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-202',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-203',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-204',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-205',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-206',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-207',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-208',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-209',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-210',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-211',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-212',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-213',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-214',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-215',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-216',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-217',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-218',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-219',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-220',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-221',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-222',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-223',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-224',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-225',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-226',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-227',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-228',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-229',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-230',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-231',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-232',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-233',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-234',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-235',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-236',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-237',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-238',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-239',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-240',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-241',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-242',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-243',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-244',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-245',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-246',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-247',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-248',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-249',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-250',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-251',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-252',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          },
          {
            'args': [
              'label-253',
              328,
              240,
              312
            ],
            'font': '16px Example Sans, monospace',
            'textBaseline': 'middle',
            'textAlign': 'left',
            'fillStyle': 'rgba(128, 96, 192, 1)',
            'globalAlpha': 1
          }
        ]
      },
      'allocations': {
        'bufferCount': 16,
        'bufferBytes': [
          0,
          0,
          0,
          0,
          12,
          32,
          48,
          48,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2412,
        'attachedGpuAttributeBytes': 140
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': false,
    'unchangedAnimating': false,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1',
        'geometry2',
        'labelMaterial',
        'labelTexture'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 1,
        'height': 1
      }
    }
  },
  'particleCap': {
    'before': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 16384,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'sampledMatrices': [
            {
              'row': 0,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            },
            {
              'row': 1,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            },
            {
              'row': 2,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            },
            {
              'row': 16381,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            },
            {
              'row': 16382,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            },
            {
              'row': 16383,
              'values': [
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1,
                0,
                0,
                0,
                0,
                1
              ]
            }
          ],
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 1048576,
            'itemSize': 16,
            'count': 16384,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '0fb278104a36d8fac62b0e32110aacb17c3aaead8f72b48ee32d0ab4870f61d0'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420,
          1048576
        ],
        'cpuBytes': 1050848,
        'attachedGpuAttributeBytes': 1049912
      }
    },
    'initial': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 16384,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'sampledMatrices': [
            {
              'row': 0,
              'values': [
                1.8058688640594482,
                0,
                0,
                0,
                0,
                1.8058688640594482,
                0,
                0,
                0,
                0,
                1.8058688640594482,
                0,
                -80,
                0,
                0,
                1
              ]
            },
            {
              'row': 1,
              'values': [
                1.7525495290756226,
                0,
                0,
                0,
                0,
                1.7525495290756226,
                0,
                0,
                0,
                0,
                1.7525495290756226,
                0,
                -26.66666603088379,
                0,
                0,
                1
              ]
            },
            {
              'row': 2,
              'values': [
                1.6992301940917969,
                0,
                0,
                0,
                0,
                1.6992301940917969,
                0,
                0,
                0,
                0,
                1.6992301940917969,
                0,
                26.66666603088379,
                0,
                0,
                1
              ]
            },
            {
              'row': 16381,
              'values': [
                1.7525495290756226,
                0,
                0,
                0,
                0,
                1.7525495290756226,
                0,
                0,
                0,
                0,
                1.7525495290756226,
                0,
                -26.66666603088379,
                0,
                0,
                1
              ]
            },
            {
              'row': 16382,
              'values': [
                1.6992301940917969,
                0,
                0,
                0,
                0,
                1.6992301940917969,
                0,
                0,
                0,
                0,
                1.6992301940917969,
                0,
                26.66666603088379,
                0,
                0,
                1
              ]
            },
            {
              'row': 16383,
              'values': [
                1.8058688640594482,
                0,
                0,
                0,
                0,
                1.8058688640594482,
                0,
                0,
                0,
                0,
                1.8058688640594482,
                0,
                -80,
                0,
                0,
                1
              ]
            }
          ],
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 1048576,
            'itemSize': 16,
            'count': 16384,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '38947898b638b5afaa76f79c58ceb0a81f362c4995619cfd6378a8c7973e9b58'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 196608,
            'itemSize': 3,
            'count': 16384,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 49152
              }
            ],
            'sha256': '620c298a4674bb133f8d38c709ab36c5abdb6c224751312173b4d3f0b27f123b'
          }
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 13,
        'bufferBytes': [
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          420,
          420,
          196608,
          1048576
        ],
        'cpuBytes': 1247456,
        'attachedGpuAttributeBytes': 1246520
      }
    },
    'unchangedPatches': [
      [
        [
          'meshes',
          2,
          'instanceMatrix',
          'version'
        ],
        2
      ]
    ],
    'animating': true,
    'unchangedAnimating': true,
    'bounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': -1
      },
      {
        'center': [
          -26.71998631969925,
          0,
          0
        ],
        'radius': 55.08588254968841
      }
    ],
    'geometryBounds': [
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.118033988749895
      },
      {
        'center': [
          0,
          0,
          0
        ],
        'radius': 1.0000000029504936
      }
    ],
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  }
};

const GEOMETRIES = {
  'ConeGeometry': {
    'attributes': {
      'position': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 324,
        'itemSize': 3,
        'count': 27,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': 'f1193d846ea21d4d0d26e2afebb53333971ed4bdd48cd616efb7d745c867add5'
      },
      'normal': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 324,
        'itemSize': 3,
        'count': 27,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': 'eeaab6c4b00ef292391850c4931973936ffa448cc9ab3d6be0d072483c563ce3'
      },
      'uv': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 216,
        'itemSize': 2,
        'count': 27,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': '23bb97b720656bd251e94e81aec36a542c5ba52e844107d763fe45014f0d3e37'
      }
    },
    'index': {
      'arrayType': 'Uint16Array',
      'byteOffset': 0,
      'byteLength': 72,
      'itemSize': 1,
      'count': 36,
      'normalized': false,
      'usage': 35044,
      'version': 0,
      'updateRanges': [],
      'sha256': '7247d1692589ecb8774969c3065599291a5add5c5d169e71588bb88856990c9f'
    }
  },
  'SphereGeometry': {
    'attributes': {
      'position': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 420,
        'itemSize': 3,
        'count': 35,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': '6dcc45d2d98b8d5585e6885fd34d2a0d7fa5c1cf2fb1a390221ee8a1caf20ea5'
      },
      'normal': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 420,
        'itemSize': 3,
        'count': 35,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': '6dcc45d2d98b8d5585e6885fd34d2a0d7fa5c1cf2fb1a390221ee8a1caf20ea5'
      },
      'uv': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 280,
        'itemSize': 2,
        'count': 35,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': 'f310f8c241c5886770ab26a48bc2aa41931dd22dc780b59c1956b131bc583c74'
      }
    },
    'index': {
      'arrayType': 'Uint16Array',
      'byteOffset': 0,
      'byteLength': 216,
      'itemSize': 1,
      'count': 108,
      'normalized': false,
      'usage': 35044,
      'version': 0,
      'updateRanges': [],
      'sha256': 'a298ae9b6022f3648ee4beee96a1d56eeb3cd4b9f87595af0da280e38e822e61'
    }
  },
  'PlaneGeometry': {
    'attributes': {
      'position': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 48,
        'itemSize': 3,
        'count': 4,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': 'f93624317a698acc777b6f8d093acf23ed636489e36c115955d6cd51315f1c01'
      },
      'normal': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 48,
        'itemSize': 3,
        'count': 4,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': '796f0b940d4268e7d9ccbd67f52dca773c768e372dae64d3c1b1caf59e6c8247'
      },
      'uv': {
        'arrayType': 'Float32Array',
        'byteOffset': 0,
        'byteLength': 32,
        'itemSize': 2,
        'count': 4,
        'normalized': false,
        'usage': 35044,
        'version': 0,
        'updateRanges': [],
        'sha256': 'f3a0a46301c6859e5b64beadee234c4eeec1dec8c4735dc7bf40ea09e762e189'
      }
    },
    'index': {
      'arrayType': 'Uint16Array',
      'byteOffset': 0,
      'byteLength': 12,
      'itemSize': 1,
      'count': 6,
      'normalized': false,
      'usage': 35044,
      'version': 0,
      'updateRanges': [],
      'sha256': 'e6681333c21d3bedc5c5d4ea4503e8acc5b95e8d8e2aabffd97d12425a145443'
    }
  }
};

const LIFECYCLE = {
  'visualPick': {
    'visualFirst': {
      'roots': {
        'world': [
          'arrows'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': '971256c93cf9ffa2a09dd41ed8b5d9299707b53c53ca53a4223162a34d7d5433'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': '971256c93cf9ffa2a09dd41ed8b5d9299707b53c53ca53a4223162a34d7d5433'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 14,
        'bufferBytes': [
          0,
          8,
          24,
          24,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2584,
        'attachedGpuAttributeBytes': 1240
      }
    },
    'pickFirst': {
      'roots': {
        'world': [
          'arrows'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 3,
            'updateRanges': [],
            'sha256': '0423ea5d51def31cd057c6a8f095e8cc1fd365d944c0cdd6f424430e7ba6d2a5'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 3,
            'updateRanges': [],
            'sha256': '0423ea5d51def31cd057c6a8f095e8cc1fd365d944c0cdd6f424430e7ba6d2a5'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 3,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 14,
        'bufferBytes': [
          0,
          8,
          24,
          24,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2584,
        'attachedGpuAttributeBytes': 1240
      }
    },
    'bothSubmitted': {
      'roots': {
        'world': [
          'arrows'
        ],
        'pick': [
          'arrowPick'
        ],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 4,
            'updateRanges': [],
            'sha256': '59ce40ab418b84f4ecc3e5252322ef2d61b0dfeb9d15f9489ecdf91be94294ae'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 6
              }
            ],
            'sha256': '5ccac0d1a5034f3d12ba6678589ad3cf14e11bdd8c8d3784fc38fd9f69d204d9'
          }
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 2,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 128,
            'itemSize': 16,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 4,
            'updateRanges': [],
            'sha256': '59ce40ab418b84f4ecc3e5252322ef2d61b0dfeb9d15f9489ecdf91be94294ae'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 24,
            'itemSize': 3,
            'count': 2,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '051ad056910998c149e2a84c41e648d19e247546dd61d6aa1dca53e10268fef6'
          }
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 4,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 14,
        'bufferBytes': [
          0,
          8,
          24,
          24,
          72,
          128,
          128,
          216,
          216,
          280,
          324,
          324,
          420,
          420
        ],
        'cpuBytes': 2584,
        'attachedGpuAttributeBytes': 1240
      }
    },
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  },
  'particleEnable': {
    'disabled': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': false,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 0,
            'updateRanges': [],
            'sha256': '25f380df903f9659d181e3d2628b4450818bd668930adecc15e73d7e36b3a1ae'
          },
          'instanceColor': null
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 12,
        'bufferBytes': [
          0,
          0,
          0,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2656,
        'attachedGpuAttributeBytes': 1720
      }
    },
    'enabledAnimating': true,
    'firstEnabled': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [],
            'sha256': '144f4ad8a2f300819b6c06cb5cfb99754196ef18bb016fbc05ee7376679041e4'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 13,
        'bufferBytes': [
          0,
          0,
          0,
          72,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2728,
        'attachedGpuAttributeBytes': 1792
      }
    },
    'alreadySubmitted': {
      'roots': {
        'world': [
          'particles'
        ],
        'pick': [],
        'overlay': []
      },
      'geometryTypes': [
        'ConeGeometry',
        'SphereGeometry'
      ],
      'meshes': [
        {
          'name': 'arrows',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 3,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'arrowPick',
          'type': 'Mesh',
          'geometry': 0,
          'count': 0,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': false,
            'fog': false,
            'blending': 0,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 0,
            'itemSize': 16,
            'count': 0,
            'normalized': false,
            'usage': 35044,
            'version': 3,
            'updateRanges': [],
            'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          },
          'instanceColor': null
        },
        {
          'name': 'particles',
          'type': 'Mesh',
          'geometry': 1,
          'count': 6,
          'material': {
            'type': 'MeshBasicMaterial',
            'transparent': false,
            'depthWrite': true,
            'depthTest': true,
            'toneMapped': true,
            'fog': true,
            'blending': 1,
            'side': 0,
            'visible': true,
            'version': 0,
            'vertexColors': false,
            'color': [
              1,
              1,
              1
            ]
          },
          'frustumCulled': false,
          'renderOrder': 0,
          'visible': true,
          'instanceMatrix': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 384,
            'itemSize': 16,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 2,
            'updateRanges': [],
            'sha256': '19d9f382ada75bdca3a84d23077a611108ba32ad6176a37507ce25a10ff02803'
          },
          'instanceColor': {
            'arrayType': 'Float32Array',
            'byteOffset': 0,
            'byteLength': 72,
            'itemSize': 3,
            'count': 6,
            'normalized': false,
            'usage': 35044,
            'version': 1,
            'updateRanges': [
              {
                'start': 0,
                'count': 18
              }
            ],
            'sha256': '994f4dd05e6718f2ae0b789438c11f1c5db1ae723e077fb35974e2d21426f286'
          }
        }
      ],
      'texture': null,
      'canvas': {
        'acquired': false,
        'width': 300,
        'height': 150,
        'contextPresent': false,
        'contextState': null,
        'trace': [],
        'painted': []
      },
      'allocations': {
        'bufferCount': 13,
        'bufferBytes': [
          0,
          0,
          0,
          72,
          72,
          216,
          216,
          280,
          324,
          324,
          384,
          420,
          420
        ],
        'cpuBytes': 2728,
        'attachedGpuAttributeBytes': 1792
      }
    },
    'retirement': {
      'events': [
        'material0',
        'instance0',
        'material1',
        'instance1',
        'material2',
        'instance2',
        'geometry0',
        'geometry1'
      ],
      'world': 0,
      'pick': 0,
      'overlay': 0,
      'canvas': {
        'width': 300,
        'height': 150
      }
    }
  }
};

function owned(raw) {
  const work = createGraphDataPreparationWork(raw);
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(4096);
    if (step.done) return step.value.data;
  }
  throw new Error('Data preparation did not finish');
}
function configuration(name) {
  const raw = {
    nodeCount: 3, source: new Uint32Array([0, 1, 2]), target: new Uint32Array([1, 2, 2]),
    positions: new Float32Array([-80, -20, 0, 80, 15, 10, 0, 70, -10]), sizes: new Float32Array([12, 0, 20]),
    directed: new Uint8Array([1, 0, 1]), particlesPerEdge: 2, particleSpeed: 0.25,
    labels: ['<b>left</b>', 'right', 'loop'], edgeLabels: ['link', 'diagonal', 'self'], nodeLabels: 'always', withEdgeLabels: true,
  };
  const style = { foreground: '#8060c0', muted: '#204060', accent: '#d08030', focus: '#20b060',
    pointSize: 8, lineWidth: 2, fontSize: 16, fontFamily: 'Example Sans, monospace', devicePixelRatio: 1.5 };
  const orbit = { ...DEFAULT_ORBIT_CAMERA, target: { ...DEFAULT_ORBIT_CAMERA.target }, yaw: 0.3, pitch: -0.2, distance: 500 };
  const state = { selected: new Set([3, 4]), dimmed: new Set([0, 4]), hover: 5, focus: 1 };
  const options = { name, raw, style, orbit, state, width: 640, height: 480, fittedDistance: 500,
    canvasWidth: 300, canvasHeight: 150, nullContext: false, legacyProjection: false };
  switch (name) {
    case 'ordinary': break;
    case 'empty':
      options.raw = { nodeCount: 0, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array() };
      options.state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
      break;
    case 'undirected': delete raw.directed; raw.particlesPerEdge = 0; delete raw.labels; delete raw.edgeLabels; break;
    case 'emptyLabels': raw.labels = ['', '', '']; raw.edgeLabels = ['', '', '']; break;
    case 'hiddenLabels': raw.nodeLabels = 'none'; raw.withEdgeLabels = false; break;
    case 'zoomGated': raw.nodeLabels = 'zoom'; orbit.distance = 2000; break;
    case 'nullContext': options.nullContext = true; options.canvasWidth = 19; options.canvasHeight = 23; break;
    case 'reducedMotion': style.reducedMotion = true; break;
    case 'forcedColors': style.forcedColors = true; break;
    case 'zeroLineWidth': style.lineWidth = 0; break;
    case 'stationary': raw.particleSpeed = 0; break;
    case 'wideCanvas': options.width = 10000; options.height = 5000; style.devicePixelRatio = 4; break;
    case 'sameSizeCanvas': options.canvasWidth = 960; options.canvasHeight = 720; break;
    case 'legacyProjection': options.legacyProjection = true; break;
    case 'clipped':
      orbit.yaw = 0; orbit.pitch = 0;
      raw.positions = new Float32Array([10000, 0, 0, 0, 0, 500, 0, 0, 0]);
      break;
    case 'spatialCss': case 'spatialWorld': case 'spatialHidden':
      raw.sizes = new Float32Array([12, 10, 20]);
      raw.target = new Uint32Array([1, 1, 2]);
      raw.directed = new Uint8Array([1, 1, 1]);
      raw.spatialAppearance = { sizeUnits: name === 'spatialWorld' ? 'world' : 'css',
        edgeCurvatures: new Float32Array([0.35, 0, 0.4]), dangling: new Uint8Array([0, 0, 1]),
        edgeWidths: new Float32Array(name === 'spatialHidden' ? [0, 2, 3] : [2, 2, 3]),
        edgeColors: new Float32Array([0.2, 0.4, 0.6, 1, 0.3, 0.5, 0.7, name === 'spatialHidden' ? 0 : 1, 0.6, 0.4, 0.2, 1]),
        dimmedOpacity: 0.4, labelLimit: 4 };
      break;
    case 'labelCap':
      options.raw = { nodeCount: 300, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array(900),
        labels: Array.from({ length: 300 }, (_, row) => `label-${row}`), nodeLabels: 'always' };
      options.state = { selected: new Set(), dimmed: new Set([0, 299]), hover: 298, focus: 299 };
      break;
    case 'particleCap':
      options.raw = { nodeCount: 2, source: new Uint32Array(5462), target: new Uint32Array(5462).fill(1),
        positions: new Float32Array([-80, 0, 0, 80, 0, 0]), particlesPerEdge: 3, particleSpeed: 0.25 };
      options.state = { selected: new Set([2]), dimmed: new Set([5463]), hover: -1, focus: -1 };
      break;
    default: throw new Error(`Unknown case ${name}`);
  }
  return options;
}
function recordingCanvas(options) {
  const trace = [], painted = [];
  let acquired = false, width = options.canvasWidth, height = options.canvasHeight;
  const values = {};
  function reset() { Object.assign(values, { font: '10px sans-serif', textBaseline: 'alphabetic', textAlign: 'start', fillStyle: '#000000', globalAlpha: 1 }); }
  reset();
  const context = {
    setTransform(...args) { trace.push(['setTransform', ...args]); },
    clearRect(...args) { trace.push(['clearRect', ...args]); painted.length = 0; },
    fillText(...args) {
      const item = { args, font: values.font, textBaseline: values.textBaseline, textAlign: values.textAlign,
        fillStyle: values.fillStyle, globalAlpha: values.globalAlpha };
      trace.push(['fillText', item]); painted.push(item);
    },
  };
  for (const key of ['font', 'textBaseline', 'textAlign', 'fillStyle', 'globalAlpha']) {
    Object.defineProperty(context, key, { enumerable: true, configurable: true,
      get() { return values[key]; }, set(value) { values[key] = value; trace.push([key, value]); } });
  }
  const canvas = {
    get width() { return width; }, set width(value) { width = value; trace.push(['width', value]); reset(); painted.length = 0; },
    get height() { return height; }, set height(value) { height = value; trace.push(['height', value]); reset(); painted.length = 0; },
    getContext(kind) { trace.push(['getContext', kind]); return options.nullContext ? null : context; },
  };
  return { canvas, create() { acquired = true; trace.push(['createCanvas']); return canvas; },
    snapshot() { return { acquired, width, height, contextPresent: acquired && !options.nullContext,
      contextState: acquired && !options.nullContext ? { ...values } : null, trace: structuredClone(trace), painted: structuredClone(painted) }; } };
}

// Observe constructor instances, including unattached count-zero meshes, without changing the
// normal own count property or any native row/geometry calculations. Each run is synchronous.
function observeInstances(run) {
  const previous = Object.getOwnPropertyDescriptor(InstancedMesh.prototype, 'count');
  assert.equal(previous, undefined, 'Pinned Three must assign count as an ordinary instance property');
  const instances = [];
  Object.defineProperty(InstancedMesh.prototype, 'count', { configurable: true,
    set(value) {
      Object.defineProperty(this, 'count', { value, writable: true, enumerable: true, configurable: true });
      instances.push(this);
    } });
  try { return run(instances); }
  finally { delete InstancedMesh.prototype.count; if (previous) Object.defineProperty(InstancedMesh.prototype, 'count', previous); }
}
function bytes(view) {
  const value = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  return value.byteLength <= 4096 ? { hex: value.toString('hex') }
    : { sha256: hash(value), first64: value.subarray(0, 64).toString('hex'), last64: value.subarray(-64).toString('hex') };
}
function sphere(value) { return value === null ? null : { center: value.center.toArray(), radius: value.radius }; }
function attribute(value, buffers) {
  if (!value) return null;
  return { arrayType: value.array.constructor.name, buffer: buffers.indexOf(value.array.buffer), byteOffset: value.array.byteOffset,
    byteLength: value.array.byteLength, itemSize: value.itemSize, count: value.count, normalized: value.normalized,
    usage: value.usage, version: value.version, updateRanges: value.updateRanges.map(range => ({ ...range })), ...bytes(value.array) };
}
function material(value) {
  return { type: value.type, transparent: value.transparent, depthWrite: value.depthWrite, depthTest: value.depthTest,
    toneMapped: value.toneMapped, fog: value.fog, blending: value.blending, side: value.side, visible: value.visible,
    version: value.version, vertexColors: value.vertexColors, color: value.color?.toArray() ?? null };
}
function snapshot(fixture) {
  const { batch, instances, view, canvas } = fixture;
  const overlay = view.scene.children[0];
  const meshes = [...instances, ...(overlay ? [overlay] : [])];
  const buffers = [...batch.allocationBuffers()];
  const geometries = [...new Set(meshes.map(mesh => mesh.geometry))];
  const names = new Map(meshes.map((mesh, index) => [mesh, ['arrows', 'arrowPick', 'particles', 'labels'][index]]));
  const rootNames = group => group.children.map(mesh => names.get(mesh));
  const gpuAttributes = new Set();
  for (const mesh of [...view.world.children, ...view.pickWorld.children, ...view.scene.children]) {
    for (const value of Object.values(mesh.geometry.attributes)) gpuAttributes.add(value);
    if (mesh.geometry.index) gpuAttributes.add(mesh.geometry.index);
    if (mesh.isInstancedMesh) { gpuAttributes.add(mesh.instanceMatrix); if (mesh.instanceColor) gpuAttributes.add(mesh.instanceColor); }
  }
  return {
    roots: { world: rootNames(view.world), pick: rootNames(view.pickWorld), overlay: rootNames(view.scene) },
    geometries: geometries.map(value => ({ type: value.type, boundingSphere: sphere(value.boundingSphere),
      attributes: Object.fromEntries(Object.entries(value.attributes).map(([key, item]) => [key, attribute(item, buffers)])), index: attribute(value.index, buffers) })),
    meshes: meshes.map(mesh => ({ name: names.get(mesh), type: mesh.type, geometry: geometries.indexOf(mesh.geometry),
      count: mesh.isInstancedMesh ? mesh.count : null, material: material(mesh.material),
      frustumCulled: mesh.frustumCulled, renderOrder: mesh.renderOrder, visible: mesh.visible,
      boundingSphere: mesh.isInstancedMesh ? sphere(mesh.boundingSphere) : undefined,
      instanceMatrix: mesh.isInstancedMesh ? attribute(mesh.instanceMatrix, buffers) : undefined,
      instanceColor: mesh.isInstancedMesh ? attribute(mesh.instanceColor, buffers) : undefined,
      sampledMatrices: mesh.isInstancedMesh && mesh.count > 64 ? [...new Set([0, 1, 2, mesh.count - 3, mesh.count - 2, mesh.count - 1])].map(row => ({ row, values: Array.from(mesh.instanceMatrix.array.subarray(row * 16, row * 16 + 16)) })) : undefined,
    })),
    texture: overlay ? { version: overlay.material.uniforms.labels.value.version, colorSpace: overlay.material.uniforms.labels.value.colorSpace,
      generateMipmaps: overlay.material.uniforms.labels.value.generateMipmaps, flipY: overlay.material.uniforms.labels.value.flipY,
      imageIsCanvas: overlay.material.uniforms.labels.value.image === canvas.canvas } : null,
    canvas: canvas.snapshot(),
    allocations: { bufferCount: buffers.length, bufferBytes: buffers.map(value => value.byteLength),
      cpuBytes: buffers.reduce((sum, value) => sum + value.byteLength, 0),
      attachedGpuAttributeBytes: [...gpuAttributes].reduce((sum, value) => sum + value.array.byteLength, 0) },
  };
}
function withFixture(options, use) {
  return observeInstances(instances => {
    const data = owned(options.raw), canvas = recordingCanvas(options);
    const view = { world: new Group(), pickWorld: new Group(), scene: new Scene(), width: options.width, height: options.height,
      orbit: options.orbit, style: resolveLyra3dStyle(options.style),
      project(point) {
        return options.legacyProjection ? { x: this.width / 4 + point.x / 2, y: this.height / 4 + point.y / 2, depth: 200, scale: 2 }
          : projectOrbitPoint(point, this.orbit, this);
      } };
    const frame = { positionOf(row) { return Number.isInteger(row) && row >= 0 && row < data.nodeCount
      ? { x: data.positions[row * 3], y: data.positions[row * 3 + 1], z: data.positions[row * 3 + 2] } : null; },
      state: options.state, fittedDistance: options.fittedDistance, revision: 7, time: 0 };
    const batch = createGraphDecorations(view, data, canvas.create);
    assert.equal(instances.length, 3, 'Observer must capture all three legacy instance owners');
    for (const mesh of instances) assert.deepEqual(Object.getOwnPropertyDescriptor(mesh, 'count'),
      { value: mesh.count, writable: true, enumerable: true, configurable: true });
    const fixture = { options, data, canvas, view, frame, batch, instances };
    const retired = [];
    const overlay = view.scene.children[0];
    const geometries = [...new Set([...instances, ...(overlay ? [overlay] : [])].map(mesh => mesh.geometry))];
    for (const [index, mesh] of instances.entries()) {
      mesh.addEventListener('dispose', () => retired.push(`instance${index}`));
      mesh.material.addEventListener('dispose', () => retired.push(`material${index}`));
    }
    geometries.forEach((geometry, index) => geometry.addEventListener('dispose', () => retired.push(`geometry${index}`)));
    if (overlay) {
      overlay.material.addEventListener('dispose', () => retired.push('labelMaterial'));
      overlay.material.uniforms.labels.value.addEventListener('dispose', () => retired.push('labelTexture'));
    }
    let result;
    try { result = use(fixture); }
    finally { batch.dispose(); }
    return { ...result, retirement: { events: retired, world: view.world.children.length, pick: view.pickWorld.children.length,
      overlay: view.scene.children.length, canvas: { width: canvas.canvas.width, height: canvas.canvas.height } } };
  });
}

const LIFECYCLE_BOUNDS = {
  'visualPick': {
    'visualFirst': [
      {
        'center': [
          40.91872144598649,
          40.8476330766872,
          0.4715296586643838
        ],
        'radius': 51.32109893014748
      },
      null,
      null
    ],
    'pickFirst': [
      {
        'center': [
          40.91872144598649,
          40.8476330766872,
          0.4715296586643838
        ],
        'radius': 51.32109893014748
      },
      {
        'center': [
          81.12058293302715,
          41.634330205548686,
          0.23371436972725507
        ],
        'radius': 86.54414542927293
      },
      null
    ],
    'bothSubmitted': [
      {
        'center': [
          40.91872144598649,
          40.8476330766872,
          0.4715296586643838
        ],
        'radius': 51.32109893014748
      },
      {
        'center': [
          81.12058293302715,
          41.634330205548686,
          0.23371436972725507
        ],
        'radius': 86.54414542927293
      },
      null
    ]
  },
  'particleEnable': {
    'disabled': [
      null,
      null,
      null
    ],
    'firstEnabled': [
      null,
      null,
      {
        'center': [
          -30.112598814808308,
          -2.5179134478104146,
          4.994881872054167
        ],
        'radius': 113.23352375153442
      }
    ],
    'alreadySubmitted': [
      null,
      null,
      {
        'center': [
          -30.112598814808308,
          -2.5179134478104146,
          4.994881872054167
        ],
        'radius': 113.23352375153442
      }
    ]
  }
};

function normalizedAttribute(value) {
  if (!value) return null;
  const { buffer, hex, first64, last64, ...rest } = value;
  return { ...rest, sha256: hex === undefined ? rest.sha256 : hash(Buffer.from(hex, 'hex')) };
}
function normalizedSnapshot(fixture) {
  const value = snapshot(fixture);
  for (const geometry of value.geometries) {
    assert.deepEqual({ attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attr]) => [key, normalizedAttribute(attr)])),
      index: normalizedAttribute(geometry.index) }, GEOMETRIES[geometry.type]);
  }
  return { roots: value.roots, geometryTypes: value.geometries.map(geometry => geometry.type),
    meshes: value.meshes.map(({ boundingSphere, ...mesh }) => Object.fromEntries(Object.entries(mesh).filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, key === 'instanceMatrix' || key === 'instanceColor' ? normalizedAttribute(item) : item]))),
    texture: value.texture, canvas: value.canvas,
    allocations: { ...value.allocations, bufferBytes: [...value.allocations.bufferBytes].sort((a, b) => a - b) } };
}
function patched(value, patches) {
  const result = structuredClone(value);
  for (const [path, replacement] of patches) {
    let owner = result;
    for (const key of path.slice(0, -1)) owner = owner[key];
    owner[path.at(-1)] = replacement;
  }
  return result;
}
function preparedFixture(options = configuration('ordinary'), guard) {
  const data = owned(options.raw), canvas = recordingCanvas(options);
  const view = { width: options.width, height: options.height, orbit: options.orbit, style: resolveLyra3dStyle(options.style) };
  const presentation = { ...view, state: options.state, fittedDistance: options.fittedDistance, revision: 7 };
  const frame = { positionOf(row) { return row >= 0 && row < data.nodeCount
    ? { x: data.positions[row * 3], y: data.positions[row * 3 + 1], z: data.positions[row * 3 + 2] } : null; },
    state: presentation.state, fittedDistance: presentation.fittedDistance, revision: 7, time: 0 };
  return { data, canvas, view, presentation, frame, work: createGraphDecorationsWork(data, presentation, canvas.create, guard) };
}
function finish(work, budget = 4096) {
  for (let calls = 0; calls < 100000; calls++) {
    const step = work.step(budget);
    assert.ok(step.operations >= 0 && step.operations <= budget);
    if (step.done) { assert.ok(step.value); return step.value; }
    assert.ok(step.operations > 0); assert.equal(step.value, undefined);
  }
  assert.fail('Decoration preparation did not finish');
}
function install(fixture, value) {
  const { resources, batch } = value;
  for (const mesh of [resources.arrows, resources.arrowPick, resources.particles, resources.labelMesh].filter(Boolean)) assert.equal(mesh.parent, null);
  Object.assign(fixture, { batch, instances: [resources.arrows, resources.arrowPick, resources.particles], resources });
  Object.assign(fixture.view, { world: new Group(), pickWorld: new Group(), scene: new Scene() });
  if (resources.arrows.count) { fixture.view.world.add(resources.arrows); fixture.view.pickWorld.add(resources.arrowPick); }
  if (resources.particles.count) fixture.view.world.add(resources.particles);
  if (resources.labelMesh) fixture.view.scene.add(resources.labelMesh);
}
function withMethod(prototype, key, replace, action) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key), original = prototype[key];
  Object.defineProperty(prototype, key, { configurable: true, writable: true, value: replace(original) });
  try { return action(); }
  finally { if (descriptor) Object.defineProperty(prototype, key, descriptor); else delete prototype[key]; }
}
function disposalLog(action, failure) {
  const released = new Map();
  const wrap = original => function (...args) {
    released.set(this, (released.get(this) ?? 0) + 1);
    original.apply(this, args);
    if (failure) throw failure;
  };
  return withMethod(BufferGeometry.prototype, 'dispose', wrap, () => withMethod(Material.prototype, 'dispose', wrap,
    () => withMethod(InstancedMesh.prototype, 'dispose', wrap, () => withMethod(Texture.prototype, 'dispose', wrap, () => action(released)))));
}
function acquiredOwners(action) {
  const owners = new Set(), descriptor = Object.getOwnPropertyDescriptor(Texture.prototype, 'needsUpdate');
  Object.defineProperty(Texture.prototype, 'needsUpdate', { ...descriptor, set(value) { owners.add(this); descriptor.set.call(this, value); } });
  const observe = original => function (...args) { owners.add(this); return original.apply(this, args); };
  try {
    return observeInstances(instances => withMethod(BufferGeometry.prototype, 'setAttribute', observe,
      () => withMethod(Material.prototype, 'setValues', observe, () => action(() => new Set([...owners, ...instances])))));
  } finally { Object.defineProperty(Texture.prototype, 'needsUpdate', descriptor); }
}
const invalidState = error => error?.name === 'InvalidStateError';
const aborted = error => error?.name === 'AbortError' || error?.name === 'InvalidStateError';

for (const name of Object.keys(ORACLES)) {
  test(`legacy decoration factory and first update retain the frozen ${name} output`, () => {
    const expected = ORACLES[name];
    withFixture(configuration(name), fixture => {
      assert.deepEqual(normalizedSnapshot(fixture), expected.before);
      for (const mesh of fixture.instances) { assert.equal(mesh.boundingSphere, null); assert.equal(mesh.geometry.boundingSphere, null); }
      return {};
    });
    const result = withFixture(configuration(name), fixture => {
      assert.equal(fixture.batch.update(fixture.frame), expected.animating);
      assert.deepEqual(normalizedSnapshot(fixture), expected.initial);
      for (const mesh of fixture.instances) { assert.equal(mesh.boundingSphere, null); assert.equal(mesh.geometry.boundingSphere, null); }
      assert.equal(fixture.batch.update(fixture.frame), expected.unchangedAnimating);
      assert.deepEqual(normalizedSnapshot(fixture), patched(expected.initial, expected.unchangedPatches));
      return {};
    });
    assert.deepEqual(result.retirement, expected.retirement);
  });
  if (name === 'legacyProjection') continue;
  test(`prepared decorations match frozen ${name} output at budgets 1, 7 and 4096`, () => {
    for (const budget of [1, 7, 4096]) {
      const fixture = preparedFixture(configuration(name)), value = finish(fixture.work, budget);
      try {
        install(fixture, value);
        assert.deepEqual(normalizedSnapshot(fixture), ORACLES[name].initial);
        assert.deepEqual(fixture.instances.map(mesh => sphere(mesh.boundingSphere)), ORACLES[name].bounds);
        assert.deepEqual([...new Set(fixture.instances.map(mesh => mesh.geometry))].map(geometry => sphere(geometry.boundingSphere)), ORACLES[name].geometryBounds);
        fixture.work.dispose(); assert.equal(value.resources.disposed, false);
        assert.throws(() => fixture.work.step(1), invalidState);
        assert.equal(value.batch.update(fixture.view, fixture.frame), ORACLES[name].unchangedAnimating);
        assert.deepEqual(normalizedSnapshot(fixture), patched(ORACLES[name].initial, ORACLES[name].unchangedPatches));
      } finally { value.batch.dispose(); fixture.work.dispose(); }
    }
  });
}

test('visual and pick bounds follow their own first submission after pre-render camera and position changes', () => {
  const options = configuration('ordinary'); options.raw.particlesPerEdge = 0; delete options.raw.labels; delete options.raw.edgeLabels;
  const fixture = preparedFixture(options), value = finish(fixture.work, 1); install(fixture, value);
  const { arrows, arrowPick } = value.resources;
  try {
    fixture.data.positions[0] = -130; fixture.view.orbit = { ...fixture.view.orbit, yaw: 0.7 }; fixture.frame.revision++;
    value.batch.update(fixture.view, fixture.frame);
    assert.deepEqual(sphere(arrows.boundingSphere), LIFECYCLE_BOUNDS.visualPick.visualFirst[0]);
    assert.deepEqual(sphere(arrowPick.boundingSphere), LIFECYCLE_BOUNDS.visualPick.visualFirst[0]);
    assert.notEqual(arrows.boundingSphere, arrowPick.boundingSphere);
    arrows.onBeforeRender();
    assert.equal(value.resources.arrowSubmitted, true); assert.equal(value.resources.arrowPickSubmitted, false);
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.visualPick.visualFirst);
    fixture.data.positions[3] = 160; fixture.view.orbit = { ...fixture.view.orbit, pitch: 0.4 }; fixture.frame.revision++;
    value.batch.update(fixture.view, fixture.frame);
    assert.deepEqual(sphere(arrows.boundingSphere), LIFECYCLE_BOUNDS.visualPick.pickFirst[0]);
    assert.deepEqual(sphere(arrowPick.boundingSphere), LIFECYCLE_BOUNDS.visualPick.pickFirst[1]);
    arrowPick.onBeforeRender();
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.visualPick.pickFirst);
    fixture.data.positions[6] = 95; fixture.view.orbit = { ...fixture.view.orbit, distance: 650 }; fixture.frame.revision++;
    value.batch.update(fixture.view, fixture.frame);
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.visualPick.bothSubmitted);
    assert.deepEqual([arrows, arrowPick].map(mesh => sphere(mesh.boundingSphere)), LIFECYCLE_BOUNDS.visualPick.bothSubmitted.slice(0, 2));
  } finally { value.batch.dispose(); fixture.work.dispose(); }
});

test('initially disabled particles replace identity bounds before their first enabled submission', () => {
  const options = configuration('reducedMotion'); delete options.raw.directed; delete options.raw.labels; delete options.raw.edgeLabels;
  const fixture = preparedFixture(options), value = finish(fixture.work, 7); install(fixture, value);
  try {
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.particleEnable.disabled);
    fixture.view.style = resolveLyra3dStyle({ ...options.style, reducedMotion: false }); fixture.data.positions[0] = -140; fixture.frame.revision++;
    assert.equal(value.batch.update(fixture.view, fixture.frame), LIFECYCLE.particleEnable.enabledAnimating);
    assert.deepEqual(sphere(value.resources.particles.boundingSphere), LIFECYCLE_BOUNDS.particleEnable.firstEnabled[2]);
    value.resources.particles.onBeforeRender(); assert.equal(value.resources.particleSubmitted, true);
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.particleEnable.firstEnabled);
    fixture.data.positions[3] = 170; fixture.frame.revision++; fixture.frame.time = 100;
    value.batch.update(fixture.view, fixture.frame);
    assert.deepEqual(normalizedSnapshot(fixture), LIFECYCLE.particleEnable.alreadySubmitted);
    assert.deepEqual(sphere(value.resources.particles.boundingSphere), LIFECYCLE_BOUNDS.particleEnable.alreadySubmitted[2]);
  } finally { value.batch.dispose(); fixture.work.dispose(); }
});

test('construction is inert and budgets, transfer and closed work follow the step contract', () => {
  let reads = 0, guards = 0;
  const watch = new Proxy({}, { get() { reads++; assert.fail('construction must not read input'); } });
  const work = createGraphDecorationsWork(watch, watch, () => assert.fail('construction must not acquire canvas'), () => { guards++; return true; });
  assert.equal(reads, 0); assert.equal(guards, 0); work.dispose(); work.dispose(); assert.throws(() => work.step(1), invalidState);
  const fixture = preparedFixture();
  try {
    for (const budget of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => fixture.work.step(budget), { name: 'RangeError' });
    const value = finish(fixture.work, 1); value.batch.dispose(); assert.throws(() => fixture.work.step(0), invalidState);
  } finally { fixture.work.dispose(); }
});

test('late nonempty labels charge every presence and rejected consideration row', () => {
  const options = configuration('empty');
  options.raw = { nodeCount: 2049, source: new Uint32Array(), target: new Uint32Array(), positions: new Float32Array(6147),
    labels: [...Array(2048).fill(''), 'last'], nodeLabels: 'always' };
  const fixture = preparedFixture(options); let presence = 0, consideration = 0, painted = 0, value;
  try {
    for (let calls = 0; calls < 10000; calls++) {
      const step = fixture.work.step(1); assert.equal(step.operations, 1);
      presence += step.visitedLabelPresenceRows; consideration += step.consideredLabels; painted += step.paintedLabels;
      if (step.done) { value = step.value; break; }
    }
    assert.ok(value); assert.equal(presence, 2049); assert.equal(consideration, 2050); assert.equal(painted, 1);
    assert.deepEqual(fixture.canvas.snapshot().painted.map(value => value.args[0]), ['last']);
  } finally { value?.batch.dispose(); fixture.work.dispose(); }
});

test('a missing factory fails only for nonempty label text and never accesses a global document', () => {
  for (const name of ['empty', 'emptyLabels', 'ordinary']) {
    const fixture = preparedFixture(configuration(name)); fixture.work.dispose();
    const work = createGraphDecorationsWork(fixture.data, fixture.presentation, undefined);
    try {
      if (name === 'ordinary') { assert.throws(() => finish(work)); assert.throws(() => work.step(1), invalidState); }
      else finish(work).batch.dispose();
    } finally { work.dispose(); }
  }
});

test('every partial cursor position retires acquired owners once on cancellation', () => {
  const control = preparedFixture(); let steps = 0, value;
  try { while (!value) { const step = control.work.step(1); steps++; if (step.done) value = step.value; } }
  finally { value?.batch.dispose(); control.work.dispose(); }
  for (let stop = 0; stop < steps; stop++) {
    const fixture = preparedFixture();
    acquiredOwners(acquired => disposalLog(released => {
      for (let index = 0; index < stop; index++) assert.equal(fixture.work.step(1).done, false);
      const expected = acquired();
      fixture.work.dispose(); const count = released.size; fixture.work.dispose(); assert.equal(released.size, count);
      assert.equal(released.size, expected.size);
      for (const owner of expected) assert.equal(released.get(owner), 1);
      for (const visits of released.values()) assert.equal(visits, 1);
      const canvas = fixture.canvas.snapshot(); if (canvas.acquired) { assert.equal(canvas.width, 1); assert.equal(canvas.height, 1); }
      assert.throws(() => fixture.work.step(1), invalidState);
    }));
  }
});

test('stale guards and reentrant guard calls cannot publish or reopen partial work', () => {
  for (const mode of ['stale', 'dispose', 'throw', 'reenter']) {
    const failure = new Error('guard failed'); let work, calls = 0;
    const fixture = preparedFixture(configuration('ordinary'), () => {
      calls++;
      if (mode === 'reenter') { assert.throws(() => work.step(0), invalidState); return true; }
      if (calls !== 5) return true;
      if (mode === 'dispose') { work.dispose(); return true; }
      if (mode === 'throw') throw failure;
      return false;
    });
    work = fixture.work;
    try {
      if (mode === 'reenter') finish(work).batch.dispose();
      else { assert.throws(() => finish(work), mode === 'throw' ? error => error === failure : aborted); assert.throws(() => work.step(1), invalidState); }
    } finally { work.dispose(); }
  }
});

// Canvas operations count acquisition/context, dimension setters, context property setters and
// native methods. Label-row consideration is reported separately, including rejected rows.
for (const boundary of ['createCanvas', 'getContext', 'width', 'height', 'setTransform', 'clearRect', 'font', 'textBaseline', 'textAlign', 'fillStyle', 'globalAlpha', 'fillText', 'globalAlphaReset']) {
  test(`canvas ${boundary} fences cancellation, staleness, failure and nested steps`, () => {
    for (const mode of ['dispose', 'stale', 'throw', 'reenter']) {
      const failure = new Error('canvas failed'); let current = true, work, fired = false, subsequent = 0, boundaryTrace = 0;
      const options = configuration(boundary === 'globalAlphaReset' ? 'hiddenLabels' : 'ordinary'), fixture = preparedFixture(options); fixture.work.dispose();
      const canvas = fixture.canvas.canvas, context = canvas.getContext('2d');
      function invoke() {
        if (fired) { subsequent++; return; }
        fired = true;
        boundaryTrace = fixture.canvas.snapshot().trace.length;
        if (mode === 'dispose') work.dispose();
        else if (mode === 'stale') current = false;
        else if (mode === 'throw') throw failure;
        else assert.throws(() => work.step(1), invalidState);
      }
      const descriptors = [];
      function wrap(owner, key) {
        const descriptor = Object.getOwnPropertyDescriptor(owner, key); descriptors.push([owner, key, descriptor]);
        if (descriptor.set) Object.defineProperty(owner, key, { ...descriptor, set(value) { descriptor.set.call(this, value); if (value !== 1 || key !== 'width' && key !== 'height') invoke(); } });
        else Object.defineProperty(owner, key, { ...descriptor, value(...args) { const result = descriptor.value.apply(this, args); invoke(); return result; } });
      }
      let create = fixture.canvas.create;
      if (boundary === 'createCanvas') create = () => { const result = fixture.canvas.create(); invoke(); return result; };
      else wrap(['getContext', 'width', 'height'].includes(boundary) ? canvas : context, boundary === 'globalAlphaReset' ? 'globalAlpha' : boundary);
      work = createGraphDecorationsWork(fixture.data, fixture.presentation, create, () => current);
      try {
        if (mode === 'reenter') { const value = finish(work, 1); assert.equal(fired, true); value.batch.dispose(); }
        else {
          assert.throws(() => finish(work, 1), mode === 'throw' ? error => error === failure : aborted);
          assert.equal(fired, true); assert.equal(subsequent, 0); assert.throws(() => work.step(1), invalidState);
          for (const operation of fixture.canvas.snapshot().trace.slice(boundaryTrace)) {
            assert.ok((operation[0] === 'width' || operation[0] === 'height') && operation[1] === 1, 'only canvas retirement may follow a canceled boundary');
          }
          if (boundary !== 'createCanvas' || mode !== 'throw') { assert.equal(canvas.width, 1); assert.equal(canvas.height, 1); }
        }
      } finally {
        for (const [owner, key, descriptor] of descriptors) Object.defineProperty(owner, key, descriptor);
        work.dispose();
      }
    }
  });
}

test('native construction is count-zero and preparation cannot lazily initialize rows or scan object bounds', () => {
  for (const name of ['ordinary', 'particleCap']) {
  const fixture = preparedFixture(configuration(name));
  observeInstances(instances => withMethod(InstancedMesh.prototype, 'setColorAt', original => function (...args) {
    assert.ok(this.instanceColor, 'color backing must exist before any row write'); return original.apply(this, args);
  }, () => withMethod(InstancedMesh.prototype, 'computeBoundingSphere', () => function () { assert.fail('object bounds must use the cursor'); }, () => {
    const counts = [];
    withMethod(InstancedMesh.prototype, 'setMatrixAt', original => function (...args) {
      if (!instances.includes(this)) assert.fail('unexpected instance');
      return original.apply(this, args);
    }, () => {
      let value;
      for (let calls = 0; calls < 100000; calls++) {
        const before = instances.length, step = fixture.work.step(1);
        for (const mesh of instances.slice(before)) counts.push(mesh.count);
        if (step.done) { value = step.value; break; }
      }
      assert.ok(value); assert.deepEqual(counts, [0, 0, 0]);
      try { for (const mesh of instances) mesh.onBeforeRender(); } finally { value.batch.dispose(); }
    });
  })));
  fixture.work.dispose();
  }
});

test('native resource retirement attempts all owners despite failures and quiesce closes semantic updates', () => {
  const fixture = preparedFixture(), value = finish(fixture.work); install(fixture, value);
  const { resources, batch } = value;
  const retained = [resources.arrows, resources.arrowPick, resources.particles, resources.arrows.geometry, resources.particles.geometry,
    resources.arrows.material, resources.arrowPick.material, resources.particles.material, resources.labelMesh.geometry, resources.labelMesh.material, resources.labelTexture];
  const failure = new Error('retirement failed');
  batch.quiesce(); const before = normalizedSnapshot(fixture);
  fixture.frame.revision++; assert.equal(batch.update(fixture.view, fixture.frame), false); assert.deepEqual(normalizedSnapshot(fixture), before);
  disposalLog(released => {
    assert.throws(() => disposeGraphDecorationResources(resources), error => error === failure);
    assert.equal(resources.disposed, true);
    for (const owner of retained) assert.equal(released.get(owner), 1);
    assert.equal(fixture.canvas.canvas.width, 1); assert.equal(fixture.canvas.canvas.height, 1);
    assert.equal(fixture.view.world.children.length + fixture.view.pickWorld.children.length + fixture.view.scene.children.length, 0);
    disposeGraphDecorationResources(resources); batch.dispose(); fixture.work.dispose();
    for (const owner of retained) assert.equal(released.get(owner), 1);
  }, failure);
});

test('staleness at every guard retires all acquired native owners, including the transfer fence', () => {
  let total = 0;
  const control = preparedFixture(configuration('ordinary'), () => { total++; return true; });
  try { finish(control.work, 1).batch.dispose(); } finally { control.work.dispose(); }
  assert.ok(total > 20);
  for (let stop = 1; stop <= total; stop++) {
    let calls = 0;
    const fixture = preparedFixture(configuration('ordinary'), () => ++calls !== stop);
    acquiredOwners(acquired => disposalLog(released => {
      assert.throws(() => finish(fixture.work, 1), { name: 'AbortError' });
      assert.equal(calls, stop);
      const expected = acquired(); assert.equal(released.size, expected.size);
      for (const owner of expected) assert.equal(released.get(owner), 1);
      const canvas = fixture.canvas.snapshot(); if (canvas.acquired) { assert.equal(canvas.width, 1); assert.equal(canvas.height, 1); }
      fixture.work.dispose(); assert.throws(() => fixture.work.step(1), invalidState);
      for (const visits of released.values()) assert.equal(visits, 1);
    }));
  }
});

for (const [kind, prototype, key] of [['geometry', BufferGeometry.prototype, 'setAttribute'], ['material', Material.prototype, 'setValues'],
  ['mesh', Mesh.prototype, 'updateMorphTargets'], ['instanced mesh', InstancedMesh.prototype, 'updateMorphTargets'], ['bounds', BufferGeometry.prototype, 'computeBoundingSphere']]) {
  test(`${kind} native calls fence disposal, replacement and nested steps`, () => {
    let total = 0;
    const control = preparedFixture();
    withMethod(prototype, key, original => function (...args) { total++; return original.apply(this, args); }, () => {
      try { finish(control.work, 1).batch.dispose(); } finally { control.work.dispose(); }
    });
    assert.ok(total > 0);
    for (let stop = 1; stop <= total; stop++) for (const mode of ['dispose', 'stale', 'reenter']) {
      let calls = 0, current = true;
      const fixture = preparedFixture(configuration('ordinary'), () => current);
      acquiredOwners(acquired => disposalLog(released => withMethod(prototype, key, original => function (...args) {
        const result = original.apply(this, args);
        if (++calls === stop) {
          if (mode === 'dispose') fixture.work.dispose();
          else if (mode === 'stale') current = false;
          else assert.throws(() => fixture.work.step(1), invalidState);
        }
        return result;
      }, () => {
        try {
          if (mode === 'reenter') finish(fixture.work, 1).batch.dispose();
          else assert.throws(() => finish(fixture.work, 1), mode === 'stale' ? { name: 'AbortError' } : aborted);
          const expected = acquired(); assert.equal(released.size, expected.size);
          for (const owner of expected) assert.equal(released.get(owner), 1);
        } finally { fixture.work.dispose(); }
      })));
    }
  });
}

test('an original canvas error survives throwing native cleanup', () => {
  const fixture = preparedFixture(), context = fixture.canvas.canvas.getContext('2d');
  const failure = new Error('draw failed'), cleanup = new Error('cleanup failed');
  withMethod(context, 'fillText', () => function () { throw failure; }, () => disposalLog(released => {
    assert.throws(() => finish(fixture.work, 1), error => error === failure);
    assert.ok(released.size >= 11); for (const visits of released.values()) assert.equal(visits, 1);
    assert.equal(fixture.canvas.canvas.width, 1); assert.equal(fixture.canvas.canvas.height, 1);
    assert.throws(() => fixture.work.step(1), invalidState); fixture.work.dispose();
  }, cleanup));
});

test('retirement attempts remaining owners and both canvas dimensions after parent and resize failures', () => {
  for (const mode of ['parent', 'canvas']) {
    const fixture = preparedFixture(), value = finish(fixture.work); install(fixture, value);
    const failure = new Error('retirement failed'), dimensions = [], descriptors = [];
    if (mode === 'canvas') for (const key of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(fixture.canvas.canvas, key); descriptors.push([key, descriptor]);
      Object.defineProperty(fixture.canvas.canvas, key, { ...descriptor, set(value) { dimensions.push(key); descriptor.set.call(this, value); throw failure; } });
    }
    try {
      const run = () => disposalLog(released => {
        assert.throws(() => disposeGraphDecorationResources(value.resources), error => error === failure);
        assert.equal(released.size, 11); for (const visits of released.values()) assert.equal(visits, 1);
        assert.equal(value.resources.disposed, true);
        if (mode === 'canvas') assert.deepEqual(dimensions, ['width', 'height']);
      });
      if (mode === 'parent') withMethod(Mesh.prototype, 'removeFromParent', original => function () { original.call(this); throw failure; }, run);
      else run();
    } finally {
      for (const [key, descriptor] of descriptors) Object.defineProperty(fixture.canvas.canvas, key, descriptor);
      value.batch.dispose(); fixture.work.dispose();
    }
  }
});
