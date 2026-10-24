import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './dialog.js';
import type { LyraDialog } from './dialog.class.js';

function panelName(el: LyraDialog): string {
  const panel = el.shadowRoot!.querySelector('[part~="panel"]')!;
  return panel.getAttribute('aria-label') ?? el.shadowRoot!
    .getElementById(panel.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? '';
}

describe('dialog content boundary contracts', () => {
  it('makes horizontal-only prose overflow keyboard reachable and removes the stop after content shrinks', async () => {
    const el = await fixture<LyraDialog>(html`
      <lr-dialog label="Wide content" without-close-button
        style="--lr-dialog-width: 300px; --lr-dialog-height: 250px; --lr-duration-base: 0ms">
        <div style="inline-size: 1800px; block-size: 20px">Wide non-interactive content</div>
      </lr-dialog>
    `);
    try {
      await el.show();
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
      expect(body.scrollHeight).to.be.at.most(body.clientHeight);
      expect(body.scrollWidth).to.be.greaterThan(body.clientWidth);
      await waitUntil(() => body.tabIndex === 0, 'horizontal overflow enters sequential focus order');
      await focusByKeyboard(body);
      expect(el.shadowRoot!.activeElement === body).to.equal(true);
      await expect(el).to.be.accessible();
      await sendKeys({ press: 'ArrowRight' });
      await waitUntil(() => body.scrollLeft > 0, 'the keyboard can reveal the wide content');
      const content = el.querySelector<HTMLElement>('div')!;
      content.textContent = 'X';
      content.style.inlineSize = '20px';
      await waitUntil(() => body.scrollWidth <= body.clientWidth && body.scrollHeight <= body.clientHeight,
        'short content fits in both dimensions');
      await waitUntil(() => body.tabIndex === -1, 'short content leaves sequential focus order');
    } finally {
      await el.hide();
    }
  });

  for (const referenced of [false, true]) {
    it(`falls back to its visible label when a ${referenced ? 'referenced' : 'direct'} heading becomes empty`, async () => {
      const el = await fixture<LyraDialog>(html`
        <lr-dialog label="Fallback title" style="--lr-duration-base: 0ms">
          ${referenced
            ? html`<h2 aria-labelledby="dialog-boundary-reference"><span id="dialog-boundary-reference">Referenced title</span></h2>`
            : html`<h2>Initial heading</h2>`}<p>Body content</p>
        </lr-dialog>
      `);
      try {
        const heading = el.querySelector('h2')!;
        const nameSource = referenced ? el.querySelector('span')! : heading;
        await el.show();
        await waitUntil(() => panelName(el) === (referenced ? 'Referenced title' : 'Initial heading'));
        nameSource.textContent = '  ';
        await waitUntil(() => panelName(el) === 'Fallback title', 'empty custom headings retain the authored fallback name');
        expect(el.shadowRoot!.querySelector('[part~="heading"]')?.textContent?.trim()).to.equal('Fallback title');
        nameSource.textContent = 'Restored heading';
        await waitUntil(() => panelName(el) === 'Restored heading',
          'restored content supplies the panel name again');
        await el.hide();
        nameSource.textContent = 'Next opening';
        await el.show();
        await waitUntil(() => panelName(el) === 'Next opening', 'reopening refreshes the current heading name');
      } finally {
        await el.hide();
      }
    });
  }

  for (const exclusion of ['hidden', 'inert', 'aria-hidden', 'display'] as const) {
    it(`keeps a ${exclusion} referenced heading excluded after opening and admits it after restoration`, async () => {
      const el = await fixture<LyraDialog>(html`
        <lr-dialog label="Fallback title" style="--lr-duration-base: 0ms">
          <h2 aria-labelledby="dialog-excluded-reference"><span id="dialog-excluded-reference">Excluded title</span></h2>
          <button>Action</button>
        </lr-dialog>
      `);
      const heading = el.querySelector('h2')!;
      if (exclusion === 'display') heading.style.display = 'none';
      else heading.setAttribute(exclusion, exclusion === 'aria-hidden' ? 'true' : '');
      try {
        await el.show();
        await el.updateComplete;
        expect(panelName(el)).to.equal('Fallback title');
        if (exclusion === 'display') heading.style.removeProperty('display');
        else heading.removeAttribute(exclusion);
        await waitUntil(() => panelName(el) === 'Excluded title', 'the restored heading becomes the accessible name');
      } finally {
        await el.hide();
      }
    });
  }

  it('honors nested external modal ownership acquired before opening and resumes only after both owners release', async () => {
    const el = await fixture<LyraDialog>(html`
      <lr-dialog label="Background dialog" style="--lr-duration-base: 0ms"><button>Dialog action</button></lr-dialog>
    `);
    el.modal.activateExternal();
    el.modal.activateExternal();
    try {
      await el.show();
      await sendKeys({ press: 'Escape' });
      await el.updateComplete;
      expect(el.open).to.equal(true);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      await el.updateComplete;
      await sendKeys({ press: 'Escape' });
      expect(el.open).to.equal(true);
      el.modal.deactivateExternal();
      await sendKeys({ press: 'Escape' });
      await el.updateComplete;
      expect(el.open).to.equal(true);
      el.modal.deactivateExternal();
      await waitUntil(() => document.activeElement === el.querySelector('button'), 'the released dialog regains initial focus');
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !el.open, 'Escape closes the dialog after both external owners release');
    } finally {
      el.modal.deactivateExternal();
      el.modal.deactivateExternal();
      await el.hide();
    }
  });
});
