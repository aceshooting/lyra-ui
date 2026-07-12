import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './stat.js';
import type { LyraStat } from './stat.js';

it('renders label, value, and unit', async () => {
  const el = (await fixture(
    html`<lyra-stat label="Revenue" value="12.4" unit="k€"></lyra-stat>`,
  )) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Revenue');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('12.4');
  expect(el.shadowRoot!.querySelector('[part="unit"]')!.textContent).to.equal('k€');
});

it('hides the trend pill when trend is NaN, shows it with direction otherwise', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.not.exist;

  el.trend = -12.5;
  await el.updateComplete;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.textContent).to.contain('12.5%');
  expect(trend.getAttribute('data-direction')).to.equal('down');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-stat label="Revenue" value="12.4" trend="3"></lyra-stat>`,
  )) as LyraStat;
  await expect(el).to.be.accessible();
});

it('collapses the icon part when no default-slot content is provided', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the icon part when icon content is slotted', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1"><span>icon</span></lyra-stat>`,
  )) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('collapses the caption part when there is no caption attribute or slot', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the caption part when a caption attribute is present', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" caption="attr caption"></lyra-stat>`,
  )) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.false;
});

it('lets the caption slot override the caption attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" caption="attr"
      ><span slot="caption">rich</span></lyra-stat
    >`,
  )) as LyraStat;
  // The `caption` attribute's fallback text lives *inside* the `<slot>` in
  // the shadow tree, so it is only ever painted when nothing is slotted —
  // native `Node.textContent` walks the raw (non-flattened) shadow tree and
  // always reports that fallback text regardless of assignment, so the only
  // reliable way to assert "the slot's projected content is what's actually
  // shown, not a concatenation" is via the slot's real assignment (same
  // pattern `empty.test.ts` uses for its icon/actions slots).
  const slot = el.shadowRoot!.querySelector('slot[name="caption"]') as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned.length).to.equal(1);
  expect(assigned[0].textContent).to.equal('rich');
});

it('defaults goodDirection to "up": a negative trend renders data-polarity="bad"', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="-12"></lyra-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('bad');
});

it('goodDirection="down" inverts polarity: the same negative trend renders data-polarity="good"', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="-12" good-direction="down"></lyra-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('good');
});

it('renders a rotatable chevron icon for up/down trend, and a plain en dash for flat trend', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="5"></lyra-stat>`,
  )) as LyraStat;
  let trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg')).to.exist;
  expect(trend.textContent).to.not.include('▲');

  el.trend = -5;
  await el.updateComplete;
  trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg')).to.exist;
  expect(trend.textContent).to.not.include('▼');

  el.trend = 0;
  await el.updateComplete;
  trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg')).to.not.exist;
  expect(trend.textContent).to.include('–');
});

it('rotates the trend chevron oppositely for up vs down via CSS on the wrapping part, not inline styles', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="5"></lyra-stat>`,
  )) as LyraStat;
  const upSvg = el.shadowRoot!.querySelector('[part="trend"] svg') as SVGElement;
  expect(upSvg.getAttribute('style')).to.be.null;
  const upTransform = getComputedStyle(upSvg).transform;

  el.trend = -5;
  await el.updateComplete;
  const downSvg = el.shadowRoot!.querySelector('[part="trend"] svg') as SVGElement;
  expect(downSvg.getAttribute('style')).to.be.null;
  const downTransform = getComputedStyle(downSvg).transform;

  expect(upTransform).to.not.equal('none');
  expect(downTransform).to.not.equal('none');
  expect(upTransform).to.not.equal(downTransform);
});

it('uses the --lyra-space-xs token for the trend chip gap', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="5"></lyra-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
  expect(getComputedStyle(trend).gap).to.equal('4px');
});

it('omits data-polarity for a flat (zero) trend', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="0"></lyra-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.hasAttribute('data-polarity')).to.be.false;
});

it('reflects variant onto the host attribute and gives each variant a distinct value color', async () => {
  const neutral = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  expect(neutral.getAttribute('variant')).to.equal('neutral');
  const neutralColor = getComputedStyle(neutral.shadowRoot!.querySelector('[part="value"]')!).color;

  const success = (await fixture(
    html`<lyra-stat label="x" value="1" variant="success"></lyra-stat>`,
  )) as LyraStat;
  expect(success.getAttribute('variant')).to.equal('success');
  const successColor = getComputedStyle(success.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(successColor).to.not.equal(neutralColor);

  const warning = (await fixture(
    html`<lyra-stat label="x" value="1" variant="warning"></lyra-stat>`,
  )) as LyraStat;
  expect(warning.getAttribute('variant')).to.equal('warning');
  const warningColor = getComputedStyle(warning.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(warningColor).to.not.equal(neutralColor);
  expect(warningColor).to.not.equal(successColor);

  const danger = (await fixture(
    html`<lyra-stat label="x" value="1" variant="danger"></lyra-stat>`,
  )) as LyraStat;
  expect(danger.getAttribute('variant')).to.equal('danger');
  const dangerColor = getComputedStyle(danger.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(dangerColor).to.not.equal(neutralColor);
  expect(dangerColor).to.not.equal(successColor);
  expect(dangerColor).to.not.equal(warningColor);
});

it('reacts to icon and caption content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
  expect(caption.hasAttribute('hidden')).to.be.true;

  const iconSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const captionSlot = el.shadowRoot!.querySelector('slot[name="caption"]') as HTMLSlotElement;

  let slotChanged = oneEvent(iconSlot, 'slotchange');
  const iconEl = document.createElement('span');
  iconEl.textContent = 'icon';
  el.appendChild(iconEl);
  await slotChanged;
  await el.updateComplete;
  expect(icon.hasAttribute('hidden')).to.be.false;

  slotChanged = oneEvent(captionSlot, 'slotchange');
  const captionEl = document.createElement('span');
  captionEl.slot = 'caption';
  captionEl.textContent = 'caption';
  el.appendChild(captionEl);
  await slotChanged;
  await el.updateComplete;
  expect(caption.hasAttribute('hidden')).to.be.false;

  slotChanged = oneEvent(iconSlot, 'slotchange');
  el.removeChild(iconEl);
  await slotChanged;
  await el.updateComplete;
  expect(icon.hasAttribute('hidden')).to.be.true;

  slotChanged = oneEvent(captionSlot, 'slotchange');
  el.removeChild(captionEl);
  await slotChanged;
  await el.updateComplete;
  expect(caption.hasAttribute('hidden')).to.be.true;
});

it('announces trend direction and good/bad polarity as sr-only text, since the icon rotation and color are not perceivable by screen readers', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1" trend="-12"></lyra-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  const srOnly = trend.querySelector('.sr-only')!;
  expect(srOnly.textContent).to.equal('decreased 12%, bad');

  el.goodDirection = 'down';
  await el.updateComplete;
  expect(trend.querySelector('.sr-only')!.textContent).to.equal('decreased 12%, good');

  el.trend = 0;
  await el.updateComplete;
  expect(trend.querySelector('.sr-only')!.textContent).to.equal('unchanged');
});

it('collapses the spark part when no spark content is slotted', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the spark part when spark content is slotted', async () => {
  const el = (await fixture(
    html`<lyra-stat label="x" value="1"><span slot="spark">spark</span></lyra-stat>`,
  )) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.false;
});

it('reacts to spark content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  const sparkSlot = el.shadowRoot!.querySelector('slot[name="spark"]') as HTMLSlotElement;
  expect(spark.hasAttribute('hidden')).to.be.true;

  let slotChanged = oneEvent(sparkSlot, 'slotchange');
  const sparkEl = document.createElement('span');
  sparkEl.slot = 'spark';
  sparkEl.textContent = 'spark';
  el.appendChild(sparkEl);
  await slotChanged;
  await el.updateComplete;
  expect(spark.hasAttribute('hidden')).to.be.false;

  slotChanged = oneEvent(sparkSlot, 'slotchange');
  el.removeChild(sparkEl);
  await slotChanged;
  await el.updateComplete;
  expect(spark.hasAttribute('hidden')).to.be.true;
});

it('renders no rows part content when rows is empty', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const rows = el.shadowRoot!.querySelector('[part="rows"]') as HTMLElement;
  expect(rows.querySelectorAll('[part="row"]').length).to.equal(0);
  // Mirrors the spark/caption parts: an always-present-but-empty flex
  // container is still a flex item and picks up an unwanted `gap` from
  // [part='base'], so the empty state must collapse via [hidden], not just
  // omit its [part="row"] children.
  expect(rows.hasAttribute('hidden')).to.be.true;
});

it('renders a breakdown row for each label/value pair, in order', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Referral', value: '21%' },
    { label: 'Other', value: '15%' },
  ];
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelector('[part="rows"]') as HTMLElement;
  expect(rows.hasAttribute('hidden')).to.be.false;
  const rowEls = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rowEls.length).to.equal(3);
  const labels = Array.from(rowEls).map(
    (row) => row.querySelector('[part="row-label"]')!.textContent,
  );
  const values = Array.from(rowEls).map(
    (row) => row.querySelector('[part="row-value"]')!.textContent,
  );
  expect(labels).to.deep.equal(['Direct', 'Referral', 'Other']);
  expect(values).to.deep.equal(['64%', '21%', '15%']);
});

it('does not reflect rows onto an attribute', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  el.rows = [{ label: 'a', value: 'b' }];
  await el.updateComplete;
  expect(el.hasAttribute('rows')).to.be.false;
});

it('reflects emphasis onto the host attribute and adds an accent border to the base part', async () => {
  const plain = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  expect(plain.hasAttribute('emphasis')).to.be.false;
  const plainBase = plain.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const plainBorder = getComputedStyle(plainBase).borderInlineStartWidth;

  const emphasized = (await fixture(
    html`<lyra-stat label="x" value="1" emphasis></lyra-stat>`,
  )) as LyraStat;
  expect(emphasized.getAttribute('emphasis')).to.equal('');
  const emphasizedBase = emphasized.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const emphasizedBorder = getComputedStyle(emphasizedBase).borderInlineStartWidth;

  expect(emphasizedBorder).to.equal('3px');
  expect(emphasizedBorder).to.not.equal(plainBorder);
});

it('colors the value with the brand accent when emphasis is set and variant is neutral', async () => {
  const neutral = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  const neutralColor = getComputedStyle(
    neutral.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  const emphasized = (await fixture(
    html`<lyra-stat label="x" value="1" emphasis></lyra-stat>`,
  )) as LyraStat;
  const emphasizedColor = getComputedStyle(
    emphasized.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  expect(emphasizedColor).to.not.equal(neutralColor);
});

it('does not let emphasis override a non-neutral variant value color', async () => {
  const dangerOnly = (await fixture(
    html`<lyra-stat label="x" value="1" variant="danger"></lyra-stat>`,
  )) as LyraStat;
  const dangerColor = getComputedStyle(
    dangerOnly.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  const dangerEmphasized = (await fixture(
    html`<lyra-stat label="x" value="1" variant="danger" emphasis></lyra-stat>`,
  )) as LyraStat;
  const dangerEmphasizedColor = getComputedStyle(
    dangerEmphasized.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  expect(dangerEmphasizedColor).to.equal(dangerColor);
});
