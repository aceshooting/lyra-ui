import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import type { LyraResponsivePanel } from './responsive-panel.class.js';
import './responsive-panel.js';

async function clickAndCheckFocus(button: HTMLButtonElement): Promise<void> {
  let clicks = 0;
  const count = (): void => { clicks += 1; };
  button.addEventListener('click', count);
  try {
    const rect = button.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(clicks, 'pointer reaches the exposed action').to.equal(1);
    await focusByKeyboard(button, button.parentElement!);
    expect(deepActiveElement(button.ownerDocument) === button, 'the exposed action accepts keyboard focus').to.equal(true);
  } finally {
    button.removeEventListener('click', count);
  }
}

async function setup() {
  const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope>
    <dialog id="outer"><button>Original action</button></dialog>
    <div id="cover-parent"><dialog id="cover"><button>Cover action</button></dialog></div>
    <dialog id="replacement"><button>Replacement action</button></dialog>
    <lr-responsive-panel mode="overlay" label="Tools" style="inline-size:320px;block-size:240px;--lr-transition-base:0ms"><button>Panel action</button></lr-responsive-panel>
  </div>`);
  const outer = wrapper.querySelector<HTMLDialogElement>('#outer')!;
  const cover = wrapper.querySelector<HTMLDialogElement>('#cover')!;
  const replacement = wrapper.querySelector<HTMLDialogElement>('#replacement')!;
  const panel = wrapper.querySelector<LyraResponsivePanel>('lr-responsive-panel')!;
  const action = panel.querySelector<HTMLButtonElement>('button')!;
  const open = async (): Promise<HTMLDialogElement> => {
    panel.open = true;
    await panel.updateComplete;
    const carrier = panel.shadowRoot!.querySelector<HTMLDialogElement>('[data-native-modal-carrier]')!;
    await waitUntil(() => carrier.matches(':modal'));
    return carrier;
  };
  const cleanup = (): void => { panel.remove(); replacement.close(); cover.close(); outer.close(); };
  return { wrapper, outer, cover, replacement, panel, action, open, cleanup };
}

async function closeExternally(carrier: HTMLDialogElement): Promise<void> {
  const closed = oneEvent(carrier, 'close');
  carrier.close();
  await closed;
}

it('restores above an older surviving predecessor after the immediate predecessor disappears', async () => {
  const state = await setup();
  try {
    state.outer.showModal();
    state.cover.showModal();
    const carrier = await state.open();
    state.cover.remove();
    await closeExternally(carrier);
    await waitUntil(() => carrier.matches(':modal'));
    expect(state.panel.open).to.equal(true);
    expect(state.outer.matches(':modal')).to.equal(true);
    await clickAndCheckFocus(state.action);
  } finally { state.cleanup(); }
});

it('treats a predecessor closed and reopened in one task as a newer covering modal', async () => {
  const state = await setup();
  try {
    state.outer.showModal();
    const carrier = await state.open();
    state.outer.close();
    state.outer.showModal();
    await closeExternally(carrier);
    expect(state.panel.open).to.equal(true);
    await clickAndCheckFocus(state.outer.querySelector<HTMLButtonElement>('button')!);
    state.outer.close();
    await waitUntil(() => carrier.matches(':modal'));
    await clickAndCheckFocus(state.action);
  } finally { state.cleanup(); }
});

for (const operation of ['remove', 'adopt'] as const) {
  it(`resumes when the covering modal's ancestor is ${operation === 'remove' ? 'removed' : 'adopted into another document'}`, async () => {
    const state = await setup();
    let iframe: HTMLIFrameElement | undefined;
    try {
      if (operation === 'adopt') {
        iframe = document.createElement('iframe');
        const loaded = oneEvent(iframe, 'load');
        document.body.append(iframe);
        await loaded;
      }
      state.outer.showModal();
      const carrier = await state.open();
      state.cover.showModal();
      await closeExternally(carrier);
      await clickAndCheckFocus(state.cover.querySelector<HTMLButtonElement>('button')!);
      const ancestor = state.cover.parentElement!;
      if (operation === 'remove') ancestor.remove();
      else {
        const destination = iframe!.contentDocument!;
        destination.body.append(ancestor);
        expect(state.cover.ownerDocument === destination).to.equal(true);
      }
      await waitUntil(() => carrier.matches(':modal'));
      expect(state.panel.open).to.equal(true);
      await clickAndCheckFocus(state.action);
    } finally { state.cleanup(); iframe?.remove(); }
  });
}

for (const operation of ['hide', 'disconnect'] as const) {
  it(`does not recover a superseded activation after ${operation}`, async () => {
    const state = await setup();
    try {
      state.outer.showModal();
      const carrier = await state.open();
      state.cover.showModal();
      await closeExternally(carrier);
      await clickAndCheckFocus(state.cover.querySelector<HTMLButtonElement>('button')!);
      state.cover.close();
      if (operation === 'hide') {
        state.panel.open = false;
        await state.panel.updateComplete;
      } else state.panel.remove();
      // wait-reason: a superseded zero-delay recovery must remain canceled after native close delivery.
      await aTimeout(50);
      expect(carrier.matches(':modal'), 'the ended activation is not promoted again').to.equal(false);
      if (operation === 'hide') expect(state.panel.open).to.equal(false);
      else expect(state.panel.isConnected).to.equal(false);
      expect(state.panel.hasAttribute('data-native-modal-active')).to.equal(false);
      await clickAndCheckFocus(state.outer.querySelector<HTMLButtonElement>('button')!);
    } finally { state.cleanup(); }
  });
}

it('waits through unrelated updates and a replacement modal opened by the cover close handler', async () => {
  const state = await setup();
  try {
    state.outer.showModal();
    const carrier = await state.open();
    state.cover.showModal();
    await closeExternally(carrier);
    state.panel.label = 'Updated tools';
    await state.panel.updateComplete;
    expect(state.panel.open).to.equal(true);
    await clickAndCheckFocus(state.cover.querySelector<HTMLButtonElement>('button')!);
    state.cover.addEventListener('close', () => state.replacement.showModal(), { once: true });
    const closed = oneEvent(state.cover, 'close');
    state.cover.close();
    await closed;
    await clickAndCheckFocus(state.replacement.querySelector<HTMLButtonElement>('button')!);
    expect(state.panel.open).to.equal(true);
    state.replacement.close();
    await waitUntil(() => carrier.matches(':modal'));
    await clickAndCheckFocus(state.action);
  } finally { state.cleanup(); }
});
