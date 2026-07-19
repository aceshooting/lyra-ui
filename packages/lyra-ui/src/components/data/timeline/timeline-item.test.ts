import { fixture, fixtureSync, expect, html, oneEvent } from '@open-wc/testing';
import './timeline-item.js';
import type { LyraTimelineItem } from './timeline-item.js';
import type { LyraRelativeTime } from '../../utility/format/relative-time.js';
import { styles } from './timeline-item.styles.js';

it('sets role="listitem" on the host in connectedCallback, before first render', async () => {
  const el = fixtureSync<LyraTimelineItem>(html`<lr-timeline-item>Deployed</lr-timeline-item>`);
  // connectedCallback runs synchronously on upgrade/connect, before Lit's first update microtask.
  expect(el.getAttribute('role')).to.equal('listitem');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('listitem');
});

it('renders default-slot content as the title; an item with no default-slot content does not error', async () => {
  const el = (await fixture(html`<lr-timeline-item>Build started</lr-timeline-item>`)) as LyraTimelineItem;
  const title = el.shadowRoot!.querySelector('[part="title"]')!;
  expect((title.querySelector('slot') as HTMLSlotElement).assignedNodes({ flatten: true })[0]!.textContent).to.equal(
    'Build started',
  );

  const empty = await fixture(html`<lr-timeline-item></lr-timeline-item>`);
  expect(empty.shadowRoot!.querySelector('[part="title"]')).to.exist;
});

it('renders the default color-coded dot marker when the icon slot is empty', async () => {
  const el = (await fixture(html`<lr-timeline-item variant="success">Done</lr-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(iconSlot.assignedElements({ flatten: true })).to.have.length(0);
  expect(getComputedStyle(marker).getPropertyValue('--lr-timeline-marker-color').trim()).to.equal('#1a7f37');
});

it('shows only the slotted icon content once the icon slot is populated, at parse time and via a later slotchange', async () => {
  const el = (await fixture(
    html`<lr-timeline-item><span slot="icon">🚀</span>Launched</lr-timeline-item>`,
  )) as LyraTimelineItem;
  const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(iconSlot.assignedElements({ flatten: true })).to.have.length(1);

  const bare = (await fixture(html`<lr-timeline-item>No icon yet</lr-timeline-item>`)) as LyraTimelineItem;
  const bareSlot = bare.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(bareSlot.assignedElements({ flatten: true })).to.have.length(0);

  const icon = document.createElement('span');
  icon.setAttribute('slot', 'icon');
  icon.textContent = '🔔';
  const changed = oneEvent(bareSlot, 'slotchange');
  bare.appendChild(icon);
  await changed;
  await bare.updateComplete;
  expect(bareSlot.assignedElements({ flatten: true })).to.have.length(1);
});

it('renders the internal <lr-relative-time> fallback, wrapped in a <time> with the correct datetime/title, when timestamp is set and the slot is empty', async () => {
  const date = new Date('2024-06-15T12:00:00Z');
  const el = (await fixture(
    html`<lr-timeline-item .timestamp=${date}>Deployed</lr-timeline-item>`,
  )) as LyraTimelineItem;
  const time = el.shadowRoot!.querySelector('[part="timestamp"] time') as HTMLTimeElement;
  expect(time).to.exist;
  expect(time.getAttribute('datetime')).to.equal(date.toISOString());
  const expectedTitle = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date);
  expect(time.getAttribute('title')).to.equal(expectedTitle);
  const relative = time.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(relative).to.exist;
  expect(relative.date).to.equal(date);
  expect(el.shadowRoot!.querySelector('[part="timestamp"]')!.hasAttribute('hidden')).to.be.false;
});

it('hides [part="timestamp"] entirely when timestamp is an invalid/unparseable value, same as unset', async () => {
  const el = (await fixture(
    html`<lr-timeline-item .timestamp=${'not a real date'}>Deployed</lr-timeline-item>`,
  )) as LyraTimelineItem;
  const timestampPart = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(timestampPart.hidden).to.be.true;
  expect(timestampPart.querySelector('time')).to.not.exist;

  const unset = (await fixture(html`<lr-timeline-item>Deployed</lr-timeline-item>`)) as LyraTimelineItem;
  expect((unset.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).hidden).to.be.true;
});

it('the timestamp slot wins outright over the timestamp property -- the internal <lr-relative-time> fallback is not rendered at all when both are present', async () => {
  const el = (await fixture(html`
    <lr-timeline-item .timestamp=${new Date()}>
      Deployed
      <time slot="timestamp" datetime="2024-01-01">Jan 1</time>
    </lr-timeline-item>
  `)) as LyraTimelineItem;
  const timestampPart = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(timestampPart.hidden).to.be.false;
  expect(timestampPart.querySelector('lr-relative-time')).to.not.exist;
  const slot = timestampPart.querySelector('slot[name="timestamp"]') as HTMLSlotElement;
  expect(slot.assignedElements({ flatten: true })).to.have.length(1);
});

it('forwards sync to the internal <lr-relative-time>\'s own sync property', async () => {
  const syncEl = (await fixture(
    html`<lr-timeline-item .timestamp=${new Date()} sync>Deployed</lr-timeline-item>`,
  )) as LyraTimelineItem;
  const relative = syncEl.shadowRoot!.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(relative.sync).to.be.true;

  const noSyncEl = (await fixture(
    html`<lr-timeline-item .timestamp=${new Date()}>Deployed</lr-timeline-item>`,
  )) as LyraTimelineItem;
  const relative2 = noSyncEl.shadowRoot!.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(relative2.sync).to.be.false;
});

it('hides [part="description"] when the slot is empty, shows it with content, and updates on a later slotchange', async () => {
  const el = (await fixture(html`<lr-timeline-item>No description</lr-timeline-item>`)) as LyraTimelineItem;
  const descPart = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  expect(descPart.hidden).to.be.true;

  const withDesc = (await fixture(
    html`<lr-timeline-item>Has one<span slot="description">Details here.</span></lr-timeline-item>`,
  )) as LyraTimelineItem;
  expect((withDesc.shadowRoot!.querySelector('[part="description"]') as HTMLElement).hidden).to.be.false;

  const span = document.createElement('span');
  span.setAttribute('slot', 'description');
  span.textContent = 'Added later.';
  const descSlot = el.shadowRoot!.querySelector('slot[name="description"]') as HTMLSlotElement;
  const changed = oneEvent(descSlot, 'slotchange');
  el.appendChild(span);
  await changed;
  await el.updateComplete;
  expect(descPart.hidden).to.be.false;
});

it('variant reflects the attribute, defaults to "neutral", and drives --lr-timeline-marker-color', async () => {
  const el = (await fixture(html`<lr-timeline-item>Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(el.variant).to.equal('neutral');
  expect(el.hasAttribute('variant')).to.be.false;
  const neutralMarker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(neutralMarker).getPropertyValue('--lr-timeline-marker-color').trim()).to.equal('#6b7280');

  const success = (await fixture(html`<lr-timeline-item variant="success">Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(success.getAttribute('variant')).to.equal('success');
  expect(
    getComputedStyle(success.shadowRoot!.querySelector('[part="marker"]') as HTMLElement)
      .getPropertyValue('--lr-timeline-marker-color')
      .trim(),
  ).to.equal('#1a7f37');

  const danger = (await fixture(html`<lr-timeline-item variant="danger">Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(
    getComputedStyle(danger.shadowRoot!.querySelector('[part="marker"]') as HTMLElement)
      .getPropertyValue('--lr-timeline-marker-color')
      .trim(),
  ).to.equal('#cf222e');
});

it('active reflects, defaults to false, and drives aria-current="true" / entirely absent (not "false")', async () => {
  const el = (await fixture(html`<lr-timeline-item>Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(el.active).to.be.false;
  expect(el.hasAttribute('aria-current')).to.be.false;

  const activeEl = (await fixture(html`<lr-timeline-item active>Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(activeEl.hasAttribute('active')).to.be.true;
  expect(activeEl.getAttribute('aria-current')).to.equal('true');

  activeEl.active = false;
  await activeEl.updateComplete;
  expect(activeEl.hasAttribute('aria-current')).to.be.false;
});

it('pulses the marker while active, and disables the animation under prefers-reduced-motion (assert via stylesheet text)', async () => {
  const el = (await fixture(html`<lr-timeline-item active>Running</lr-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(marker).animationName).to.not.equal('none');

  const inactive = (await fixture(html`<lr-timeline-item>Done</lr-timeline-item>`)) as LyraTimelineItem;
  const inactiveMarker = inactive.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(inactiveMarker).animationName).to.equal('none');

  expect(styles.cssText).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^}]*\[part='marker'\][^}]*animation: none !important/,
  );
});

it('is accessible standalone with an icon, timestamp, title, and a description containing a nested focusable link', async () => {
  const el = await fixture(html`
    <ul style="list-style:none;margin:0;padding:0;">
      <lr-timeline-item variant="brand" .timestamp=${new Date()}>
        <span slot="icon">🔔</span>
        Deployment started
        <span slot="description">See <a href="#log">the live log</a> for progress.</span>
      </lr-timeline-item>
    </ul>
  `);
  await expect(el).to.be.accessible();
});

it('renders correctly with no .strings/locale registered (this component introduces no new message keys of its own -- only <lr-timeline>\'s "timeline" key exists in this family)', async () => {
  const el = (await fixture(html`<lr-timeline-item>Plain English render</lr-timeline-item>`)) as LyraTimelineItem;
  const slot = el.shadowRoot!.querySelector('[part="title"] slot') as HTMLSlotElement;
  expect(slot.assignedNodes({ flatten: true })[0]!.textContent).to.equal('Plain English render');
});
