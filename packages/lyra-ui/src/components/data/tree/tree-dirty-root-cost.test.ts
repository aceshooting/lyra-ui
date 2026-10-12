import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './tree.js';
import type { LyraTree } from './tree.js';
import type { LyraTreeItem } from './tree-item.js';
import { twoFrames } from '../../../../test/frames.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

async function settled(tree: LyraTree): Promise<LyraTreeItem[]> {
  const roots = [...tree.querySelectorAll<LyraTreeItem>(':scope > lr-tree-item')];
  await Promise.all(roots.map((item) => item.updateComplete));
  await tree.updateComplete;
  await twoFrames();
  await tree.updateComplete;
  return roots;
}

it('indexes multiple observer-dirty roots linearly without changing active state or ARIA positions', async () => {
  const count = 128;
  const tree = await fixture<LyraTree>(html`<lr-tree label="Documents">
    ${Array.from({ length: count }, (_, index) => html`<lr-tree-item label=${`Document ${index}`}></lr-tree-item>`)}
  </lr-tree>`);
  const roots = await settled(tree);
  expect(roots.length).to.equal(count);
  expect(roots.filter((item) => item.tabIndex === 0).length).to.equal(1);
  const activeNodeId = roots[0]!.nodeId;
  expect(roots[0]!.tabIndex).to.equal(0);
  const identities = new Set(roots);
  const seam = tree as unknown as {
    readonly hasAuthoredItems: boolean;
    readonly activeId: string | null;
    readonly dirtyConfigureRoots: ReadonlySet<LyraTreeItem>;
    updated(changed: PropertyValues): void;
  };
  const original = seam.updated;
  const descriptor = Object.getOwnPropertyDescriptor(tree, 'updated');
  let targeted = 0;
  let reads = 0;
  const batches: { changedSize: number; dirtyCount: number; activeId: string | null }[] = [];
  Object.defineProperty(tree, 'updated', {
    configurable: true,
    value: (changed: PropertyValues): void => {
      const dirtyCount = seam.dirtyConfigureRoots.size;
      if (changed.size !== 0 || !seam.hasAuthoredItems || dirtyCount <= 1) {
        original.call(tree, changed);
        return;
      }
      targeted += 1;
      batches.push({ changedSize: changed.size, dirtyCount, activeId: seam.activeId });
      const measured = measureArrayProbeReads(
        (array, value) => array.length === count && array[0] === roots[0]
          && array[count - 1] === roots[count - 1] && identities.has(value as LyraTreeItem),
        () => original.call(tree, changed),
      );
      reads += measured.reads;
    },
  });
  try {
    // The existing single-dirty public test uses the same disabled metadata trigger. Deliver all
    // nonactive roots in one synchronous burst to prove the actual multi-dirty empty-map path.
    roots.slice(1).forEach((item) => item.setAttribute('disabled', ''));
    await waitUntil(() => targeted > 0, 'Public batch did not enter the multi-dirty targeted update', { timeout: 3000 });
  } finally {
    if (descriptor) Object.defineProperty(tree, 'updated', descriptor);
    else Reflect.deleteProperty(tree, 'updated');
  }
  await settled(tree);
  expect(targeted).to.equal(1);
  expect(batches).to.deep.equal([{ changedSize: 0, dirtyCount: count - 1, activeId: activeNodeId }]);
  expect(roots.slice(1).every((item) => item.disabled)).to.equal(true);
  expect(roots.map((item) => item.getAttribute('aria-posinset'))).to.deep.equal(Array.from({ length: count }, (_, index) => String(index + 1)));
  expect(roots.map((item) => item.getAttribute('aria-setsize'))).to.deep.equal(Array<string>(count).fill(String(count)));
  expect(roots[0]!.tabIndex).to.equal(0);
  expect(seam.activeId).to.equal(activeNodeId);
  expect(reads).to.be.at.most(count * 4);
});

it('uses current authored positions including index zero after reorder and a new metadata batch', async () => {
  const tree = await fixture<LyraTree>(html`<lr-tree label="Documents">
    <lr-tree-item label="Alpha"></lr-tree-item>
    <lr-tree-item label="Beta"></lr-tree-item>
    <lr-tree-item label="Gamma"></lr-tree-item>
  </lr-tree>`);
  const [alpha, beta, gamma] = await settled(tree);
  tree.insertBefore(gamma!, alpha!);
  const reordered = await settled(tree);
  expect(reordered.map((item) => item.label)).to.deep.equal(['Gamma', 'Alpha', 'Beta']);
  // Index-zero and final roots participate together; neither update may treat position0 as missing.
  gamma!.setAttribute('lazy', '');
  beta!.setAttribute('lazy', '');
  await settled(tree);
  expect(reordered.map((item) => item.getAttribute('aria-posinset'))).to.deep.equal(['1', '2', '3']);
  expect(reordered.map((item) => item.getAttribute('aria-setsize'))).to.deep.equal(['3', '3', '3']);
  expect(gamma!.lazy).to.equal(true);
  expect(beta!.lazy).to.equal(true);
  beta!.remove();
  alpha!.setAttribute('lazy', '');
  const remaining = await settled(tree);
  expect(remaining.map((item) => item.label)).to.deep.equal(['Gamma', 'Alpha']);
  expect(remaining.map((item) => item.getAttribute('aria-posinset'))).to.deep.equal(['1', '2']);
  expect(remaining.map((item) => item.getAttribute('aria-setsize'))).to.deep.equal(['2', '2']);
});
