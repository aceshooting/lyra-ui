import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './community-card.js';
import type { LyraCommunityCard, LyraCommunity } from './community-card.js';
import type { LyraEntity } from '../entity-card/entity-card.js';
import { styles } from './community-card.styles.js';

const community: LyraCommunity = { id: 'c1', label: 'Nobel laureates', summary: 'A cluster of prize winners.', memberCount: 3 };
const members: LyraEntity[] = [
  { id: 'e1', label: 'Marie Curie' },
  { id: 'e2', label: 'Pierre Curie' },
  { id: 'e3', label: 'Henri Becquerel' },
];

it('renders the noData empty state when community is null (the default)', async () => {
  const el = (await fixture(html`<lr-community-card></lr-community-card>`)) as LyraCommunityCard;
  expect(el.community).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('falls back to untitledCommunity when label is missing', async () => {
  const el = (await fixture(html`<lr-community-card></lr-community-card>`)) as LyraCommunityCard;
  el.community = { id: 'c2', label: '' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.include('Untitled community');
});

it('renders the member count from memberCount (authoritative over members.length)', async () => {
  const el = (await fixture(html`<lr-community-card></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members.slice(0, 2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')!.textContent).to.include('3');
});

it('renders up to maxMembers chips and a +N overflow chip', async () => {
  const el = (await fixture(html`<lr-community-card max-members="2"></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="overflow"]')!.textContent).to.include('1');
});

it('clamps a negative max-members to showing zero members, not slice(0, -1)\'s "all but the last" behavior', async () => {
  const el = (await fixture(html`<lr-community-card max-members="-1"></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="overflow"]')!.textContent).to.include('3');
});

it('falls back to the documented default of 8 for a non-numeric max-members', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="not-a-number"></lr-community-card>`,
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  // All 3 members shown (well under the default cap of 8), and no overflow chip -- unlike
  // slice(0, NaN)'s coincidental (and undocumented) "0 members" behavior.
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="overflow"]')).to.not.exist;
});

it('emits lr-entity-activate when a member chip is activated', async () => {
  const el = (await fixture(html`<lr-community-card></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-entity-activate');
  (el.shadowRoot!.querySelectorAll('[part="member"]')[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ id: 'e1' });
});

it('emits lr-drill from the drill button, the header, and the overflow chip', async () => {
  const el = (await fixture(html`<lr-community-card max-members="1"></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;

  const drillButton = el.shadowRoot!.querySelector('[part="drill-button"]') as HTMLElement;
  let listener = oneEvent(el, 'lr-drill');
  drillButton.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });

  const header = el.shadowRoot!.querySelector('[part="title"] button') as HTMLButtonElement;
  listener = oneEvent(el, 'lr-drill');
  header.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });

  const overflow = el.shadowRoot!.querySelector('[part="overflow"]') as HTMLButtonElement;
  listener = oneEvent(el, 'lr-drill');
  overflow.click();
  expect((await listener).detail).to.deep.equal({ id: 'c1' });
});

it('renders only title + member count + drill button in compact mode -- no summary, no chips', async () => {
  const el = (await fixture(html`<lr-community-card compact></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="summary"]')).to.not.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="drill-button"]')).to.exist;
});

it('defaults to appearance="card", keeping the bordered chrome', async () => {
  const el = (await fixture(html`<lr-community-card></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  await el.updateComplete;
  expect(el.appearance).to.equal('card');
  expect(el.getAttribute('appearance')).to.equal('card');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const chrome = getComputedStyle(base);
  expect(chrome.borderTopWidth).to.not.equal('0px');
  expect(chrome.paddingTop).to.not.equal('0px');
});

it('drops border, background, and padding under appearance="plain" -- the same nested-card escape hatch as its sibling lr-entity-card', async () => {
  const el = (await fixture(
    html`<lr-community-card appearance="plain"></lr-community-card>`,
  )) as LyraCommunityCard;
  el.community = community;
  await el.updateComplete;
  expect(el.getAttribute('appearance')).to.equal('plain');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const chrome = getComputedStyle(base);
  expect(chrome.borderTopWidth).to.equal('0px');
  expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(chrome.paddingTop).to.equal('0px');
  expect(chrome.paddingLeft).to.equal('0px');
});

it('routes every localized string through this.localize(), provable via a .strings override reaching the rendered DOM', async () => {
  const el = (await fixture(
    html`<lr-community-card
      .strings=${{
        noData: 'Pas de données',
        untitledCommunity: 'Communauté sans titre',
        communityMemberCount: '{count} membres',
        communityDrillIn: 'Explorer la communauté',
        showMoreCount: '{count} de plus',
      }}
    ></lr-community-card>`,
  )) as LyraCommunityCard;
  expect(el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')).to.equal('Pas de données');

  el.community = { id: 'c2', label: '', memberCount: 5 };
  el.members = members.slice(0, 1);
  el.maxMembers = 0;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="title"]')!.textContent).to.include('Communauté sans titre');
  expect(el.shadowRoot!.querySelector('[part="member-count"]')!.textContent).to.include('5 membres');
  expect(el.shadowRoot!.querySelector('[part="drill-button"]')!.textContent).to.include('Explorer la communauté');
  expect(el.shadowRoot!.querySelector('[part="overflow"]')!.textContent).to.include('5 de plus');
});

it('is accessible with members and an overflow chip', async () => {
  const el = (await fixture(html`<lr-community-card max-members="2"></lr-community-card>`)) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('gives the title button, member, and overflow parts hover/focus-visible', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='title'\] button:hover/);
  expect(css).to.match(/\[part='title'\] button:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).to.match(/\[part='member'\]:hover/);
  expect(css).to.match(/\[part='overflow'\]:hover/);
  expect(css).to.match(/\[part='member'\]:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).to.match(/\[part='overflow'\]:focus-visible[^{]*\{[^}]*outline:/);
});

it('formats member and overflow counts with the effective locale', async () => {
  const el = (await fixture(html`<lr-community-card lang="ar-u-nu-arab" max-members="1"></lr-community-card>`)) as LyraCommunityCard;
  el.community = { ...community, memberCount: 1234 };
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')!.textContent).to.include('١٬٢٣٤');
  expect(el.shadowRoot!.querySelector('[part="overflow"]')!.textContent).to.include('١٬٢٣٣');
});
