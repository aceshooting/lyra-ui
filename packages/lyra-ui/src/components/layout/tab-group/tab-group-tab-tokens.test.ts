import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';
import type { LyraTabGroup } from '../../lr-tab-group.js';

async function mount(style = ''): Promise<LyraTabGroup> {
  const el = await fixture<LyraTabGroup>(html`<lr-tab-group style=${style}>
    <lr-tab panel="general">General</lr-tab>
    <lr-tab panel="advanced">Advanced</lr-tab>
    <lr-tab-panel name="general">General body</lr-tab-panel>
    <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
  </lr-tab-group>`);
  await el.updateComplete;
  return el;
}

const tabOf = (el: LyraTabGroup): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="tab"]')!;
const tablistOf = (el: LyraTabGroup): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="tablist"]')!;

const tabMetrics = (el: LyraTabGroup) => {
  const style = getComputedStyle(tabOf(el));
  return [style.paddingBlockStart, style.paddingInlineStart, style.fontSize, Math.round(tabOf(el).getBoundingClientRect().height)];
};

describe('lr-tab-group tab tokens', () => {
  it('keeps the default tab metrics while unset', async () => {
    const plain = await mount();
    const explicit = await mount(
      '--lr-tab-group-tab-padding: var(--lr-space-s) var(--lr-space-xs); --lr-tab-group-tab-font-size: inherit; --lr-tab-group-tab-min-block-size: auto; --lr-tab-group-track-width: var(--lr-border-width-thin)',
    );
    expect(tabMetrics(plain)).to.deep.equal(tabMetrics(explicit));
    expect(getComputedStyle(tablistOf(plain)).borderBlockEndWidth).to.equal(getComputedStyle(tablistOf(explicit)).borderBlockEndWidth);
  });

  it('applies tab padding, font size and min block size tokens', async () => {
    const el = await mount('--lr-tab-group-tab-padding: 3px 4px; --lr-tab-group-tab-font-size: 21px; --lr-tab-group-tab-min-block-size: 64px');
    const [blockPadding, inlinePadding, fontSize, height] = tabMetrics(el);
    expect([blockPadding, inlinePadding, fontSize]).to.deep.equal(['3px', '4px', '21px']);
    expect(height).to.be.at.least(64);
  });

  it('sizes the track with --lr-tab-group-track-width, behind the upstream --track-width alias', async () => {
    const el = await mount('--lr-tab-group-track-width: 5px');
    const own = [getComputedStyle(tablistOf(el)).borderBlockEndWidth, getComputedStyle(tabOf(el)).marginBlockEnd];
    el.style.setProperty('--track-width', '2px');
    const alias = getComputedStyle(tablistOf(el)).borderBlockEndWidth;
    expect(own).to.deep.equal(['5px', '-5px']);
    expect(alias).to.equal('2px');
  });

  it('sizes a vertical track with --lr-tab-group-track-width', async () => {
    const el = await mount('--lr-tab-group-track-width: 6px');
    el.placement = 'start';
    await el.updateComplete;
    expect(getComputedStyle(tablistOf(el)).borderInlineEndWidth).to.equal('6px');
  });
});
