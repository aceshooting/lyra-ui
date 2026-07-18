import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './intersection-observer.js';
import type { LyraIntersectionObserver } from './intersection-observer.class.js';

describe('<lyra-intersection-observer>', () => {
  it('renders a non-layout observer wrapper', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><div>Observed</div></lyra-intersection-observer>`);
    expect(getComputedStyle(el).display).to.equal('contents');
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  });

  it('supports root margins and thresholds', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer root-margin="16px"><div>Observed</div></lyra-intersection-observer>`);
    el.threshold = [0, 0.5, 1];
    await el.updateComplete;
    expect(el.rootMargin).to.equal('16px');
    expect(el.threshold).to.deep.equal([0, 0.5, 1]);
  });

  it('re-observes slotted content when the default slot changes, via the inline @slotchange binding on the shadow <slot>', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><div>Observed</div></lyra-intersection-observer>`);
    await el.updateComplete;
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'initial slotted content should be observed').to.exist;

    const extra = document.createElement('span');
    extra.textContent = 'More';
    el.append(extra);
    // The <slot>'s own slotchange event (not composed) is what re-triggers
    // observeTargets -- a host-level slotchange listener never fires here.
    await aTimeout(0);

    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should survive a slot change').to.exist;
  });

  it('does not create a dangling observer when a property change re-observe is still queued at disconnect', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><div>Observed</div></lyra-intersection-observer>`);
    const parent = el.parentElement!;

    // Property change queues a re-observe via scheduleAfterUpdate; removing
    // the element right away races that queued microtask against disconnect.
    el.threshold = 0.5;
    el.remove();
    await aTimeout(0);

    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'no observer should have been created post-disconnect').to.be.undefined;

    parent.append(el);
  });

  it('resumes observation after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><div>Observed</div></lyra-intersection-observer>`);
    const parent = el.parentElement!;
    await aTimeout(0);
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should exist after the initial connect').to.exist;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so slotchange never fires either.
    el.remove();
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should be torn down on disconnect').to.be.undefined;

    parent.append(el);
    await aTimeout(0);
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should be re-armed on reconnect').to.exist;
  });

  it('is accessible', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lyra-intersection-observer><button>Observed</button></lyra-intersection-observer>`);
    await expect(el).to.be.accessible();
  });
});
