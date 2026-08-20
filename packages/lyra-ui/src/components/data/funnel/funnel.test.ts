import { expect, fixture, html } from '@open-wc/testing';
import type { LyraFunnel } from './funnel.class.js';
import './funnel.js';

describe('<lr-funnel>', () => {
  it('renders populated content through the public base part and remains accessible', async () => {
    const el = await fixture<LyraFunnel>(html`
      <lr-funnel><p>Populated Funnel content</p></lr-funnel>
    `);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const slot = base.querySelector<HTMLSlotElement>('slot')!;
    const assigned = slot.assignedElements();

    expect(base.localName).to.equal('div');
    expect(assigned.length).to.equal(1);
    expect(assigned[0]?.textContent?.trim()).to.equal('Populated Funnel content');
    await expect(el).to.be.accessible();
  });
});
