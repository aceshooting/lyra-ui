import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './timeline.js';
import './timeline-item.js';
import type { LyraTimeline } from './timeline.js';
import { styles as timelineStyles } from './timeline.styles.js';
import { styles as itemStyles } from './timeline-item.styles.js';

it('renders with default orientation="vertical" and role="list" on [part="base"]', async () => {
  const el = (await fixture(html`<lyra-timeline></lyra-timeline>`)) as LyraTimeline;
  expect(el.orientation).to.equal('vertical');
  expect(el.hasAttribute('orientation')).to.be.false;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('list');
});

it('orientation="horizontal" reflects the attribute and the CSS rule driving --lyra-timeline-item-direction exists', async () => {
  const el = (await fixture(html`<lyra-timeline orientation="horizontal"></lyra-timeline>`)) as LyraTimeline;
  expect(el.getAttribute('orientation')).to.equal('horizontal');
  const css = timelineStyles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:host\(\[orientation='horizontal'\]\)\s*\{[^}]*--lyra-timeline-item-direction:\s*column/,
  );
});

it('resolves the accessible name to the localized "Timeline" by default', async () => {
  const el = (await fixture(html`<lyra-timeline></lyra-timeline>`)) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Timeline');
});

it('a host aria-label overrides the localized default', async () => {
  const el = (await fixture(html`<lyra-timeline aria-label="Deployment history"></lyra-timeline>`)) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Deployment history');
});

it('honors a .strings override for the timeline key', async () => {
  const el = (await fixture(
    html`<lyra-timeline .strings=${{ timeline: 'Chronologie' }}></lyra-timeline>`,
  )) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Chronologie');
});

it('exposes a live itemCount reflecting the slotted children, including on later add/remove', async () => {
  const el = (await fixture(
    html`<lyra-timeline>
      <lyra-timeline-item>First</lyra-timeline-item>
      <lyra-timeline-item>Second</lyra-timeline-item>
    </lyra-timeline>`,
  )) as LyraTimeline;
  expect(el.itemCount).to.equal(2);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const third = document.createElement('lyra-timeline-item');
  third.textContent = 'Third';
  let changed = oneEvent(slot, 'slotchange');
  el.appendChild(third);
  await changed;
  await el.updateComplete;
  expect(el.itemCount).to.equal(3);

  changed = oneEvent(slot, 'slotchange');
  el.removeChild(third);
  await changed;
  await el.updateComplete;
  expect(el.itemCount).to.equal(2);
});

it('reports itemCount as 0 for an empty timeline', async () => {
  const el = (await fixture(html`<lyra-timeline></lyra-timeline>`)) as LyraTimeline;
  expect(el.itemCount).to.equal(0);
});

it('suppresses the trailing rail on the last item only, reacting to DOM changes with no JS coordination', async () => {
  const el = (await fixture(
    html`<lyra-timeline>
      <lyra-timeline-item>First</lyra-timeline-item>
      <lyra-timeline-item>Second</lyra-timeline-item>
      <lyra-timeline-item>Third</lyra-timeline-item>
    </lyra-timeline>`,
  )) as LyraTimeline;
  const items = Array.from(el.querySelectorAll('lyra-timeline-item'));
  const rails = items.map((item) => item.shadowRoot!.querySelector('[part="rail"]') as HTMLElement);

  expect(getComputedStyle(rails[0]!).visibility).to.equal('visible');
  expect(getComputedStyle(rails[1]!).visibility).to.equal('visible');
  expect(getComputedStyle(rails[2]!).visibility).to.equal('hidden');

  el.removeChild(items[2]!);
  await el.updateComplete;
  const newLastRail = items[1]!.shadowRoot!.querySelector('[part="rail"]') as HTMLElement;
  expect(getComputedStyle(newLastRail).visibility).to.equal('hidden');
});

it('is accessible with a realistic set of timeline items', async () => {
  const el = await fixture(html`
    <lyra-timeline>
      <lyra-timeline-item variant="success" .timestamp=${new Date()}>
        <span slot="icon">✅</span>
        Deployment succeeded
        <span slot="description">Version 3.4.0 shipped to production without incident.</span>
      </lyra-timeline-item>
      <lyra-timeline-item variant="brand" active>
        Running integration tests
        <span slot="description">See <a href="#log">the live log</a> for details.</span>
      </lyra-timeline-item>
      <lyra-timeline-item variant="neutral">Build started</lyra-timeline-item>
    </lyra-timeline>
  `);
  await expect(el).to.be.accessible();
});

it('uses only CSS logical properties in both stylesheets (no left/right/margin-*/padding-* physical properties)', () => {
  for (const styles of [timelineStyles, itemStyles]) {
    expect(styles.cssText).to.not.match(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
  }
});
