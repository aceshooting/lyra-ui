import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './entity-card.js';
import type { LyraEntityCard, LyraEntity } from './entity-card.js';
import { styles } from './entity-card.styles.js';
import type { LyraResultField } from '../../agent-tools/result-card/result-field.class.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const entity: LyraEntity = {
  id: 'e1',
  label: 'Marie Curie',
  type: 'person',
  description: 'Physicist and chemist.',
  properties: { born: 1867, field: 'Physics' },
  degree: 5,
  communityId: 'c1',
};

const types = [{ id: 'person', label: 'Person', color: '#7c3aed' }];

// Locale/numbering fixtures intentionally use English fallback text.
expectLocaleFallback('ar-u-nu-arab', [
  'noData',
  'focusInGraph',
  'entityDegree',
  'entityCommunity',
  'resultFieldLabel',
]);
it('renders the noData empty state when entity is null (the default)', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  expect(el.entity).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty') != null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="header"]') == null).to.be.true;
});

it('renders label, description, and property rows for a given entity', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="title"]')!.textContent
  ).to.include('Marie Curie');
  expect(
    el.shadowRoot!.querySelector('[part="description"]')!.textContent
  ).to.include('Physicist');
  const rows = el.shadowRoot!.querySelectorAll('[part="property"]');
  expect(rows.length).to.equal(2);
});

it('falls back to untitledEntity when label is missing', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = { id: 'e2', label: '' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="title"]')!.textContent
  ).to.include('Untitled entity');
});

it('resolves the type badge label/color against types, falling back to the raw type id', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.types = types;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="type-badge"]')!.textContent
  ).to.include('Person');

  el.entity = { ...entity, type: 'unknown-type' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="type-badge"]')!.textContent
  ).to.include('unknown-type');
});

it('keeps the static type category out of a live region across entity updates', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.types = types;
  await el.updateComplete;
  let badge = el.shadowRoot!.querySelector('lr-badge')!;
  await badge.updateComplete;
  expect(badge.hasAttribute('role')).to.be.false;

  el.entity = { ...entity, type: 'organization' };
  await el.updateComplete;
  badge = el.shadowRoot!.querySelector('lr-badge')!;
  await badge.updateComplete;
  expect(badge.textContent).to.include('organization');
  expect(badge.hasAttribute('role')).to.be.false;
});

it('renders degree and community rows with their localized labels', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.communityLabel = 'Nobel laureates';
  await el.updateComplete;
  const degree = el.shadowRoot!.querySelector(
    '[part="degree"]'
  ) as LyraResultField;
  expect(degree.label).to.equal('Connections');
  expect(degree.value).to.equal('5');
  const community = el.shadowRoot!.querySelector(
    '[part="community"]'
  ) as LyraResultField;
  expect(community.label).to.equal('Community');
  expect(community.textContent).to.include('Nobel laureates');
});

it('localizes the degree row label via this.localize() when .strings overrides entityDegree', async () => {
  const el = (await fixture(html`
    <lr-entity-card .strings=${{ entityDegree: 'Connexions' }}></lr-entity-card>
  `)) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  const degree = el.shadowRoot!.querySelector(
    '[part="degree"]'
  ) as LyraResultField;
  await degree.updateComplete;
  expect(
    degree.shadowRoot!.querySelector('[part="label"]')!.textContent
  ).to.include('Connexions');
});

it('emits lr-entity-select from the built-in focus button', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector(
    '[part="focus-button"]'
  ) as HTMLElement;
  const listener = oneEvent(el, 'lr-entity-select');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e1' });
});

it('fires lr-entity-select exactly once from one click', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector(
    '[part="focus-button"]'
  ) as HTMLElement;
  let selectCount = 0;
  el.addEventListener('lr-entity-select', () => {
    selectCount++;
  });
  button.click();
  await el.updateComplete;
  expect(selectCount).to.equal(1);
});

it('hides the focus button when withoutFocusButton is set', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.withoutFocusButton = true;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="focus-button"]').length
  ).to.equal(0);
});

it('without-focus-button (plain HTML attribute) also hides the focus button', async () => {
  const el = (await fixture(
    html`<lr-entity-card
      without-focus-button
      .entity=${entity}
    ></lr-entity-card>`
  )) as LyraEntityCard;
  await el.updateComplete;
  expect(el.withoutFocusButton).to.be.true;
  expect(
    el.shadowRoot!.querySelectorAll('[part="focus-button"]').length
  ).to.equal(0);
});

it('is accessible with a full entity', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.types = types;
  el.communityLabel = 'Nobel laureates';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

const baseChrome = (el: LyraEntityCard) => {
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const s = getComputedStyle(base);
  return {
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

it('defaults to size="m" and frame="card", rendering identically to those values restated', async () => {
  const implicit = (await fixture(
    html`<lr-entity-card .entity=${entity}></lr-entity-card>`
  )) as LyraEntityCard;
  const explicit = (await fixture(
    html`<lr-entity-card
      frame="card"
      size="m"
      .entity=${entity}
    ></lr-entity-card>`
  )) as LyraEntityCard;

  expect(implicit.size).to.equal('m');
  expect(implicit.frame).to.equal('card');
  expect(implicit.getAttribute('size')).to.equal('m');
  expect(implicit.getAttribute('frame')).to.equal('card');

  expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));
  const chrome = baseChrome(implicit);
  expect(chrome.paddingTop).to.equal('12px'); // --lr-space-m
  expect(chrome.rowGap).to.equal('8px'); // --lr-space-s
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.borderTopStyle).to.equal('solid');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('reflects size="s" and tightens the base padding/gap, keeping the card border', async () => {
  const el = (await fixture(
    html`<lr-entity-card size="s" .entity=${entity}></lr-entity-card>`
  )) as LyraEntityCard;
  expect(el.getAttribute('size')).to.equal('s');
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
  expect(chrome.rowGap).to.equal('4px'); // --lr-space-xs
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets a consumer retune the dense-tier values through --lr-entity-card-compact-*', async () => {
  const el = (await fixture(
    html`<lr-entity-card size="s" .entity=${entity}></lr-entity-card>`
  )) as LyraEntityCard;
  el.style.setProperty('--lr-entity-card-compact-padding', '3px');
  el.style.setProperty('--lr-entity-card-compact-gap', '5px');
  await el.updateComplete;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('3px');
  expect(chrome.rowGap).to.equal('5px');
});

it('retints the resting card frame through --lr-entity-card-bg', async () => {
  const el = (await fixture(
    html`<lr-entity-card .entity=${entity} style="--lr-entity-card-bg: rgb(1, 2, 3)"></lr-entity-card>`
  )) as LyraEntityCard;
  expect(baseChrome(el).backgroundColor).to.equal('rgb(1, 2, 3)');
});

it('leaves the resting frame on the shared surface token when --lr-entity-card-bg is unset', async () => {
  const el = (await fixture(
    html`<lr-entity-card .entity=${entity} style="--lr-color-surface: rgb(4, 5, 6)"></lr-entity-card>`
  )) as LyraEntityCard;
  expect(baseChrome(el).backgroundColor).to.equal('rgb(4, 5, 6)');
});

it('keeps frame="plain" transparent regardless of --lr-entity-card-bg', async () => {
  const el = (await fixture(
    html`<lr-entity-card
      frame="plain"
      .entity=${entity}
      style="--lr-entity-card-bg: rgb(1, 2, 3)"
    ></lr-entity-card>`
  )) as LyraEntityCard;
  expect(baseChrome(el).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
});

it('drops border, background, padding and radius under frame="plain"', async () => {
  const el = (await fixture(
    html`<lr-entity-card frame="plain" .entity=${entity}></lr-entity-card>`
  )) as LyraEntityCard;
  expect(el.getAttribute('frame')).to.equal('plain');
  const chrome = baseChrome(el);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.borderTopLeftRadius).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

// The container treatment moved off `appearance` (which now means only how a control FILLS
// itself) onto `frame` in 8.0.0, with no attribute alias. A stale `appearance="plain"` must
// therefore render as an untouched card -- asserted on the rendered box, because a renamed
// selector that still matched the old attribute would be invisible to every other assertion here.
it('ignores a stale appearance="plain", leaving the card chrome intact', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  let stale: LyraEntityCard;
  try {
    stale = (await fixture(
      html`<lr-entity-card appearance="plain" .entity=${entity}></lr-entity-card>`
    )) as LyraEntityCard;
  } finally {
    console.warn = originalWarn;
  }
  expect(stale.frame).to.equal('card');
  const chrome = baseChrome(stale);
  expect(chrome.paddingTop).to.equal('12px'); // --lr-space-m, i.e. the untouched card padding
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets plain win over size="s" when both are set', async () => {
  const el = (await fixture(
    html`<lr-entity-card
      size="s"
      frame="plain"
      .entity=${entity}
    ></lr-entity-card>`
  )) as LyraEntityCard;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.borderTopWidth).to.equal('0px');
});

it('is accessible in the populated size="s" and plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-entity-card
      size="s"
      .entity=${entity}
      .types=${types}
      community-label="Nobel laureates"
    ></lr-entity-card>`
  )) as LyraEntityCard;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-entity-card
      frame="plain"
      .entity=${entity}
      .types=${types}
      community-label="Nobel laureates"
    ></lr-entity-card>`
  )) as LyraEntityCard;
  await expect(plainEl).to.be.accessible();
});

it('formats numeric properties and degree with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-entity-card lang="ar-u-nu-arab"></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = { ...entity, properties: { year: 1867 }, degree: 1234 };
  await el.updateComplete;
  const property = el.shadowRoot!.querySelector(
    '[part="property"]'
  ) as LyraResultField;
  const degree = el.shadowRoot!.querySelector(
    '[part="degree"]'
  ) as LyraResultField;
  expect(property.value).to.equal('١٬٨٦٧');
  expect(degree.value).to.equal('١٬٢٣٤');
});

it('rejects a non-color type badge color (url() CSS-injection hardening)', async () => {
  const el = (await fixture(
    html`<lr-entity-card></lr-entity-card>`
  )) as LyraEntityCard;
  el.entity = entity;
  el.types = [
    {
      id: 'person',
      label: 'Person',
      color: 'url(https://evil.example/exfil.png)',
    },
  ];
  await el.updateComplete;
  const badge = el.shadowRoot!.querySelector(
    '[part="type-badge"]'
  ) as HTMLElement;
  expect(badge.style.getPropertyValue('--lr-badge-color')).to.equal('');
  expect(badge.style.getPropertyValue('--lr-badge-background')).to.equal('');
  expect(badge.style.getPropertyValue('--lr-badge-border')).to.equal('');
});

it('uses caller type colors only as an accent and retains semantic foreground contrast', async () => {
  for (const color of ['#000000', '#ffffff', 'rgba(255, 255, 255, 0.05)']) {
    const el = (await fixture(
      html`<lr-entity-card></lr-entity-card>`
    )) as LyraEntityCard;
    el.entity = entity;
    el.types = [{ id: 'person', label: 'Person', color }];
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector(
      '[part="type-badge"]'
    ) as HTMLElement;
    expect(badge.style.getPropertyValue('--lr-badge-color')).to.equal(
      'var(--lr-color-text)'
    );
    expect(badge.style.getPropertyValue('--lr-badge-border')).to.equal(color);
    expect(badge.style.getPropertyValue('--lr-badge-background')).to.include(
      `${color} 12%`
    );
    await expect(el).to.be.accessible();
  }
});

it('stretches [part="base"] to fill a flex row, matching a taller sibling instead of leaving blank space', async () => {
  const wrapper = (await fixture(
    html`<div style="display: flex; inline-size: 600px;">
      <lr-entity-card></lr-entity-card>
      <div style="block-size: 400px;">tall sibling</div>
    </div>`
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-entity-card') as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;

  const hostRect = el.getBoundingClientRect();
  // The flex row stretched the host to match the taller sibling (default align-items: stretch).
  expect(hostRect.height).to.be.greaterThan(100);

  const baseRect = el.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
  // [part="base"] must fill its own host's full measured height, not shrink-wrap to its own
  // (shorter) content and leave visible blank space below its border.
  expect(baseRect.height).to.be.closeTo(hostRect.height, 1);
});

it('routes forced-color badge paint back through the system-owned semantic tokens', async () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /@media \(forced-colors: active\).*--lr-badge-color: var\(--lr-color-text\) !important.*--lr-badge-background: var\(--lr-color-surface\) !important.*--lr-badge-border: var\(--lr-color-border-strong\) !important/
  );

  try {
    await setForcedColors('active');
    const el = (await fixture(
      html`<lr-entity-card></lr-entity-card>`
    )) as LyraEntityCard;
    el.entity = entity;
    el.types = [{ id: 'person', label: 'Person', color: '#ffffff' }];
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('lr-badge') as HTMLElement & {
      updateComplete: Promise<unknown>;
      shadowRoot: ShadowRoot;
    };
    await badge.updateComplete;
    const badgeBase = badge.shadowRoot.querySelector(
      '[part~="base"]'
    ) as HTMLElement;
    const cardBase = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(badgeBase).color).to.equal(
      getComputedStyle(cardBase).color
    );
    expect(getComputedStyle(badgeBase).backgroundColor).to.equal(
      getComputedStyle(cardBase).backgroundColor
    );
  } finally {
    await setForcedColors('none');
  }
});

describe('lr-entity-card retired show-focus-button alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-entity-card', kind: 'property', name: 'showFocusButton' }];
  const observe = (el: LyraEntityCard): string => String(el.shadowRoot!.querySelectorAll('[part="focus-button"]').length);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraEntityCard>(markup);

  it('applies without-focus-button with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-entity-card .entity=${entity} without-focus-button></lr-entity-card>`));
      plain = observe(await mount(html`<lr-entity-card .entity=${entity}></lr-entity-card>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-entity-card size and the retired compact alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-entity-card', kind: 'property', name: 'compact' }];
  const observe = (el: LyraEntityCard): string => {
    const chrome = baseChrome(el);
    return `${chrome.paddingTop}|${chrome.rowGap}`;
  };
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraEntityCard>(markup);

  it('applies size="s" with canonical defaults and no deprecation warning', async () => {
    let dense = '';
    let regular = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      dense = observe(await mount(html`<lr-entity-card size="s" .entity=${entity}></lr-entity-card>`));
      regular = observe(await mount(html`<lr-entity-card .entity=${entity}></lr-entity-card>`));
    });
    expect(dense).to.equal('8px|4px');
    expect(regular).to.equal('12px|8px');
    expect(warnings).to.have.length(0);
  });
});
