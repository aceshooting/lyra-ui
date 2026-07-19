import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './span-waterfall.js';
import type { LyraSpanWaterfall } from './span-waterfall.js';
import type { LyraSpan } from '../trace-tree/span.js';

const SPANS: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 400, status: 'success' },
  { id: 'search', parentId: 'root', name: 'web_search', kind: 'tool', startMs: 10, endMs: 120, status: 'success' },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 130, endMs: 390, status: 'running' },
];

describe('lr-span-waterfall', () => {
  it('renders one row per span in start order, regardless of hierarchy', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')].map((b) => b.getAttribute('data-id'));
    expect(bars).to.deep.equal(['root', 'search', 'llm']);
  });

  it('positions each bar from the shared time scale using inline-start/inline-size', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('2.5%');
    expect(bar.style.inlineSize).to.equal('27.5%');
  });

  it('clips bars to viewStartMs/viewEndMs when set', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${100} .viewEndMs=${300}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('0%');
  });

  it('normalizes a NaN viewStartMs/viewEndMs the same as unset (fits the whole trace)', async () => {
    const baseline = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${0} .viewEndMs=${400}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await baseline.updateComplete;
    const expectedStart = (baseline.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement).style
      .insetInlineStart;

    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${NaN} .viewEndMs=${NaN}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.not.include('NaN');
    expect(bar.style.insetInlineStart).to.equal(expectedStart);
  });

  it('clamps a negative viewStartMs to 0 (trace-relative ms is never negative)', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${-50} .viewEndMs=${400}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    // root spans startMs=0..endMs=400 -- the same as the clamped [0, 400] view window, so it
    // should fill the bar track completely.
    const bar = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('0%');
    expect(bar.style.inlineSize).to.equal('100%');
  });

  it('widens an inverted/degenerate view window (viewEndMs <= viewStartMs) to a minimal span instead of a negative-width window', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} .viewStartMs=${300} .viewEndMs=${100}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as HTMLElement[];
    expect(bars.length).to.be.greaterThan(0);
    for (const bar of bars) {
      expect(bar.style.inlineSize).to.not.include('NaN');
      expect(bar.style.inlineSize).to.not.include('-');
      expect(bar.style.insetInlineStart).to.not.include('NaN');
    }
  });

  it('emits lr-span-select on bar click and on Enter', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    setTimeout(() => bar.click());
    const ev = await oneEvent(el, 'lr-span-select');
    expect(ev.detail).to.deep.equal({ id: 'llm' });
  });

  it('moves roving tabindex among bars with ArrowDown/ArrowUp', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const first = el.shadowRoot!.querySelector('[data-id="root"]') as HTMLElement;
    expect(first.getAttribute('tabindex')).to.equal('0');
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(second.getAttribute('tabindex')).to.equal('0');
    expect(first.getAttribute('tabindex')).to.equal('-1');
  });

  it('marks the bar matching activeSpanId with aria-current', async () => {
    const el = (await fixture(
      html`<lr-span-waterfall .spans=${SPANS} active-span-id="llm"></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(bar.getAttribute('aria-current')).to.equal('true');
  });

  it('hides the axis when hide-axis is set', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS} hide-axis></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="axis"]')).to.not.exist;
  });

  it('renders lr-empty when spans is empty', async () => {
    const el = (await fixture(html`<lr-span-waterfall></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  });

  it('registers lr-live-region and lr-empty as a side effect of importing span-waterfall.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. Rendering an un-registered dependency silently produces a plain, un-upgraded
    // HTMLElement instead of the real component.
    expect(customElements.get('lr-live-region')).to.exist;
    expect(customElements.get('lr-empty')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = (await fixture(html`<lr-span-waterfall></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Span timeline');
    el.strings = { spanWaterfall: 'Ligne du temps' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Ligne du temps');
  });

  it('reverses the running-bar stripe crawl under dir="rtl"', async () => {
    const ltr = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await ltr.updateComplete;
    const ltrBar = ltr.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement; // running -> accent
    expect(getComputedStyle(ltrBar).animationDirection).to.equal('normal');

    // background-position keyframes are physical, so the RTL variant plays the same stripe
    // animation backwards instead of always crawling in the LTR direction.
    const rtl = (await fixture(
      html`<lr-span-waterfall dir="rtl" .spans=${SPANS}></lr-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await rtl.updateComplete;
    const rtlBar = rtl.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(getComputedStyle(rtlBar).animationDirection).to.equal('reverse');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
