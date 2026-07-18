import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './resize-observer.js';
import type { LyraResizeObserver } from './resize-observer.class.js';

describe('<lr-resize-observer>', () => {
  it('observes slotted elements without adding layout', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
  });

  it('supports disabling observation', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer disabled><button>Resize me</button></lr-resize-observer>`);
    expect(el.disabled).to.equal(true);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    await expect(el).to.be.accessible();
  });

  it('does not create a dangling observer when a property change re-observe is still queued at disconnect', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;

    // Property change queues a re-observe via scheduleAfterUpdate; removing
    // the element right away races that queued microtask against disconnect.
    el.box = 'border-box';
    el.remove();
    await aTimeout(0);

    expect((el as unknown as { observer?: ResizeObserver }).observer, 'no observer should have been created post-disconnect').to.be.undefined;

    parent.append(el);
  });

  it('resumes observation after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should exist after the initial connect').to.exist;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so slotchange never fires either.
    el.remove();
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be torn down on disconnect').to.be.undefined;

    parent.append(el);
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be re-armed on reconnect').to.exist;
  });
});
