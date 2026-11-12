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

it('culls offscreen labels with a styled font shorthand and paints them after panning into view', () => {
  const context = document.createElement('canvas').getContext('2d')!;
  const fillText = context.fillText, strokeText = context.strokeText;
  const filled: string[] = [], outlined: string[] = [];
  context.fillText = (text, x, y) => { filled.push(text); fillText.call(context, text, x, y); };
  context.strokeText = (text, x, y) => { outlined.push(text); strokeText.call(context, text, x, y); };
  const scene = {
    hulls: [], links: [], nodes: [],
    edgeLabels: [{ text: 'Near edge', x: 30, y: 30 }, { text: 'Far edge', x: 10030, y: 10030 }],
    nodeLabels: [{ text: 'Near node', x: 30, y: 60 }, { text: 'Far node', x: 10030, y: 10060 }],
    showNodeLabels: true, haloColor: 'black', selectedColor: 'blue', labelColor: 'black',
    labelHaloColor: 'white', font: 'italic bold 14px serif',
  };
  try {
    drawGraphScene(context, { k: 1, x: 0, y: 0 }, scene, { width: 400, height: 300 });
    expect(filled).to.deep.equal(['Near edge', 'Near node']);
    expect(outlined).to.deep.equal(['Near edge']);
    filled.length = 0; outlined.length = 0;
    drawGraphScene(context, { k: 1, x: -10000, y: -10000 }, scene, { width: 400, height: 300 });
    expect(filled).to.deep.equal(['Far edge', 'Far node']);
    expect(outlined).to.deep.equal(['Far edge']);
  } finally { context.fillText = fillText; context.strokeText = strokeText; }
});
