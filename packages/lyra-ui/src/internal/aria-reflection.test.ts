import { expect, fixture, html } from '@open-wc/testing';
import { syncAriaControlsElements } from './aria-reflection.js';

type Reflected = HTMLElement & {
  ariaControlsElements?: Element[] | null;
};

describe('aria-reflection: stale idref retargeting (aria-controls)', () => {
  it('clears ariaControlsElements when a resolving id is replaced by one that no longer resolves', async function () {
    if (!('ariaControlsElements' in HTMLElement.prototype)) this.skip();
    const root = await fixture<HTMLElement>(html`
      <div><button></button><span id="panel-one"></span></div>
    `);
    const target = root.querySelector<Reflected>('button')!;

    syncAriaControlsElements(root, target, 'panel-one');

    // The host's aria-controls attribute now names an id that resolves to nothing (removed,
    // renamed, or not yet rendered) -- the previously reflected element must not linger.
    syncAriaControlsElements(root, target, 'panel-missing');
    expect(target.ariaControlsElements ?? []).to.deep.equal([]);
  });
});
