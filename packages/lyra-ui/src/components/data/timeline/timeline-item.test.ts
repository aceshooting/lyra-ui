import { fixture, fixtureSync, expect, html, oneEvent } from '@open-wc/testing';
import './timeline-item.js';
import type { LyraTimelineItem } from './timeline-item.js';
import type { LyraRelativeTime } from '../../utility/format/relative-time.js';
import { styles } from './timeline-item.styles.js';

/**
 * Resolve a design token in the same shadow scope the component's own `var()` chain resolves in.
 * A computed custom-property value already has its `var()` references substituted, so this reads
 * whatever the generated palette currently produces. Colour assertions below compare against this
 * rather than restating a literal hex -- a hardcoded hex asserts the palette instead of this
 * component, and breaks on every legitimate regeneration of the ramp.
 */
const resolve = (node: Element, token: string) => getComputedStyle(node).getPropertyValue(token).trim();

/**
 * Round-trip a colour string through the browser so it is serialized exactly the way a computed
 * `background-color` / `color` is, making the two directly comparable.
 */
const toRgb = (color: string) => {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return rgb;
};

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
    'Build started'
  );

  const empty = await fixture(html`<lr-timeline-item></lr-timeline-item>`);
  expect(empty.shadowRoot!.querySelector('[part="title"]')).to.exist;
});

it('renders the default color-coded dot marker when the icon slot is empty', async () => {
  const el = (await fixture(html`<lr-timeline-item variant="success">Done</lr-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const iconSlot = el.shadowRoot!.querySelector('slot[name="icon"]') as HTMLSlotElement;
  expect(iconSlot.assignedElements({ flatten: true })).to.have.length(0);
  const success = resolve(marker, '--lr-color-success');
  expect(success).to.not.equal('');
  // The dot is actually painted with it (background: var(--lr-timeline-marker-color)), rather than
  // left transparent the way the [data-has-icon] branch leaves it.
  expect(getComputedStyle(marker).backgroundColor).to.equal(toRgb(success));
});

it('shows only the slotted icon content once the icon slot is populated, at parse time and via a later slotchange', async () => {
  const el = (await fixture(
    html`<lr-timeline-item><span slot="icon">🚀</span>Launched</lr-timeline-item>`
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

it('renders marker-icon ahead of the legacy icon slot and falls back live', async () => {
  const el = (await fixture(html`
    <lr-timeline-item>
      <span id="legacy-marker" slot="icon">legacy</span>
      <span id="canonical-marker" slot="marker-icon">canonical</span>
      Deployed
    </lr-timeline-item>
  `)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const canonicalSlot = marker.querySelector('slot[name="marker-icon"]') as HTMLSlotElement | null;
  const legacySlot = marker.querySelector('slot[name="icon"]') as HTMLSlotElement | null;
  const canonicalMarker = el.querySelector('#canonical-marker') as HTMLElement;
  const legacyMarker = el.querySelector('#legacy-marker') as HTMLElement;

  expect(canonicalSlot?.localName).to.equal('slot');
  expect(legacySlot?.localName).to.equal('slot');
  expect(canonicalSlot?.assignedElements().map((assigned) => assigned.id)).to.deep.equal(['canonical-marker']);
  expect(legacySlot?.assignedElements().map((assigned) => assigned.id)).to.deep.equal(['legacy-marker']);
  expect(marker.hasAttribute('data-has-icon')).to.be.true;
  expect(canonicalMarker.getClientRects().length > 0).to.be.true;
  expect(legacyMarker.getClientRects().length).to.equal(0);

  const changed = oneEvent(canonicalSlot!, 'slotchange');
  canonicalMarker.remove();
  await changed;
  await el.updateComplete;
  expect(marker.hasAttribute('data-has-icon')).to.be.true;
  expect(legacyMarker.getClientRects().length > 0).to.be.true;
});

it('renders the internal <lr-relative-time> fallback, wrapped in a <time> with the correct datetime/title, when timestamp is set and the slot is empty', async () => {
  const date = new Date('2024-06-15T12:00:00Z');
  const el = (await fixture(
    html`<lr-timeline-item .timestamp=${date}>Deployed</lr-timeline-item>`
  )) as LyraTimelineItem;
  const time = el.shadowRoot!.querySelector('[part="timestamp"] time') as HTMLTimeElement;
  expect(time != null).to.equal(true);
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
    html`<lr-timeline-item .timestamp=${'not a real date'}>Deployed</lr-timeline-item>`
  )) as LyraTimelineItem;
  const timestampPart = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
  expect(timestampPart.hidden).to.be.true;
  expect(timestampPart.querySelector('time') == null).to.equal(true);

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
  expect((timestampPart.querySelector('lr-relative-time')) == null).to.be.true;
  const slot = timestampPart.querySelector('slot[name="timestamp"]') as HTMLSlotElement;
  expect(slot.assignedElements({ flatten: true })).to.have.length(1);
});

it("forwards sync to the internal <lr-relative-time>'s own sync property", async () => {
  const syncEl = (await fixture(
    html`<lr-timeline-item .timestamp=${new Date()} sync>Deployed</lr-timeline-item>`
  )) as LyraTimelineItem;
  const relative = syncEl.shadowRoot!.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(relative.sync).to.be.true;

  const noSyncEl = (await fixture(
    html`<lr-timeline-item .timestamp=${new Date()}>Deployed</lr-timeline-item>`
  )) as LyraTimelineItem;
  const relative2 = noSyncEl.shadowRoot!.querySelector('lr-relative-time') as LyraRelativeTime;
  expect(relative2.sync).to.be.false;
});

it('hides [part="description"] when the slot is empty, shows it with content, and updates on a later slotchange', async () => {
  const el = (await fixture(html`<lr-timeline-item>No description</lr-timeline-item>`)) as LyraTimelineItem;
  const descPart = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  expect(descPart.hidden).to.be.true;

  const withDesc = (await fixture(
    html`<lr-timeline-item>Has one<span slot="description">Details here.</span></lr-timeline-item>`
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
  // The unset/"neutral" default resolves to the quiet text tone, not to a variant tone.
  const neutralColor = resolve(neutralMarker, '--lr-color-text-quiet');
  expect(neutralColor).to.not.equal('');
  expect(getComputedStyle(neutralMarker).backgroundColor).to.equal(toRgb(neutralColor));

  const success = (await fixture(
    html`<lr-timeline-item variant="success">Event</lr-timeline-item>`
  )) as LyraTimelineItem;
  expect(success.getAttribute('variant')).to.equal('success');
  const successMarker = success.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const successColor = resolve(successMarker, '--lr-color-success');
  expect(successColor).to.not.equal('');
  expect(getComputedStyle(successMarker).backgroundColor).to.equal(toRgb(successColor));

  const danger = (await fixture(html`<lr-timeline-item variant="danger">Event</lr-timeline-item>`)) as LyraTimelineItem;
  const dangerMarker = danger.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const dangerColor = resolve(dangerMarker, '--lr-color-danger');
  expect(dangerColor).to.not.equal('');
  expect(getComputedStyle(dangerMarker).backgroundColor).to.equal(toRgb(dangerColor));

  // Colour-coded: the three tones are three genuinely different colours, not one token reused --
  // this is what a per-variant marker buys, and it survives any palette regeneration.
  expect(new Set([neutralColor, successColor, dangerColor]).size).to.equal(3);
});

it('inherits marker and rail theme hooks from an ancestor while direct item overrides win', async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-timeline-marker-size:31px; --lr-timeline-marker-color:rgb(1, 2, 3); --lr-timeline-rail-width:7px; --lr-timeline-rail-color:rgb(4, 5, 6)"
    >
      <lr-timeline-item variant="success">Event</lr-timeline-item>
    </div>
  `);
  const el = wrapper.querySelector('lr-timeline-item') as LyraTimelineItem;
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  const rail = el.shadowRoot!.querySelector('[part="rail"]') as HTMLElement;
  expect(getComputedStyle(marker).inlineSize).to.equal('31px');
  expect(getComputedStyle(marker).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(rail).inlineSize).to.equal('7px');
  expect(getComputedStyle(rail).backgroundColor).to.equal('rgb(4, 5, 6)');

  el.style.setProperty('--lr-timeline-marker-color', 'rgb(7, 8, 9)');
  expect(getComputedStyle(marker).backgroundColor).to.equal('rgb(7, 8, 9)');
});

it('active reflects and drives an explicit aria-current true/false state', async () => {
  const el = (await fixture(html`<lr-timeline-item>Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(el.active).to.be.false;
  expect(el.getAttribute('aria-current')).to.equal('false');

  const activeEl = (await fixture(html`<lr-timeline-item active>Event</lr-timeline-item>`)) as LyraTimelineItem;
  expect(activeEl.hasAttribute('active')).to.be.true;
  expect(activeEl.getAttribute('aria-current')).to.equal('true');

  activeEl.active = false;
  await activeEl.updateComplete;
  expect(activeEl.getAttribute('aria-current')).to.equal('false');
});

it('pulses the marker while active, and disables the animation under prefers-reduced-motion (assert via stylesheet text)', async () => {
  const el = (await fixture(html`<lr-timeline-item active>Running</lr-timeline-item>`)) as LyraTimelineItem;
  const marker = el.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(marker).animationName).to.not.equal('none');

  const inactive = (await fixture(html`<lr-timeline-item>Done</lr-timeline-item>`)) as LyraTimelineItem;
  const inactiveMarker = inactive.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
  expect(getComputedStyle(inactiveMarker).animationName).to.equal('none');

  expect(styles.cssText).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^}]*\[part='marker'\][^}]*animation: none !important/
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
