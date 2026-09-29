import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../dialog/dialog.js';
import './dropdown.js';
import '../../layout/filter-bar/filter-bar.js';
import '../../layout/menu/dropdown-item.js';
import type { LyraDialog } from '../dialog/dialog.class.js';
import type { LyraDropdown } from './dropdown.class.js';
import type { LyraFilterBar, LyraFilterBarFilterDefinition } from '../../layout/filter-bar/filter-bar.class.js';

const filters: LyraFilterBarFilterDefinition[] = [{
  filterId: 'status', label: 'Status', type: 'checkbox-menu',
  options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }],
}];

for (const direction of ['ltr', 'rtl']) {
  for (const composed of [false, true]) {
    it(`anchors ${composed ? 'a checkbox filter' : 'a dropdown'} inside a wide ${direction} dialog without scrolling`, async () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      await setViewport({ width: 2560, height: 1440 });
      let dialog: LyraDialog | undefined;
      try {
        dialog = await fixture<LyraDialog>(html`
          <lr-dialog label="Filters" dir=${direction}
            style="--lr-dialog-width: 900px; --lr-dialog-height: 400px; --show-duration: 0ms; --hide-duration: 0ms;">
            ${composed ? html`<lr-filter-bar .filters=${filters}></lr-filter-bar>` : html`
              <lr-dropdown>
                <button slot="trigger">Status</button>
                <lr-dropdown-item type="checkbox" value="open">Open</lr-dropdown-item>
                <lr-dropdown-item type="checkbox" value="closed">Closed</lr-dropdown-item>
              </lr-dropdown>
            `}
          </lr-dialog>
        `);
        await dialog.show();
        const filter = dialog.querySelector<LyraFilterBar>('lr-filter-bar');
        if (filter) await filter.updateComplete;
        const dropdown = (filter?.shadowRoot ?? dialog).querySelector<LyraDropdown>('lr-dropdown')!;
        await dropdown.updateComplete;
        const trigger = dropdown.querySelector<HTMLElement>('[slot="trigger"]')!;
        const body = dialog.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
        const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
        const heading = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="heading"]')!;
        if (!composed) panel.style.overflow = 'hidden';
        const headingLeft = heading.getBoundingClientRect().left;
        await focusByKeyboard(trigger, dialog);
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => dropdown.open);
        const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
        await waitUntil(() => popup.style.left !== '' && popup.style.top !== '');
        const anchorRect = trigger.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        expect(getComputedStyle(popup).position).to.equal('absolute');
        expect(popupRect.top).to.be.closeTo(anchorRect.bottom + dropdown.distance, 2);
        expect(direction === 'rtl' ? popupRect.right : popupRect.left).to.be.closeTo(
          direction === 'rtl' ? anchorRect.right : anchorRect.left, 2,
        );
        const item = dropdown.querySelector<HTMLElement>('lr-dropdown-item')!;
        await waitUntil(() => item.matches(':focus-within'));
        expect(body.scrollLeft).to.equal(0);
        expect(panel.scrollLeft).to.equal(0);
        expect(heading.getBoundingClientRect().left).to.be.closeTo(headingLeft, 1);
        expect(body.scrollWidth).to.be.at.most(body.clientWidth + 1);
        expect(panel.scrollWidth).to.be.at.most(panel.clientWidth + 1);
      } finally {
        if (dialog?.open) await dialog.hide();
        await setViewport(viewport);
      }
    });
  }
}
