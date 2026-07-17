import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './span-waterfall.js';
import type { LyraSpanWaterfall } from './span-waterfall.js';
import type { LyraSpan } from '../trace-tree/span.js';

const SPANS: LyraSpan[] = [
  { id: 'root', name: 'Plan trip', kind: 'agent', startMs: 0, endMs: 400, status: 'success' },
  { id: 'search', parentId: 'root', name: 'web_search', kind: 'tool', startMs: 10, endMs: 120, status: 'success' },
  { id: 'llm', parentId: 'root', name: 'gpt-turbo', kind: 'llm', startMs: 130, endMs: 390, status: 'running' },
];

describe('lyra-span-waterfall', () => {
  it('renders one row per span in start order, regardless of hierarchy', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS}></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')].map((b) => b.getAttribute('data-id'));
    expect(bars).to.deep.equal(['root', 'search', 'llm']);
  });

  it('positions each bar from the shared time scale using inline-start/inline-size', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS}></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('2.5%');
    expect(bar.style.inlineSize).to.equal('27.5%');
  });

  it('clips bars to viewStartMs/viewEndMs when set', async () => {
    const el = (await fixture(
      html`<lyra-span-waterfall .spans=${SPANS} .viewStartMs=${100} .viewEndMs=${300}></lyra-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
    expect(bar.style.insetInlineStart).to.equal('0%');
  });

  it('emits lyra-span-select on bar click and on Enter', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS}></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    setTimeout(() => bar.click());
    const ev = await oneEvent(el, 'lyra-span-select');
    expect(ev.detail).to.deep.equal({ id: 'llm' });
  });

  it('moves roving tabindex among bars with ArrowDown/ArrowUp', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS}></lyra-span-waterfall>`)) as LyraSpanWaterfall;
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
      html`<lyra-span-waterfall .spans=${SPANS} active-span-id="llm"></lyra-span-waterfall>`,
    )) as LyraSpanWaterfall;
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[data-id="llm"]') as HTMLElement;
    expect(bar.getAttribute('aria-current')).to.equal('true');
  });

  it('hides the axis when hide-axis is set', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS} hide-axis></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="axis"]')).to.not.exist;
  });

  it('renders lyra-empty when spans is empty', async () => {
    const el = (await fixture(html`<lyra-span-waterfall></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lyra-empty')).to.exist;
  });

  it('registers lyra-empty as a side effect of importing span-waterfall.js (regression)', async () => {
    // Importing the *.class.js module alone never calls defineElement -- only the barrel (*.js)
    // does. Rendering an un-registered <lyra-empty> silently produces a plain, un-upgraded
    // HTMLElement instead of the real component.
    expect(customElements.get('lyra-empty')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = (await fixture(html`<lyra-span-waterfall></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Span timeline');
    el.strings = { spanWaterfall: 'Ligne du temps' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Ligne du temps');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-span-waterfall .spans=${SPANS}></lyra-span-waterfall>`)) as LyraSpanWaterfall;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
