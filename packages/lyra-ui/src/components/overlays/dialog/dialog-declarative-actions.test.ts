import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-dialog.js';
import '../../lr-drawer.js';
import '../../lr-button.js';
import { LyraDialog, type LyraDialogCloseDetail, type LyraDialogHideDetail } from '../../lr-dialog.js';
import type { LyraDrawer } from '../../lr-drawer.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const FAST = '--lr-duration-base: 0ms';

describe('declarative dialog and drawer actions', () => {
  it('opens the dialog named by data-dialog="open <id>" through the cancelable show lifecycle', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="opener" data-dialog="open edit-user">Edit</button>
        <lr-dialog id="edit-user" label="Edit user" style=${FAST}>Body</lr-dialog>
      </div>
    `);
    const dialog = root.querySelector<LyraDialog>('lr-dialog')!;
    const opener = root.querySelector<HTMLButtonElement>('#opener')!;
    const shown = oneEvent(dialog, 'lr-show');
    opener.click();
    await shown;
    expect(dialog.open).to.equal(true);
    await dialog.updateComplete;
    expect(dialog.hasAttribute('open')).to.equal(true);
  });

  it('keeps the dialog closed when lr-show is vetoed', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button data-dialog="open veto-show">Open</button>
        <lr-dialog id="veto-show" label="Veto" style=${FAST}>Body</lr-dialog>
      </div>
    `);
    const dialog = root.querySelector<LyraDialog>('lr-dialog')!;
    dialog.addEventListener('lr-show', (event) => event.preventDefault());
    root.querySelector('button')!.click();
    expect(dialog.open).to.equal(false);
  });

  it('closes the owning dialog from data-dialog="close" with the close-action reason and the action as source', async () => {
    const dialog = await fixture<LyraDialog>(html`
      <lr-dialog open label="Edit user" style=${FAST}>
        Body
        <button slot="footer" data-dialog="close">Cancel</button>
      </lr-dialog>
    `);
    const action = dialog.querySelector('button')!;
    let source: Element | undefined;
    dialog.addEventListener('lr-hide', (event) => {
      source = (event as CustomEvent<LyraDialogHideDetail>).detail.source;
    });
    const closed = oneEvent(dialog, 'lr-close');
    action.click();
    const event = (await closed) as CustomEvent<LyraDialogCloseDetail>;
    expect(event.detail.reason).to.equal('close-action');
    expect(source === action, 'lr-hide names the activated action').to.equal(true);
    expect(dialog.open).to.equal(false);
  });

  it('respects a vetoed lr-close-request and a vetoed lr-hide', async () => {
    const dialog = await fixture<LyraDialog>(html`
      <lr-dialog open label="Veto" style=${FAST}>
        <button data-dialog="close">Close</button>
      </lr-dialog>
    `);
    const action = dialog.querySelector('button')!;
    const vetoRequest = (event: Event): void => event.preventDefault();
    dialog.addEventListener('lr-close-request', vetoRequest);
    action.click();
    expect(dialog.open, 'lr-close-request veto').to.equal(true);
    dialog.removeEventListener('lr-close-request', vetoRequest);
    dialog.addEventListener('lr-hide', (event) => event.preventDefault());
    action.click();
    expect(dialog.open, 'lr-hide veto').to.equal(true);
  });

  it('activates from the keyboard, because Enter on a button is a click', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <lr-button data-dialog="open keyboard-dialog">Open</lr-button>
        <lr-dialog id="keyboard-dialog" label="Keyboard" style=${FAST}>
          <button data-dialog="close">Close</button>
        </lr-dialog>
      </div>
    `);
    const dialog = root.querySelector<LyraDialog>('lr-dialog')!;
    const opener = root.querySelector<HTMLElement>('lr-button')!;
    await focusByKeyboard(opener);
    await sendKeys({ press: 'Enter' });
    expect(dialog.open, 'Enter on a custom button opens').to.equal(true);
    await dialog.updateComplete;
    const close = dialog.querySelector<HTMLButtonElement>('button')!;
    await focusByKeyboard(close);
    await sendKeys({ press: 'Space' });
    expect(dialog.open, 'Space on the close action closes').to.equal(false);
  });

  it('ignores disabled, aria-disabled and inert actions, and clicks whose default was prevented', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <div id="disabled" disabled data-dialog="open guarded">Disabled</div>
        <lr-button id="disabled-button" disabled data-dialog="open guarded">Disabled button</lr-button>
        <span id="aria" aria-disabled="true" data-dialog="open guarded">Aria disabled</span>
        <div inert><span id="inert" data-dialog="open guarded">Inert</span></div>
        <button id="prevented" data-dialog="open guarded">Prevented</button>
        <lr-dialog id="guarded" label="Guarded" style=${FAST}>
          <span id="close-disabled" aria-disabled="true" data-dialog="close">Close</span>
        </lr-dialog>
      </div>
    `);
    const dialog = root.querySelector<LyraDialog>('lr-dialog')!;
    for (const id of ['disabled', 'disabled-button', 'aria', 'inert']) {
      root.querySelector<HTMLElement>(`#${id}`)!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      expect(dialog.open, id).to.equal(false);
    }
    const prevented = root.querySelector<HTMLButtonElement>('#prevented')!;
    prevented.addEventListener('click', (event) => event.preventDefault());
    prevented.click();
    expect(dialog.open, 'prevented click').to.equal(false);

    await dialog.show();
    root.querySelector<HTMLElement>('#close-disabled')!.click();
    expect(dialog.open, 'aria-disabled close action').to.equal(true);
  });

  it('ignores an id that matches nothing, a non-dialog element, or an unknown command', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="missing" data-dialog="open no-such-dialog">Missing</button>
        <button id="not-dialog" data-dialog="open plain">Plain</button>
        <button id="no-id" data-dialog="open">No id</button>
        <button id="unknown" data-dialog="toggle target">Unknown</button>
        <div id="plain"></div>
        <lr-dialog id="target" label="Target" style=${FAST}>Body</lr-dialog>
      </div>
    `);
    const dialog = root.querySelector<LyraDialog>('lr-dialog')!;
    for (const id of ['missing', 'not-dialog', 'no-id', 'unknown']) {
      root.querySelector<HTMLButtonElement>(`#${id}`)!.click();
      expect(dialog.open, id).to.equal(false);
    }
  });

  it('lets a nested dialog consume its own close action without closing its parent', async () => {
    const outer = await fixture<LyraDialog>(html`
      <lr-dialog open label="Outer" style=${FAST}>
        <button id="open-inner" data-dialog="open inner">Open inner</button>
        <button id="close-outer" data-dialog="close">Close outer</button>
        <lr-dialog id="inner" label="Inner" style=${FAST}>
          <button id="close-inner" data-dialog="close">Close inner</button>
        </lr-dialog>
      </lr-dialog>
    `);
    const inner = outer.querySelector<LyraDialog>('#inner')!;
    outer.querySelector<HTMLButtonElement>('#open-inner')!.click();
    expect(inner.open).to.equal(true);
    await inner.updateComplete;
    const innerClosed = oneEvent(inner, 'lr-close');
    inner.querySelector<HTMLButtonElement>('#close-inner')!.click();
    await innerClosed;
    expect(inner.open).to.equal(false);
    expect(outer.open, 'the parent stays open').to.equal(true);
    outer.querySelector<HTMLButtonElement>('#close-outer')!.click();
    expect(outer.open).to.equal(false);
  });

  it('works inside shadow roots: a close action in a composed child and an opener scoped to its shadow root', async () => {
    const dialog = await fixture<LyraDialog>(html`
      <lr-dialog open label="Shadow" style=${FAST}><div id="host"></div></lr-dialog>
    `);
    const host = dialog.querySelector<HTMLElement>('#host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<button data-dialog="close">Close</button>';
    shadow.querySelector('button')!.click();
    expect(dialog.open, 'composed close action').to.equal(false);

    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const scope = wrapper.attachShadow({ mode: 'open' });
    scope.innerHTML = '<button data-dialog="open scoped">Open</button>';
    const scoped = document.createElement('lr-dialog') as LyraDialog;
    scoped.id = 'scoped';
    scoped.label = 'Scoped';
    scope.append(scoped);
    await scoped.updateComplete;
    scope.querySelector('button')!.click();
    expect(scoped.open, 'opener resolves the id inside its own shadow root').to.equal(true);
  });

  it('serves a dialog defined under another tag name', async () => {
    const name = 'acme-declarative-dialog';
    if (!customElements.get(name)) customElements.define(name, class extends LyraDialog {});
    const root = await fixture<HTMLElement>(html`<div><button data-dialog="open renamed">Open</button></div>`);
    const renamed = document.createElement(name) as LyraDialog;
    renamed.id = 'renamed';
    renamed.innerHTML = '<button data-dialog="close">Close</button>';
    root.append(renamed);
    await renamed.updateComplete;
    root.querySelector('button')!.click();
    expect(renamed.open).to.equal(true);
    await renamed.updateComplete;
    renamed.querySelector('button')!.click();
    expect(renamed.open).to.equal(false);
  });

  it('opens and closes a drawer through data-drawer, never through data-dialog', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="wrong" data-dialog="open filters">Wrong vocabulary</button>
        <button id="right" data-drawer="open filters">Filters</button>
        <lr-drawer id="filters" label="Filters" style=${FAST}>
          <button id="dialog-close" data-dialog="close">Wrong close</button>
          <button id="drawer-close" data-drawer="close">Done</button>
        </lr-drawer>
      </div>
    `);
    const drawer = root.querySelector<LyraDrawer>('lr-drawer')!;
    root.querySelector<HTMLButtonElement>('#wrong')!.click();
    expect(drawer.open, 'data-dialog does not address a drawer').to.equal(false);
    root.querySelector<HTMLButtonElement>('#right')!.click();
    expect(drawer.open).to.equal(true);
    await drawer.updateComplete;
    drawer.querySelector<HTMLButtonElement>('#dialog-close')!.click();
    expect(drawer.open, 'data-dialog="close" does not close a drawer').to.equal(true);
    const closed = oneEvent(drawer, 'lr-close');
    drawer.querySelector<HTMLButtonElement>('#drawer-close')!.click();
    const event = (await closed) as CustomEvent<LyraDialogCloseDetail>;
    expect(event.detail.reason).to.equal('close-action');
    expect(drawer.open).to.equal(false);
  });

  it('installs one document listener for every overlay and removes it with the last one', async () => {
    const added: EventListenerOrEventListenerObject[] = [];
    const removed: EventListenerOrEventListenerObject[] = [];
    const originalAdd = document.addEventListener;
    const originalRemove = document.removeEventListener;
    document.addEventListener = function (this: Document, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      if (type === 'click') added.push(listener);
      return originalAdd.call(this, type, listener, options);
    } as typeof document.addEventListener;
    document.removeEventListener = function (this: Document, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
      if (type === 'click') removed.push(listener);
      return originalRemove.call(this, type, listener, options);
    } as typeof document.removeEventListener;
    try {
      const dialog = document.createElement('lr-dialog');
      const drawer = document.createElement('lr-drawer');
      document.body.append(dialog, drawer);
      expect(added.length, 'one shared listener for both overlays').to.equal(1);
      // A synchronous reparent keeps the registration without reinstalling the listener.
      document.body.append(dialog);
      dialog.remove();
      expect(added.length, 'no reinstall').to.equal(1);
      expect(removed.length, 'still installed while the drawer is connected').to.equal(0);
      drawer.remove();
      expect(removed.length, 'removed with the last overlay').to.equal(1);
      expect(removed[0] === added[0], 'the same listener is removed').to.equal(true);
    } finally {
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
    }
  });
});
