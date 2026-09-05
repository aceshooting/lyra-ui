import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './source-picker.js';
import type { LyraSourcePicker } from './source-picker.js';
import type { LyraInput } from '../../forms/input/input.js';

for (const focused of [false, true]) {
  it(`restores a visible tree entry when search is re-enabled (${focused ? 'focused' : 'outside focus'})`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button>Outside</button><lr-source-picker
      .sources=${[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]}
    ></lr-source-picker></div>`);
    const el = wrapper.querySelector<LyraSourcePicker>('lr-source-picker')!;
    await el.updateComplete;
    const search = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
    search.focus();
    await sendKeys({ type: 'Alpha' });
    await el.updateComplete;
    el.searchable = false;
    await el.updateComplete;
    const beta = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(row => row.textContent!.includes('Beta'))!;
    beta.click();
    beta.focus();
    await el.updateComplete;
    if (!focused) wrapper.querySelector('button')!.focus();
    el.searchable = true;
    await el.updateComplete;
    const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
    expect(rows.length).to.equal(1);
    expect(rows[0]!.tabIndex).to.equal(0);
    expect(el.selectedSourceIds).to.deep.equal(['b']);
    const restoredSearch = el.shadowRoot!.querySelector<LyraInput>('[part="search"]')!;
    expect(restoredSearch.value).to.equal('Alpha');
    if (focused) expect(el.shadowRoot!.activeElement === rows[0]).to.equal(true);
    else {
      expect(document.activeElement === wrapper.querySelector('button')).to.equal(true);
      restoredSearch.focus();
      await sendKeys({ press: 'Tab' });
      // Select-all remains in the tab order before the tree when enabled.
      if (el.shadowRoot!.activeElement !== rows[0]) await sendKeys({ press: 'Tab' });
      expect(el.shadowRoot!.activeElement === rows[0]).to.equal(true);
    }
  });
}
