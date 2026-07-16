import { fixture, fixtureSync, expect, html, oneEvent } from '@open-wc/testing';
import './timeline-item.js';
import type { LyraTimelineItem } from './timeline-item.js';
import type { LyraRelativeTime } from '../format/relative-time.js';
import { styles } from './timeline-item.styles.js';

it('sets role="listitem" on the host in connectedCallback, before first render', async () => {
  const el = fixtureSync<LyraTimelineItem>(html`<lyra-timeline-item>Deployed</lyra-timeline-item>`);
  // connectedCallback runs synchronously on upgrade/connect, before Lit's first update microtask.
  expect(el.getAttribute('role')).to.equal('listitem');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('listitem');
});

it('renders default-slot content as the title; an item with no default-slot content does not error', async () => {
  const el = (await fixture(html`<lyra-timeline-item>Build started</lyra-timeline-item>`)) as LyraTimelineItem;
  const title = el.shadowRoot!.querySelector('[part="title"]')!;
  expect((title.querySelector('slot') as HTMLSlotElement).assignedNodes({ flatten: true })[0]!.textContent).to.equal(
    'Build started',
  );

  const empty = await fixture(html`<lyra-timeline-item></lyra-timeline-item>`);
  expect(empty.shadowRoot!.querySelector('[part="title"]')).to.exist;
});

it('renders the default color-coded dot marker when the icon slot is empty', async () => {
  const el = (await fixture(html`<lyra-timeline-item variant="success">Done</lyra-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(iconSlot.assignedElements({ flatten: true })).to.have.length(0);
  expect(getComputedStyle(marker).getPropertyValue('--lyra-timeline-marker-color').trim()).to.equal('#1a7f37');
});

it('shows only the slotted icon content once the icon slot is populated, at parse time and via a later slotchange', async () => {
  const el = (await fixture(
    html`<lyra-timeline-item><span slot="icon">🚀</span>Launched</lyra-timeline-item>`,
  )) as LyraTimelineItem;
  const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(iconSlot.assignedElements({ flatten: true })).to.have.length(1);

  const bare = (await fixture(html`<lyra-timeline-item>No icon yet</lyra-timeline-item>`)) as LyraTimelineItem;
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

it('renders the internal <lyra-relative-time> fallback, wrapped in a <time> with the correct datetime/title, when timestamp is set and the slot is empty', async () => {
  const date = new Date('2024-06-15T12:00:00Z');
  const el = (await fixture(
    html`<lyra-timeline-item .timestamp=${date}>Deployed</lyra-timeline-item>`,
  )) as LyraTimelineItem;
  const time = el.shadowRoot!.querySelector('[part="timestamp"] time') as HTMLTimeElement;
  expect(time).to.exist;
  expect(time.getAttribute('datetime')).to.equal(date.toISOString());
  const expectedTitle = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date);
  expect(time.getAttribute('title')).to.equal(expectedTitle);
  const relative = time.querySelector('lyra-relative-time') as LyraRelativeTime;
  expect(relative).to.exist;
  expect(relative.date).to.equal(date);
  expect(el.shadowRoot!.querySelector('[part="timestamp"]')!.hasAttribute('hidden')).to.be.false;
});

it('hides [part="timestamp"] entirely when timestamp is an invalid/unparseable value, same as unset', async () => {
  const el = (await fixture(
    html`<lyra-timeline-item .timestamp=${'not a real date'}>Deployed</lyra-timeline-item>`,
  )) as LyraTimelineItem;
  const timestampPart = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(timestampPart.hidden).to.be.true;
  expect(timestampPart.querySelector('time')).to.not.exist;

  const unset = (await fixture(html`<lyra-timeline-item>Deployed</lyra-timeline-item>`)) as LyraTimelineItem;
  expect((unset.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement).hidden).to.be.true;
});

it('the timestamp slot wins outright over the timestamp property -- the internal <lyra-relative-time> fallback is not rendered at all when both are present', async () => {
  const el = (await fixture(html`
    <lyra-timeline-item .timestamp=${new Date()}>
      Deployed
      <time slot="timestamp" datetime="2024-01-01">Jan 1</time>
    </lyra-timeline-item>
  `)) as LyraTimelineItem;
  const timestampPart = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(timestampPart.hidden).to.be.false;
  expect(timestampPart.querySelector('lyra-relative-time')).to.not.exist;
  const slot = timestampPart.querySelector('slot[name="timestamp"]') as HTMLSlotElement;
  expect(slot.assignedElements({ flatten: true })).to.have.length(1);
});

it('forwards sync to the internal <lyra-relative-time>\'s own sync property', async () => {
  const syncEl = (await fixture(
    html`<lyra-timeline-item .timestamp=${new Date()} sync>Deployed</lyra-timeline-item>`,
  )) as LyraTimelineItem;
  const relative = syncEl.shadowRoot!.querySelector('lyra-relative-time') as LyraRelativeTime;
  expect(relative.sync).to.be.true;

  const noSyncEl = (await fixture(
    html`<lyra-timeline-item .timestamp=${new Date()}>Deployed</lyra-timeline-item>`,
  )) as LyraTimelineItem;
  const relative2 = noSyncEl.shadowRoot!.querySelector('lyra-relative-time') as LyraRelativeTime;
  expect(relative2.sync).to.be.false;
});

it('hides [part="description"] when the slot is empty, shows it with content, and updates on a later slotchange', async () => {
  const el = (await fixture(html`<lyra-timeline-item>No description</lyra-timeline-item>`)) as LyraTimelineItem;
  const descPart = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  expect(descPart.hidden).to.be.true;

  const withDesc = (await fixture(
    html`<lyra-timeline-item>Has one<span slot="description">Details here.</span></lyra-timeline-item>`,
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

it('variant reflects the attribute, defaults to "neutral", and drives --lyra-timeline-marker-color', async () => {
  const el = (await fixture(html`<lyra-timeline-item>Event</lyra-timeline-item>`)) as LyraTimelineItem;
  expect(el.variant).to.equal('neutral');
  expect(el.hasAttribute('variant')).to.be.false;
  const neutralMarker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(neutralMarker).getPropertyValue('--lyra-timeline-marker-color').trim()).to.equal('#6b7280');

  const success = (await fixture(html`<lyra-timeline-item variant="success">Event</lyra-timeline-item>`)) as LyraTimelineItem;
  expect(success.getAttribute('variant')).to.equal('success');
  expect(
    getComputedStyle(success.shadowRoot!.querySelector('[part="marker"]') as HTMLElement)
      .getPropertyValue('--lyra-timeline-marker-color')
      .trim(),
  ).to.equal('#1a7f37');

  const danger = (await fixture(html`<lyra-timeline-item variant="danger">Event</lyra-timeline-item>`)) as LyraTimelineItem;
  expect(
    getComputedStyle(danger.shadowRoot!.querySelector('[part="marker"]') as HTMLElement)
      .getPropertyValue('--lyra-timeline-marker-color')
      .trim(),
  ).to.equal('#cf222e');
});

it('active reflects, defaults to false, and drives aria-current="true" / entirely absent (not "false")', async () => {
  const el = (await fixture(html`<lyra-timeline-item>Event</lyra-timeline-item>`)) as LyraTimelineItem;
  expect(el.active).to.be.false;
  expect(el.hasAttribute('aria-current')).to.be.false;

  const activeEl = (await fixture(html`<lyra-timeline-item active>Event</lyra-timeline-item>`)) as LyraTimelineItem;
  expect(activeEl.hasAttribute('active')).to.be.true;
  expect(activeEl.getAttribute('aria-current')).to.equal('true');

  activeEl.active = false;
  await activeEl.updateComplete;
  expect(activeEl.hasAttribute('aria-current')).to.be.false;
});

it('pulses the marker while active, and disables the animation under prefers-reduced-motion (assert via stylesheet text)', async () => {
  const el = (await fixture(html`<lyra-timeline-item active>Running</lyra-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(marker).animationName).to.not.equal('none');

  const inactive = (await fixture(html`<lyra-timeline-item>Done</lyra-timeline-item>`)) as LyraTimelineItem;
  const inactiveMarker = inactive.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(inactiveMarker).animationName).to.equal('none');

  expect(styles.cssText).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^}]*\[part='marker'\][^}]*animation: none !important/,
  );
});

it('is accessible standalone with an icon, timestamp, title, and a description containing a nested focusable link', async () => {
  const el = await fixture(html`
    <ul style="list-style:none;margin:0;padding:0;">
      <lyra-timeline-item variant="brand" .timestamp=${new Date()}>
        <span slot="icon">🔔</span>
        Deployment started
        <span slot="description">See <a href="#log">the live log</a> for progress.</span>
      </lyra-timeline-item>
    </ul>
  `);
  await expect(el).to.be.accessible();
});

it('renders correctly with no .strings/locale registered (this component introduces no new message keys of its own -- only <lyra-timeline>\'s "timeline" key exists in this family)', async () => {
  const el = (await fixture(html`<lyra-timeline-item>Plain English render</lyra-timeline-item>`)) as LyraTimelineItem;
  const slot = el.shadowRoot!.querySelector('[part="title"] slot') as HTMLSlotElement;
  expect(slot.assignedNodes({ flatten: true })[0]!.textContent).to.equal('Plain English render');
});
