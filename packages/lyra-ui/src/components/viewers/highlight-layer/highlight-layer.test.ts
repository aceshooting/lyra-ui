import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './highlight-layer.js';
import type { LyraHighlightLayer, HighlightLayerItem } from './highlight-layer.js';
import { styles } from './highlight-layer.styles.js';
import { maxPairedAnimationEndMs } from './highlight-layer-timing.js';

const ITEMS: HighlightLayerItem[] = [
  { id: 'a', rects: [{ x: 10, y: 10, width: 20, height: 5 }], label: 'Zone A', tone: 'accent' },
  { id: 'b', rects: [{ x: 10, y: 20, width: 20, height: 5 }], tone: 'warning' },
];

describe('lr-highlight-layer', () => {
  it('defaults to empty items, active-id null, and interactive true', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    expect(el.items).to.deep.equal([]);
    expect(el.activeId).to.be.null;
    expect(el.interactive).to.be.true;
  });

  it('renders nothing when items is empty', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
  });

  it('renders one rect per item at percent-of-box coordinates', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects).to.have.length(2);
    expect((rects[0] as HTMLElement).style.left).to.equal('10%');
    expect((rects[0] as HTMLElement).getAttribute('data-tone')).to.equal('accent');
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

  it('marks the matching item aria-current="true" when active-id is set', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer .items=${ITEMS} active-id="b"></lr-highlight-layer>`,
    );
    const targets = el.shadowRoot!.querySelectorAll('[part="rect-target"]');
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
    const targets = [...el.shadowRoot!.querySelectorAll('[part="rect-target"]')];
    expect(targets.filter((target) => target.getAttribute('role') === 'button')).to.have.length(2);
    expect(targets.filter((target) => target.getAttribute('tabindex') === '0')).to.have.length(1);
    expect(targets[1].getAttribute('aria-hidden')).to.equal('true');
    expect(targets[1].hasAttribute('tabindex')).to.be.false;
  });

  it('uses occurrence identity when duplicate public ids are supplied', async () => {
    const duplicates: HighlightLayerItem[] = [
      { id: 'same', label: 'First', rects: [{ x: 5, y: 5, width: 10, height: 5 }] },
      { id: 'same', label: 'Second', rects: [{ x: 5, y: 20, width: 10, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${duplicates} active-id="same"></lr-highlight-layer>
    `);
    let targets = [...el.shadowRoot!.querySelectorAll('[part="rect-target"]')] as HTMLElement[];
    expect(targets.map((target) => target.getAttribute('aria-current'))).to.deep.equal(['true', 'false']);
    targets[0]!.focus();
    targets[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    targets = [...el.shadowRoot!.querySelectorAll('[part="rect-target"]')] as HTMLElement[];
    expect(targets.map((target) => target.getAttribute('tabindex'))).to.deep.equal(['-1', '0']);
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('aria-label')).to.equal(
      'Highlight: Second',
    );
  });

  it('focuses an item whose public id contains selector metacharacters', async () => {
    const items: HighlightLayerItem[] = [
      { id: 'ordinary', rects: [{ x: 5, y: 5, width: 10, height: 5 }] },
      { id: 'quote\"]', rects: [{ x: 5, y: 20, width: 10, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${items}></lr-highlight-layer>
    `);
    const first = el.shadowRoot!.querySelector('[part="rect-target"]') as HTMLElement;
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
    const targets = el.shadowRoot!.querySelectorAll('[part="rect-target"]');
    expect(targets[0].getAttribute('aria-label')).to.equal('Highlight: Zone A');
    expect(targets[1].getAttribute('aria-label')).to.equal('Highlight 2 of 2');
  });

  it('emits lr-highlight-activate on rect click', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rect = el.shadowRoot!.querySelectorAll('[part="rect-target"]')[1] as HTMLElement;
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    rect.click();
    expect((await eventPromise).detail).to.deep.equal({ id: 'b' });
  });

  it('emits lr-highlight-activate on Enter/Space when a rect is focused', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rect = el.shadowRoot!.querySelector('[part="rect-target"]') as HTMLElement;
    const eventPromise = oneEvent(el, 'lr-highlight-activate');
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((await eventPromise).detail).to.deep.equal({ id: 'a' });
  });

  it('is one roving tab stop: only one rect has tabindex="0"', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const rects = [...el.shadowRoot!.querySelectorAll('[part="rect-target"]')];
    const zeroTab = rects.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroTab).to.have.length(1);
  });

  it('ArrowDown moves the roving tab stop to the next rect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const first = el.shadowRoot!.querySelector('[part="rect-target"]') as HTMLElement;
    first.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const rects = [...el.shadowRoot!.querySelectorAll('[part="rect-target"]')];
    expect(rects[1].getAttribute('tabindex')).to.equal('0');
    expect(rects[0].getAttribute('tabindex')).to.equal('-1');
  });

  it('transfers focus to the nearest surviving target when focused items shrink', async () => {
    const items: HighlightLayerItem[] = [
      ...ITEMS,
      { id: 'c', rects: [{ x: 10, y: 30, width: 20, height: 5 }] },
    ];
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${items}></lr-highlight-layer>
    `);
    const targets = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="rect-target"]')];
    targets[2]!.focus();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('c');

    el.items = items.slice(0, 2);
    await el.updateComplete;
    const surviving = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="rect-target"]')];
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('b');
    expect(surviving.filter((target) => target.tabIndex === 0).map((target) => target.dataset.id)).to.deep.equal([
      'b',
    ]);
  });

  it('interactive=false removes role/tabindex from rects (pure paint)', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer .items=${ITEMS} .interactive=${false}></lr-highlight-layer>`,
    );
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part="rect-target"]')).to.not.exist;
    expect(rect.hasAttribute('role')).to.be.false;
    expect(rect.hasAttribute('tabindex')).to.be.false;
  });

  it('interactive="false" (plain HTML attribute) also removes role/tabindex from rects', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lr-highlight-layer interactive="false" .items=${ITEMS}></lr-highlight-layer>`,
    );
    expect(el.interactive).to.be.false;
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(el.shadowRoot!.querySelector('[part="rect-target"]')).to.not.exist;
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
    expect(el.shadowRoot!.querySelector('[data-flash]')).to.exist;
    await new Promise((resolve) => setTimeout(resolve, 80));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]')).to.not.exist;
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
    expect(el.shadowRoot!.querySelector('[data-flash]')).to.not.exist;
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
    expect(el.shadowRoot!.querySelector('[data-flash]')).to.not.exist;

    el.flash('a');
    await el.updateComplete;
    el.items = ITEMS.map((item) => ({ ...item }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-flash]')).to.not.exist;
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
    expect((await eventPromise).detail).to.deep.equal({ id: 'second' });
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
    const targets = el.shadowRoot!.querySelectorAll('[part="rect-target"]');
    expect(targets[0].getAttribute('aria-label')).to.equal('Surlignage : Zone A');
    expect(targets[1].getAttribute('aria-label')).to.equal('Surlignage 2 sur 2');
  });

  it('resolves the group aria-label through a .strings override when no host aria-label is set', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS} .strings=${{ highlightLayerLabel: 'Calque de surlignage' }}></lr-highlight-layer>
    `);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Calque de surlignage');
  });

  it('gives an interactive rect a hover state matching its focus-visible affordance', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='rect-target'\]:hover/);
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
});
