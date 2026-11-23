import { expect, fixture } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
import '../../lr-tooltip.js';

describe('lr-tooltip full-width-trigger', () => {
  it('stretches the host, the trigger wrapper and the slotted trigger, and stays off by default', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="inline-size: 400px"><lr-tooltip content="Full title"><button slot="trigger">Card</button></lr-tooltip><lr-tooltip full-width-trigger content="Full title"><button slot="trigger">Card</button></lr-tooltip></div>`,
    );
    const [plain, full] = [...wrapper.querySelectorAll<LyraTooltip>('lr-tooltip')];
    await Promise.all([plain!.updateComplete, full!.updateComplete]);
    const width = (node: Element) => Math.round(node.getBoundingClientRect().width);
    expect(plain!.fullWidthTrigger).to.equal(false);
    expect(full!.fullWidthTrigger).to.equal(true);
    expect(width(plain!)).to.be.lessThan(400);
    const trigger = full!.shadowRoot!.querySelector('[part="trigger"]')!;
    expect([width(full!), width(trigger), width(full!.querySelector('button')!)]).to.deep.equal([400, 400, 400]);
  });

  it('reflects the property and lets a truncated block trigger ellipsize inside a grid column', async () => {
    const grid = await fixture<HTMLDivElement>(
      `<div style="display: grid; grid-template-columns: 160px 160px"><lr-tooltip content="A very long suggestion title that cannot fit"><div slot="trigger" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">A very long suggestion title that cannot fit</div></lr-tooltip></div>`,
    );
    const tooltip = grid.querySelector<LyraTooltip>('lr-tooltip')!;
    tooltip.fullWidthTrigger = true;
    await tooltip.updateComplete;
    expect(tooltip.hasAttribute('full-width-trigger')).to.equal(true);
    const title = tooltip.querySelector<HTMLElement>('[slot="trigger"]')!;
    expect(Math.round(tooltip.getBoundingClientRect().width)).to.equal(160);
    expect(title.scrollWidth > title.clientWidth).to.equal(true);
    expect(Math.round(title.getBoundingClientRect().width)).to.equal(160);
  });
});
