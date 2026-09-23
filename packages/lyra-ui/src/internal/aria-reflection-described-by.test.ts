import { expect, fixture, html } from '@open-wc/testing';
import { syncAriaDescribedByElements } from './aria-reflection.js';

type Reflected = HTMLElement & {
  ariaDescribedByElements?: Element[] | null;
};

// Kept in its own file, separate from the aria-controls regression coverage in
// aria-reflection.test.ts: exercising both ariaControlsElements and ariaDescribedByElements
// element-reference reflection against the same page has been observed to make this headless
// browser's accessibility tree bookkeeping pathologically slow, unrelated to this library's own
// logic. One relationship kind per file keeps the suite fast and deterministic.
describe('aria-reflection: stale idref retargeting (aria-describedby)', () => {
  it('clears ariaDescribedByElements when a resolving id is replaced by one that no longer resolves', async function () {
    if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
    const root = await fixture<HTMLElement>(html`
      <div><button></button><span id="desc-one"></span></div>
    `);
    const target = root.querySelector<Reflected>('button')!;

    const firstResolved = syncAriaDescribedByElements(root, target, 'desc-one');
    const secondResolved = syncAriaDescribedByElements(root, target, 'desc-missing');

    expect(firstResolved).to.equal(true);
    expect(secondResolved).to.equal(false);
    expect(target.ariaDescribedByElements).to.equal(null);
  });

  it('keeps ariaDescribedByElements cleared across a further unresolved idref update', async function () {
    if (!('ariaDescribedByElements' in HTMLElement.prototype)) this.skip();
    const root = await fixture<HTMLElement>(html`
      <div><button></button><span id="desc-two"></span></div>
    `);
    const target = root.querySelector<Reflected>('button')!;

    syncAriaDescribedByElements(root, target, 'desc-two');
    syncAriaDescribedByElements(root, target, 'gone-once');
    syncAriaDescribedByElements(root, target, 'gone-twice');
    expect(target.ariaDescribedByElements).to.equal(null);
  });
});
