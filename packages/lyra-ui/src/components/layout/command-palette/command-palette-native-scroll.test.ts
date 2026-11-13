import { expect, fixture, html, waitUntil, oneEvent, nextFrame } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
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

  it('keeps keyboard selection visible after actual result-list scrolling', async () => {
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

  it('coalesces a synchronous scroll burst while rendering the latest window and retaining the active descendant', async () => {
    const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette
      .commands=${Array.from({ length: 200 }, (_, index) => ({ commandId: `${index}`, label: `Command ${index}` }))}
    ></lr-command-palette>`);
    palette.openPalette();
    await palette.updateComplete;
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    await nextFrame(); await nextFrame();
    const list = palette.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;
    const activeId = input.getAttribute('aria-activedescendant');
    const originalFrame = window.requestAnimationFrame;
    let scheduled = 0;
    window.requestAnimationFrame = callback => { scheduled++; return originalFrame.call(window, callback); };
    try {
      for (const offset of [100, 400, 800, 1200]) {
        list.scrollTop = offset;
        list.dispatchEvent(new Event('scroll'));
      }
      expect(scheduled).to.equal(1);
    } finally { window.requestAnimationFrame = originalFrame; }
    await nextFrame(); await nextFrame();
    await palette.updateComplete;
    const visible = [...palette.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="command"]')];
    const rect = list.getBoundingClientRect();
    const intersecting = visible.filter(option => {
      const bounds = option.getBoundingClientRect();
      return bounds.bottom > rect.top && bounds.top < rect.bottom;
    });
    expect(list.scrollTop).to.equal(1200);
    expect(intersecting.length).to.be.greaterThan(0);
    expect(intersecting.some(option => option.textContent!.includes('Command 0'))).to.equal(false);
    expect(visible.length).to.be.lessThan(50);
    expect(input.getAttribute('aria-activedescendant')).to.equal(activeId);
    expect(visible.filter(option => option.id === activeId).length).to.equal(1);
    expect(palette.shadowRoot!.activeElement === input).to.equal(true);
  });

  it('keeps a late scroll event after detachment from taking focus and remains usable on reconnect', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><button>Continue editing</button>
      <lr-command-palette .commands=${[{ commandId: 'save', label: 'Save' }]}></lr-command-palette>
    </div>`);
    const palette = wrapper.querySelector<LyraCommandPalette>('lr-command-palette')!;
    palette.openPalette(); await palette.updateComplete;
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    const list = palette.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;
    palette.remove();
    const outside = wrapper.querySelector<HTMLButtonElement>('button')!;
    await focusByKeyboard(outside);
    list.dispatchEvent(new Event('scroll'));
    await nextFrame(); await nextFrame();
    expect(document.activeElement === outside).to.equal(true);
    expect(document.documentElement.style.overflow).not.to.equal('hidden');
    wrapper.append(palette);
    await palette.updateComplete;
    await waitUntil(() => palette.shadowRoot!.activeElement === input);
    const selected = oneEvent(palette, 'lr-select');
    await sendKeys({ press: 'Enter' });
    expect((await selected as CustomEvent<{ command: LyraCommand }>).detail.command.commandId).to.equal('save');
    await palette.updateComplete;
    expect(palette.open).to.equal(false);
  });
});
