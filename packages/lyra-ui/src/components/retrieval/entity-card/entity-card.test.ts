import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './entity-card.js';
import type { LyraEntityCard, LyraEntity } from './entity-card.js';
import { styles } from './entity-card.styles.js';
import type { LyraResultField } from '../../agent-tools/result-card/result-field.class.js';

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

it('renders the noData empty state when entity is null (the default)', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  expect(el.entity).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
});

it('renders label, description, and property rows for a given entity', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.include('Marie Curie');
  expect(el.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('Physicist');
  const rows = el.shadowRoot!.querySelectorAll('[part="property"]');
  expect(rows.length).to.equal(2);
});

it('falls back to untitledEntity when label is missing', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = { id: 'e2', label: '' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.include('Untitled entity');
});

it('resolves the type badge label/color against types, falling back to the raw type id', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  el.types = types;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="type-badge"]')!.textContent).to.include('Person');

  el.entity = { ...entity, type: 'unknown-type' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="type-badge"]')!.textContent).to.include('unknown-type');
});

it('renders degree and community rows with their localized labels', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  el.communityLabel = 'Nobel laureates';
  await el.updateComplete;
  const degree = el.shadowRoot!.querySelector('[part="degree"]') as LyraResultField;
  expect(degree.label).to.equal('Connections');
  expect(degree.value).to.equal('5');
  const community = el.shadowRoot!.querySelector('[part="community"]') as LyraResultField;
  expect(community.label).to.equal('Community');
  expect(community.textContent).to.include('Nobel laureates');
});

it('localizes the degree row label via this.localize() when .strings overrides entityDegree', async () => {
  const el = (await fixture(html`
    <lr-entity-card .strings=${{ entityDegree: 'Connexions' }}></lr-entity-card>
  `)) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  const degree = el.shadowRoot!.querySelector('[part="degree"]') as LyraResultField;
  await degree.updateComplete;
  expect(degree.shadowRoot!.querySelector('[part="label"]')!.textContent).to.include('Connexions');
});

it('emits lr-entity-activate from the built-in focus button', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="focus-button"]') as HTMLElement;
  const listener = oneEvent(el, 'lr-entity-activate');
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e1' });
});

it('hides the focus button when showFocusButton is false', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  el.showFocusButton = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="focus-button"]').length).to.equal(0);
});

it('show-focus-button="false" (plain HTML attribute) also hides the focus button', async () => {
  const el = (await fixture(
    html`<lr-entity-card show-focus-button="false" .entity=${entity}></lr-entity-card>`,
  )) as LyraEntityCard;
  await el.updateComplete;
  expect(el.showFocusButton).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="focus-button"]').length).to.equal(0);
});

it('is accessible with a full entity', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
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

it('defaults to compact=false and appearance="card", rendering identically to those values restated', async () => {
  const implicit = (await fixture(html`<lr-entity-card .entity=${entity}></lr-entity-card>`)) as LyraEntityCard;
  const explicit = (await fixture(
    html`<lr-entity-card appearance="card" .compact=${false} .entity=${entity}></lr-entity-card>`,
  )) as LyraEntityCard;

  expect(implicit.compact).to.be.false;
  expect(implicit.appearance).to.equal('card');
  expect(implicit.hasAttribute('compact')).to.be.false;
  expect(implicit.getAttribute('appearance')).to.equal('card');

  expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));
  const chrome = baseChrome(implicit);
  expect(chrome.paddingTop).to.equal('12px'); // --lr-space-m
  expect(chrome.rowGap).to.equal('8px'); // --lr-space-s
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.borderTopStyle).to.equal('solid');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('reflects compact and tightens the base padding/gap, keeping the card border', async () => {
  const el = (await fixture(html`<lr-entity-card compact .entity=${entity}></lr-entity-card>`)) as LyraEntityCard;
  expect(el.hasAttribute('compact')).to.be.true;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
  expect(chrome.rowGap).to.equal('4px'); // --lr-space-xs
  expect(chrome.borderTopWidth).to.equal('1px');
  expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('lets a consumer retune the compact values through --lr-entity-card-compact-*', async () => {
  const el = (await fixture(html`<lr-entity-card compact .entity=${entity}></lr-entity-card>`)) as LyraEntityCard;
  el.style.setProperty('--lr-entity-card-compact-padding', '3px');
  el.style.setProperty('--lr-entity-card-compact-gap', '5px');
  await el.updateComplete;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('3px');
  expect(chrome.rowGap).to.equal('5px');
});

it('drops border, background, padding and radius under appearance="plain"', async () => {
  const el = (await fixture(
    html`<lr-entity-card appearance="plain" .entity=${entity}></lr-entity-card>`,
  )) as LyraEntityCard;
  expect(el.getAttribute('appearance')).to.equal('plain');
  const chrome = baseChrome(el);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.borderTopLeftRadius).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

it('orders :host([appearance="plain"]) after :host([compact]) so the equal-specificity reset wins', () => {
  const css = styles.cssText;
  const compactAt = css.indexOf(':host([compact])');
  const plainAt = css.indexOf(":host([appearance='plain'])");
  expect(compactAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(-1);
  expect(plainAt).to.be.greaterThan(compactAt);
});

it('lets plain win over compact when both are set', async () => {
  const el = (await fixture(
    html`<lr-entity-card compact appearance="plain" .entity=${entity}></lr-entity-card>`,
  )) as LyraEntityCard;
  const chrome = baseChrome(el);
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.borderTopWidth).to.equal('0px');
});

it('is accessible in the populated compact and plain states', async () => {
  const compactEl = (await fixture(
    html`<lr-entity-card compact .entity=${entity} .types=${types} community-label="Nobel laureates"></lr-entity-card>`,
  )) as LyraEntityCard;
  await expect(compactEl).to.be.accessible();

  const plainEl = (await fixture(
    html`<lr-entity-card
      appearance="plain"
      .entity=${entity}
      .types=${types}
      community-label="Nobel laureates"
    ></lr-entity-card>`,
  )) as LyraEntityCard;
  await expect(plainEl).to.be.accessible();
});

it('formats numeric properties and degree with the effective locale', async () => {
  const el = (await fixture(html`<lr-entity-card lang="ar-u-nu-arab"></lr-entity-card>`)) as LyraEntityCard;
  el.entity = { ...entity, properties: { year: 1867 }, degree: 1234 };
  await el.updateComplete;
  const property = el.shadowRoot!.querySelector('[part="property"]') as LyraResultField;
  const degree = el.shadowRoot!.querySelector('[part="degree"]') as LyraResultField;
  expect(property.value).to.equal('١٬٨٦٧');
  expect(degree.value).to.equal('١٬٢٣٤');
});
