import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './community-card.js';
import type { LyraCommunityCard, LyraCommunity } from './community-card.js';
import type { LyraEntity } from '../entity-card/entity-card.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const community: LyraCommunity = {
  id: 'c1',
  label: 'Nobel laureates',
  summary: 'A cluster of prize winners.',
  memberCount: 3,
};
const members: LyraEntity[] = [
  { id: 'e1', label: 'Marie Curie' },
  { id: 'e2', label: 'Pierre Curie' },
  { id: 'e3', label: 'Henri Becquerel' },
];

it('renders the noData empty state when community is null (the default)', async () => {
  const el = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  expect(el.community).to.equal(null);
  expect(el.shadowRoot!.querySelector('lr-empty') != null).to.equal(true);
});

it('falls back to untitledCommunity when label is missing', async () => {
  const el = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = { id: 'c2', label: '' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="title"]')!.textContent
  ).to.include('Untitled community');
});

it('renders the member count from memberCount (authoritative over members.length)', async () => {
  const el = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members.slice(0, 2);
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="member-count"]')!.textContent
  ).to.include('3');
});

it('never lets a stale memberCount contradict the known rendered member records', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="2"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = { ...community, memberCount: 1 };
  el.members = members;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="member-count"]')!.textContent
  ).to.include('3');
  expect(
    el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
  ).to.include('1');
});

it('rejects invalid explicit totals and derives a truthful count from known records', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="2"></lr-community-card>`
  )) as LyraCommunityCard;
  el.members = members;
  for (const memberCount of [
    -1,
    1.5,
    Number.POSITIVE_INFINITY,
    Number.NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    el.community = { ...community, memberCount };
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="member-count"]')!.textContent
    ).to.include('3');
    expect(
      el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
    ).to.include('1');
  }
});

it('renders up to maxMembers chips and a +N overflow chip', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="2"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(2);
  expect(
    el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
  ).to.include('1');
});

it('clamps a negative max-members to showing zero members, not slice(0, -1)\'s "all but the last" behavior', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="-1"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(0);
  expect(
    el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
  ).to.include('3');
});

it('falls back to the documented default of 8 for a non-numeric max-members', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="not-a-number"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  // All 3 members shown (well under the default cap of 8), and no overflow chip -- unlike
  // slice(0, NaN)'s coincidental (and undocumented) "0 members" behavior.
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="overflow"]') == null).to.be.true;
});

it('emits lr-entity-activate when a member chip is activated', async () => {
  const el = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-entity-activate');
  (
    el.shadowRoot!.querySelectorAll('[part="member"]')[0] as HTMLButtonElement
  ).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e1' });
});

it('emits lr-drill from the drill button, the header, and the overflow chip', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="1"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;

  const drillButton = el.shadowRoot!.querySelector(
    '[part="drill-button"]'
  ) as HTMLElement;
  let listener = oneEvent(el, 'lr-drill');
  drillButton.click();
  expect((await listener).detail).to.deep.equal({ communityId: 'c1' });

  const header = el.shadowRoot!.querySelector(
    '[part="title"] button'
  ) as HTMLButtonElement;
  listener = oneEvent(el, 'lr-drill');
  header.click();
  expect((await listener).detail).to.deep.equal({ communityId: 'c1' });

  const overflow = el.shadowRoot!.querySelector(
    '[part="overflow"]'
  ) as HTMLButtonElement;
  listener = oneEvent(el, 'lr-drill');
  overflow.click();
  expect((await listener).detail).to.deep.equal({ communityId: 'c1' });
});

it('renders only title + member count + drill button in compact mode -- no summary, no chips', async () => {
  const el = (await fixture(
    html`<lr-community-card compact></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="summary"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="member"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="title"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="member-count"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="drill-button"]')).to.exist;
});

it('tightens [part="base"] padding and gap in compact mode, matching sibling lr-entity-card/lr-source-card', async () => {
  const regular = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  regular.community = community;
  regular.members = members;
  await regular.updateComplete;
  const regularBase = regular.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const compact = (await fixture(
    html`<lr-community-card compact></lr-community-card>`
  )) as LyraCommunityCard;
  compact.community = community;
  compact.members = members;
  await compact.updateComplete;
  const compactBase = compact.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const regularPadding = getComputedStyle(regularBase).paddingBlockStart;
  const compactPadding = getComputedStyle(compactBase).paddingBlockStart;
  expect(parseFloat(compactPadding)).to.be.lessThan(parseFloat(regularPadding));

  const regularGap = getComputedStyle(regularBase).rowGap;
  const compactGap = getComputedStyle(compactBase).rowGap;
  expect(parseFloat(compactGap)).to.be.lessThan(parseFloat(regularGap));
});

it('retunes the compact padding/gap through --lr-community-card-compact-*, falling back to the pre-existing values when unset', async () => {
  const unset = (await fixture(
    html`<lr-community-card compact .community=${community} .members=${members}></lr-community-card>`
  )) as LyraCommunityCard;
  await unset.updateComplete;
  const unsetBase = getComputedStyle(unset.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(unsetBase.paddingTop).to.equal('8px'); // --lr-space-s fallback
  expect(unsetBase.rowGap).to.equal('4px'); // --lr-space-xs fallback

  const retuned = (await fixture(
    html`<lr-community-card
      compact
      .community=${community}
      .members=${members}
      style="--lr-community-card-compact-padding: 3px; --lr-community-card-compact-gap: 5px"
    ></lr-community-card>`
  )) as LyraCommunityCard;
  await retuned.updateComplete;
  const retunedBase = getComputedStyle(retuned.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
  expect(retunedBase.paddingTop).to.equal('3px');
  expect(retunedBase.rowGap).to.equal('5px');
});

it('defaults to frame="card", keeping the bordered chrome', async () => {
  const el = (await fixture(
    html`<lr-community-card></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  await el.updateComplete;
  expect(el.frame).to.equal('card');
  expect(el.getAttribute('frame')).to.equal('card');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const chrome = getComputedStyle(base);
  expect(chrome.borderTopWidth).to.not.equal('0px');
  expect(chrome.paddingTop).to.not.equal('0px');
});

it('retints the resting card frame through --lr-community-card-bg', async () => {
  const el = (await fixture(
    html`<lr-community-card .community=${community} style="--lr-community-card-bg: rgb(1, 2, 3)"></lr-community-card>`
  )) as LyraCommunityCard;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).backgroundColor).to.equal('rgb(1, 2, 3)');
});

it('leaves the resting frame on the shared surface token when --lr-community-card-bg is unset', async () => {
  const el = (await fixture(
    html`<lr-community-card .community=${community} style="--lr-color-surface: rgb(4, 5, 6)"></lr-community-card>`
  )) as LyraCommunityCard;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).backgroundColor).to.equal('rgb(4, 5, 6)');
});

it('keeps frame="plain" transparent regardless of --lr-community-card-bg', async () => {
  const el = (await fixture(
    html`<lr-community-card
      frame="plain"
      .community=${community}
      style="--lr-community-card-bg: rgb(1, 2, 3)"
    ></lr-community-card>`
  )) as LyraCommunityCard;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
});

it('drops border, background, and padding under frame="plain" -- the same nested-card escape hatch as its sibling lr-entity-card', async () => {
  const el = (await fixture(
    html`<lr-community-card frame="plain"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  await el.updateComplete;
  expect(el.getAttribute('frame')).to.equal('plain');
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
    ></lr-community-card>`
  )) as LyraCommunityCard;
  expect(
    el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')
  ).to.equal('Pas de données');

  el.community = { id: 'c2', label: '', memberCount: 5 };
  el.members = members.slice(0, 1);
  el.maxMembers = 0;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="title"]')!.textContent
  ).to.include('Communauté sans titre');
  expect(
    el.shadowRoot!.querySelector('[part="member-count"]')!.textContent
  ).to.include('5 membres');
  expect(
    el.shadowRoot!.querySelector('[part="drill-button"]')!.textContent
  ).to.include('Explorer la communauté');
  expect(
    el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
  ).to.include('5 de plus');
});

it('is accessible with members and an overflow chip', async () => {
  const el = (await fixture(
    html`<lr-community-card max-members="2"></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = community;
  el.members = members;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders the title, member, and overflow hover/focus-visible feedback', async () => {
  const el = await fixture<LyraCommunityCard>(html`
    <lr-community-card
      max-members="1"
      style="--lr-color-brand-quiet: rgb(1, 2, 3); --lr-focus-ring-width: 6px; --lr-focus-ring-color: rgb(4, 5, 6)"
      .community=${community}
      .members=${members}
    ></lr-community-card>
  `);
  const title = el.shadowRoot!.querySelector<HTMLElement>('[part="title"] button')!;
  const member = el.shadowRoot!.querySelector<HTMLElement>('[part="member"]')!;
  const overflow = el.shadowRoot!.querySelector<HTMLElement>('[part="overflow"]')!;

  for (const target of [title, member, overflow]) {
    target.scrollIntoView({ block: 'center' });
    const rect = target.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => target === title
          ? getComputedStyle(target).textDecorationLine.includes('underline')
          : getComputedStyle(target).backgroundColor === 'rgb(1, 2, 3)',
        `${target.getAttribute('part') ?? 'title button'} never painted its hover feedback`
      );
    } finally {
      await resetMouse();
    }

    await sendKeys({ press: 'Tab' });
    target.focus();
    await waitUntil(() => {
      const computed = getComputedStyle(target);
      return computed.outlineWidth === '6px' && computed.outlineColor === 'rgb(4, 5, 6)';
    }, `${target.getAttribute('part') ?? 'title button'} never painted its keyboard focus ring`);
  }
});

it('formats member and overflow counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-community-card
      lang="ar-u-nu-arab"
      max-members="1"
    ></lr-community-card>`
  )) as LyraCommunityCard;
  el.community = { ...community, memberCount: 1234 };
  el.members = members;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="member-count"]')!.textContent
  ).to.include('١٬٢٣٤');
  expect(
    el.shadowRoot!.querySelector('[part="overflow"]')!.textContent
  ).to.include('١٬٢٣٣');
});
