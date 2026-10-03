import { expect, fixture, html } from '@open-wc/testing';
import { composedAccessibilityTextResult } from './accessibility-visibility.js';

it('reports existing visibility snapshots without changing bounded text or adding style reads', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div style="display: contents">
      <span id="snapshot-label">Referenced label</span>
      <button aria-labelledby="snapshot-label">Fallback label</button>
      <span hidden>Excluded text</span>
    </div>
  `);
  const original = window.getComputedStyle;
  let reads = 0;
  window.getComputedStyle = function (element, pseudo) {
    reads++;
    return original.call(this, element, pseudo);
  };
  try {
    for (const maxNodes of [0, 1, 8, 64]) {
      reads = 0;
      const baseline = composedAccessibilityTextResult(root, { maxNodes });
      const baselineReads = reads;
      reads = 0;
      const observed = new Map<Element, number>();
      const result = composedAccessibilityTextResult(root, {
        maxNodes,
        onElementState: (element) => observed.set(element, (observed.get(element) ?? 0) + 1),
      });
      expect(result.text).to.equal(baseline.text);
      expect(result.visitedNodes).to.equal(baseline.visitedNodes);
      expect(result.truncated).to.equal(baseline.truncated);
      expect(result.truncationReasons).to.deep.equal(baseline.truncationReasons);
      expect(reads).to.equal(baselineReads);
      expect([...observed.values()].every((count) => count === 1)).to.equal(true);
      if (maxNodes === 64) {
        expect(result.text.replace(/\s+/g, ' ').trim()).to.equal('Referenced label');
        expect(observed.size).to.be.greaterThan(0);
      }
    }
  } finally {
    window.getComputedStyle = original;
  }
});
