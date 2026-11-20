import { expect, fixture, html } from '@open-wc/testing';
import '../components/lr-time-range.js';
import '../components/lr-token-input.js';
import '../components/lr-reorder-list.js';
import '../components/lr-reorder-item.js';
import '../components/lr-tree.js';
import '../components/lr-zoomable-frame.js';
import type { LyraTimeRange } from '../components/lr-time-range.js';
import type { LyraTokenInput } from '../components/lr-token-input.js';
import type { LyraReorderList } from '../components/lr-reorder-list.js';
import type { LyraTree } from '../components/lr-tree.js';
import type { LyraTreeItem } from '../components/lr-tree-item.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';

expectDevWarning('lyra-tree-missing-accessible-name');

/** An application shortcut layer that owns every key in the capture phase. */
function claimKeys(): () => void {
  const claim = (event: Event): void => event.preventDefault();
  window.addEventListener('keydown', claim, { capture: true });
  return () => window.removeEventListener('keydown', claim, { capture: true });
}

function press(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init }));
}

describe('keys an earlier listener already claimed', () => {
  let release: (() => void) | undefined;
  afterEach(() => {
    release?.();
    release = undefined;
  });

  it('do not move a time-range handle', async () => {
    const el = await fixture<LyraTimeRange>(html`<lr-time-range min="0" max="10" start="2" end="8" step="1"></lr-time-range>`);
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="handle-start"]')!;
    release = claimKeys();
    press(handle, { key: 'ArrowRight' });
    await el.updateComplete;
    expect(el.start).to.equal(2);
  });

  it('do not remove a token from an empty token-input draft', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['alpha']}></lr-token-input>`);
    const input = el.shadowRoot!.querySelector('input')!;
    release = claimKeys();
    press(input, { key: 'Backspace' });
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha']);
  });

  it('do not remove a token on a modified Backspace', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['alpha']}></lr-token-input>`);
    press(el.shadowRoot!.querySelector('input')!, { key: 'Backspace', ctrlKey: true });
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha']);
  });

  it('do not reorder a reorder-list item', async () => {
    const el = await fixture<LyraReorderList>(html`<lr-reorder-list>
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
    </lr-reorder-list>`);
    const items = [...el.querySelectorAll<HTMLElement & { value: string; updateComplete: Promise<boolean> }>('lr-reorder-item')];
    await Promise.all(items.map((item) => item.updateComplete));
    let requests = 0;
    el.addEventListener('lr-reorder-request', () => (requests += 1));
    const up = items[1]!.shadowRoot!.querySelector<HTMLElement>('[part="move-up-button"]')!;
    release = claimKeys();
    press(up, { key: 'ArrowUp', ctrlKey: true });
    expect(requests).to.equal(0);
    expect([...el.querySelectorAll<HTMLElement & { value: string }>('lr-reorder-item')].map((item) => item.value))
      .to.deep.equal(['a', 'b']);
  });

  it('do not expand a tree node', async () => {
    const el = await fixture<LyraTree>(html`<lr-tree></lr-tree>`);
    el.data = [{ id: '1', label: 'Root', children: [{ id: '1.1', label: 'Child' }] }];
    await el.updateComplete;
    const root = el.querySelector('lr-tree-item') as unknown as LyraTreeItem;
    release = claimKeys();
    press(root, { key: 'ArrowRight' });
    await el.updateComplete;
    expect(root.expanded, 'claimed ArrowRight').to.equal(false);
  });

  it('do not zoom a zoomable-frame', async () => {
    const el = await fixture<HTMLElement & { updateComplete: Promise<boolean> }>(html`<lr-zoomable-frame srcdoc="<p>x</p>"></lr-zoomable-frame>`);
    let changes = 0;
    el.addEventListener('lr-zoom-change', () => (changes += 1));
    const controls = el.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
    release = claimKeys();
    press(controls, { key: '+' });
    await el.updateComplete;
    expect(changes).to.equal(0);
  });
});
