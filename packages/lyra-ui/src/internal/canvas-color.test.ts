import { expect } from '@open-wc/testing';
import { resolveCanvasColor, resolveCanvasColors } from './canvas-color.js';

/** Counts probe insertions, which is what makes a resolution expensive: each one forces a
 *  synchronous style recalculation. */
function countingScope(): { scope: HTMLElement; probes: () => number; dispose: () => void } {
  const scope = document.createElement('div');
  document.body.append(scope);
  let probes = 0;
  const original = scope.append.bind(scope);
  scope.append = ((...nodes: (Node | string)[]) => {
    probes += 1;
    original(...nodes);
  }) as HTMLElement['append'];
  return { scope, probes: () => probes, dispose: () => scope.remove() };
}

it('resolves a repeated color once per distinct string, preserving order', () => {
  const { scope, probes, dispose } = countingScope();
  try {
    const authored = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? '#ff0000' : '#00ff00'));
    const resolved = resolveCanvasColors(scope, authored, 'transparent');

    expect(resolved).to.have.length(60);
    // Two distinct colors -- not 60 -- however long the array is.
    expect(probes()).to.equal(2);
    expect(resolved[0]).to.equal(resolved[2]);
    expect(resolved[0]).to.not.equal(resolved[1]);
  } finally {
    dispose();
  }
});

it('agrees with the scalar resolver for every entry', () => {
  const { scope, dispose } = countingScope();
  try {
    const authored = ['#ff0000', 'rebeccapurple', 'not-a-color', 'rgb(0, 128, 0)'];
    const batch = resolveCanvasColors(scope, authored, 'transparent');
    const scalar = authored.map((color) => resolveCanvasColor(scope, color, 'transparent'));
    expect(batch).to.deep.equal(scalar);
  } finally {
    dispose();
  }
});

it('falls back per entry without poisoning the entries around it', () => {
  const { scope, dispose } = countingScope();
  try {
    const resolved = resolveCanvasColors(scope, ['#ff0000', 'definitely-not-a-color'], 'transparent');
    expect(resolved[0]).to.not.equal('transparent');
    expect(resolved[1]).to.equal('transparent');
  } finally {
    dispose();
  }
});

it('returns an empty array for empty input without probing at all', () => {
  const { scope, probes, dispose } = countingScope();
  try {
    expect(resolveCanvasColors(scope, [], 'transparent')).to.deep.equal([]);
    expect(probes()).to.equal(0);
  } finally {
    dispose();
  }
});
