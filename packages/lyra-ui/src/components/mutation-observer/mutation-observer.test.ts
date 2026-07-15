import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.class.js';

describe('<lyra-mutation-observer>', () => {
  it('forwards mutations from slotted content', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lyra-mutation-observer><div></div></lyra-mutation-observer>`);
    await el.updateComplete;
    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lyra-mutation');
    target.append(document.createElement('span'));
    const result = await event as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
  });

  it('supports disabled observation', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lyra-mutation-observer disabled><div></div></lyra-mutation-observer>`);
    expect(el.disabled).to.equal(true);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lyra-mutation-observer><button>Observed</button></lyra-mutation-observer>`);
    await expect(el).to.be.accessible();
  });
});
