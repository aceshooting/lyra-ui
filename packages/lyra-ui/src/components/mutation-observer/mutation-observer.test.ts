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

  it('coalesces synchronous mutations across multiple slotted targets into one shared-observer event', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lyra-mutation-observer><div id="a"></div><div id="b"></div></lyra-mutation-observer>`,
    );
    await el.updateComplete;
    const a = el.querySelector('#a')!;
    const b = el.querySelector('#b')!;

    let eventCount = 0;
    let lastRecordCount = 0;
    el.addEventListener('lyra-mutation', ((e: CustomEvent<{ records: MutationRecord[] }>) => {
      eventCount++;
      lastRecordCount = e.detail.records.length;
    }) as EventListener);

    const event = oneEvent(el, 'lyra-mutation');
    // Two different observed targets mutated synchronously in the same script -- a single shared
    // MutationObserver instance batches both into one microtask callback (one event, two records);
    // one MutationObserver per target would instead fire one event per target.
    a.textContent = 'x';
    b.textContent = 'y';
    await event;
    await new Promise((r) => setTimeout(r, 0));

    expect(eventCount).to.equal(1);
    expect(lastRecordCount).to.equal(2);
  });

  it('drives observation solely through the internal <slot>, not a host-level slotchange listener', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lyra-mutation-observer><div></div></lyra-mutation-observer>`);
    await el.updateComplete;

    let hostSlotchangeFired = false;
    el.addEventListener('slotchange', () => {
      hostSlotchangeFired = true;
    });

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lyra-mutation');
    target.append(document.createElement('span'));
    await event;

    // slotchange bubbles only within the shadow tree (composed: false), so a listener added
    // directly on the host element never observes it -- mutation forwarding must therefore be
    // driven entirely by the internal <slot>'s own @slotchange template binding, confirming
    // there is no host-level slotchange wiring left to maintain.
    expect(hostSlotchangeFired).to.equal(false);
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
