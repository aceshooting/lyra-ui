import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './timeline.js';
import './timeline-item.js';
import type { LyraTimeline } from './timeline.js';
import { styles as timelineStyles } from './timeline.styles.js';
import { styles as itemStyles } from './timeline-item.styles.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

/** Two animation frames, long enough for the overflow controller's `ResizeObserver` callback to
 *  have landed on top of the synchronous measurement it already does in `hostUpdated()`. */
async function nextFrames(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

it('renders with default orientation="vertical" and role="list" on [part="base"]', async () => {
  const el = (await fixture(html`<lr-timeline></lr-timeline>`)) as LyraTimeline;
  expect(el.orientation).to.equal('vertical');
  expect(el.getAttribute('orientation')).to.equal('vertical');
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('list');
});

it('orientation="horizontal" reflects the attribute', async () => {
  const el = (await fixture(html`<lr-timeline orientation="horizontal"></lr-timeline>`)) as LyraTimeline;
  expect(el.getAttribute('orientation')).to.equal('horizontal');
});

it('normalizes invalid orientation attributes and property assignments to vertical', async () => {
  const el = (await fixture(html`<lr-timeline orientation="diagonal"></lr-timeline>`)) as LyraTimeline;
  expect(el.orientation).to.equal('vertical');
  expect(el.getAttribute('orientation')).to.equal('vertical');

  el.orientation = 'diagonal' as never;
  await el.updateComplete;
  expect(el.orientation).to.equal('vertical');
  expect(el.getAttribute('orientation')).to.equal('vertical');
});

it('reflects orientation and item variant when assigned as properties so CSS state follows', async () => {
  const el = (await fixture(
    html`<lr-timeline><lr-timeline-item>Only</lr-timeline-item></lr-timeline>`,
  )) as LyraTimeline;
  const item = el.querySelector('lr-timeline-item')!;

  el.orientation = 'horizontal';
  item.variant = 'danger';
  await Promise.all([el.updateComplete, item.updateComplete]);

  expect(el.getAttribute('orientation')).to.equal('horizontal');
  expect(item.getAttribute('variant')).to.equal('danger');
  expect(getComputedStyle(item.shadowRoot!.querySelector('[part="base"]') as HTMLElement).flexDirection).to.equal(
    'column',
  );
});

it('contains an unbroken title inside a 320px vertical allocation', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size: 320px">
      <lr-timeline>
        <lr-timeline-item>${'unbroken'.repeat(200)}</lr-timeline-item>
      </lr-timeline>
    </div>
  `);
  const timeline = wrapper.querySelector('lr-timeline') as HTMLElement;
  const item = wrapper.querySelector('lr-timeline-item') as HTMLElement;
  const title = item.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  expect(timeline.scrollWidth).to.be.at.most(320);
  expect(title.scrollWidth).to.be.at.most(title.clientWidth);
});

it('orientation="horizontal" actually reorients a slotted item -- marker above content, not beside it', async () => {
  const vertical = (await fixture(
    html`<lr-timeline><lr-timeline-item>Only</lr-timeline-item></lr-timeline>`,
  )) as LyraTimeline;
  const verticalItem = vertical.querySelector('lr-timeline-item')!;
  const verticalBase = verticalItem.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(verticalBase).flexDirection).to.equal('row');

  const horizontal = (await fixture(
    html`<lr-timeline orientation="horizontal"><lr-timeline-item>Only</lr-timeline-item></lr-timeline>`,
  )) as LyraTimeline;
  const horizontalItem = horizontal.querySelector('lr-timeline-item')!;
  const horizontalBase = horizontalItem.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(horizontalBase).flexDirection).to.equal('column');
});

it('never scrolls vertically in horizontal orientation -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar', async () => {
  const el = (await fixture(html`<lr-timeline orientation="horizontal"></lr-timeline>`)) as LyraTimeline;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).overflowY).to.equal('hidden');
});

it('adds a themeable edge fade to the horizontal scroll strip once it actually overflows', async () => {
  // Reads the real computed mask off the rendered [part="base"] instead of substring-matching
  // the exported stylesheet source, which would still pass even if the rule's selector never
  // actually matched (e.g. only applies once orientation="horizontal" is set).
  const el = (await fixture(html`
    <lr-timeline orientation="horizontal" style="display: block; max-inline-size: 90px">
      <lr-timeline-item style="flex: 0 0 200px">Deployed build 4821</lr-timeline-item>
      <lr-timeline-item style="flex: 0 0 200px">Rolled back to 4820</lr-timeline-item>
      <lr-timeline-item style="flex: 0 0 200px">Opened INC-3311</lr-timeline-item>
    </lr-timeline>
  `)) as LyraTimeline;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  await nextFrames();
  expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
  expect(getComputedStyle(el).getPropertyValue('--lr-scroll-fade-size').trim()).to.equal('2rem');
  expect(getComputedStyle(base).maskImage).to.contain('linear-gradient');

  el.style.setProperty('--lr-scroll-fade-size', '13px');
  expect(getComputedStyle(base).maskImage).to.contain('13px');
});

it('removes forced-colors masks while every scroll position remains visibly reachable in both directions', async () => {
  try {
    await setForcedColors('active');
    for (const direction of ['ltr', 'rtl'] as const) {
      const el = (await fixture(html`
        <lr-timeline
          dir=${direction}
          orientation="horizontal"
          style="display: block; max-inline-size: 90px"
        >
          <lr-timeline-item style="flex: 0 0 200px">Start</lr-timeline-item>
          <lr-timeline-item style="flex: 0 0 200px">Middle</lr-timeline-item>
          <lr-timeline-item style="flex: 0 0 200px">End</lr-timeline-item>
        </lr-timeline>
      `)) as LyraTimeline;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const items = Array.from(el.querySelectorAll<HTMLElement>('lr-timeline-item'));
      await nextFrames();

      const computed = getComputedStyle(base);
      expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
      expect(computed.maskImage).to.equal('none');
      expect(computed.webkitMaskImage).to.equal('none');
      expect(computed.overflowX).to.equal('auto');

      for (const item of items) {
        item.scrollIntoView({ block: 'nearest', inline: 'center' });
        await nextFrames();
        const viewport = base.getBoundingClientRect();
        const target = item.getBoundingClientRect();
        expect(target.right).to.be.greaterThan(viewport.left);
        expect(target.left).to.be.lessThan(viewport.right);
      }
    }
  } finally {
    await setForcedColors('none');
  }
});

it('leaves a horizontal strip that fits completely unmasked', async () => {
  // The regression this guards: the fade used to be painted unconditionally, dimming the first
  // and last item of a strip with nothing to scroll to.
  const el = (await fixture(
    html`<lr-timeline orientation="horizontal"><lr-timeline-item>Only</lr-timeline-item></lr-timeline>`,
  )) as LyraTimeline;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  await nextFrames();
  expect(base.scrollWidth - base.clientWidth).to.be.at.most(1);
  expect(getComputedStyle(base).maskImage).to.equal('none');
});

it('keeps the edge fade opaque when a consumer themes the shadow color translucent', async () => {
  // The regression this guards: the mask's opaque stops used to be var(--lr-color-shadow), a
  // documented consumer theming input. A mask reads alpha only, so a translucent shadow theme
  // dropped mask alpha across the whole strip rather than just its edges.
  const el = (await fixture(html`
    <lr-timeline
      orientation="horizontal"
      style="display: block; max-inline-size: 90px; --lr-theme-color-shadow: rgb(0 0 0 / 0.25)"
    >
      <lr-timeline-item style="flex: 0 0 200px">Deployed build 4821</lr-timeline-item>
      <lr-timeline-item style="flex: 0 0 200px">Rolled back to 4820</lr-timeline-item>
      <lr-timeline-item style="flex: 0 0 200px">Opened INC-3311</lr-timeline-item>
    </lr-timeline>
  `)) as LyraTimeline;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  await nextFrames();
  const mask = getComputedStyle(base).maskImage;
  expect(mask).to.contain('linear-gradient');
  expect(mask).to.not.contain('0.25');
});

it('resolves the accessible name to the localized "Timeline" by default', async () => {
  const el = (await fixture(html`<lr-timeline></lr-timeline>`)) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Timeline');
});

it('a host aria-label overrides the localized default', async () => {
  const el = (await fixture(html`<lr-timeline aria-label="Deployment history"></lr-timeline>`)) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Deployment history');
});

it('honors a .strings override for the timeline key', async () => {
  const el = (await fixture(
    html`<lr-timeline .strings=${{ timeline: 'Chronologie' }}></lr-timeline>`,
  )) as LyraTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Chronologie');
});

it('exposes a live itemCount reflecting the slotted children, including on later add/remove', async () => {
  const el = (await fixture(
    html`<lr-timeline>
      <lr-timeline-item>First</lr-timeline-item>
      <lr-timeline-item>Second</lr-timeline-item>
    </lr-timeline>`,
  )) as LyraTimeline;
  expect(el.itemCount).to.equal(2);

  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const third = document.createElement('lr-timeline-item');
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
  const el = (await fixture(html`<lr-timeline></lr-timeline>`)) as LyraTimeline;
  expect(el.itemCount).to.equal(0);
});

it('counts only slotted lr-timeline-item elements before and after slot changes', async () => {
  const el = (await fixture(
    html`<lr-timeline>
      <div>Unrelated default-slot element</div>
      <lr-timeline-item>Only event</lr-timeline-item>
    </lr-timeline>`,
  )) as LyraTimeline;
  expect(el.itemCount).to.equal(1);

  const unrelated = document.createElement('span');
  const slot = el.shadowRoot!.querySelector('slot') as HTMLSlotElement;
  const changed = oneEvent(slot, 'slotchange');
  el.append(unrelated);
  await changed;
  await el.updateComplete;
  expect(el.itemCount).to.equal(1);
});

it('suppresses the trailing rail on the last item only, reacting to DOM changes with no JS coordination', async () => {
  const el = (await fixture(
    html`<lr-timeline>
      <lr-timeline-item>First</lr-timeline-item>
      <lr-timeline-item>Second</lr-timeline-item>
      <lr-timeline-item>Third</lr-timeline-item>
    </lr-timeline>`,
  )) as LyraTimeline;
  const items = Array.from(el.querySelectorAll('lr-timeline-item'));
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
    <lr-timeline>
      <lr-timeline-item variant="success" .timestamp=${new Date()}>
        <span slot="icon">✅</span>
        Deployment succeeded
        <span slot="description">Version 3.4.0 shipped to production without incident.</span>
      </lr-timeline-item>
      <lr-timeline-item variant="brand" active>
        Running integration tests
        <span slot="description">See <a href="#log">the live log</a> for details.</span>
      </lr-timeline-item>
      <lr-timeline-item variant="neutral">Build started</lr-timeline-item>
    </lr-timeline>
  `);
  await expect(el).to.be.accessible();
});

it('uses only CSS logical properties in both stylesheets (no left/right/margin-*/padding-* physical properties)', () => {
  for (const styles of [timelineStyles, itemStyles]) {
    expect(styles.cssText).to.not.match(/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
  }
});
