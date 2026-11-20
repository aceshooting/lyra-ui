import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-dropdown.js';
import '../../lr-dropdown-item.js';
import type { LyraDropdown } from './dropdown.class.js';

describe('lr-dropdown live sync changes', () => {
  it('re-syncs the open popup width when sync changes while open', async () => {
    const el = await fixture<LyraDropdown>(html`
      <lr-dropdown style="--show-duration: 0ms; --hide-duration: 0ms">
        <button slot="trigger" style="inline-size: 320px">Actions</button>
        <lr-dropdown-item>Rename</lr-dropdown-item>
      </lr-dropdown>
    `);
    const trigger = el.querySelector<HTMLButtonElement>('[slot="trigger"]')!;
    const shown = oneEvent(el, 'lr-after-show');
    void el.show();
    await shown;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    const triggerWidth = Math.round(trigger.getBoundingClientRect().width);
    expect(Math.round(popup.getBoundingClientRect().width)).to.not.equal(triggerWidth);

    el.sync = 'width';
    await el.updateComplete;

    await waitUntil(
      () => Math.round(popup.getBoundingClientRect().width) === triggerWidth,
      'the open popup adopts the trigger width',
    );
    const hidden = oneEvent(el, 'lr-after-hide');
    void el.hide();
    await hidden;
  });
});
