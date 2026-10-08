import { aTimeout, expect, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { toast } from './toaster.js';

const TOAST_TAG = 'lr-toast';
const TOAST_ITEM_TAG = 'lr-toast-item';

/** True once the browser has actually fetched a module whose URL ends with `suffix` -- the
 *  reliable proxy for "reached by the static import graph" under `@web/test-runner`'s unbundled
 *  ESM serving, where every distinct specifier is its own HTTP resource. */
function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

describe('toaster() lazy element loading', () => {
  it('never fetches the toast/toast-item class modules merely by importing the helper', () => {
    expect(
      fetchedModuleEnding('/toast.class.ts'),
      'importing toaster.js alone must not pull in toast.class.ts',
    ).to.equal(false);
    expect(
      fetchedModuleEnding('/toast-item.class.ts'),
      'importing toaster.js alone must not pull in toast-item.class.ts',
    ).to.equal(false);
    expect(customElements.get(TOAST_TAG), 'lr-toast must stay unregistered').to.equal(undefined);
    expect(customElements.get(TOAST_ITEM_TAG), 'lr-toast-item must stay unregistered').to.equal(undefined);
  });

  it('fetches and registers both elements once toast() actually runs, and dismiss() still resolves', async () => {
    const handle = toast('hello');
    const item = await handle.item;
    expect(fetchedModuleEnding('/toast.class.ts'), 'toast() must load toast.class.ts').to.equal(true);
    expect(fetchedModuleEnding('/toast-item.class.ts'), 'toast() must load toast-item.class.ts').to.equal(
      true,
    );
    expect(customElements.get(TOAST_TAG)).to.not.equal(undefined);
    expect(customElements.get(TOAST_ITEM_TAG)).to.not.equal(undefined);
    handle.dismiss();
    item.remove();
  });
});


describe('toast() failure containment and stacking', () => {
  it('contains a failed fire-and-forget toast() while its item promise still rejects', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const unhandled: unknown[] = [];
    const record = (event: PromiseRejectionEvent): void => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', record);
    try {
      const handle = toast({ message: 'Saved', ownerDocument: frame.contentDocument! });
      handle.dismiss();
      // wait-reason: asserting no unhandled rejection surfaces after dismissing a failed toast
      await aTimeout(50);
      expect(unhandled.length).to.equal(0);
      expect(await handle.item.then(() => 'resolved', () => 'rejected')).to.equal('rejected');
    } finally {
      window.removeEventListener('unhandledrejection', record);
      frame.remove();
    }
  });

  it('raises a toast above an already open lr-dialog so its action takes the pointer', async () => {
    await import('../dialog/dialog.js');
    const dialog = document.createElement('lr-dialog') as HTMLElement & { open: boolean; updateComplete: Promise<boolean> };
    dialog.setAttribute('label', 'Settings');
    dialog.open = true;
    document.body.append(dialog);
    try {
      await dialog.updateComplete;
      await waitUntil(() => dialog.matches(':popover-open'), 'the dialog never reached the top layer');
      const item = await toast({ message: 'Saved', action: { label: 'Undo', onClick: () => undefined } }).item;
      const action = item.querySelector('button')!;
      await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
      const box = action.getBoundingClientRect();
      expect(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === action).to.equal(true);
      item.remove();
    } finally {
      dialog.remove();
    }
  });
});

describe('toast() inside native modal dialogs', () => {
  const mounted: HTMLElement[] = [];
  afterEach(() => {
    for (const element of mounted.splice(0)) element.remove();
    for (const region of document.querySelectorAll(TOAST_TAG)) region.remove();
  });

  function modal(parent: HTMLElement | ShadowRoot = document.body): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<button>Native action</button>';
    parent.append(dialog);
    mounted.push(dialog);
    dialog.showModal();
    return dialog;
  }

  it('renders an actionable toast above a native modal and announces within its subtree', async () => {
    const dialog = modal();
    let invoked = false;
    const item = await toast({ message: 'Saved inside modal', action: {
      label: 'Undo', onClick: () => { invoked = true; },
    } }).item;
    await item.updateComplete;
    const action = item.querySelector<HTMLButtonElement>('button')!;
    expect(action !== null).to.equal(true);
    await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
    const bounds = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
    expect(invoked, 'the native pointer must reach the toast action').to.equal(true);
    expect(dialog.open).to.equal(true);
    await waitUntil(() => dialog.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('Saved inside modal') === true);
  });

  it('uses the most recently opened modal, even when DOM order is reversed, and recovers after close', async () => {
    const first = modal();
    const second = document.createElement('dialog');
    second.innerHTML = '<button>Second</button>';
    document.body.prepend(second);
    mounted.push(second);
    second.showModal();
    const topItem = await toast({ message: 'Top modal', duration: 0 }).item;
    expect(second.contains(topItem)).to.equal(true);
    second.close();
    await waitUntil(() => !topItem.isConnected, 'closed modal notifications must be discarded');
    const lowerItem = await toast({ message: 'Previous modal', duration: 0 }).item;
    expect(first.contains(lowerItem)).to.equal(true);
    first.close();
    const bodyItem = await toast({ message: 'Page again', duration: 0 }).item;
    expect(bodyItem.parentElement?.parentElement === document.body).to.equal(true);
  });

  it('finds a native modal inside an open shadow root', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    mounted.push(host);
    const dialog = modal(host.attachShadow({ mode: 'open' }));
    dialog.querySelector('button')!.blur();
    const item = await toast({ message: 'Shadow modal', duration: 0 }).item;
    expect(dialog.contains(item)).to.equal(true);
  });

  it('keeps toast actions and announcements in a Lyra modal carrier’s slotted light DOM', async () => {
    const native = modal();
    const { confirm } = await import('../dialog/confirm.js');
    const result = confirm({ title: 'Nested confirmation' });
    const dialog = document.querySelector('lr-dialog')!;
    mounted.push(dialog);
    await (dialog as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    let invoked = false;
    const item = await toast({ message: 'Nested status', action: {
      label: 'Undo', onClick: () => { invoked = true; },
    } }).item;
    expect(dialog.contains(item)).to.equal(true);
    expect(item.getRootNode() === document).to.equal(true);
    await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
    const action = item.querySelector<HTMLButtonElement>('button')!;
    const bounds = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
    expect(invoked).to.equal(true);
    await waitUntil(() => dialog.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('Nested status') === true);
    dialog.querySelector<HTMLButtonElement>('button[slot="footer"]')!.click();
    expect(await result).to.equal(false);
    expect(native.open).to.equal(true);
    await waitUntil(() => !item.isConnected);
  });


  it('starts a fresh toast region when the same native modal closes and immediately reopens', async () => {
    const dialog = modal();
    const oldItem = await toast({ message: 'Previous session', duration: 0 }).item;
    dialog.close();
    dialog.showModal();
    const freshItem = await toast({ message: 'Fresh session', duration: 0 }).item;
    await waitUntil(() => !oldItem.isConnected, 'the previous session item was removed');
    expect(oldItem.isConnected).to.equal(false);
    expect(freshItem.isConnected).to.equal(true);
    expect(dialog.contains(freshItem)).to.equal(true);
  });


  it('does not mistake retained focus in an older modal for the active modal', async () => {
    modal();
    const top = document.createElement('dialog');
    top.innerHTML = '<button>Current modal</button>';
    document.body.append(top);
    mounted.push(top);
    top.style.visibility = 'hidden';
    top.showModal();
    top.style.removeProperty('visibility');
    const item = await toast({ message: 'Current context', duration: 0 }).item;
    expect(top.contains(item)).to.equal(true);
  });


  it('keeps helper toasts interactive and announced inside mobile Page navigation', async () => {
    const native = modal();
    await import('../../layout/page/page.js');
    const page = document.createElement('lr-page');
    page.setAttribute('mobile-breakpoint', '10000px');
    page.style.inlineSize = '400px';
    page.innerHTML = '<button slot="navigation">Navigation action</button><button>Main content</button>';
    document.body.append(page);
    mounted.push(page);
    await waitUntil(() => page.view === 'mobile');
    page.navOpen = true;
    await page.updateComplete;
    await waitUntil(() => page.shadowRoot?.querySelector('dialog')?.matches(':modal') === true);
    let invoked = false;
    const item = await toast({ message: 'Navigation saved', action: {
      label: 'Undo navigation', onClick: () => { invoked = true; },
    } }).item;
    await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
    const action = item.querySelector<HTMLButtonElement>('button')!;
    const bounds = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
    expect(invoked, 'the helper action is inside the interactive navigation modal').to.equal(true);
    let reachedByKeyboard = false;
    for (let index = 0; index < 8; index += 1) {
      await sendKeys({ press: 'Tab' });
      reachedByKeyboard ||= deepActiveElementIn(document) === action;
    }
    expect(reachedByKeyboard, 'the modal Tab loop includes its toast action').to.equal(true);
    await waitUntil(() => page.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('Navigation saved') === true);
    page.navOpen = false;
    await page.updateComplete;
    await waitUntil(() => !item.isConnected);
    expect(native.open).to.equal(true);
  });


  it('keeps toasts outside an arbitrary shadow pane while sharing its floating modal focus loop', async () => {
    const native = modal();
    await import('../../layout/multi-split/multi-split.js');
    if (!customElements.get('helper-shadow-pane')) {
      customElements.define('helper-shadow-pane', class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML = '<button>Apply pane action</button>';
        }
      });
    }
    const split = document.createElement('lr-multi-split');
    split.setAttribute('collapse', 'start');
    split.style.cssText = 'inline-size:400px;block-size:240px';
    split.innerHTML = '<helper-shadow-pane aria-label="Tools"></helper-shadow-pane><div>Background</div>';
    document.body.append(split);
    mounted.push(split);
    await split.updateComplete;
    split.collapseState = 'floating';
    split.open = true;
    await split.updateComplete;
    await waitUntil(() => split.shadowRoot?.querySelector('dialog')?.matches(':modal') === true);
    const pane = split.querySelector('helper-shadow-pane')!;
    const paneAction = pane.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    let paneInvoked = false;
    paneAction.addEventListener('click', () => { paneInvoked = true; });
    const paneBounds = paneAction.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(paneBounds.x + paneBounds.width / 2), Math.round(paneBounds.y + paneBounds.height / 2)] });
    expect(paneInvoked, 'the authored shadow pane itself is rendered and interactive').to.equal(true);
    let invoked = false;
    const item = await toast({ message: 'Pane saved', action: {
      label: 'Undo pane action', onClick: () => { invoked = true; },
    } }).item;
    await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
    const action = item.querySelector<HTMLButtonElement>('button')!;
    const bounds = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
    expect(invoked, 'the helper remains rendered when the custom pane has no default slot').to.equal(true);
    expect(item.getRootNode() === document).to.equal(true);
    let reachedByKeyboard = false;
    for (let index = 0; index < 8; index += 1) {
      await sendKeys({ press: 'Tab' });
      reachedByKeyboard ||= deepActiveElementIn(document) === action;
    }
    expect(reachedByKeyboard, 'the floating modal Tab loop includes its auxiliary action').to.equal(true);
    await waitUntil(() => split.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('Pane saved') === true);
    split.open = false;
    await split.updateComplete;
    await waitUntil(() => !item.isConnected);
    expect(native.open).to.equal(true);
  });

});
