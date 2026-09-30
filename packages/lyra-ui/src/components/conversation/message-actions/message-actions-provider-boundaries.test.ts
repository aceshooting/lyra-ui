import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './message-actions.js';
import type { LyraMessageActions } from './message-actions.js';
import type { LyraToolbarAction } from './toolbar-actions.js';

async function toolbarWithProvider(actions: unknown): Promise<{ toolbar: LyraMessageActions; survivor: HTMLButtonElement }> {
  const toolbar = await fixture<LyraMessageActions>(html`<lr-message-actions .controls=${[]}>
    <div id="provider"></div><button id="survivor">Safe action</button>
  </lr-message-actions>`);
  const provider = toolbar.querySelector('#provider')!;
  Object.defineProperty(provider, 'getToolbarActions', { value: () => actions });
  provider.dispatchEvent(new CustomEvent('lr-toolbar-actions-change', { bubbles: true, composed: true }));
  const survivor = toolbar.querySelector<HTMLButtonElement>('#survivor')!;
  await aTimeout(0);
  await waitUntil(() => survivor.tabIndex === 0, 'the safe action remains the sequential tab stop');
  return { toolbar, survivor };
}

describe('message action provider boundaries', () => {
  it('ignores an uninspectable array and leaves a later native action available', async () => {
    const revocable = Proxy.revocable([], {});
    revocable.revoke();
    const { survivor } = await toolbarWithProvider(revocable.proxy);
    expect(survivor.disabled).to.equal(false);
    expect(survivor.tabIndex).to.equal(0);
  });

  it('rejects hostile action descriptors without reading accessors or losing another action', async () => {
    let reads = 0;
    const inaccessible = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('opaque action'); } });
    const inaccessiblePrototype = new Proxy({}, { getPrototypeOf() { throw new Error('opaque ancestry'); } });
    const accessor = { get id() { reads += 1; return 'unsafe'; } };
    const badDisabled = {
      id: 'disabled', focus() {}, setTabIndex() {}, matchesEventPath() { return false; },
      get disabled() { throw new Error('unavailable'); },
    };
    const { survivor } = await toolbarWithProvider([inaccessible, inaccessiblePrototype, accessor, badDisabled]);
    expect(reads).to.equal(0);
    expect(survivor.tabIndex).to.equal(0);
  });

  it('contains provider tab-index and release exceptions so a following native action still works', async () => {
    let sets = 0;
    let releases = 0;
    const throwing: LyraToolbarAction = {
      id: 'throwing', disabled: false,
      focus() { throw new Error('cannot focus'); },
      setTabIndex() { sets += 1; throw new Error('cannot lease'); },
      releaseTabIndex() { releases += 1; throw new Error('cannot release'); },
      matchesEventPath() { throw new Error('cannot inspect path'); },
    };
    const toolbar = await fixture<LyraMessageActions>(html`<lr-message-actions .controls=${[]}>
      <div id="provider"></div><button id="survivor">Safe action</button>
    </lr-message-actions>`);
    const provider = toolbar.querySelector('#provider')!;
    Object.defineProperty(provider, 'getToolbarActions', { value: () => [throwing] });
    provider.dispatchEvent(new CustomEvent('lr-toolbar-actions-change', { bubbles: true, composed: true }));
    await waitUntil(() => sets > 0, 'the provider is managed');
    const base = toolbar.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await focusByKeyboard(base);
    await sendKeys({ press: 'End' });
    const survivor = toolbar.querySelector<HTMLButtonElement>('#survivor')!;
    expect(document.activeElement === survivor).to.equal(true);
    expect(survivor.tabIndex).to.equal(0);
    provider.remove();
    await waitUntil(() => releases > 0, 'the failed provider lease is released');
    expect(survivor.tabIndex).to.equal(0);
  });
});
