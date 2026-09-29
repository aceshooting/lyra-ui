import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './dialog.js';
import '../drawer/drawer.js';
import type { LyraDialog } from './dialog.js';

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

describe('native modal interoperability', () => {
  for (const tag of ['lr-dialog', 'lr-drawer'] as const) {
    for (const shadow of [false, true]) {
      it(`${tag} outside a native modal ${shadow ? 'in a shadow root' : 'in the document'} accepts pointer, focus and Escape`, async () => {
        const wrapper = await fixture<HTMLElement>(html`<div></div>`);
        const nativeHost = document.createElement('div');
        wrapper.append(nativeHost);
        const scope = shadow ? nativeHost.attachShadow({ mode: 'open' }) : nativeHost;
        const native = document.createElement('dialog');
        const opener = document.createElement('button');
        opener.textContent = 'Open details';
        native.append(opener);
        scope.append(native);
        const overlay = document.createElement(tag) as LyraDialog;
        overlay.label = 'Details';
        overlay.style.cssText = '--show-duration: 0ms; --hide-duration: 0ms;';
        const action = document.createElement('button');
        action.textContent = 'Apply';
        overlay.append(action);
        wrapper.append(overlay);
        let clicks = 0;
        action.addEventListener('click', () => clicks++);
        opener.addEventListener('click', () => { void overlay.show(); });
        try {
          native.showModal();
          await click(opener);
          await waitUntil(() => overlay.open);
          await overlay.updateComplete;
          await click(action);
          expect(clicks, 'the visible overlay action receives the native pointer').to.equal(1);
          expect(deepActiveElement(document) === action, 'the overlay action receives focus').to.equal(true);
          expect(overlay.parentNode === wrapper, 'declarative host retains its parent').to.equal(true);
          await expect(overlay).to.be.accessible();
          await sendKeys({ press: 'Escape' });
          await waitUntil(() => !overlay.open, 'Escape closes the Lyra overlay');
          expect(native.open, 'Escape leaves the native parent open').to.equal(true);
          await waitUntil(() => deepActiveElement(document) === opener, 'focus returns to the native opener');
        } finally {
          overlay.remove();
          native.close();
        }
      });
    }
  }

  it('honors a hide veto while a native modal remains underneath', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><dialog><button>Open</button></dialog><lr-dialog label="Details">Content</lr-dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    const veto = (event: Event) => event.preventDefault();
    try {
      native.showModal();
      await overlay.show();
      overlay.addEventListener('lr-hide', veto);
      await sendKeys({ press: 'Escape' });
      expect(overlay.open).to.equal(true);
      expect(native.open).to.equal(true);
      overlay.removeEventListener('lr-hide', veto);
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !overlay.open);
      expect(native.open).to.equal(true);
    } finally {
      overlay.removeEventListener('lr-hide', veto);
      overlay.remove();
      native.close();
    }
  });

  it('keeps Escape on the carrier when initial focus is vetoed above a native modal', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><dialog><button>Native opener</button></dialog><lr-dialog label="Details"><button autofocus style="visibility:visible">Apply</button></lr-dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    const veto = (event: Event) => event.preventDefault();
    let initialFocusEvents = 0;
    overlay.addEventListener('lr-initial-focus', (event) => {
      initialFocusEvents++;
      veto(event);
    });
    try {
      native.showModal();
      await click(native.querySelector('button')!);
      await overlay.show();
      expect(initialFocusEvents).to.equal(1);
      expect(deepActiveElement(document) === overlay.querySelector('button'), 'native autofocus respects the veto').to.equal(false);
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !overlay.open);
      expect(native.open).to.equal(true);
    } finally {
      overlay.remove();
      native.close();
    }
  });

  it('lets a later native modal own pointer and Escape above an existing Lyra dialog', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><lr-dialog label="Details"><button>Lyra action</button></lr-dialog><dialog><button>Native action</button></dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    const action = native.querySelector('button')!;
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    try {
      await overlay.show();
      native.showModal();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await click(action);
      expect(clicks).to.equal(1);
      expect(deepActiveElement(document) === action).to.equal(true);
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !native.open);
      expect(overlay.open).to.equal(true);
    } finally {
      native.close();
      overlay.remove();
    }
  });

  it('keeps the ordinary path interactive when the Lyra host is inside the native modal', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><dialog><lr-dialog label="Details"><button>Apply</button></lr-dialog></dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    const action = overlay.querySelector('button')!;
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    try {
      native.showModal();
      await overlay.show();
      expect(overlay.matches(':popover-open')).to.equal(true);
      await click(action);
      expect(clicks).to.equal(1);
      expect(deepActiveElement(document) === action).to.equal(true);
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => !overlay.open);
      expect(native.open).to.equal(true);
    } finally {
      overlay.remove();
      native.close();
    }
  });

  it('keeps the native carrier interactive through an interrupted exit and reconnect', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><dialog><button>Native opener</button></dialog>
        <lr-dialog label="Details" style="--hide-duration: 120ms"><button>Apply</button></lr-dialog>
      </div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    const action = overlay.querySelector('button')!;
    let clicks = 0;
    action.addEventListener('click', () => clicks++);
    try {
      native.showModal();
      await overlay.show();
      const closing = overlay.hide();
      await overlay.updateComplete;
      const reopening = overlay.show();
      await Promise.all([closing, reopening]);
      expect(overlay.open).to.equal(true);
      await click(action);
      expect(clicks).to.equal(1);
      overlay.remove();
      wrapper.append(overlay);
      await overlay.updateComplete;
      await click(action);
      expect(clicks).to.equal(2);
      await overlay.hide();
      expect(overlay.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(0);
      expect(native.open).to.equal(true);
    } finally {
      overlay.remove();
      native.close();
    }
  });

  it('preserves an authored inert attribute on a later native modal', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><lr-dialog label="Details">Content</lr-dialog><dialog inert>Unavailable</dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    try {
      await overlay.show();
      native.showModal();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(native.inert).to.equal(true);
      native.close();
      await overlay.hide();
      expect(native.inert).to.equal(true);
    } finally {
      native.close();
      overlay.remove();
    }
  });

  it('preserves authored inertness on a Lyra host promoted above a native modal', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div><dialog>Native context</dialog><lr-dialog inert label="Unavailable"><button>Apply</button></lr-dialog></div>
    `);
    const native = wrapper.querySelector('dialog')!;
    const overlay = wrapper.querySelector('lr-dialog') as LyraDialog;
    let clicks = 0;
    overlay.querySelector('button')!.addEventListener('click', () => clicks++);
    try {
      native.showModal();
      await overlay.show();
      await click(overlay.querySelector('button')!);
      expect(clicks, 'an authored inert host does not become interactive').to.equal(0);
      expect(overlay.inert).to.equal(true);
      await overlay.hide();
      overlay.inert = false;
      await overlay.show();
      await click(overlay.querySelector('button')!);
      expect(clicks, 'removing authored inertness before reopening restores interaction').to.equal(1);
    } finally {
      overlay.remove();
      native.close();
    }
  });

});
