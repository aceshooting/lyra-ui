import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './stat.js';
import type { LyraStat } from './stat.js';
import { styles } from './stat.styles.js';

it('renders label, value, and unit', async () => {
  const el = (await fixture(
    html`<lr-stat label="Revenue" value="12.4" unit="k€"></lr-stat>`,
  )) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Revenue');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('12.4');
  expect(el.shadowRoot!.querySelector('[part="unit"]')!.textContent).to.equal('k€');
});

it('renders a real semantic link only when href is safe and forwards target/rel', async () => {
  const plain = (await fixture(html`
    <lr-stat label="Memories" value="128"></lr-stat>
  `)) as LyraStat;
  expect(plain.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('div');

  const linked = (await fixture(html`
    <lr-stat label="Memories" value="128" href="/memories" target="_blank" rel="noreferrer"></lr-stat>
  `)) as LyraStat;
  const anchor = linked.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.localName).to.equal('a');
  expect(anchor.getAttribute('href')).to.equal('/memories');
  expect(anchor.target).to.equal('_blank');
  expect(anchor.rel).to.equal('noreferrer');
  anchor.focus();
  expect(linked.shadowRoot!.activeElement?.getAttribute('href')).to.equal('/memories');

  const unsafe = (await fixture(html`
    <lr-stat label="Unsafe" value="0" href="java\tscript:alert(1)"></lr-stat>
  `)) as LyraStat;
  expect(unsafe.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('div');
});

it('avoids nested focus targets when an exact-value stat is linked', async () => {
  const el = (await fixture(html`
    <lr-stat label="Revenue" value="$1.2K" exact-value="$1,204.37" href="/revenue"></lr-stat>
  `)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.hasAttribute('tabindex')).to.be.false;
  await expect(el).to.be.accessible();
});

it('hides the trend pill when trend is NaN, shows it with direction otherwise', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.not.exist;

  el.trend = -12.5;
  await el.updateComplete;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.textContent).to.contain('12.5%');
  expect(trend.getAttribute('data-direction')).to.equal('down');
});

it('hides the trend pill again after the trend attribute is removed', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" trend="5"></lr-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.exist;

  el.removeAttribute('trend');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.not.exist;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-stat label="Revenue" value="12.4" trend="3"></lr-stat>`,
  )) as LyraStat;
  await expect(el).to.be.accessible();
});

it('preserves NaN/null as the deliberate "no trend" sentinel, but normalizes Infinity to a flat 0% instead of rendering "Infinity%"', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" trend="5"></lr-stat>`)) as LyraStat;

  el.trend = NaN;
  expect(el.trend).to.satisfy(Number.isNaN); // still the hidden sentinel, not coerced to 0
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.not.exist;

  el.trend = Infinity;
  expect(el.trend).to.equal(0); // normalized to a flat, finite trend instead of "Infinity%"
  await el.updateComplete;
  let trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend).to.exist;
  expect(trend.textContent).to.not.contain('Infinity');

  el.trend = -Infinity;
  expect(el.trend).to.equal(0);
  await el.updateComplete;
  trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.textContent).to.not.contain('Infinity');
});

it('stretches [part=base] to fill the host, matching lr-word-cloud/lr-context-meter\'s convention', async () => {
  const el = (await fixture(html`<lr-stat label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  el.style.blockSize = '200px';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).blockSize).to.equal('200px');
});

it('collapses the icon part when no default-slot content is provided', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the icon part when icon content is slotted', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1"><span>icon</span></lr-stat>`,
  )) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('collapses the caption part when there is no caption attribute or slot', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the caption part when a caption attribute is present', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" caption="attr caption"></lr-stat>`,
  )) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.false;
});

it('lets the caption slot override the caption attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" caption="attr"
      ><span slot="caption">rich</span></lr-stat
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
    html`<lr-stat label="x" value="1" trend="-12"></lr-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('bad');
});

it('goodDirection="down" inverts polarity: the same negative trend renders data-polarity="good"', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" trend="-12" good-direction="down"></lr-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('good');
});

it('renders a rotatable chevron icon for up/down trend, and a plain en dash for flat trend', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" trend="5"></lr-stat>`,
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
    html`<lr-stat label="x" value="1" trend="5"></lr-stat>`,
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

it('uses the --lr-space-xs token for the trend chip gap', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" trend="5"></lr-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
  expect(getComputedStyle(trend).gap).to.equal('4px');
});

it('omits data-polarity for a flat (zero) trend', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" trend="0"></lr-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.hasAttribute('data-polarity')).to.be.false;
});

it('reflects variant onto the host attribute and gives each variant a distinct value color', async () => {
  const neutral = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  expect(neutral.getAttribute('variant')).to.equal('neutral');
  const neutralColor = getComputedStyle(neutral.shadowRoot!.querySelector('[part="value"]')!).color;

  const success = (await fixture(
    html`<lr-stat label="x" value="1" variant="success"></lr-stat>`,
  )) as LyraStat;
  expect(success.getAttribute('variant')).to.equal('success');
  const successColor = getComputedStyle(success.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(successColor).to.not.equal(neutralColor);

  const warning = (await fixture(
    html`<lr-stat label="x" value="1" variant="warning"></lr-stat>`,
  )) as LyraStat;
  expect(warning.getAttribute('variant')).to.equal('warning');
  const warningColor = getComputedStyle(warning.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(warningColor).to.not.equal(neutralColor);
  expect(warningColor).to.not.equal(successColor);

  const danger = (await fixture(
    html`<lr-stat label="x" value="1" variant="danger"></lr-stat>`,
  )) as LyraStat;
  expect(danger.getAttribute('variant')).to.equal('danger');
  const dangerColor = getComputedStyle(danger.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(dangerColor).to.not.equal(neutralColor);
  expect(dangerColor).to.not.equal(successColor);
  expect(dangerColor).to.not.equal(warningColor);
});

it('reacts to icon and caption content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
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
    html`<lr-stat label="x" value="1" trend="-12"></lr-stat>`,
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

it('interpolates the trend value into a locale override instead of concatenating raw text, so word order can differ from English', async () => {
  // Regression test: trendIncreased/trendDecreased used to be JS-concatenated
  // with a raw number ("increased" + " " + "12" + "%"), which silently broke
  // for any locale whose word order differs from English. A `.strings`
  // override with the `{value}` placeholder moved to the front proves the
  // number is actually interpolated via the localize() `values` argument,
  // not just appended after a fixed English word.
  const el = (await fixture(
    html`<lr-stat
      label="x"
      value="1"
      trend="12"
      .strings=${{ trendIncreased: '{value}% de plus', trendGoodSuffix: '' }}
    ></lr-stat>`,
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('.sr-only')!.textContent).to.equal('12% de plus');
});

it('collapses the spark part when no spark content is slotted', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the spark part when spark content is slotted', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1"><span slot="spark">spark</span></lr-stat>`,
  )) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.false;
});

it('reacts to spark content added or removed after initial mount (slotchange)', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
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
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const rows = el.shadowRoot!.querySelector('[part="rows"]') as HTMLElement;
  expect(rows.querySelectorAll('[part="row"]').length).to.equal(0);
  // Mirrors the spark/caption parts: an always-present-but-empty flex
  // container is still a flex item and picks up an unwanted `gap` from
  // [part='base'], so the empty state must collapse via [hidden], not just
  // omit its [part="row"] children.
  expect(rows.hasAttribute('hidden')).to.be.true;
});

it('renders a breakdown row for each label/value pair, in order', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
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
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [{ label: 'a', value: 'b' }];
  await el.updateComplete;
  expect(el.hasAttribute('rows')).to.be.false;
});

it('shows a row exact value as a title tooltip, and makes that row focusable', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [{ label: 'Tokens', value: '1.2K', exactValue: '1,204' }];
  await el.updateComplete;

  const rowValue = el.shadowRoot!.querySelector('[part="row-value"]') as HTMLElement;
  expect(rowValue.getAttribute('title')).to.equal('1,204');
  expect(rowValue.getAttribute('tabindex')).to.equal('0');
});

it('does not make a row focusable when that row has no exactValue', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [{ label: 'Direct', value: '64%' }];
  await el.updateComplete;

  const rowValue = el.shadowRoot!.querySelector('[part="row-value"]') as HTMLElement;
  expect(rowValue.hasAttribute('title')).to.be.false;
  expect(rowValue.hasAttribute('tabindex')).to.be.false;
});

it('applies the exactValue tooltip/focusability independently per row', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Tokens', value: '1.2K', exactValue: '1,204' },
    { label: 'Other', value: '15%' },
  ];
  await el.updateComplete;

  const rowValues = Array.from(el.shadowRoot!.querySelectorAll('[part="row-value"]'));
  expect(rowValues.map((el) => el.hasAttribute('title'))).to.deep.equal([false, true, false]);
  expect(rowValues.map((el) => el.hasAttribute('tabindex'))).to.deep.equal([false, true, false]);
  expect(rowValues[1].getAttribute('title')).to.equal('1,204');
  expect(rowValues[1].getAttribute('tabindex')).to.equal('0');
});

it('reflects emphasis onto the host attribute and adds an accent border to the base part', async () => {
  const plain = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  expect(plain.hasAttribute('emphasis')).to.be.false;
  const plainBase = plain.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const plainBorder = getComputedStyle(plainBase).borderInlineStartWidth;

  const emphasized = (await fixture(
    html`<lr-stat label="x" value="1" emphasis></lr-stat>`,
  )) as LyraStat;
  expect(emphasized.getAttribute('emphasis')).to.equal('');
  const emphasizedBase = emphasized.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const emphasizedBorder = getComputedStyle(emphasizedBase).borderInlineStartWidth;

  expect(emphasizedBorder).to.equal('3px');
  expect(emphasizedBorder).to.not.equal(plainBorder);
});

it('colors the value with the brand accent when emphasis is set and variant is neutral', async () => {
  const neutral = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const neutralColor = getComputedStyle(
    neutral.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  const emphasized = (await fixture(
    html`<lr-stat label="x" value="1" emphasis></lr-stat>`,
  )) as LyraStat;
  const emphasizedColor = getComputedStyle(
    emphasized.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  expect(emphasizedColor).to.not.equal(neutralColor);
});

it('does not let emphasis override a non-neutral variant value color', async () => {
  const dangerOnly = (await fixture(
    html`<lr-stat label="x" value="1" variant="danger"></lr-stat>`,
  )) as LyraStat;
  const dangerColor = getComputedStyle(
    dangerOnly.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  const dangerEmphasized = (await fixture(
    html`<lr-stat label="x" value="1" variant="danger" emphasis></lr-stat>`,
  )) as LyraStat;
  const dangerEmphasizedColor = getComputedStyle(
    dangerEmphasized.shadowRoot!.querySelector('[part="value"]')!,
  ).color;

  expect(dangerEmphasizedColor).to.equal(dangerColor);
});

it('shows the exact value as a title tooltip on the headline value, and makes it focusable', async () => {
  const el = (await fixture(
    html`<lr-stat value="$1.2K" exact-value="$1,204.37"></lr-stat>`,
  )) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(valueEl.getAttribute('title')).to.equal('$1,204.37');
  expect(valueEl.getAttribute('tabindex')).to.equal('0');
});

it("gives [part='value']/[part='row-value'] a token-driven :focus-visible outline, since exactValue makes them keyboard-focusable", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='value']:focus-visible, [part='row-value']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }",
  );
});

it('associates the focusable value with its label via aria-labelledby', async () => {
  const el = (await fixture(
    html`<lr-stat label="Revenue" value="$1.2K" exact-value="$1,204.37"></lr-stat>`,
  )) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const labelledBy = valueEl.getAttribute('aria-labelledby');
  expect(labelledBy).to.be.a('string').and.not.empty;
  const combinedText = labelledBy!
    .split(' ')
    .map((id) => el.shadowRoot!.getElementById(id)!.textContent!.trim())
    .join(' ');
  expect(combinedText).to.equal('Revenue $1.2K');
});

it('does not add aria-labelledby to the value when there is no label', async () => {
  const el = (await fixture(html`<lr-stat value="42"></lr-stat>`)) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(valueEl.hasAttribute('aria-labelledby')).to.be.false;
});

it('associates each row value with its row label via aria-labelledby', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Referral', value: '21%' },
  ];
  await el.updateComplete;

  const rowEls = Array.from(el.shadowRoot!.querySelectorAll('[part="row"]'));
  const combined = rowEls.map((row) => {
    const rowValue = row.querySelector('[part="row-value"]') as HTMLElement;
    const labelledBy = rowValue.getAttribute('aria-labelledby')!;
    return labelledBy
      .split(' ')
      .map((id) => el.shadowRoot!.getElementById(id)!.textContent!.trim())
      .join(' ');
  });
  expect(combined).to.deep.equal(['Direct 64%', 'Referral 21%']);
});

it('does not make the value focusable when exact-value is unset', async () => {
  const el = (await fixture(html`<lr-stat value="42"></lr-stat>`)) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(valueEl.hasAttribute('title')).to.be.false;
  expect(valueEl.hasAttribute('tabindex')).to.be.false;
});

it('renders a sub line distinct from caption', async () => {
  const el = (await fixture(
    html`<lr-stat value="42" sub="vs. last week" caption="Updated 2h ago"></lr-stat>`,
  )) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="sub"]')!.textContent!.trim()).to.equal('vs. last week');
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent!.trim()).to.equal(
    'Updated 2h ago',
  );
});

it('lets the sub slot override the sub attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lr-stat value="1" sub="attr"><span slot="sub">rich</span></lr-stat>`,
  )) as LyraStat;
  // Same reasoning as the caption test above: the `sub` attribute's fallback
  // text lives *inside* the `<slot>` in the shadow tree, so `textContent`
  // (which walks the un-flattened shadow tree) always reports it regardless
  // of assignment — assert via the slot's real assignment instead.
  const slot = el.shadowRoot!.querySelector('slot[name="sub"]') as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned.length).to.equal(1);
  expect(assigned[0].textContent).to.equal('rich');
});

it('hides the sub part when unset', async () => {
  const el = (await fixture(html`<lr-stat value="42"></lr-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="sub"]')!.hasAttribute('hidden')).to.be.true;
});

it('reflects the prose attribute', async () => {
  const el = (await fixture(html`<lr-stat prose value="Loading…"></lr-stat>`)) as LyraStat;
  expect(el.hasAttribute('prose')).to.be.true;
});

it('reflects the compact attribute', async () => {
  const el = (await fixture(html`<lr-stat compact value="42"></lr-stat>`)) as LyraStat;
  expect(el.hasAttribute('compact')).to.be.true;
});

const baseChrome = (el: LyraStat) => {
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  return {
    flexDirection: s.flexDirection,
    flexWrap: s.flexWrap,
    alignItems: s.alignItems,
    paddingTop: s.paddingTop,
    paddingLeft: s.paddingLeft,
    borderTopWidth: s.borderTopWidth,
    borderTopStyle: s.borderTopStyle,
    borderTopLeftRadius: s.borderTopLeftRadius,
    backgroundColor: s.backgroundColor,
    rowGap: s.rowGap,
    columnGap: s.columnGap,
  };
};

it('leaves the card rendering untouched when both new axes are left unset (they default to card/vertical)', async () => {
  const markup = html`<lr-stat
    label="Revenue"
    value="12.4"
    unit="k€"
    caption="Last 30 days"
  ></lr-stat>`;
  const implicit = (await fixture(markup)) as LyraStat;
  const explicit = (await fixture(html`<lr-stat
    label="Revenue"
    value="12.4"
    unit="k€"
    caption="Last 30 days"
    appearance="card"
    orientation="vertical"
  ></lr-stat>`)) as LyraStat;

  expect(implicit.appearance).to.equal('card');
  expect(implicit.orientation).to.equal('vertical');
  expect(implicit.getAttribute('appearance')).to.equal('card');
  expect(implicit.getAttribute('orientation')).to.equal('vertical');

  // Explicitly restating the defaults must not change a single chrome declaration…
  expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));
  // …and the defaults are still exactly the card chrome that shipped before these axes existed.
  const chrome = baseChrome(implicit);
  expect(chrome.flexDirection).to.equal('column');
  expect(chrome.paddingTop).to.equal('12px'); // --lr-space-m
  expect(chrome.paddingLeft).to.equal('12px');
  expect(chrome.borderTopWidth).to.equal('1px'); // --lr-border-width-thin
  expect(chrome.borderTopStyle).to.equal('solid');
  expect(chrome.rowGap).to.equal('4px'); // --lr-space-xs
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  expect(
    getComputedStyle(implicit.shadowRoot!.querySelector('[part="base"]') as HTMLElement).blockSize,
  ).to.equal(
    getComputedStyle(explicit.shadowRoot!.querySelector('[part="base"]') as HTMLElement).blockSize,
  );
});

it('drops border, background, padding and the block-size stretch under appearance="plain"', async () => {
  const el = (await fixture(html`<lr-stat
    appearance="plain"
    label="Revenue"
    value="12.4"
    unit="k€"
    caption="Last 30 days"
  ></lr-stat>`)) as LyraStat;
  expect(el.getAttribute('appearance')).to.equal('plain');

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  expect(s.borderTopWidth).to.equal('0px');
  expect(s.borderInlineStartWidth).to.equal('0px');
  expect(s.borderTopLeftRadius).to.equal('0px');
  expect(s.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(s.paddingTop).to.equal('0px');
  expect(s.paddingLeft).to.equal('0px');

  // block-size: 100% is card-only: a chrome-less stat sits inline and must not stretch to fill an
  // arbitrarily tall parent.
  el.style.blockSize = '200px';
  await el.updateComplete;
  expect(getComputedStyle(base).blockSize).to.not.equal('200px');
});

it('orders :host([appearance="plain"]) after :host([compact]) so the equal-specificity padding reset wins', () => {
  const css = styles.cssText;
  const compactAt = css.indexOf(":host([compact])");
  const plainAt = css.indexOf(":host([appearance='plain'])");
  expect(compactAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(compactAt);
});

it('lets plain win over compact when both are set (equal specificity, source order decides)', async () => {
  const el = (await fixture(html`<lr-stat
    compact
    appearance="plain"
    label="Revenue"
    value="12.4"
  ></lr-stat>`)) as LyraStat;
  const s = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(s.paddingTop).to.equal('0px');
  expect(s.paddingLeft).to.equal('0px');
  expect(s.borderTopWidth).to.equal('0px');
});

it("gives a linked plain stat a text-underline hover/focus affordance, since it has no border to shift", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  // The card affordance is a border-color shift, which is invisible once `plain` removes the
  // border — a linked plain stat must still look interactive.
  expect(css).to.include(
    ":host([appearance='plain']) [part='base'][href]:hover [part='value'], :host([appearance='plain']) [part='base'][href]:focus-visible [part='value'] { text-decoration: underline; }",
  );
  // …and the card's lift shadow is suppressed, since there is no card to lift.
  expect(css).to.include(
    ":host([appearance='plain']) [part='base'][href]:hover { box-shadow: none; }",
  );
});

it('keeps the focus ring on a linked plain stat (an outline needs no border)', async () => {
  const el = (await fixture(html`<lr-stat
    appearance="plain"
    label="Memories"
    value="128"
    href="/memories"
  ></lr-stat>`)) as LyraStat;
  expect(el.appearance).to.equal('plain');
  const anchor = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.localName).to.equal('a');
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base'][href]:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }",
  );
  anchor.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('href')).to.equal('/memories');
});

it('puts value, unit and caption on one baseline row under orientation="horizontal"', async () => {
  const el = (await fixture(html`<lr-stat
    orientation="horizontal"
    value="87"
    unit="/100"
    caption="42 of 48 clean"
  ></lr-stat>`)) as LyraStat;
  expect(el.getAttribute('orientation')).to.equal('horizontal');

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  expect(s.flexDirection).to.equal('row');
  expect(s.alignItems).to.equal('baseline');

  const valueRow = el.shadowRoot!.querySelector('[part="value-row"]') as HTMLElement;
  const unit = el.shadowRoot!.querySelector('[part="unit"]') as HTMLElement;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  const valueRect = valueRow.getBoundingClientRect();
  const unitRect = unit.getBoundingClientRect();
  const captionRect = caption.getBoundingClientRect();

  // Same row: they overlap vertically and the caption sits after the value inline-wise.
  expect(unitRect.top).to.be.lessThan(valueRect.bottom);
  expect(captionRect.top).to.be.lessThan(valueRect.bottom);
  expect(valueRect.top).to.be.lessThan(captionRect.bottom);
  expect(captionRect.left).to.be.greaterThanOrEqual(valueRect.right);
});

it('keeps rows and spark stacked on their own line beneath the horizontal row', async () => {
  const el = (await fixture(html`<lr-stat
    orientation="horizontal"
    value="87"
    unit="/100"
    caption="42 of 48 clean"
    ><span slot="spark">spark</span></lr-stat
  >`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Referral', value: '21%' },
  ];
  await el.updateComplete;

  const valueRect = (
    el.shadowRoot!.querySelector('[part="value-row"]') as HTMLElement
  ).getBoundingClientRect();
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  const rows = el.shadowRoot!.querySelector('[part="rows"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.false;
  expect(rows.hasAttribute('hidden')).to.be.false;
  // They are forced onto their own full-width line rather than sharing the baseline row.
  expect(getComputedStyle(spark).flexBasis).to.equal('100%');
  expect(getComputedStyle(rows).flexBasis).to.equal('100%');
  expect(spark.getBoundingClientRect().top).to.be.greaterThanOrEqual(valueRect.bottom);
  expect(rows.getBoundingClientRect().top).to.be.greaterThanOrEqual(
    spark.getBoundingClientRect().bottom,
  );
});

it('keeps prose\'s hidden unit hidden under orientation="horizontal"', async () => {
  const el = (await fixture(html`<lr-stat
    orientation="horizontal"
    prose
    label="Status"
    value="Waiting for the next sync…"
    caption="Updated 2h ago"
  ></lr-stat>`)) as LyraStat;
  const unit = el.shadowRoot!.querySelector('[part="unit"]') as HTMLElement;
  expect(getComputedStyle(unit).display).to.equal('none');

  const valueRect = (
    el.shadowRoot!.querySelector('[part="value"]') as HTMLElement
  ).getBoundingClientRect();
  const captionRect = (
    el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement
  ).getBoundingClientRect();
  expect(captionRect.top).to.be.lessThan(valueRect.bottom);
  expect(captionRect.left).to.be.greaterThanOrEqual(valueRect.right);
});

it('hides the label part only when label is empty, and never when it is set', async () => {
  const empty = (await fixture(html`<lr-stat value="87" unit="/100"></lr-stat>`)) as LyraStat;
  const emptyLabel = empty.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(emptyLabel.hasAttribute('hidden')).to.be.true;
  expect(getComputedStyle(emptyLabel).display).to.equal('none');

  const labelled = (await fixture(
    html`<lr-stat label="Revenue" value="12.4"></lr-stat>`,
  )) as LyraStat;
  const label = labelled.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hasAttribute('hidden')).to.be.false;
  expect(getComputedStyle(label).display).to.not.equal('none');
});

it('keeps aria-labelledby resolving to the visible label once a label is set after mount', async () => {
  const el = (await fixture(
    html`<lr-stat value="$1.2K" exact-value="$1,204.37"></lr-stat>`,
  )) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(valueEl.hasAttribute('aria-labelledby')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.be.true;

  el.label = 'Revenue';
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hasAttribute('hidden')).to.be.false;
  const labelledBy = valueEl.getAttribute('aria-labelledby')!;
  expect(labelledBy).to.be.a('string').and.not.empty;
  const combinedText = labelledBy
    .split(' ')
    .map((id) => el.shadowRoot!.getElementById(id)!.textContent!.trim())
    .join(' ');
  expect(combinedText).to.equal('Revenue $1.2K');
});

it("drops emphasis's accent edge under plain (it is card chrome) while keeping its brand value tint", async () => {
  const el = (await fixture(html`<lr-stat
    appearance="plain"
    emphasis
    label="Revenue"
    value="12.4"
  ></lr-stat>`)) as LyraStat;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).borderInlineStartWidth).to.equal('0px');

  const cardNeutral = (await fixture(
    html`<lr-stat label="Revenue" value="12.4"></lr-stat>`,
  )) as LyraStat;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="value"]')!).color).to.not.equal(
    getComputedStyle(cardNeutral.shadowRoot!.querySelector('[part="value"]')!).color,
  );
});

it('is accessible in the populated plain/horizontal state', async () => {
  const el = (await fixture(html`<lr-stat
    appearance="plain"
    orientation="horizontal"
    label="Checks"
    value="87"
    unit="/100"
    exact-value="87 of 100"
    trend="4.2"
    sub="vs. last run"
    caption="42 of 48 clean"
  ></lr-stat>`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Referral', value: '21%', exactValue: '21.4%' },
  ];
  await el.updateComplete;

  // Prove the state actually rendered before asserting on it.
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).flexDirection).to.equal('row');
  expect(getComputedStyle(base).borderTopWidth).to.equal('0px');
  expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.hasAttribute('hidden')).to.be.false;

  await expect(el).to.be.accessible();
});
