import { expect, fixture, html } from '@open-wc/testing';
import type { LyraTabGroup } from './tab-group.class.js';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import '../segmented/segmented.js';
import type { LyraSegmented } from '../segmented/segmented.js';

const make = (): Promise<LyraTabGroup> =>
  fixture<LyraTabGroup>(html`<lr-tab-group>
    <lr-tab panel="a">A</lr-tab>
    <lr-tab panel="b">B</lr-tab>
    <lr-tab-panel name="a">A body</lr-tab-panel>
    <lr-tab-panel name="b">B body</lr-tab-panel>
  </lr-tab-group>`);

describe('tab-group and segmented emit timing', () => {
  it('reports a removed active tab only after the new tab is rendered selected', async () => {
    const el = await make();
    const seen: string[] = [];
    el.addEventListener('lr-tab-show', (event) => {
      const name = (event as CustomEvent<{ name: string }>).detail.name;
      const selected = el.shadowRoot!.querySelector('[part~="tab"][aria-selected="true"]');
      seen.push(`${name}:${selected?.getAttribute('data-slot') ?? ''}`);
    });
    el.querySelector('lr-tab[panel="a"]')!.remove();
    await el.updateComplete;
    await el.updateComplete;
    expect(seen).to.deep.equal(['b:b']);
  });

  it('skips lr-tab-show when an lr-tab-hide listener moved the selection', async () => {
    const el = await make();
    let shows = 0;
    el.addEventListener('lr-tab-hide', () => { el.active = 'a'; }, { once: true });
    el.addEventListener('lr-tab-show', () => (shows += 1));
    el.show('b');
    expect(shows).to.equal(0);
  });

  it('does not report an activation to a detached tab group or segmented control', async () => {
    const group = await make();
    group.addEventListener('lr-tab-show', () => group.remove());
    let activations = 0;
    group.addEventListener('lr-activate', () => (activations += 1));
    group.shadowRoot!.querySelectorAll<HTMLElement>('[part~="tab"]')[1]!.click();
    expect(activations).to.equal(0);

    const seg = await fixture<LyraSegmented>(html`<lr-segmented
      value="a"
      .items=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
    ></lr-segmented>`);
    let segActivations = 0;
    seg.addEventListener('lr-change', () => seg.remove());
    seg.addEventListener('lr-activate', () => (segActivations += 1));
    seg.shadowRoot!.querySelectorAll<HTMLElement>('[part~="segment"]')[1]!.click();
    expect(segActivations).to.equal(0);
  });

  it('segmented neither cancels nor acts on composing or modified arrow keys', async () => {
    const seg = await fixture<LyraSegmented>(html`<lr-segmented
      value="a"
      .items=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
    ></lr-segmented>`);
    const first = seg.shadowRoot!.querySelector<HTMLElement>('[part="segment"]')!;
    for (const init of [{ keyCode: 229 }, { altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true, ...init });
      first.dispatchEvent(event);
      expect(event.defaultPrevented, JSON.stringify(init)).to.equal(false);
    }
    expect(seg.value).to.equal('a');
  });
});

it('drops a tab activation superseded by a show listener', async () => {
  const group = await make();
  const seen: string[] = [];
  group.addEventListener('lr-tab-show', () => { group.active = 'a'; });
  group.addEventListener('lr-activate', event => seen.push(event.detail.value));
  group.shadowRoot!.querySelector<HTMLElement>('[data-slot="b"]')!.click();
  expect(seen).to.deep.equal([]);
});

it('drops a segment activation superseded by a change listener', async () => {
  const seg = await fixture<LyraSegmented>(html`<lr-segmented value="a"
    .items=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}></lr-segmented>`);
  const seen: string[] = [];
  seg.addEventListener('lr-change', () => { seg.value = 'a'; });
  seg.addEventListener('lr-activate', event => seen.push(event.detail.value));
  seg.shadowRoot!.querySelector<HTMLElement>('[data-value="b"]')!.click();
  expect(seen).to.deep.equal([]);
});

it('identifies the group as the origin of its declared outgoing tab notification', async () => {
  const group = await make();
  const events: string[] = [];
  group.parentElement!.addEventListener('lr-tab-hide', event => {
    const { name } = (event as CustomEvent<{ name: string }>).detail;
    events.push(`${(event.target as Element).localName}:${name}`);
  });
  group.show('b');
  expect(events).to.deep.equal(['lr-tab-group:a']);
});

it('abandons a pending switch when a hide listener removes the destination', async () => {
  const group = await make();
  const events: string[] = [];
  group.addEventListener('lr-tab-hide', () => group.querySelector('[panel="b"]')!.remove(), { once: true });
  group.addEventListener('lr-tab-show', event => events.push(event.detail.name));
  group.shadowRoot!.querySelector<HTMLElement>('[data-slot="b"]')!.click();
  expect(events).to.deep.equal([]);
});

it('abandons activation when a change listener replaces the item or disables the control', async () => {
  for (const invalidate of ['replace', 'disable']) {
    const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    const seg = await fixture<LyraSegmented>(html`<lr-segmented value="a" .items=${items}></lr-segmented>`);
    let activations = 0;
    seg.addEventListener('lr-activate', () => { activations++; });
    seg.addEventListener('lr-change', () => {
      if (invalidate === 'replace') seg.items = [{ value: 'b', label: 'Replacement' }];
      else seg.disabled = true;
    });
    seg.shadowRoot!.querySelector<HTMLElement>('[data-value="b"]')!.click();
    expect(activations).to.equal(0);
  }
});

for (const invalidate of ['rename', 'disable', 'inert'] as const) {
  it(`abandons both notifications after a hide listener changes the destination via ${invalidate}`, async () => {
    const group = await make();
    const destination = group.querySelector<HTMLElementTagNameMap['lr-tab']>('lr-tab[panel="b"]')!;
    group.addEventListener('lr-tab-hide', () => {
      if (invalidate === 'rename') destination.panel = 'new';
      if (invalidate === 'disable') destination.disabled = true;
      if (invalidate === 'inert') destination.inert = true;
    }, { once: true });
    const seen: string[] = [];
    group.addEventListener('lr-tab-show', event => seen.push(event.detail.name));
    group.addEventListener('lr-activate', event => seen.push(event.detail.value));
    group.shadowRoot!.querySelector<HTMLElement>('[data-slot="b"]')!.click();
    expect(seen).to.deep.equal([]);
  });
}

it('skips the self-corrected show when the hide listener removes the replacement tab', async () => {
  const group = await make();
  const shown: string[] = [];
  group.addEventListener('lr-tab-show', event => shown.push(event.detail.name));
  group.addEventListener('lr-tab-hide', () => group.querySelector('lr-tab[panel="b"]')!.remove(), { once: true });
  group.querySelector('lr-tab[panel="a"]')!.remove();
  await group.updateComplete;
  await group.updateComplete;
  expect(group.querySelectorAll('lr-tab').length).to.equal(0);
  expect(shown).to.deep.equal([]);
});

it('ignores a stale segment button after the caller updates the value before rendering', async () => {
  const seg = await fixture<LyraSegmented>(html`<lr-segmented value="a"
    .items=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}></lr-segmented>`);
  let activations = 0;
  seg.addEventListener('lr-activate', () => { activations++; });
  seg.value = 'b';
  seg.shadowRoot!.querySelector<HTMLElement>('[data-value="a"]')!.click();
  expect(activations).to.equal(0);
});
