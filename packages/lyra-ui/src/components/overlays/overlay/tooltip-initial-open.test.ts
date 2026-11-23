import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
import '../../lr-tooltip.js';

const popupRole = (tooltip: LyraTooltip): string | null =>
  tooltip.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('role');

describe('lr-tooltip opened before its first render', () => {
  it('classifies actionable content after the first update without changing state inside it', async () => {
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <lr-tooltip open manual>
          <button slot="trigger">Help</button>
          <button>Content action</button>
        </lr-tooltip>
      </div>`);
      const tooltip = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
      await tooltip.updateComplete;
      await waitUntil(() => popupRole(tooltip) === 'dialog', 'actionable content makes the popup a dialog');
      expect(tooltip.open).to.equal(true);
    } finally {
      console.warn = original;
    }
    expect(warnings.filter((args) => String(args[0]).includes('scheduled an update')).length).to.equal(0);
  });

  it('keeps plain content as a tooltip when opened before its first render', async () => {
    const tooltip = await fixture<LyraTooltip>(html`<lr-tooltip open manual>
      <button slot="trigger">Help</button>
      Plain help text
    </lr-tooltip>`);
    await tooltip.updateComplete;
    await tooltip.updateComplete;
    expect(popupRole(tooltip)).to.equal('tooltip');
  });
});
