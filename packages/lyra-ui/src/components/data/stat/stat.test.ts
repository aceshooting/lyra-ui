import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './stat.js';
import type { LyraStat } from './stat.js';
import { styles } from './stat.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('renders label, value, and unit', async () => {
  const el = (await fixture(html`<lr-stat label="Revenue" value="12.4" unit="k€"></lr-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Revenue');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('12.4');
  expect(el.shadowRoot!.querySelector('[part="unit"]')!.textContent).to.equal('k€');
});

it('seeds slot-presence state when the SSR element shim has no children collection', () => {
  const el = document.createElement('lr-stat') as LyraStat;
  Object.defineProperty(el, 'children', { configurable: true, value: undefined });

  try {
    expect(() => {
      (el as unknown as { willUpdate(changed: PropertyValues): void }).willUpdate(
        new Map() as PropertyValues,
      );
    }).not.to.throw();
  } finally {
    delete (el as unknown as { children?: HTMLCollection }).children;
  }
});

it('renders a real semantic link only when href is safe and forwards target, deriving rel', async () => {
  const plain = (await fixture(html` <lr-stat label="Memories" value="128"></lr-stat> `)) as LyraStat;
  expect(plain.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('div');

  const linked = (await fixture(html`
    <lr-stat label="Memories" value="128" href="/memories" target="_blank"></lr-stat>
  `)) as LyraStat;
  const anchor = linked.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.localName).to.equal('a');
  expect(anchor.getAttribute('href')).to.equal('/memories');
  expect(anchor.target).to.equal('_blank');
  expect(anchor.rel).to.equal('noopener noreferrer');
  anchor.focus();
  expect(linked.shadowRoot!.activeElement?.getAttribute('href')).to.equal('/memories');

  const unsafe = (await fixture(html`
    <lr-stat label="Unsafe" value="0" href="java	script:alert(1)"></lr-stat>
  `)) as LyraStat;
  expect(unsafe.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('div');
});

it('derives rel="noopener noreferrer" automatically from target alone (reverse-tabnabbing guard)', async () => {
  const el = (await fixture(html`
    <lr-stat label="Memories" value="128" href="/memories" target="_blank"></lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.rel).to.equal('noopener noreferrer');
});

it('omits rel entirely when target is unset', async () => {
  const el = (await fixture(html` <lr-stat label="Memories" value="128" href="/memories"></lr-stat> `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.hasAttribute('rel')).to.be.false;
});

it('avoids nested focus targets when an exact-value stat is linked', async () => {
  const el = (await fixture(html`
    <lr-stat label="Revenue" value="$1.2K" exact-value="$1,204.37" href="/revenue"></lr-stat>
  `)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.localName).to.equal('a');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.hasAttribute('tabindex')).to.be.false;
  await expect(el).to.be.accessible();
});

it('keeps interactive slotted content outside the linked stat anchor and independently operable', async () => {
  const el = (await fixture(html`
    <lr-stat label="Revenue" value="12.4" href="#revenue-details">
      <button id="stat-slot-action" slot="caption">Compare periods</button>
    </lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  const action = el.querySelector<HTMLButtonElement>('#stat-slot-action')!;
  let anchorClicks = 0;
  let actionClicks = 0;
  anchor.addEventListener('click', (event) => {
    anchorClicks += 1;
    event.preventDefault();
  });
  action.addEventListener('click', () => {
    actionClicks += 1;
  });

  expect(anchor.contains(action)).to.be.false;
  action.click();
  expect(actionClicks).to.equal(1);
  expect(anchorClicks).to.equal(0);
  await expect(el).to.be.accessible();
});

it('keeps whole-card activation for non-interactive slotted content outside the link', async () => {
  const el = (await fixture(html`
    <lr-stat label="Revenue" value="12.4" href="#revenue-details">
      <span id="stat-plain-caption" slot="caption">Open details</span>
    </lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  let anchorClicks = 0;
  anchor.addEventListener('click', (event) => {
    anchorClicks += 1;
    event.preventDefault();
  });

  el.querySelector<HTMLElement>('#stat-plain-caption')!.click();
  expect(anchorClicks).to.equal(1);
});

it('forwards host click() to the linked whole-card anchor exactly once', async () => {
  const el = (await fixture(html`
    <lr-stat href="/details" label="Revenue" value="12.4"></lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  let clicks = 0;
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    clicks++;
  });
  el.click();
  expect(clicks).to.equal(1);
});

it('forwards a live host aria-label to the linked stat anchor and restores natural naming when removed', async () => {
  const el = (await fixture(html`
    <lr-stat aria-label="Open revenue details" label="Revenue" value="12.4" unit="k€" href="/revenue"></lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  expect(anchor.getAttribute('aria-label')).to.equal('Open revenue details');

  el.setAttribute('aria-label', 'Open archived revenue');
  await el.updateComplete;
  expect(anchor.getAttribute('aria-label')).to.equal('Open archived revenue');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(anchor.hasAttribute('aria-label')).to.be.false;
  expect(anchor.textContent?.replace(/\s+/g, ' ').trim()).to.equal('Revenue 12.4 k€');
});

it('hides the trend pill when deltaPercent is null, shows it with direction otherwise', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  expect((el.shadowRoot!.querySelector('[part="trend"]')) == null).to.be.true;

  el.deltaPercent = -12.5;
  await el.updateComplete;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.textContent).to.contain('12.5%');
  expect(trend.getAttribute('data-direction')).to.equal('down');
});

it('hides the trend pill again after the delta-percent attribute is removed', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5"></lr-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.exist;

  el.removeAttribute('delta-percent');
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="trend"]')) == null).to.be.true;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-stat label="Revenue" value="12.4" delta-percent="3"></lr-stat>`)) as LyraStat;
  await expect(el).to.be.accessible();
});

it('normalizes NaN and infinities to the JSON-safe null absence state', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5"></lr-stat>`)) as LyraStat;

  el.deltaPercent = NaN;
  expect(el.deltaPercent).to.equal(null);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="trend"]')) == null).to.be.true;

  el.deltaPercent = Infinity;
  expect(el.deltaPercent).to.equal(null);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="trend"]') === null).to.be.true;

  el.deltaPercent = -Infinity;
  expect(el.deltaPercent).to.equal(null);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="trend"]') === null).to.be.true;
});

it("stretches [part=base] to fill the host, matching lr-word-cloud/lr-context-meter's convention", async () => {
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
  const el = (await fixture(html`<lr-stat label="x" value="1"><span>icon</span></lr-stat>`)) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(icon.hasAttribute('hidden')).to.be.false;
});

it('renders the canonical start slot ahead of the legacy default icon and falls back live', async () => {
  const el = (await fixture(html`
    <lr-stat label="x" value="1">
      <span id="legacy-icon">legacy</span>
      <span id="start-icon" slot="start">start</span>
    </lr-stat>
  `)) as LyraStat;
  const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  const startSlot = el.shadowRoot!.querySelector('slot[name="start"]') as HTMLSlotElement | null;
  const defaultSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement | null;
  const startIcon = el.querySelector('#start-icon') as HTMLElement;
  const legacyIcon = el.querySelector('#legacy-icon') as HTMLElement;

  expect(startSlot?.localName).to.equal('slot');
  expect(defaultSlot?.localName).to.equal('slot');
  expect(startSlot?.assignedElements().map((assigned) => assigned.id)).to.deep.equal(['start-icon']);
  expect(defaultSlot?.assignedElements().map((assigned) => assigned.id)).to.deep.equal(['legacy-icon']);
  expect(icon.hasAttribute('hidden')).to.be.false;
  expect(startIcon.getClientRects().length > 0).to.be.true;
  expect(legacyIcon.getClientRects().length).to.equal(0);

  const changed = oneEvent(startSlot!, 'slotchange');
  startIcon.remove();
  await changed;
  await el.updateComplete;
  expect(icon.hasAttribute('hidden')).to.be.false;
  expect(legacyIcon.getClientRects().length > 0).to.be.true;
});

it('collapses the caption part when there is no caption attribute or slot', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the caption part when a caption attribute is present', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" caption="attr caption"></lr-stat>`)) as LyraStat;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(caption.hasAttribute('hidden')).to.be.false;
});

it('lets the caption slot override the caption attribute instead of concatenating both', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" caption="attr"><span slot="caption">rich</span></lr-stat>`
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
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="-12"></lr-stat>`)) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('bad');
});

it('goodDirection="down" inverts polarity: the same negative trend renders data-polarity="good"', async () => {
  const el = (await fixture(
    html`<lr-stat label="x" value="1" delta-percent="-12" good-direction="down"></lr-stat>`
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.getAttribute('data-polarity')).to.equal('good');
});

it('renders a rotatable chevron icon for up/down trend, and a plain en dash for flat trend', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5"></lr-stat>`)) as LyraStat;
  let trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg') != null).to.equal(true);
  expect(trend.textContent).to.not.include('▲');

  el.deltaPercent = -5;
  await el.updateComplete;
  trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg') != null).to.equal(true);
  expect(trend.textContent).to.not.include('▼');

  el.deltaPercent = 0;
  await el.updateComplete;
  trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('svg') == null).to.equal(true);
  expect(trend.textContent).to.include('–');
});

it('rotates the trend chevron oppositely for up vs down via CSS on the wrapping part, not inline styles', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5"></lr-stat>`)) as LyraStat;
  const upSvg = el.shadowRoot!.querySelector('[part="trend"] svg') as SVGElement;
  expect(upSvg.getAttribute('style')).to.be.null;
  const upTransform = getComputedStyle(upSvg).transform;

  el.deltaPercent = -5;
  await el.updateComplete;
  const downSvg = el.shadowRoot!.querySelector('[part="trend"] svg') as SVGElement;
  expect(downSvg.getAttribute('style')).to.be.null;
  const downTransform = getComputedStyle(downSvg).transform;

  expect(upTransform).to.not.equal('none');
  expect(downTransform).to.not.equal('none');
  expect(upTransform).to.not.equal(downTransform);
});

it('uses the --lr-space-xs token for the trend chip gap', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5"></lr-stat>`)) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
  expect(getComputedStyle(trend).gap).to.equal('4px');
});

it('omits data-polarity for a flat (zero) trend', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="0"></lr-stat>`)) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.hasAttribute('data-polarity')).to.be.false;
});

it('lets each headline value variant color be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-stat
      label="x"
      value="1"
      style="
        --lr-stat-value-success-color: rgb(1, 2, 3);
        --lr-stat-value-warning-color: rgb(4, 5, 6);
        --lr-stat-value-danger-color: rgb(7, 8, 9);
      "
    ></lr-stat>
  `)) as LyraStat;
  const expected = new Map([
    ['success', 'rgb(1, 2, 3)'],
    ['warning', 'rgb(4, 5, 6)'],
    ['danger', 'rgb(7, 8, 9)'],
  ]);
  for (const [variant, color] of expected) {
    el.variant = variant as LyraStat['variant'];
    await el.updateComplete;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(getComputedStyle(value).color).to.equal(color);
  }
});

describe('trend pill tint decoupled from the headline value tint', () => {
  it("defaults the 'good' trend pill's color to the same shared --lr-color-success token the headline value's variant=\"success\" tint reads, byte-identical to before", async () => {
    const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="5" variant="success"></lr-stat>`)) as LyraStat;
    const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(getComputedStyle(trend).color).to.equal(getComputedStyle(value).color);
  });

  it('lets --lr-stat-trend-good-color/-bg retint just the trend pill without touching the headline value\'s variant="success" color', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-stat-trend-good-color: rgb(1, 2, 3); --lr-stat-trend-good-bg: rgb(4, 5, 6);">
        <lr-stat label="x" value="1" delta-percent="5" variant="success"></lr-stat>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-stat') as LyraStat;
    const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(getComputedStyle(trend).color).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(trend).backgroundColor).to.equal('rgb(4, 5, 6)');
    // The headline value's status tint is untouched by the trend-pill-scoped override.
    expect(getComputedStyle(value).color).to.not.equal('rgb(1, 2, 3)');
  });

  it("lets --lr-stat-trend-bad-color/-bg retint just the 'bad' trend pill without touching the headline value's variant=\"danger\" color", async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-stat-trend-bad-color: rgb(7, 8, 9); --lr-stat-trend-bad-bg: rgb(11, 12, 13);">
        <lr-stat label="x" value="1" delta-percent="-5" variant="danger"></lr-stat>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-stat') as LyraStat;
    const trend = el.shadowRoot!.querySelector('[part="trend"]') as HTMLElement;
    const value = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
    expect(getComputedStyle(trend).color).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(trend).backgroundColor).to.equal('rgb(11, 12, 13)');
    expect(getComputedStyle(value).color).to.not.equal('rgb(7, 8, 9)');
  });
});

it('reflects variant onto the host attribute and gives each variant a distinct value color', async () => {
  const neutral = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  expect(neutral.getAttribute('variant')).to.equal('neutral');
  const neutralColor = getComputedStyle(neutral.shadowRoot!.querySelector('[part="value"]')!).color;

  const success = (await fixture(html`<lr-stat label="x" value="1" variant="success"></lr-stat>`)) as LyraStat;
  expect(success.getAttribute('variant')).to.equal('success');
  const successColor = getComputedStyle(success.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(successColor).to.not.equal(neutralColor);

  const warning = (await fixture(html`<lr-stat label="x" value="1" variant="warning"></lr-stat>`)) as LyraStat;
  expect(warning.getAttribute('variant')).to.equal('warning');
  const warningColor = getComputedStyle(warning.shadowRoot!.querySelector('[part="value"]')!).color;
  expect(warningColor).to.not.equal(neutralColor);
  expect(warningColor).to.not.equal(successColor);

  const danger = (await fixture(html`<lr-stat label="x" value="1" variant="danger"></lr-stat>`)) as LyraStat;
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
  const el = (await fixture(html`<lr-stat label="x" value="1" delta-percent="-12"></lr-stat>`)) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  const srOnly = trend.querySelector('.sr-only')!;
  expect(srOnly.textContent).to.equal('decreased 12%, bad');

  el.goodDirection = 'down';
  await el.updateComplete;
  expect(trend.querySelector('.sr-only')!.textContent).to.equal('decreased 12%, good');

  el.deltaPercent = 0;
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
      delta-percent="12"
      .strings=${{
        statTrendIncreased: '{value} de plus',
        statTrendGood: '',
        statTrendAnnouncement: '{trend}{polarity}',
      }}
    ></lr-stat>`
  )) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.querySelector('.sr-only')!.textContent).to.equal('12% de plus');
});

it('formats the trend as a locale-aware percentage in both visible and announced text', async () => {
  const el = (await fixture(html`<lr-stat lang="de-DE" label="x" value="1" delta-percent="12.5"></lr-stat>`)) as LyraStat;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  const expectedPercent = new Intl.NumberFormat('de-DE', {
    style: 'percent',
    maximumFractionDigits: 20,
  }).format(0.125);

  expect(trend.querySelector('[aria-hidden="true"]')!.textContent).to.contain(expectedPercent);
  expect(trend.querySelector('.sr-only')!.textContent).to.contain(expectedPercent);
});

it('localizes the full trend announcement so direction and polarity can be reordered', async () => {
  const el = (await fixture(
    html`<lr-stat
      label="x"
      value="1"
      delta-percent="12"
      .strings=${{
        statTrendIncreased: '{value} higher',
        statTrendGood: 'favorable',
        statTrendAnnouncement: '[{polarity}] {trend}',
      }}
    ></lr-stat>`
  )) as LyraStat;

  expect(el.shadowRoot!.querySelector('[part="trend"] .sr-only')!.textContent).to.equal('[favorable] 12% higher');
});

it('contains long unbroken content inside a 320px allocation', async () => {
  const long = 'x'.repeat(300);
  const wrapper = await fixture(html`
    <div style="inline-size: 320px">
      <lr-stat
        style="inline-size: 100%"
        label=${long}
        value=${long}
        unit=${long}
        sub=${long}
        caption=${long}
        .rows=${[{ label: long, value: long }]}
      ></lr-stat>
    </div>
  `);
  const el = wrapper.querySelector('lr-stat') as LyraStat;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.getBoundingClientRect().width).to.be.at.most(320);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth);
});

it('collapses the spark part when no spark content is slotted', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.true;
});

it('does not collapse the spark part when spark content is slotted', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"><span slot="spark">spark</span></lr-stat>`)) as LyraStat;
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
  const labels = Array.from(rowEls).map((row) => row.querySelector('[part="row-label"]')!.textContent);
  const values = Array.from(rowEls).map((row) => row.querySelector('[part="row-value"]')!.textContent);
  expect(labels).to.deep.equal(['Direct', 'Referral', 'Other']);
  expect(values).to.deep.equal(['64%', '21%', '15%']);
});

it('does not reflect rows onto an attribute', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  el.rows = [{ label: 'a', value: 'b' }];
  await el.updateComplete;
  expect(el.hasAttribute('rows')).to.be.false;
});

it('snapshots rows so caller mutation cannot bypass rendering', async () => {
  const el = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const rows = [{ label: 'Direct', value: '64%' }];
  el.rows = rows;
  rows[0]!.value = 'mutated';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="row-value"]')!.textContent).to.equal('64%');
  expect(Object.isFrozen(el.rows)).to.equal(true);
  expect(Object.isFrozen(el.rows[0]!)).to.equal(true);
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

  const emphasized = (await fixture(html`<lr-stat label="x" value="1" emphasis></lr-stat>`)) as LyraStat;
  expect(emphasized.getAttribute('emphasis')).to.equal('');
  const emphasizedBase = emphasized.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const emphasizedBorder = getComputedStyle(emphasizedBase).borderInlineStartWidth;

  expect(emphasizedBorder).to.equal('3px');
  expect(emphasizedBorder).to.not.equal(plainBorder);
});

it('colors the value with the brand accent when emphasis is set and variant is neutral', async () => {
  const neutral = (await fixture(html`<lr-stat label="x" value="1"></lr-stat>`)) as LyraStat;
  const neutralColor = getComputedStyle(neutral.shadowRoot!.querySelector('[part="value"]')!).color;

  const emphasized = (await fixture(html`<lr-stat label="x" value="1" emphasis></lr-stat>`)) as LyraStat;
  const emphasizedColor = getComputedStyle(emphasized.shadowRoot!.querySelector('[part="value"]')!).color;

  expect(emphasizedColor).to.not.equal(neutralColor);
});

it('themes emphasis border and value independently without retinting the brand variant', async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-stat-value-brand-color:rgb(10, 11, 12); --lr-stat-emphasis-border-color:rgb(1, 2, 3); --lr-stat-emphasis-value-color:rgb(4, 5, 6)"
    >
      <lr-stat label="Emphasized" value="1" emphasis></lr-stat>
      <lr-stat label="Brand variant" value="2" variant="brand"></lr-stat>
    </div>
  `);
  const [emphasized, brand] = [...wrapper.querySelectorAll('lr-stat')] as LyraStat[];
  await emphasized!.updateComplete;
  await brand!.updateComplete;

  const emphasizedBase = emphasized!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const emphasizedValue = emphasized!.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const brandValue = brand!.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(getComputedStyle(emphasizedBase).borderInlineStartColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(emphasizedValue).color).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(brandValue).color).to.equal('rgb(10, 11, 12)');
});

it('does not let emphasis override a non-neutral variant value color', async () => {
  const dangerOnly = (await fixture(html`<lr-stat label="x" value="1" variant="danger"></lr-stat>`)) as LyraStat;
  const dangerColor = getComputedStyle(dangerOnly.shadowRoot!.querySelector('[part="value"]')!).color;

  const dangerEmphasized = (await fixture(
    html`<lr-stat label="x" value="1" variant="danger" emphasis></lr-stat>`
  )) as LyraStat;
  const dangerEmphasizedColor = getComputedStyle(dangerEmphasized.shadowRoot!.querySelector('[part="value"]')!).color;

  expect(dangerEmphasizedColor).to.equal(dangerColor);
});

it('shows the exact value as a title tooltip on the headline value, and makes it focusable', async () => {
  const el = (await fixture(html`<lr-stat value="$1.2K" exact-value="$1,204.37"></lr-stat>`)) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  expect(valueEl.getAttribute('title')).to.equal('$1,204.37');
  expect(valueEl.getAttribute('tabindex')).to.equal('0');
});

it("gives [part='value']/[part='row-value'] a token-driven :focus-visible outline, since exactValue makes them keyboard-focusable", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='value']:focus-visible, [part='row-value']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }"
  );
});

it("gives the same focusable [part='value']/[part='row-value'] a mouse-user :hover affordance, wrapped in :where() so a consumer ::part(value):hover / ::part(row-value):hover override wins without !important", async () => {
  const el = (await fixture(html`<lr-stat value="$1.2K" exact-value="$1,204.37"></lr-stat>`)) as LyraStat;
  const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText.replace(/"/g, "'"))
    .find((text) => text.includes(':hover') && text.includes("[part='value'][tabindex]"));
  expect(internalRule).to.contain(':where(');
  expect(internalRule).to.contain('cursor: help');
});

it('scopes the value/row-value hover affordance to the focusable ([tabindex]) state only', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(":where([part='value'][tabindex]):hover, :where([part='row-value'][tabindex]):hover");
});

it('associates the focusable value with its label via aria-labelledby', async () => {
  const el = (await fixture(
    html`<lr-stat label="Revenue" value="$1.2K" exact-value="$1,204.37"></lr-stat>`
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

it('includes the visible unit in the focusable exact-value accessible name', async () => {
  const el = (await fixture(
    html`<lr-stat label="Latency" value="42" unit="ms" exact-value="42.03"></lr-stat>`,
  )) as LyraStat;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const combinedText = valueEl
    .getAttribute('aria-labelledby')!
    .split(' ')
    .map((id) => el.shadowRoot!.getElementById(id)!.textContent!.trim())
    .join(' ');
  expect(combinedText).to.equal('Latency 42 ms');
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
    html`<lr-stat value="42" sub="vs. last week" caption="Updated 2h ago"></lr-stat>`
  )) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="sub"]')!.textContent!.trim()).to.equal('vs. last week');
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent!.trim()).to.equal('Updated 2h ago');
});

it('lets the sub slot override the sub attribute instead of concatenating both', async () => {
  const el = (await fixture(html`<lr-stat value="1" sub="attr"><span slot="sub">rich</span></lr-stat>`)) as LyraStat;
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
  const markup = html`<lr-stat label="Revenue" value="12.4" unit="k€" caption="Last 30 days"></lr-stat>`;
  const implicit = (await fixture(markup)) as LyraStat;
  const explicit = (await fixture(html`<lr-stat
    label="Revenue"
    value="12.4"
    unit="k€"
    caption="Last 30 days"
    frame="card"
    orientation="vertical"
  ></lr-stat>`)) as LyraStat;

  expect(implicit.frame).to.equal('card');
  expect(implicit.orientation).to.equal('vertical');
  expect(implicit.getAttribute('frame')).to.equal('card');
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
  expect(getComputedStyle(implicit.shadowRoot!.querySelector('[part="base"]') as HTMLElement).blockSize).to.equal(
    getComputedStyle(explicit.shadowRoot!.querySelector('[part="base"]') as HTMLElement).blockSize
  );
});

it('drops border, background, padding and the block-size stretch under frame="plain"', async () => {
  const el = (await fixture(html`<lr-stat
    frame="plain"
    label="Revenue"
    value="12.4"
    unit="k€"
    caption="Last 30 days"
  ></lr-stat>`)) as LyraStat;
  expect(el.getAttribute('frame')).to.equal('plain');

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

it('orders :host([frame="plain"]) after :host([compact]) so the equal-specificity padding reset wins', () => {
  const css = styles.cssText;
  const compactAt = css.indexOf(':host([compact])');
  const plainAt = css.indexOf(":host([frame='plain'])");
  expect(compactAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(compactAt);
});

it('lets plain win over compact when both are set (equal specificity, source order decides)', async () => {
  const el = (await fixture(html`<lr-stat compact frame="plain" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const s = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(s.paddingTop).to.equal('0px');
  expect(s.paddingLeft).to.equal('0px');
  expect(s.borderTopWidth).to.equal('0px');
});

it('gives a linked plain stat a rendered text-underline hover/focus affordance, since it has no border to shift', async () => {
  const el = (await fixture(html`
    <lr-stat frame="plain" label="Memories" value="128" href="/memories"></lr-stat>
  `)) as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  const value = el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
  const rect = value.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(value).textDecorationLine).to.contain('underline');
    expect(getComputedStyle(anchor).boxShadow).to.equal('none');
  } finally {
    await resetMouse();
  }

  anchor.focus();
  expect(getComputedStyle(value).textDecorationLine).to.contain('underline');
});

it('inherits linked hover/pressed hooks while direct host values still win', async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-transition-fast: 0s; --lr-stat-link-hover-border-color: rgb(1, 2, 3); --lr-stat-link-active-bg: rgb(4, 5, 6)"
    >
      <lr-stat label="Memories" value="128" href="#memory-inventory"></lr-stat>
    </div>
  `);
  const el = wrapper.querySelector('lr-stat') as LyraStat;
  const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  anchor.addEventListener('click', (event) => event.preventDefault());
  const rect = anchor.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];

  try {
    await sendMouse({ type: 'move', position });
    await waitUntil(() => getComputedStyle(anchor).borderTopColor === 'rgb(1, 2, 3)');

    el.style.setProperty('--lr-stat-link-hover-border-color', 'rgb(7, 8, 9)');
    await waitUntil(() => getComputedStyle(anchor).borderTopColor === 'rgb(7, 8, 9)');

    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(anchor).backgroundColor === 'rgb(4, 5, 6)');
    el.style.setProperty('--lr-stat-link-active-bg', 'rgb(10, 11, 12)');
    await waitUntil(() => getComputedStyle(anchor).backgroundColor === 'rgb(10, 11, 12)');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it("wraps the internal [part='base'][href]:hover rule in :where() so a consumer ::part(base):hover override wins without !important", async () => {
  const el = (await fixture(html` <lr-stat label="Memories" value="128" href="/memories"></lr-stat> `)) as LyraStat;
  const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText.replace(/"/g, "'"))
    .find((text) => text.includes(':hover') && text.includes("[part='base'][href]") && !text.includes(':host'));
  expect(internalRule).to.contain(':where(');
});

it('keeps the focus ring on a linked plain stat (an outline needs no border)', async () => {
  const el = (await fixture(html`<lr-stat
    frame="plain"
    label="Memories"
    value="128"
    href="/memories"
  ></lr-stat>`)) as LyraStat;
  expect(el.frame).to.equal('plain');
  const anchor = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
  expect(anchor.localName).to.equal('a');
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base'][href]:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }"
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
  const el = (await fixture(html`<lr-stat orientation="horizontal" value="87" unit="/100" caption="42 of 48 clean"
    ><span slot="spark">spark</span></lr-stat
  >`)) as LyraStat;
  el.rows = [
    { label: 'Direct', value: '64%' },
    { label: 'Referral', value: '21%' },
  ];
  await el.updateComplete;

  const valueRect = (el.shadowRoot!.querySelector('[part="value-row"]') as HTMLElement).getBoundingClientRect();
  const spark = el.shadowRoot!.querySelector('[part="spark"]') as HTMLElement;
  const rows = el.shadowRoot!.querySelector('[part="rows"]') as HTMLElement;
  expect(spark.hasAttribute('hidden')).to.be.false;
  expect(rows.hasAttribute('hidden')).to.be.false;
  // They are forced onto their own full-width line rather than sharing the baseline row.
  expect(getComputedStyle(spark).flexBasis).to.equal('100%');
  expect(getComputedStyle(rows).flexBasis).to.equal('100%');
  expect(spark.getBoundingClientRect().top).to.be.greaterThanOrEqual(valueRect.bottom);
  expect(rows.getBoundingClientRect().top).to.be.greaterThanOrEqual(spark.getBoundingClientRect().bottom);
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

  const valueRect = (el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).getBoundingClientRect();
  const captionRect = (el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement).getBoundingClientRect();
  expect(captionRect.top).to.be.lessThan(valueRect.bottom);
  expect(captionRect.left).to.be.greaterThanOrEqual(valueRect.right);
});

it('hides the label part only when label is empty, and never when it is set', async () => {
  const empty = (await fixture(html`<lr-stat value="87" unit="/100"></lr-stat>`)) as LyraStat;
  const emptyLabel = empty.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(emptyLabel.hasAttribute('hidden')).to.be.true;
  expect(getComputedStyle(emptyLabel).display).to.equal('none');

  const labelled = (await fixture(html`<lr-stat label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const label = labelled.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hasAttribute('hidden')).to.be.false;
  expect(getComputedStyle(label).display).to.not.equal('none');
});

it('keeps aria-labelledby resolving to the visible label once a label is set after mount', async () => {
  const el = (await fixture(html`<lr-stat value="$1.2K" exact-value="$1,204.37"></lr-stat>`)) as LyraStat;
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
  const el = (await fixture(html`<lr-stat frame="plain" emphasis label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).borderInlineStartWidth).to.equal('0px');

  const cardNeutral = (await fixture(html`<lr-stat label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="value"]')!).color).to.not.equal(
    getComputedStyle(cardNeutral.shadowRoot!.querySelector('[part="value"]')!).color
  );
});

it('is accessible in the populated plain/horizontal state', async () => {
  const el = (await fixture(html`<lr-stat
    frame="plain"
    orientation="horizontal"
    label="Checks"
    value="87"
    unit="/100"
    exact-value="87 of 100"
    delta-percent="4.2"
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

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g.
  // src/internal/motion.test.ts's window.matchMedia stub) to prove LyraStat's own
  // willUpdate() override actually calls super.willUpdate(...) rather than shadowing it silently.
  const proto = LyraElement.prototype as unknown as {
    willUpdate: (changed: PropertyValues) => void;
  };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-stat label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('tints the headline value with the brand tone under variant="brand"', async () => {
  const neutral = (await fixture(html`<lr-stat label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const brand = (await fixture(html`<lr-stat variant="brand" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  // `emphasis` on a neutral stat already paints [part='value'] with --lr-color-brand, so it pins
  // the new variant to the same *resolved* token rather than to a literal colour string that a
  // palette regeneration would invalidate.
  const emphasized = (await fixture(html`<lr-stat emphasis label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const valueColor = (el: LyraStat) =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).color;

  expect(brand.variant).to.equal('brand');
  expect(brand.getAttribute('variant')).to.equal('brand');
  expect(valueColor(brand)).to.not.equal(valueColor(neutral));
  expect(valueColor(brand)).to.equal(valueColor(emphasized));
});

it('lets --lr-stat-value-brand-color retint just the brand headline, like its success/warning/danger siblings', async () => {
  const el = (await fixture(html`<lr-stat variant="brand" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  el.style.setProperty('--lr-stat-value-brand-color', 'rgb(1, 2, 3)');
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="value"]') as HTMLElement).color).to.equal(
    'rgb(1, 2, 3)'
  );
});

it('keeps card chrome under frame="card" and drops it under frame="plain"', async () => {
  const card = (await fixture(html`<lr-stat frame="card" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  const plain = (await fixture(html`<lr-stat frame="plain" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;

  expect(card.frame).to.equal('card');
  expect(plain.frame).to.equal('plain');
  expect(plain.getAttribute('frame')).to.equal('plain');

  const cardChrome = baseChrome(card);
  expect(cardChrome.borderTopWidth).to.equal('1px');
  expect(cardChrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');

  const plainChrome = baseChrome(plain);
  expect(plainChrome.borderTopWidth).to.equal('0px');
  expect(plainChrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(plainChrome.paddingTop).to.equal('0px');
  expect(plainChrome.borderTopLeftRadius).to.equal('0px');
});

it('no longer answers to the pre-8.0.0 appearance attribute — frame replaced it outright', async () => {
  const legacy = (await fixture(html`<lr-stat appearance="plain" label="Revenue" value="12.4"></lr-stat>`)) as LyraStat;
  expect(legacy.frame).to.equal('card');
  const chrome = baseChrome(legacy);
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});
