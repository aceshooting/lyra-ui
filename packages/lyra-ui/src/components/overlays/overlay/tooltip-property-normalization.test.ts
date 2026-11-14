import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './tooltip.js';
import './popover.js';
import type { LyraTooltip } from './tooltip.class.js';
import type { LyraPopover } from './popover.class.js';
import type { PlaceStrategy } from '../../../internal/positioner.js';

describe('lr-tooltip and lr-popover property normalization', () => {
  it('normalizes a null for to the empty string and drops the reflected attribute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="tip-anchor">Anchor</button>
        <lr-tooltip for="tip-anchor" content="Tip"></lr-tooltip>
        <lr-popover for="tip-anchor"><span>Body</span></lr-popover>
      </div>
    `);
    const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
    const popover = wrapper.querySelector<LyraPopover>('lr-popover')!;
    (tooltip as unknown as { for: string | null }).for = null;
    (popover as unknown as { for: string | null }).for = null;
    await tooltip.updateComplete;
    await popover.updateComplete;
    expect(tooltip.for).to.equal('');
    expect(popover.for).to.equal('');
    expect(tooltip.hasAttribute('for')).to.equal(false);
    expect(popover.hasAttribute('for')).to.equal(false);
  });

  it('resolves an unsupported positioning strategy to the absolute default without a re-render', async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip positioning-strategy="fixed" content="Tip">
      <button slot="trigger">Trigger</button>
    </lr-tooltip>`);
    expect(el.positioningStrategy).to.equal('fixed');
    el.positioningStrategy = 'sideways' as PlaceStrategy;
    await el.updateComplete;
    expect(el.positioningStrategy).to.equal('absolute');
    expect(el.getAttribute('positioning-strategy')).to.equal('absolute');
    // Re-authoring the already-resolved value is accepted but changes nothing.
    el.positioningStrategy = 'absolute';
    expect(el.isUpdatePending).to.equal(false);
    expect(el.positioningStrategy).to.equal('absolute');
  });

  it('treats a nullish trigger like manual: no click opens it', async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip content="Tip">
      <button slot="trigger">Trigger</button>
    </lr-tooltip>`);
    (el as unknown as { trigger: string | null }).trigger = null;
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>('button')!.click();
    // wait-reason: proves no deferred open follows the ignored click
    await aTimeout(50);
    expect(el.open).to.equal(false);
    await el.show();
    expect(el.open).to.equal(true);
    await el.hide();
  });

  it('ignores a trigger click on a disabled click tooltip', async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip trigger="click" disabled content="Tip">
      <button slot="trigger">Trigger</button>
    </lr-tooltip>`);
    el.querySelector<HTMLButtonElement>('button')!.click();
    // wait-reason: proves no deferred open follows the ignored click
    await aTimeout(50);
    expect(el.open).to.equal(false);
    el.disabled = false;
    await el.updateComplete;
    el.querySelector<HTMLButtonElement>('button')!.click();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    await el.hide();
  });
});
