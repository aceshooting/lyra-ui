import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './highlight-layer.js';
import type { LyraHighlightLayer, HighlightLayerItem } from './highlight-layer.js';

const ITEMS: HighlightLayerItem[] = [
  { id: 'a', rects: [{ x: 10, y: 10, width: 20, height: 5 }], label: 'Zone A', tone: 'accent' },
  { id: 'b', rects: [{ x: 10, y: 20, width: 20, height: 5 }], tone: 'warning' },
];

describe('lyra-highlight-layer', () => {
  it('defaults to empty items, active-id null, and interactive true', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer></lyra-highlight-layer>`);
    expect(el.items).to.deep.equal([]);
    expect(el.activeId).to.be.null;
    expect(el.interactive).to.be.true;
  });

  it('renders nothing when items is empty', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer></lyra-highlight-layer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
  });

  it('renders one rect per item at percent-of-box coordinates', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects).to.have.length(2);
    expect((rects[0] as HTMLElement).style.left).to.equal('10%');
    expect((rects[0] as HTMLElement).getAttribute('data-tone')).to.equal('accent');
  });

  it('positions rects with physical left/top under dir="rtl" so they stay over non-mirroring content', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lyra-highlight-layer dir="rtl" .items=${ITEMS}></lyra-highlight-layer>`,
    );
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(rect.style.left).to.equal('10%');
    expect(rect.style.top).to.equal('10%');
    expect(rect.style.getPropertyValue('inset-inline-start')).to.equal('');
  });

  it('marks the matching item aria-current="true" when active-id is set', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lyra-highlight-layer .items=${ITEMS} active-id="b"></lyra-highlight-layer>`,
    );
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects[0].getAttribute('aria-current')).to.be.null;
    expect(rects[1].getAttribute('aria-current')).to.equal('true');
  });

  it('names a labeled rect via highlightWithLabel and an unlabeled one via highlightOfTotal', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects[0].getAttribute('aria-label')).to.equal('Highlight: Zone A');
    expect(rects[1].getAttribute('aria-label')).to.equal('Highlight 2 of 2');
  });

  it('emits lyra-highlight-activate on rect click', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const rect = el.shadowRoot!.querySelectorAll('[part="rect"]')[1] as HTMLElement;
    const eventPromise = oneEvent(el, 'lyra-highlight-activate');
    rect.click();
    expect((await eventPromise).detail).to.deep.equal({ id: 'b' });
  });

  it('emits lyra-highlight-activate on Enter/Space when a rect is focused', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    const eventPromise = oneEvent(el, 'lyra-highlight-activate');
    rect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((await eventPromise).detail).to.deep.equal({ id: 'a' });
  });

  it('is one roving tab stop: only one rect has tabindex="0"', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const rects = [...el.shadowRoot!.querySelectorAll('[part="rect"]')];
    const zeroTab = rects.filter((r) => r.getAttribute('tabindex') === '0');
    expect(zeroTab).to.have.length(1);
  });

  it('ArrowDown moves the roving tab stop to the next rect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    const first = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    first.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const rects = [...el.shadowRoot!.querySelectorAll('[part="rect"]')];
    expect(rects[1].getAttribute('tabindex')).to.equal('0');
    expect(rects[0].getAttribute('tabindex')).to.equal('-1');
  });

  it('interactive=false removes role/tabindex from rects (pure paint)', async () => {
    const el = await fixture<LyraHighlightLayer>(
      html`<lyra-highlight-layer .items=${ITEMS} .interactive=${false}></lyra-highlight-layer>`,
    );
    const rect = el.shadowRoot!.querySelector('[part="rect"]') as HTMLElement;
    expect(rect.hasAttribute('role')).to.be.false;
    expect(rect.hasAttribute('tabindex')).to.be.false;
  });

  it('flash(id) sets data-flash on the matching rect then clears it', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    el.flash('a');
    await el.updateComplete;
    const rects = el.shadowRoot!.querySelectorAll('[part="rect"]');
    expect(rects[0].hasAttribute('data-flash')).to.be.true;
    expect(rects[1].hasAttribute('data-flash')).to.be.false;
  });

  it('is accessible with items present', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lyra-highlight-layer .items=${ITEMS}></lyra-highlight-layer>`);
    await expect(el).to.be.accessible();
  });
});
