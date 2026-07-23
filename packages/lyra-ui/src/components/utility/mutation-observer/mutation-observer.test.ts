import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.class.js';

describe('<lr-mutation-observer>', () => {
  it('forwards mutations from slotted content', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = await event as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
  });

  it('coalesces synchronous mutations across multiple slotted targets into one shared-observer event', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer><div id="a"></div><div id="b"></div></lr-mutation-observer>`,
    );
    await el.updateComplete;
    const a = el.querySelector('#a')!;
    const b = el.querySelector('#b')!;

    let eventCount = 0;
    let lastRecordCount = 0;
    el.addEventListener('lr-mutation', ((e: CustomEvent<{ records: MutationRecord[] }>) => {
      eventCount++;
      lastRecordCount = e.detail.records.length;
    }) as EventListener);

    const event = oneEvent(el, 'lr-mutation');
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
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><div></div></lr-mutation-observer>`);
    await el.updateComplete;

    let hostSlotchangeFired = false;
    el.addEventListener('slotchange', () => {
      hostSlotchangeFired = true;
    });

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    await event;

    // slotchange bubbles only within the shadow tree (composed: false), so a listener added
    // directly on the host element never observes it -- mutation forwarding must therefore be
    // driven entirely by the internal <slot>'s own @slotchange template binding, confirming
    // there is no host-level slotchange wiring left to maintain.
    expect(hostSlotchangeFired).to.equal(false);
  });

  it('still reports mutations after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><div></div></lr-mutation-observer>`);
    await el.updateComplete;
    const parent = el.parentElement!;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so neither updated() nor slotchange re-arms observation;
    // only connectedCallback's own re-arm covers this path.
    el.remove();
    parent.append(el);
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.append(document.createElement('span'));
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.be.greaterThan(0);
  });

  it('supports disabled observation', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer disabled><div></div></lr-mutation-observer>`);
    expect(el.disabled).to.equal(true);
  });

  describe('true-defaulting child-list/subtree attributes', () => {
    it('clears childList/subtree from a plain HTML attribute (child-list="false" subtree="false"), not just a property binding', async () => {
      // Lit's default presence-based Boolean converter can never clear a true-defaulting property
      // from a literal attribute value -- only .prop=${false} would work without the converter
      // fix. This proves the plain-markup form (the actual regression) is what's fixed.
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer child-list="false" subtree="false"><div></div></lr-mutation-observer>`,
      );
      expect(el.childList).to.equal(false);
      expect(el.subtree).to.equal(false);
    });

    it('still defaults both to true with no attribute present', async () => {
      const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><div></div></lr-mutation-observer>`);
      expect(el.childList).to.equal(true);
      expect(el.subtree).to.equal(true);
    });

    it('an observer with child-list="false" ignores child mutations but still reports attribute mutations', async () => {
      const el = await fixture<LyraMutationObserver>(
        html`<lr-mutation-observer child-list="false" attributes><div></div></lr-mutation-observer>`,
      );
      await el.updateComplete;
      const target = el.querySelector('div')!;

      let fired = false;
      el.addEventListener('lr-mutation', () => {
        fired = true;
      });

      target.append(document.createElement('span'));
      await aTimeout(20);
      expect(fired, 'child-list mutation must NOT be reported').to.equal(false);

      const event = oneEvent(el, 'lr-mutation');
      target.setAttribute('data-x', '1');
      const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
      expect(result.detail.records.length).to.be.greaterThan(0);
    });
  });

  it('treats a non-empty attributeFilter as enabling attribute observation', async () => {
    const el = await fixture<LyraMutationObserver>(
      html`<lr-mutation-observer child-list="false"><div></div></lr-mutation-observer>`,
    );
    el.attributeFilter = ['data-state'];
    await el.updateComplete;
    await aTimeout(0);

    const target = el.querySelector('div')!;
    const event = oneEvent(el, 'lr-mutation');
    target.setAttribute('data-state', 'ready');
    const result = (await event) as CustomEvent<{ records: MutationRecord[] }>;
    expect(result.detail.records.length).to.equal(1);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraMutationObserver>(html`<lr-mutation-observer><button>Observed</button></lr-mutation-observer>`);
    await expect(el).to.be.accessible();
  });
});
