import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import type { LyraTabGroup } from './tab-group.class.js';

for (const outside of [false, true]) {
  it(`repairs removal of a manually focused unselected tab with outside focus=${outside}`, async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="outside">Outside</button>
      <lr-tab-group activation="manual">
        <lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab><lr-tab panel="c">C</lr-tab>
        <lr-tab-panel name="a">A panel</lr-tab-panel><lr-tab-panel name="b">B panel</lr-tab-panel><lr-tab-panel name="c">C panel</lr-tab-panel>
      </lr-tab-group></div>`);
    const group = root.querySelector<LyraTabGroup>('lr-tab-group')!;
    const first = group.shadowRoot!.querySelector<HTMLElement>('[part="tab"][data-slot="a"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    expect(group.shadowRoot!.activeElement?.getAttribute('data-slot')).to.equal('b');
    expect(group.active).to.equal('a');
    let changes = 0;
    group.addEventListener('lr-tab-show', () => changes++);
    group.addEventListener('lr-tab-hide', () => changes++);
    if (outside) root.querySelector<HTMLElement>('#outside')!.focus();
    group.querySelector('lr-tab[panel="b"]')!.remove();
    await waitUntil(() => group.shadowRoot!.querySelectorAll('[part="tab"]').length === 2);
    expect(group.active).to.equal('a');
    expect(changes).to.equal(0);
    if (outside) expect(document.activeElement?.id).to.equal('outside');
    else {
      expect(group.shadowRoot!.activeElement?.getAttribute('part')).to.equal('tab');
      expect(group.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
    }
  });
}
