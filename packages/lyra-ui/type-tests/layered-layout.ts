import {
  layeredLayout,
  type LayeredLayoutResult,
} from '../src/utilities/layered-layout.js';

const result = layeredLayout({
  nodes: [{ id: 'start', width: 20, height: 20 }],
  edges: [],
  options: {
    fixedPositions: new Map([['start', { x: 10, y: 10 }]]) as ReadonlyMap<
      string,
      Readonly<{ x: number; y: number }>
    >,
    gapX: 0,
    gapY: 0,
    maxVirtualWaypoints: 25,
  },
});
const publicResult: LayeredLayoutResult = result;
const position = publicResult.positions.get('start')!;

void publicResult.truncated;
void publicResult.virtualWaypointCount;
void position.x;

// @ts-expect-error v9 returns bounded resource metadata rather than a bare Map.
result.get('start');
// @ts-expect-error public result coordinates are readonly snapshots.
position.x = 10;
// @ts-expect-error the public positions collection is readonly.
publicResult.positions.set('other', { x: 0, y: 0 });
// @ts-expect-error the waypoint budget is numeric.
layeredLayout({ nodes: [], edges: [], options: { maxVirtualWaypoints: '25' } });
// @ts-expect-error fixed coordinates are numeric.
layeredLayout({ nodes: [], edges: [], options: { fixedPositions: new Map([['bad', { x: '0', y: 0 }]]) } });
