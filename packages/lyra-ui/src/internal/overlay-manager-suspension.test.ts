import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { activateOverlay } from './overlay-manager.js';

async function surface(hidden: boolean) {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <button data-background>Background action</button>
    <section ?hidden=${hidden}><div data-panel tabindex="-1"><button>Overlay action</button></div></section>
  </div>`);
  const background = wrapper.querySelector<HTMLButtonElement>('[data-background]')!;
  const host = wrapper.querySelector('section')!;
  const panel = wrapper.querySelector<HTMLElement>('[data-panel]')!;
  const action = panel.querySelector('button')!;
  await focusByKeyboard(background);
  return { background, host, panel, action };
}

describe('explicit and rendered overlay suspension', () => {
  it('preserves explicit suspension across hidden and visible transitions until resume', async () => {
    const { background, host, panel, action } = await surface(true);
    const previousOverflow = document.documentElement.style.overflow;
    let escapes = 0;
    let backdrops = 0;
    const handle = activateOverlay({ host, panel: () => panel, suspendWhenUnrendered: true,
      lockScroll: true, onEscape: () => escapes++, onBackdrop: () => backdrops++ });
    try {
      handle.suspend();
      handle.suspend();
      for (let cycle = 0; cycle < 2; cycle++) {
        host.hidden = false;
        expect(handle.isTopmost()).to.equal(false);
        handle.focusInitial();
        expect(document.activeElement === background).to.equal(true);
        expect(handle.dismissBackdrop()).to.equal(false);
        expect(background.inert).to.equal(false);
        expect(document.documentElement.style.overflow).to.equal(previousOverflow);
        await sendKeys({ press: 'Escape' });
        expect(escapes).to.equal(0);
        expect(backdrops).to.equal(0);
        host.hidden = true;
        expect(handle.isTopmost()).to.equal(false);
      }
      host.hidden = false;
      expect(handle.isTopmost()).to.equal(false);
      handle.resume();
      expect(handle.isTopmost()).to.equal(true);
      expect(background.inert).to.equal(true);
      expect(document.documentElement.style.overflow).to.equal('hidden');
      handle.focusInitial();
      expect(document.activeElement === action).to.equal(true);
      await sendKeys({ press: 'Escape' });
      expect(escapes).to.equal(1);
      expect(handle.dismissBackdrop()).to.equal(true);
      expect(backdrops).to.equal(1);
    } finally {
      handle.deactivate({ restoreFocus: false });
    }
    expect(background.inert).to.equal(false);
    expect(document.documentElement.style.overflow).to.equal(previousOverflow);
  });

  it('releases explicit suspension while hidden but waits for rendering before restoring ownership', async () => {
    const { background, host, panel } = await surface(false);
    const previousOverflow = document.documentElement.style.overflow;
    let escapes = 0;
    const handle = activateOverlay({ host, panel: () => panel, suspendWhenUnrendered: true,
      lockScroll: true, onEscape: () => escapes++ });
    try {
      expect(handle.isTopmost()).to.equal(true);
      handle.suspend();
      host.hidden = true;
      expect(handle.isTopmost()).to.equal(false);
      handle.resume();
      expect(handle.isTopmost()).to.equal(false);
      expect(background.inert).to.equal(false);
      expect(document.documentElement.style.overflow).to.equal(previousOverflow);
      await sendKeys({ press: 'Escape' });
      expect(escapes).to.equal(0);
      host.hidden = false;
      await waitUntil(() => handle.isTopmost(), 'the resumed overlay registers when rendered');
      expect(background.inert).to.equal(true);
      expect(document.documentElement.style.overflow).to.equal('hidden');
      await sendKeys({ press: 'Escape' });
      expect(escapes).to.equal(1);
    } finally {
      handle.deactivate({ restoreFocus: false });
    }
    expect(background.inert).to.equal(false);
    expect(document.documentElement.style.overflow).to.equal(previousOverflow);
  });
});
