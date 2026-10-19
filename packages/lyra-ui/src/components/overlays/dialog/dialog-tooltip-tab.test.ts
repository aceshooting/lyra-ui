import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import './dialog.js';
import '../overlay/tooltip.js';
import '../overlay/popover.js';
import '../drawer/drawer.js';
import type { LyraDialog } from './dialog.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const ids = (dialog: LyraDialog) => ({
  a: dialog.querySelector<HTMLElement>('#a')!,
  b: dialog.querySelector<HTMLElement>('#b')!,
  c: dialog.querySelector<HTMLElement>('#c')!,
});

function inertWithin(dialog: LyraDialog): string[] {
  return [dialog.shadowRoot!, dialog].flatMap((root) =>
    Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => el.inert).map((el) => el.localName));
}

async function openDialog(popup: 'tooltip' | 'popover', tag = 'lr-dialog'): Promise<LyraDialog> {
  const popupTemplate = popup === 'tooltip'
    ? html`<lr-tooltip content="Hint"><button id="b" type="button">B</button></lr-tooltip>`
    : html`<lr-popover><button id="b" slot="trigger" type="button">B</button>Hint</lr-popover>`;
  const dialog = await fixture<LyraDialog>(`<${tag} label="Dialog" style="--lr-duration-base: 0ms">
    <input id="a" aria-label="A" /><span id="slot-b"></span><input id="c" aria-label="C" />
  </${tag}>`);
  render(popupTemplate, dialog.querySelector('#slot-b')!);
  await dialog.show();
  return dialog;
}

async function openPopup(host: HTMLElement & { open: boolean; show?: () => Promise<void> }, popup: string): Promise<void> {
  // A tooltip opens itself on keyboard focus after its show delay; a popover is opened explicitly.
  if (popup === 'popover') await host.show?.();
  await waitUntil(() => host.open, `the ${popup} is open`, { timeout: 3000 });
}

for (const tag of ['lr-dialog', 'lr-drawer']) for (const popup of ['tooltip', 'popover'] as const) {
  describe(`${tag} Tab with an open keyboard-focus ${popup}`, () => {
    it('moves focus to the next and previous control and never inerts dialog content', async () => {
      const dialog = await openDialog(popup, tag);
      try {
        const { a, b, c } = ids(dialog);
        await focusByKeyboard(b);
        const host = b.closest(`lr-${popup}`) as HTMLElement & { open: boolean };
        await openPopup(host, popup);
        expect(inertWithin(dialog)).to.deep.equal([]);
        await sendKeys({ press: 'Tab' });
        expect(deepActiveElement(document)?.id).to.equal('c');
        expect(inertWithin(dialog)).to.deep.equal([]);
        await focusByKeyboard(b);
        await openPopup(host, popup);
        await sendKeys({ press: 'Shift+Tab' });
        expect(deepActiveElement(document)?.id).to.equal('a');
        expect(a.inert || b.inert || c.inert).to.equal(false);
      } finally {
        await dialog.close('api');
      }
    });

    it('wraps from the last control to the first while the popup is open', async () => {
      const dialog = await openDialog(popup, tag);
      try {
        const { b, c } = ids(dialog);
        await focusByKeyboard(b);
        const host = b.closest(`lr-${popup}`) as HTMLElement & { open: boolean };
        await openPopup(host, popup);
        await sendKeys({ press: 'Tab' });
        expect(deepActiveElement(document)?.id).to.equal('c');
        await sendKeys({ press: 'Tab' });
        const active = deepActiveElement(document) as HTMLElement | null;
        expect(composedContains(dialog, active)).to.equal(true);
        expect(active === c).to.equal(false);
      } finally {
        await dialog.close('api');
      }
    });
  });
}
