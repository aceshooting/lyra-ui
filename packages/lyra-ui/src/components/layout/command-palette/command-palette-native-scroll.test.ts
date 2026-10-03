import { expect, fixture, html, waitUntil, oneEvent, nextFrame } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './command-palette.js';
import type { LyraCommandPalette, LyraCommand } from './command-palette.js';

describe('command palette native modal and result scrolling', () => {
  it('ignores revoked command records while retaining later selectable commands', async () => {
    const revoked = Proxy.revocable({ commandId: 'bad', label: 'Unavailable' }, {});
    revoked.revoke();
    const command: LyraCommand = { commandId: 'good', label: 'Available' };
    const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${[revoked.proxy, command]}></lr-command-palette>`);
    palette.openPalette();
    await palette.updateComplete;
    const options = palette.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="command"]');
    expect(options.length).to.equal(1);
    expect(options[0]!.textContent).to.contain('Available');
    const selected = oneEvent(palette, 'lr-select');
    options[0]!.click();
    expect((await selected as CustomEvent<{ command: LyraCommand }>).detail.command === command).to.equal(true);
  });

  for (const veto of [false, true]) {
    it(`${veto ? 'reopens' : 'dismisses'} an externally closed native carrier ${veto ? 'when close is vetoed' : 'through the public close event'}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div>
        <dialog><button>Existing modal</button></dialog>
        <lr-command-palette .commands=${[{ commandId: 'save', label: 'Save' }]}></lr-command-palette>
      </div>`);
      const outer = wrapper.querySelector<HTMLDialogElement>('dialog')!;
      const palette = wrapper.querySelector<LyraCommandPalette>('lr-command-palette')!;
      outer.showModal();
      try {
        palette.openPalette();
        await palette.updateComplete;
        const carrier = palette.shadowRoot!.querySelector<HTMLDialogElement>('dialog[data-native-modal-carrier]')!;
        await waitUntil(() => carrier.matches(':modal'));
        let reason: unknown;
        palette.addEventListener('lr-close-request', event => {
          reason = event.detail.reason;
          if (veto) event.preventDefault();
        });
        carrier.close();
        await waitUntil(() => reason === 'escape');
        if (veto) {
          await waitUntil(() => carrier.matches(':modal'));
          expect(palette.open).to.equal(true);
        } else {
          await waitUntil(() => !palette.open);
          expect(carrier.open).to.equal(false);
        }
        expect(outer.open).to.equal(true);
      } finally {
        palette.remove();
        outer.close();
      }
    });
  }

  it('keeps keyboard selection visible while coalescing actual result-list scroll events', async () => {
    const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette
      style="--lr-command-palette-list-max-block-size:120px"
      .commands=${Array.from({ length: 80 }, (_, index) => ({ commandId: `${index}`, label: `Command ${index}` }))}
    ></lr-command-palette>`);
    palette.openPalette();
    await palette.updateComplete;
    const list = palette.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;
    list.style.maxHeight = '120px';
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    for (let i = 0; i < 12; i += 1) await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => list.scrollTop > 0);
    await nextFrame();
    const active = palette.shadowRoot!.querySelector<HTMLElement>('[part="command"][aria-selected="true"]')!;
    const bounds = active.getBoundingClientRect();
    expect(bounds.bottom).to.be.at.most(list.getBoundingClientRect().bottom + 1);
    expect(bounds.top).to.be.at.least(list.getBoundingClientRect().top - 1);
    expect(input.getAttribute('aria-activedescendant')).to.equal(active.id);
  });
});
