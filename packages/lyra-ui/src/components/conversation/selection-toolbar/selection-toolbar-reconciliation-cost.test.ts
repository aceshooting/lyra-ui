import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './selection-toolbar.js';
import type { LyraSelectionToolbar } from './selection-toolbar.js';

interface ToolbarAccess {
  actionButtons(): HTMLElement[];
  setRovingStops(buttons: HTMLElement[], index: number): void;
  syncRovingStops(index?: number): Promise<HTMLElement | undefined>;
}

function access(toolbar: LyraSelectionToolbar): ToolbarAccess {
  return toolbar as unknown as ToolbarAccess;
}

function restoreOwn(target: object, key: string, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else Reflect.deleteProperty(target, key);
}

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function populated(count: number): Promise<LyraSelectionToolbar> {
  const toolbar = await fixture<LyraSelectionToolbar>(html`<lr-selection-toolbar
    open text="Selected passage" .actions=${[]}
  >${Array.from({ length: count }, (_, index) => html`<button
    slot="actions" id=${`action-${index}`} type="button"
  >Action ${index}</button>`)}</lr-selection-toolbar>`);
  await aTimeout(0);
  await access(toolbar).syncRovingStops(0);
  await aTimeout(0);
  expect(access(toolbar).actionButtons().length).to.equal(count);
  expect([...toolbar.querySelectorAll('button')].filter((button) => button.tabIndex === 0).length).to.equal(1);
  return toolbar;
}

it('collects the current composed action snapshot once during a settled reconciliation', async () => {
  const toolbar = await populated(64);
  const own = Object.getOwnPropertyDescriptor(toolbar, 'actionButtons');
  const original = access(toolbar).actionButtons;
  let collections = 0;
  Object.defineProperty(toolbar, 'actionButtons', {
    configurable: true,
    value(): HTMLElement[] {
      collections++;
      return original.call(toolbar);
    },
  });
  try {
    const target = await access(toolbar).syncRovingStops(17);
    expect(target?.id).to.equal('action-17');
    expect([...toolbar.querySelectorAll('button')].filter((button) => button.tabIndex === 0).map((button) => button.id))
      .to.deep.equal(['action-17']);
    expect(collections, 'one post-await collection serves the synchronous reconciliation').to.equal(1);
  } finally {
    restoreOwn(toolbar, 'actionButtons', own);
  }
});

it('reconciles retained action leases with a linear number of catalog reads', async () => {
  const toolbar = await populated(128);
  const reversed = access(toolbar).actionButtons().reverse();
  let reads = 0;
  const observed = new Proxy(reversed, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  access(toolbar).setRovingStops(observed, 9);
  expect(reversed.filter((button) => button.tabIndex === 0).map((button) => button.id)).to.deep.equal(['action-118']);
  expect(reads, 'retained membership and ordered writes each inspect a bounded number of entries')
    .to.be.at.most(8 * reversed.length);
});

it('restores missing and explicit authored tabindex while preserving a later author override', async () => {
  const toolbar = await fixture<LyraSelectionToolbar>(html`<lr-selection-toolbar
    open text="Selected passage" .actions=${[]}
  ><button slot="actions" id="implicit">Implicit</button>
    <button slot="actions" id="explicit" tabindex="5">Explicit</button>
    <button slot="actions" id="overridden" tabindex="3">Overridden</button>
    <button slot="actions" id="survivor">Survivor</button>
  </lr-selection-toolbar>`);
  await aTimeout(0);
  await access(toolbar).syncRovingStops(0);
  const [implicit, explicit, overridden, survivor] = [...toolbar.querySelectorAll('button')];
  overridden!.tabIndex = 7;
  implicit!.remove();
  explicit!.remove();
  overridden!.remove();
  await waitUntil(() => survivor!.tabIndex === 0);
  expect(implicit!.getAttribute('tabindex')).to.equal(null);
  expect(explicit!.getAttribute('tabindex')).to.equal('5');
  expect(overridden!.getAttribute('tabindex')).to.equal('7');
  expect(access(toolbar).actionButtons().map((button) => button.id)).to.deep.equal(['survivor']);
});

it('collects surviving actions after a deferred slotted root finishes updating', async () => {
  const toolbar = await fixture<LyraSelectionToolbar>(html`<lr-selection-toolbar
    open text="Selected passage" .actions=${[]}
  ><div slot="actions"><button id="removed">Removed</button><button id="disabled">Disabled</button>
    <button id="retained">Retained</button></div></lr-selection-toolbar>`);
  await aTimeout(0);
  await access(toolbar).syncRovingStops(0);
  const root = toolbar.querySelector('div')!;
  const removed = root.querySelector<HTMLButtonElement>('#removed')!;
  const disabled = root.querySelector<HTMLButtonElement>('#disabled')!;
  const pending = deferred();
  const own = Object.getOwnPropertyDescriptor(root, 'updateComplete');
  Object.defineProperty(root, 'updateComplete', { configurable: true, value: pending.promise });
  try {
    const oldRequest = access(toolbar).syncRovingStops(0);
    removed.remove();
    disabled.disabled = true;
    const replacement = document.createElement('button');
    replacement.id = 'replacement';
    replacement.textContent = 'Replacement';
    root.append(replacement);
    await aTimeout(0);
    pending.resolve();
    await oldRequest;
    await waitUntil(() => root.querySelector<HTMLButtonElement>('#retained')!.tabIndex === 0);
    expect(access(toolbar).actionButtons().map((button) => button.id)).to.deep.equal(['retained', 'replacement']);
    expect(removed.getAttribute('tabindex')).to.equal(null);
    expect(disabled.getAttribute('tabindex')).to.equal(null);
    expect(replacement.tabIndex).to.equal(-1);
  } finally {
    pending.resolve();
    restoreOwn(root, 'updateComplete', own);
  }
});

it('lets the newest pending reconciliation win and invalidates a disconnected request', async () => {
  const toolbar = await populated(3);
  const root = toolbar.querySelector('button')!;
  const own = Object.getOwnPropertyDescriptor(root, 'updateComplete');
  const pending = deferred();
  Object.defineProperty(root, 'updateComplete', { configurable: true, value: pending.promise });
  try {
    const older = access(toolbar).syncRovingStops(1);
    const newer = access(toolbar).syncRovingStops(2);
    pending.resolve();
    expect((await older)?.id).to.equal(undefined);
    expect((await newer)?.id).to.equal('action-2');
    expect([...toolbar.querySelectorAll('button')].map((button) => button.tabIndex)).to.deep.equal([-1, -1, 0]);

    const disconnected = access(toolbar).syncRovingStops(1);
    toolbar.remove();
    expect((await disconnected)?.id).to.equal(undefined);
    expect([...toolbar.querySelectorAll('button')].map((button) => button.getAttribute('tabindex')))
      .to.deep.equal([null, null, null]);
  } finally {
    pending.resolve();
    restoreOwn(root, 'updateComplete', own);
  }
});

it('rechecks ownership before keyboard focus after an action leaves the toolbar', async () => {
  const toolbar = await populated(2);
  const first = toolbar.querySelector<HTMLButtonElement>('#action-0')!;
  const second = toolbar.querySelector<HTMLButtonElement>('#action-1')!;
  const outside = document.createElement('div');
  document.body.append(outside);
  await focusByKeyboard(first);
  await aTimeout(0);
  const ownSync = Object.getOwnPropertyDescriptor(toolbar, 'syncRovingStops');
  const originalSync = access(toolbar).syncRovingStops;
  const ownFocus = Object.getOwnPropertyDescriptor(second, 'focus');
  const originalFocus = second.focus;
  let moved = false;
  let staleFocusCalls = 0;
  Object.defineProperty(second, 'focus', {
    configurable: true,
    value(options?: FocusOptions): void {
      staleFocusCalls++;
      originalFocus.call(second, options);
    },
  });
  Object.defineProperty(toolbar, 'syncRovingStops', {
    configurable: true,
    async value(index?: number): Promise<HTMLElement | undefined> {
      const target = await originalSync.call(toolbar, index);
      if (!moved && target === second) {
        moved = true;
        outside.append(second);
      }
      return target;
    },
  });
  try {
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => moved);
    await aTimeout(0);
    expect(second.isConnected).to.equal(true);
    expect(second.ownerDocument === toolbar.ownerDocument).to.equal(true);
    expect(staleFocusCalls).to.equal(0);
    expect(document.activeElement === first).to.equal(true);
    expect(access(toolbar).actionButtons().map((button) => button.id)).to.deep.equal(['action-0']);
  } finally {
    restoreOwn(toolbar, 'syncRovingStops', ownSync);
    restoreOwn(second, 'focus', ownFocus);
    outside.remove();
  }
});
