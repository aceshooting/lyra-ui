import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './community-card.js';
import type { LyraCommunityCard } from './community-card.js';

const member = (id: string) => ({ id, label: `${id} member` });

it('keeps keyboard focus on the same member when an earlier member is removed', async () => {
  const el = await fixture<LyraCommunityCard>(html`<lr-community-card .community=${{ id: 'c', label: 'Group' }}
    .members=${[member('a'), member('b'), member('c')]}></lr-community-card>`);
  const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="member"]')];
  await focusByKeyboard(buttons[1]!);
  el.members = [member('b'), member('c')];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.textContent?.trim()).to.equal('b member');
});
