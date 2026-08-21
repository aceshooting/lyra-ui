import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './highlight-layer.js';
import type { LyraHighlightLayer, HighlightLayerItem } from './highlight-layer.js';
import { styles } from './highlight-layer.styles.js';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';

const ITEMS: HighlightLayerItem[] = [
  { id: 'a', rects: [{ x: 10, y: 10, width: 20, height: 5 }], label: 'Zone A', tone: 'accent' },
  { id: 'b', rects: [{ x: 10, y: 20, width: 20, height: 5 }], tone: 'warning' },
];

function itemActions(el: LyraHighlightLayer): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-item-action]')];
}

describe('lr-highlight-layer', () => {
  it('omits non-finite, negative-size, and non-numeric public rectangles', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    el.items = [
      {
        id: 'unsafe',
        rects: [
          { x: Number.NaN, y: 0, width: 10, height: 10 },
          { x: 0, y: 0, width: -1, height: 10 },
          { x: '0;position:fixed', y: 0, width: 10, height: 10 } as unknown as HighlightLayerItem['rects'][number],
        ],
      },
      { id: 'safe', rects: [{ x: 10, y: 20, width: 30, height: 40 }] },
    ];
    await el.updateComplete;
    const rects = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="rect"]')];
    expect(rects.length).to.equal(1);
    expect(rects[0]!.dataset['id']).to.equal('safe');
    expect(rects[0]!.style.left).to.equal('10%');
    expect(rects[0]!.style.position).to.equal('');
  });

  it('defaults to empty items, active-highlight-id null, and interactive true', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    expect(el.items).to.deep.equal([]);
    expect(el.activeHighlightId).to.be.null;
    expect(el.interactive).to.be.true;
  });

  it('renders nothing when items is empty', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]') === null).to.be.true;
  });

  it('renders no paint or semantic subtree when every rectangle is invalid', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        aria-label="Ignored invalid overlay"
        .items=${[
          { id: 'empty', rects: [] },
          { id: 'negative', rects: [{ x: 1, y: 1, width: -2, height: 3 }] },
          { id: 'nan', rects: [{ x: Number.NaN, y: 1, width: 2, height: 3 }] },
        ]}
      ></lr-highlight-layer>
    `);
    expect(el.shadowRoot!.childElementCount).to.equal(0);
  });

  it('renders one rect per item at percent-of-box coordinates', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects).to.have.length(2);
    expect((rects[0] as HTMLElement).style.left).to.equal('10%');
    expect((rects[0] as HTMLElement).getAttribute('data-tone')).to.equal('accent');
  });

  it('keeps the Narrow320 story inside a narrower Storybook allocation', async () => {
    const { Narrow320 } = await import('./highlight-layer.stories.js');
    const allocation = await fixture<HTMLElement>(html`
      <div style="inline-size:256px; overflow:auto">
        ${Narrow320.render!({}, null as never)}
      </div>
    `);
    const figure = allocation.querySelector('figure') as HTMLElement;
    const backdrop = figure.querySelector('div') as HTMLElement;
    expect(allocation.scrollWidth).to.be.at.most(allocation.clientWidth);
    expect(figure.getBoundingClientRect().width).to.be.at.most(allocation.getBoundingClientRect().width);
    expect(backdrop.getBoundingClientRect().width).to.equal(figure.getBoundingClientRect().width);
  });

  it('lets component-scoped properties theme one highlight tone and flash state', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        style="
          --lr-highlight-layer-warning-background: rgb(1, 2, 3);
          --lr-highlight-layer-warning-outline: rgb(4, 5, 6);
          --lr-highlight-layer-flash-background: rgb(7, 8, 9);
        "
        .items=${[{ id: 'warning', tone: 'warning', rects: [{ x: 10, y: 10, width: 20, height: 5 }] }]}
      ></lr-highlight-layer>
    `);
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(getComputedStyle(rect).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(rect).outlineColor).to.equal('rgb(4, 5, 6)');
    el.flash('warning');
    await el.updateComplete;
    expect(getComputedStyle(rect).backgroundColor).to.equal('rgb(7, 8, 9)');
  });

  it('positions rects with physical left/top under dir="rtl" so they stay over non-mirroring content', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer dir="rtl" .items=${ITEMS}></lr-highlight-layer>`,
    );
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(rect.style.left).to.equal('10%');
    expect(rect.style.top).to.equal('10%');
    expect(rect.style.getPropertyValue('inset-inline-start')).to.equal('');
  });

  it('marks the matching item aria-current="true" when active-highlight-id is set', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer .items=${ITEMS} active-highlight-id="b"></lr-highlight-layer>`,
    );
    const targets = itemActions(el);
    expect(targets[0].getAttribute('aria-current')).to.equal('false');
    expect(targets[1].getAttribute('aria-current')).to.equal('true');
  });

  it('gives one multi-rect logical highlight one semantic roving target', async () => {
    const items: HighlightLayerItem[] = [
      {
        id: 'wrapped',
        label: 'Wrapped quote',
        rects: [
          { x: 10, y: 10, width: 20, height: 5 },
          { x: 10, y: 16, width: 30, height: 5 },
        ],
      },
      { id: 'next', rects: [{ x: 10, y: 30, width: 20, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${items}></lr-highlight-layer>
    `);
    const targets = itemActions(el);
    expect(targets).to.have.length(2);
    expect(targets.filter((target) => target.getAttribute('tabindex') === '0')).to.have.length(1);
    expect(el.shadowRoot!.querySelectorAll('[part="rect"]').length).to.equal(3);
  });

  it('retains the first unique nonempty item id before rendering and activation', async () => {
    const duplicates: HighlightLayerItem[] = [
      { id: '', label: 'Empty', rects: [{ x: 5, y: 1, width: 10, height: 5 }] },
      { id: ' same ', label: 'First', rects: [{ x: 5, y: 5, width: 10, height: 5 }] },
      { id: 'same', label: 'Second', rects: [{ x: 5, y: 20, width: 10, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${duplicates} active-highlight-id="same"></lr-highlight-layer>
    `);
    const targets = itemActions(el);
    expect(targets).to.have.length(1);
    expect(targets[0]!.getAttribute('aria-current')).to.equal('true');
    expect(targets[0]!.getAttribute('aria-label')).to.equal('Highlight: First');
    expect(el.items.map((item) => item.id)).to.deep.equal(['same']);

    const activated = oneEvent(el, 'lr-highlight-activate');
    targets[0]!.click();
    expect((await activated).detail).to.deep.equal({ highlightId: 'same' });
  });

  it('owns recursively frozen item snapshots at assignment', async () => {
    const source = [
      { id: 'owned', label: 'Before', rects: [{ x: 5, y: 5, width: 10, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${source}></lr-highlight-layer>
    `);

    source[0]!.label = 'After';
    source[0]!.rects[0]!.x = 95;
    source.push({ id: 'later', label: 'Later', rects: [] });

    expect(el.items).to.have.length(1);
    expect(el.items[0]!.label).to.equal('Before');
    expect(el.items[0]!.rects[0]!.x).to.equal(5);
    expect(Object.isFrozen(el.items)).to.be.true;
    expect(Object.isFrozen(el.items[0])).to.be.true;
    expect(Object.isFrozen(el.items[0]!.rects)).to.be.true;
    expect(Object.isFrozen(el.items[0]!.rects[0])).to.be.true;
  });

  it('bounds accepted items at 10,000, silently dropping the rest', async () => {
    // Empty rects keep each item's node footprint minimal, so the shared cross-component
    // collection-snapshot budget (a stricter, generic 50,000-node ceiling applied to every
    // `ownedCollectionProperties` entry before this component's own setter ever runs) does not
    // clip the list before snapshotItems()'s own 10,000-item cap gets a chance to.
    const many: HighlightLayerItem[] = Array.from({ length: 10_005 }, (_unused, index) => ({
      id: `item-${index}`,
      rects: [],
    }));
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    el.items = many;
    await el.updateComplete;
    expect(el.items).to.have.length(10_000);
    expect(el.items[9_999]!.id).to.equal('item-9999');
  });

  it('skips a record whose id accessor throws, without dropping later valid items', async () => {
    const poison = {} as HighlightLayerItem;
    Object.defineProperty(poison, 'id', {
      get(): string { throw new Error('boom'); },
    });
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    el.items = [poison, { id: 'safe', rects: [{ x: 10, y: 20, width: 30, height: 40 }] }];
    await el.updateComplete;
    expect(el.items).to.have.length(1);
    expect(el.items[0]!.id).to.equal('safe');
    expect(el.shadowRoot!.querySelectorAll('[part="rect"]')).to.have.length(1);
  });

  it('normalizes trimmed IDs while rejecting malformed, blank, and duplicate records', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    el.items = [
      null,
      [],
      { id: 3, rects: [] },
      { id: '   ', rects: [] },
      { id: '  stable  ', rects: [{ x: 1, y: 2, width: 3, height: 4 }] },
      { id: 'stable', rects: [{ x: 5, y: 6, width: 7, height: 8 }] },
    ] as unknown as HighlightLayerItem[];
    await el.updateComplete;

    expect(el.items).to.have.length(1);
    expect(el.items[0]!.id).to.equal('stable');
    expect(el.items[0]!.rects[0]!.x).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="rect"]')).to.have.length(1);
  });

  it('focuses an item whose public id contains selector metacharacters', async () => {
    const items: HighlightLayerItem[] = [
      { id: 'ordinary', rects: [{ x: 5, y: 5, width: 10, height: 5 }] },
      { id: 'quote\"]', rects: [{ x: 5, y: 20, width: 10, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${items}></lr-highlight-layer>
    `);
    const first = itemActions(el)[0]!;
    first.focus();
    let uncaught: unknown;
    const onError = (event: ErrorEvent): void => {
      uncaught = event.error;
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(uncaught).to.be.undefined;
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('quote"]');
  });

  it('names a labeled rect via highlightWithLabel and an unlabeled one via highlightOfTotal', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const targets = itemActions(el);
    expect(targets[0].getAttribute('aria-label')).to.equal('Highlight: Zone A');
    expect(targets[1].getAttribute('aria-label')).to.equal('Highlight 2 of 2');
  });

  it('renumbers action labels after filtering items with no rendered rectangles', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${[
        { id: 'empty', rects: [] },
        { id: 'visible-a', rects: [{ x: 1, y: 1, width: 2, height: 2 }] },
        { id: 'visible-b', rects: [{ x: 4, y: 4, width: 2, height: 2 }] },
      ]}></lr-highlight-layer>
    `);
    expect(itemActions(el).map((action) => action.getAttribute('aria-label')))
      .to.deep.equal(['Highlight 1 of 2', 'Highlight 2 of 2']);
  });

  it('emits lr-highlight-activate on rect click', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rect = itemActions(el)[1]!;
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    rect.click();
    expect((await eventPromise).detail).to.deep.equal({ highlightId: 'b' });
  });

  it('keeps secondary visual rects non-interactive when one logical item spans multiple rects', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        .items=${[{
          id: 'wrapped-quote',
          rects: [
            { x: 5, y: 5, width: 20, height: 4 },
            { x: 5, y: 12, width: 15, height: 4 },
          ],
        }]}
      ></lr-highlight-layer>
    `);

    expect(el.shadowRoot!.querySelectorAll('[part="rect"]')).to.have.length(2);
    const targets = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="rect-target"]');
    expect(targets).to.have.length(2);
    expect(itemActions(el)).to.have.length(1);
    expect(targets[0]!.getAttribute('role')).to.equal('button');
    expect(targets[0]!.getAttribute('aria-hidden')).to.equal(null);
    expect(targets[1]!.getAttribute('role')).to.equal(null);
    expect(targets[1]!.getAttribute('aria-hidden')).to.equal('true');
    expect(targets[1]!.hasAttribute('data-item-action')).to.be.false;
  });

  it('emits lr-highlight-activate on Enter/Space when a rect is focused', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rect = itemActions(el)[0]!;
    for (const key of ['Enter', ' ']) {
      const eventPromise = oneEvent(el, 'lr-highlight-activate');
      rect.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      expect((await eventPromise).detail).to.deep.equal({ highlightId: 'a' });
    }
  });

  it('is one roving tab stop: only one rect has tabindex="0"', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rects = itemActions(el);
    const zeroTab = rects.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroTab).to.have.length(1);
  });

  it('ArrowDown moves the roving tab stop to the next rect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const first = itemActions(el)[0]!;
    first.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const rects = itemActions(el);
    expect(rects[1].getAttribute('tabindex')).to.equal('0');
    expect(rects[0].getAttribute('tabindex')).to.equal('-1');
  });

  it('ArrowUp moves the roving tab stop back to the previous rect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const second = itemActions(el)[1]!;
    second.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;

    const rects = itemActions(el);
    expect(rects[0].getAttribute('tabindex')).to.equal('0');
    expect(rects[1].getAttribute('tabindex')).to.equal('-1');
  });

  it('Home/End jump the roving tab stop to the first/last rendered rect', async () => {
    const items: HighlightLayerItem[] = [
      ...ITEMS,
      { id: 'c', rects: [{ x: 10, y: 30, width: 20, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${items}></lr-highlight-layer>`);
    const first = itemActions(el)[0]!;
    first.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    let rects = itemActions(el);
    expect(rects[2]!.getAttribute('tabindex')).to.equal('0');
    expect(rects[0]!.getAttribute('tabindex')).to.equal('-1');

    rects[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await el.updateComplete;
    rects = itemActions(el);
    expect(rects[0]!.getAttribute('tabindex')).to.equal('0');
    expect(rects[2]!.getAttribute('tabindex')).to.equal('-1');
  });

  it('does not move the roving tab stop or preventDefault past the last/first rect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rects = itemActions(el);
    const last = rects[1]!; // already the last rendered rect
    last.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    const cancelled = !last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await el.updateComplete;
    expect(cancelled).to.equal(false);
    expect(itemActions(el)[1]!.getAttribute('tabindex')).to.equal('0');
    expect(itemActions(el)[0]!.getAttribute('tabindex')).to.equal('-1');
  });

  it('swaps ArrowLeft/ArrowRight semantics under inherited RTL for roving-tabindex navigation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl"><lr-highlight-layer .items=${ITEMS}></lr-highlight-layer></div>
    `);
    const el = wrapper.querySelector('lr-highlight-layer') as LyraHighlightLayer;
    await el.updateComplete;
    const first = itemActions(el)[0]!;
    first.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    // Under RTL, ArrowLeft is the "forward" (next) direction, mirroring ArrowDown under LTR.
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    const rects = itemActions(el);
    expect(rects[1]!.getAttribute('tabindex')).to.equal('0');
    expect(rects[0]!.getAttribute('tabindex')).to.equal('-1');

    rects[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const rectsAfter = itemActions(el);
    expect(rectsAfter[0]!.getAttribute('tabindex')).to.equal('0');
    expect(rectsAfter[1]!.getAttribute('tabindex')).to.equal('-1');
  });

  it('transfers focus to the nearest surviving target when focused items shrink', async () => {
    const items: HighlightLayerItem[] = [
      ...ITEMS,
      { id: 'c', rects: [{ x: 10, y: 30, width: 20, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${items}></lr-highlight-layer>
    `);
    const targets = itemActions(el);
    targets[2]!.focus();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('c');

    el.items = items.slice(0, 2);
    await el.updateComplete;
    const surviving = itemActions(el);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('b');
    expect(surviving.filter((target) => target.tabIndex === 0).map((target) => target.dataset.id)).to.deep.equal([
      'b',
    ]);
  });

  it('drops the roving cursor when a focused item is replaced by items with no renderable rects', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    itemActions(el)[1]!.focus();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('b');

    el.items = [{ id: 'empty', rects: [] }];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[data-item-action]')).to.have.length(0);
    expect(el.shadowRoot!.querySelectorAll('[part="rect"]')).to.have.length(0);
  });

  it('interactive=false removes role/tabindex from rects (pure paint)', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer .items=${ITEMS} .interactive=${false}></lr-highlight-layer>`,
    );
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part="rect-target"]') === null).to.be.true;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.be.false;
    expect(base.hasAttribute('aria-label')).to.be.false;
    expect(base.getAttribute('aria-hidden')).to.equal('true');
    expect(rect.hasAttribute('role')).to.be.false;
    expect(rect.hasAttribute('tabindex')).to.be.false;
  });

  it('interactive="false" (plain HTML attribute) also removes role/tabindex from rects', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer interactive="false" .items=${ITEMS}></lr-highlight-layer>`,
    );
    expect(el.interactive).to.be.false;
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part="rect-target"]') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('role')).to.be.false;
    expect(rect.hasAttribute('role')).to.be.false;
    expect(rect.hasAttribute('tabindex')).to.be.false;
  });

  it('flash(id) sets data-flash on the matching rect then clears it', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    el.flash('a');
    await el.updateComplete;
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects[0].hasAttribute('data-flash')).to.be.true;
    expect(rects[1].hasAttribute('data-flash')).to.be.false;
  });

  it('uses the computed flash animation duration for state cleanup', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        style="--lr-transition-ambient: 20ms linear"
        .items=${ITEMS}
      ></lr-highlight-layer>
    `);
    el.flash('a');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]') !== null).to.be.true;
    await new Promise((resolve) => setTimeout(resolve, 80));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]') === null).to.be.true;
  });

  it('clears flash state for a zero-duration reduced-motion equivalent', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        style="--lr-transition-ambient: 0ms linear"
        .items=${ITEMS}
      ></lr-highlight-layer>
    `);
    el.flash('a');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]') === null).to.be.true;
  });

  it('clears transient flash state when disconnected or when items are replaced', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    el.flash('a');
    await el.updateComplete;
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]') === null).to.be.true;

    el.flash('a');
    await el.updateComplete;
    el.items = ITEMS.map((item) => ({ ...item }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]') === null).to.be.true;
  });

  it('does not retain a flash requested while detached after reconnecting', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    const parent = el.parentElement!;
    el.remove();
    el.flash('a');
    parent.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-flash]').length).to.equal(0);
  });

  it('ignores missing IDs and supersedes a flash before its first render completes', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    el.flash('missing');
    el.flash('a');
    el.flash('b');
    await el.updateComplete;
    await Promise.resolve();

    const flashing = el.shadowRoot!.querySelector<HTMLElement>('[data-flash]');
    expect(flashing?.dataset.id).to.equal('b');
  });

  it('ignores an obsolete flash timer after a newer highlight starts flashing', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const handlers: Array<() => void> = [];
    window.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === 'function') handlers.push(handler);
      return 80 + handlers.length;
    }) as typeof window.setTimeout;
    window.clearTimeout = (() => undefined) as typeof window.clearTimeout;

    try {
      el.flash('a');
      await el.updateComplete;
      await Promise.resolve();
      const obsolete = handlers[0]!;

      el.flash('b');
      await el.updateComplete;
      await Promise.resolve();
      obsolete();
      await el.updateComplete;

      const flashing = el.shadowRoot!.querySelector<HTMLElement>('[data-flash]');
      expect(flashing?.dataset.id).to.equal('b');
    } finally {
      el.remove();
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    }
  });

  it('clears a flash when adopted into a connected document without a browsing context', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    const detachedDocument = document.implementation.createHTMLDocument('detached');
    el.remove();
    detachedDocument.adoptNode(el);
    detachedDocument.body.append(el);
    await el.updateComplete;

    el.flash('a');
    await el.updateComplete;
    await Promise.resolve();

    expect(el.shadowRoot!.querySelectorAll('[data-flash]')).to.have.length(0);
    el.remove();
  });

  it('resolves and cancels flash timing through the adopted owner window', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>
    `);
    el.remove();
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalGetComputedStyle = frameWindow.getComputedStyle;
    const originalSetTimeout = frameWindow.setTimeout;
    const originalClearTimeout = frameWindow.clearTimeout;
    const callbacks = new Map<number, TimerHandler>();
    const clears: number[] = [];
    let styleReads = 0;

    frameWindow.getComputedStyle = ((target: Element, pseudo?: string | null) => {
      styleReads += 1;
      return originalGetComputedStyle.call(frameWindow, target, pseudo);
    }) as typeof frameWindow.getComputedStyle;
    frameWindow.setTimeout = ((handler: TimerHandler) => {
      callbacks.set(71, handler);
      return 71;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) {
        clears.push(handle);
        callbacks.delete(handle);
      }
    }) as typeof frameWindow.clearTimeout;

    try {
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;
      el.flash('a');
      await el.updateComplete;
      await Promise.resolve();

      expect(styleReads).to.be.greaterThan(0);
      expect(callbacks.has(71)).to.be.true;

      document.adoptNode(el);
      expect(clears).to.deep.equal([71]);
      expect(callbacks.size).to.equal(0);
    } finally {
      el.remove();
      frameWindow.getComputedStyle = originalGetComputedStyle;
      frameWindow.setTimeout = originalSetTimeout;
      frameWindow.clearTimeout = originalClearTimeout;
      frame.remove();
    }
  });

  it('adds a transparent minimum pointer area around small percentage rects', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="position:relative; width:200px; height:200px">
        <lr-highlight-layer
          .items=${[{ id: 'small', rects: [{ x: 50, y: 50, width: 1, height: 1 }] }]}
        ></lr-highlight-layer>
      </div>
    `);
    const el = wrapper.querySelector('lr-highlight-layer') as LyraHighlightLayer;
    await el.updateComplete;
    const target = el.shadowRoot!.querySelector('[part="rect-target"]') as HTMLElement;
    const box = target.getBoundingClientRect();
    const hit = el.shadowRoot!.elementFromPoint(box.left + box.width / 2 + 15, box.top + box.height / 2);
    expect((hit as HTMLElement | null)?.dataset.id).to.equal('small');
  });

  it('moves adjacent logical highlights to non-overlapping minimum-size actions', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="position:relative; width:200px; height:200px">
        <lr-highlight-layer
          .items=${[
            { id: 'first', label: 'First', rects: [{ x: 50, y: 50, width: 1, height: 1 }] },
            { id: 'second', label: 'Second', rects: [{ x: 51, y: 50, width: 1, height: 1 }] },
          ]}
        ></lr-highlight-layer>
      </div>
    `);
    const el = wrapper.querySelector('lr-highlight-layer') as LyraHighlightLayer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="rect-target"]').length).to.equal(0);
    const actions = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="highlight-action"]')];
    expect(actions.length).to.equal(2);
    const first = actions[0]!.getBoundingClientRect();
    const second = actions[1]!.getBoundingClientRect();
    expect(first.bottom).to.be.at.most(second.top);
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    actions[1]!.click();
    expect((await eventPromise).detail).to.deep.equal({ highlightId: 'second' });
  });

  it('is accessible with items present', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    await expect(el).to.be.accessible();
  });

  it('resolves rect and group labels through a .strings override', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer
        aria-label="ignored-for-this-test"
        .items=${ITEMS}
        .strings=${{
          highlightWithLabel: 'Surlignage : {label}',
          highlightOfTotal: 'Surlignage {index} sur {total}',
          highlightLayerLabel: 'Calque de surlignage',
        }}
      ></lr-highlight-layer>
    `);
    const targets = itemActions(el);
    expect(targets[0].getAttribute('aria-label')).to.equal('Surlignage : Zone A');
    expect(targets[1].getAttribute('aria-label')).to.equal('Surlignage 2 sur 2');
  });

  it('resolves the group aria-label through a .strings override when no host aria-label is set', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS} .strings=${{ highlightLayerLabel: 'Calque de surlignage' }}></lr-highlight-layer>
    `);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Calque de surlignage');
  });

  it('retains an explicit empty group aria-label instead of falling back to the localized default', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer aria-label="" .items=${ITEMS}></lr-highlight-layer>`,
    );
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
  });

  it('gives an interactive rect a hover state matching its focus-visible affordance', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='rect-target'\]:hover/);
    expect(css).to.match(/\[part='highlight-action'\]:hover/);
  });
});

describe('highlight-layer animation timing', () => {
  it('pairs crossed duration and delay lists by animation index', () => {
    expect(maxPairedAnimationEndMs('flash, pulse', '1s, 100ms', '0ms, 2s')).to.equal(2100);
  });

  it('cycles shorter CSS lists and clamps negative paired totals to zero', () => {
    expect(maxPairedAnimationEndMs('a, b, c', '100ms, 200ms', '10ms, -250ms')).to.equal(110);
  });

  it('returns zero when animation-name is none', () => {
    expect(maxPairedAnimationEndMs('none', '1.8s', '1s')).to.equal(0);
  });

  it('treats unsupported and non-finite CSS time values as zero', () => {
    expect(maxPairedAnimationEndMs('flash', 'not-a-time', '10px')).to.equal(0);
    expect(maxPairedAnimationEndMs('flash', 'NaNms', 'Infinitys')).to.equal(0);
  });
});
