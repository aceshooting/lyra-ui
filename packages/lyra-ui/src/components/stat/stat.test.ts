import { fixture, expect, html } from '@open-wc/testing';
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
