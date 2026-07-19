import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './entity-card.js';
import type { LyraEntityCard, LyraEntity } from './entity-card.js';
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
  expect(el.shadowRoot!.querySelector('[part="focus-button"]')).to.not.exist;
});

it('is accessible with a full entity', async () => {
  const el = (await fixture(html`<lr-entity-card></lr-entity-card>`)) as LyraEntityCard;
  el.entity = entity;
  el.types = types;
  el.communityLabel = 'Nobel laureates';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
