import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './community-card.js';
import type { LyraCommunityCard, LyraCommunity } from './community-card.js';
import type { LyraEntity } from '../entity-card/entity-card.js';

const community: LyraCommunity = { id: 'c1', label: 'Nobel laureates', summary: 'A cluster of prize winners.', memberCount: 3 };
const members: LyraEntity[] = [
  { id: 'e1', label: 'Marie Curie' },
  { id: 'e2', label: 'Pierre Curie' },
  { id: 'e3', label: 'Henri Becquerel' },
];

it('renders the noData empty state when community is null (the default)', async () => {
  const el = (await fixture(html`<lyra-community-card></lyra-community-card>`)) as LyraCommunityCard;
  expect(el.community).to.equal(null);
  expect(el.shadowRoot!.querySelector('lyra-empty')).to.exist;
});

it('falls back to untitledCommunity when label is missing', async () => {
  const el = (await fixture(html`<lyra-community-card></lyra-community-card>`)) as LyraCommunityCard;
  el.community = { id: 'c2', label: '' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.include('Untitled community');
});

it('renders the member count from memberCount (authoritative over members.length)', async () => {
  const el = (await fixture(html`<lyra-community-card></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members.slice(0, 2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')!.textContent).to.include('3');
});

it('renders up to maxMembers chips and a +N overflow chip', async () => {
  const el = (await fixture(html`<lyra-community-card max-members="2"></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="overflow"]')!.textContent).to.include('1');
});

it('emits lyra-entity-activate when a member chip is activated', async () => {
  const el = (await fixture(html`<lyra-community-card></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  const listener = oneEvent(el, 'lyra-entity-activate');
  (el.shadowRoot!.querySelectorAll('[part="member"]')[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e1' });
});

it('emits lyra-drill from the drill button, the header, and the overflow chip', async () => {
  const el = (await fixture(html`<lyra-community-card max-members="1"></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;

  const drillButton = el.shadowRoot!.querySelector('[part="drill-button"]') as HTMLElement;
  let listener = oneEvent(el, 'lyra-drill');
  drillButton.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });

  const header = el.shadowRoot!.querySelector('[part="title"] button') as HTMLButtonElement;
  listener = oneEvent(el, 'lyra-drill');
  header.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });

  const overflow = el.shadowRoot!.querySelector('[part="overflow"]') as HTMLButtonElement;
  listener = oneEvent(el, 'lyra-drill');
  overflow.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });
});

it('renders only title + member count + drill button in compact mode -- no summary, no chips', async () => {
  const el = (await fixture(html`<lyra-community-card compact></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="drill-button"]')).to.exist;
});

it('is accessible with members and an overflow chip', async () => {
  const el = (await fixture(html`<lyra-community-card max-members="2"></lyra-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
