import { expect, fixture, html } from '@open-wc/testing';
import { acquireAriaDescription } from './aria-controls.js';

// Keep query-imported copies in their own page so coverage retains the original module's hits.
it('composes descriptions across query-imported current source copies', async () => {
  const copyUrl = new URL('./aria-controls.ts?current-description-copy=one', import.meta.url).href;
  const copy = await import(copyUrl) as typeof import('./aria-controls.js');
  const root = await fixture<HTMLElement>(html`
    <div><button></button><span id="first"></span><span id="second"></span></div>
  `);
  const target = root.querySelector<HTMLButtonElement>('button')!;
  const firstSource = root.querySelector<HTMLElement>('#first')!;
  const secondSource = root.querySelector<HTMLElement>('#second')!;
  const first = acquireAriaDescription(target, [firstSource]);
  const second = copy.acquireAriaDescription(target, [secondSource]);

  try {
    expect(target.getAttribute('aria-describedby')).to.equal('first second');
    first.release();
    expect(target.getAttribute('aria-describedby')).to.equal('second');
    second.release();
    expect(target.hasAttribute('aria-describedby')).to.equal(false);
  } finally {
    first.release();
    second.release();
  }
});
