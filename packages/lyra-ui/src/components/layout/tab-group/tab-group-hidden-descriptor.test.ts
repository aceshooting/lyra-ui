import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraTabGroup } from '../../lr-tab-group.js';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';

const buttons = (el: LyraTabGroup) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const visiblePanels = (el: LyraTabGroup) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden])')];
const roving = (el: LyraTabGroup) => buttons(el).filter(button => button.tabIndex === 0).map(button => button.dataset['slot']);
const tabNames = (el: LyraTabGroup) => buttons(el).map(button => button.dataset['slot']);
const focusedTab = (el: LyraTabGroup) => el.shadowRoot!.activeElement?.getAttribute('data-slot');

const mount = () => fixture<LyraTabGroup>(html`
  <lr-tab-group label="Files">
    <lr-tab panel="first">First</lr-tab>
    <lr-tab panel="detail" hidden closable aria-label="File details">Details</lr-tab>
    <lr-tab panel="locked" disabled>Locked</lr-tab>
    <lr-tab panel="last">Last</lr-tab>
    <lr-tab-panel name="first">First panel</lr-tab-panel>
    <lr-tab-panel name="detail">Details panel</lr-tab-panel>
    <lr-tab-panel name="locked">Locked panel</lr-tab-panel>
    <lr-tab-panel name="last">Last panel</lr-tab-panel>
  </lr-tab-group>`);

describe('lr-tab-group hidden descriptors', () => {
  it('omits the hidden tab and close action while show() exposes its named panel', async () => {
    const el = await mount();
    expect(tabNames(el)).to.deep.equal(['first', 'locked', 'last']);
    expect(el.shadowRoot!.querySelectorAll('[data-close-tab]').length).to.equal(0);
    el.show('detail');
    await el.updateComplete;
    expect(el.active).to.equal('detail');
    expect(el.querySelector('lr-tab-panel[name="detail"]')!.hasAttribute('active')).to.equal(true);
    const panels = visiblePanels(el);
    expect(panels.length).to.equal(1);
    expect(panels[0]!.querySelector('slot')!.name).to.equal('detail');
    const labelledBy = panels[0]!.getAttribute('aria-labelledby');
    const name = labelledBy ? el.shadowRoot!.getElementById(labelledBy)?.textContent?.trim() : panels[0]!.getAttribute('aria-label');
    expect(name).to.equal('File details');
    expect(roving(el).length).to.equal(1);
    expect(el.focusTab('detail')).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('skips the hidden and disabled tabs during real keyboard navigation in both directions', async () => {
    const el = await mount();
    await focusByKeyboard(buttons(el)[0]!);
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect([el.active, focusedTab(el)]).to.deep.equal(['last', 'last']);
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    expect([el.active, focusedTab(el)]).to.deep.equal(['first', 'first']);
  });

  it('removes and restores the real control when its descriptor visibility changes', async () => {
    const el = await mount();
    const descriptor = el.querySelector<HTMLElement>('lr-tab[panel="first"]')!;
    await focusByKeyboard(buttons(el)[0]!);
    descriptor.hidden = true;
    await waitUntil(() => !tabNames(el).includes('first'), 'the hidden control leaves the tab strip');
    expect(el.active).to.equal('last');
    expect(roving(el)).to.deep.equal(['last']);
    expect(focusedTab(el)).to.equal('last');
    descriptor.hidden = false;
    await waitUntil(() => tabNames(el).includes('first'), 'the restored control reappears');
    expect(el.focusTab('first')).to.equal(true);
    expect(focusedTab(el)).to.equal('first');
  });

  it('rehomes a hidden manual-mode focus target while preserving selection and unrelated focus', async () => {
    const el = await mount();
    el.activation = 'manual';
    await el.updateComplete;
    expect(el.focusTab('last')).to.equal(true);
    const last = el.querySelector<HTMLElement>('lr-tab[panel="last"]')!;
    last.hidden = true;
    await waitUntil(() => focusedTab(el) === 'first', 'focus returns to the selected visible tab');
    expect(el.active).to.equal('first');
    last.hidden = false;
    await waitUntil(() => tabNames(el).includes('last'), 'last tab returns');
    const outside = document.createElement('button');
    el.after(outside);
    try {
      await focusByKeyboard(outside);
      last.hidden = true;
      await waitUntil(() => !tabNames(el).includes('last'), 'visibility change settles');
      expect(document.activeElement === outside).to.equal(true);
    } finally {
      outside.remove();
    }
  });

  it('skips a leading hidden default and supports controlled selection when all descriptors are hidden', async () => {
    const el = await fixture<LyraTabGroup>(html`<lr-tab-group label="Files">
      <lr-tab panel="detail" hidden>Details</lr-tab><lr-tab panel="first">First</lr-tab>
      <lr-tab-panel name="detail">Details panel</lr-tab-panel><lr-tab-panel name="first">First panel</lr-tab-panel>
    </lr-tab-group>`);
    expect(el.active).to.equal('first');
    el.querySelector<HTMLElement>('lr-tab[panel="first"]')!.hidden = true;
    await waitUntil(() => buttons(el).length === 0, 'all hidden controls leave the strip');
    expect(el.active).to.equal('');
    expect(roving(el)).to.deep.equal([]);
    el.active = 'detail';
    await el.updateComplete;
    const panels = visiblePanels(el);
    expect(panels.map(panel => panel.querySelector('slot')!.name)).to.deep.equal(['detail']);
    expect(panels[0]!.getAttribute('aria-label')).to.equal('Details');
    expect(panels[0]!.hasAttribute('aria-labelledby')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[role="tablist"]')!.getClientRects().length).to.equal(0);
    await expect(el).to.be.accessible();
    const hidden = el.querySelector<HTMLElement>('lr-tab[panel="detail"]')!;
    hidden.hidden = false;
    await waitUntil(() => buttons(el).length === 1, 'selected descriptor returns');
    expect(roving(el)).to.deep.equal(['detail']);
    expect(panels[0]!.getAttribute('aria-labelledby')).to.equal(buttons(el)[0]!.id);
  });

  it('retains programmatic panel access when all other descriptors are disabled', async () => {
    const el = await fixture<LyraTabGroup>(html`<lr-tab-group label="Files">
      <lr-tab panel="locked" disabled>Locked</lr-tab><lr-tab panel="detail" hidden>Details</lr-tab>
      <lr-tab-panel name="locked">Locked panel</lr-tab-panel><lr-tab-panel name="detail">Details panel</lr-tab-panel>
    </lr-tab-group>`);
    el.show('detail');
    await el.updateComplete;
    expect(roving(el)).to.deep.equal([]);
    expect(el.focusTab('detail')).to.equal(false);
    expect(visiblePanels(el).map(panel => panel.querySelector('slot')!.name)).to.deep.equal(['detail']);
    el.show('locked');
    await el.updateComplete;
    expect(el.active).to.equal('detail');
  });
});
