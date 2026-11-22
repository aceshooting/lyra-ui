import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, oneEvent } from '@open-wc/testing';

interface TabGroupHost extends HTMLElement {
  active: string;
  updateComplete: Promise<boolean>;
}

interface DetailsHost extends HTMLElement {
  open: boolean;
  updateComplete: Promise<boolean>;
}

describe('hydrated layout', () => {
  it('lr-tab-group hydrates its server tab strip and switches panels after hydration', async () => {
    const group = await ssrFixture<TabGroupHost>(html`<lr-tab-group active="preview">
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>`);
    expect(group.active).to.equal('preview');
    expect(group.getAttribute('active')).to.equal('preview');
    const tabs = [...group.shadowRoot!.querySelectorAll<HTMLElement>('[part="tab"]')];
    const shown = oneEvent(group, 'lr-tab-show');
    tabs[2]!.click();
    await shown;
    await group.updateComplete;
    expect(group.active).to.equal('settings');
    const panels = [...group.shadowRoot!.querySelectorAll<HTMLElement>('[part="panel"]')];
    expect(panels.map((panel) => panel.hidden)).to.deep.equal([true, true, false]);
  });

  it('lr-details keeps its server open state and collapses from its summary after hydration', async () => {
    const details = await ssrFixture<DetailsHost>(html`<lr-details open summary="Shipping">Ships in two days</lr-details>`);
    const native = details.shadowRoot!.querySelector<HTMLDetailsElement>('details:not([part])')!;
    expect(details.open).to.equal(true);
    expect(native.open).to.equal(true);
    details.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!.click();
    await details.updateComplete;
    // wait-reason: the collapse runs after the hide animation, which a hydrated fixture cannot shorten
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(details.open).to.equal(false);
  });
});
