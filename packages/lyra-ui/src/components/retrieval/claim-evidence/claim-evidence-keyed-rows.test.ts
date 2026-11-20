import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-claim-evidence.js';
import type { GroundedClaim } from '../../../ai/types.js';
import type { LyraClaimEvidence } from '../../lr-claim-evidence.js';

const claim = (id: string): GroundedClaim => ({ id, text: `${id} claim`, status: 'supported', citationIds: [] });

it('keeps keyboard focus on the same claim when an earlier claim is removed', async () => {
  const el = await fixture<LyraClaimEvidence>(html`<lr-claim-evidence .claims=${[claim('a'), claim('b'), claim('c')]} .citations=${[]}></lr-claim-evidence>`);
  const triggers = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="claim-trigger"]')];
  await focusByKeyboard(triggers[1]!);
  el.claims = [claim('b'), claim('c')];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.textContent).to.include('b claim');
});
