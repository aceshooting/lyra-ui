import { expect } from '@open-wc/testing';
import { drawGraphScene } from './graph-canvas.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('culls canvas marks outside the viewport at n=10000', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  const marks = countCalls(context, 'arc');
  try {
    drawGraphScene(context, { k: 1, x: 0, y: 0 }, {
      hulls: [], links: [], edgeLabels: [], nodeLabels: [],
      nodes: Array.from({ length: 10000 }, () => ({ x: 1000000, y: 0, r: 5, shape: 'circle' as const, fill: 'black' })),
      showNodeLabels: false, haloColor: 'black', selectedColor: 'blue', labelColor: 'black', labelHaloColor: 'white', font: '12px sans-serif',
    }, { width: 400, height: 300 });
    recordScaleMeasurement('lr-graph', 'n=10000 canvas offscreen paint', { marks: marks.calls });
    expect(marks.calls).to.equal(0);
  } finally { marks.restore(); }
});
