import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-retrieval-trace.js';
import type { LyraRetrievalTrace, RetrievalStage } from '../../lr-retrieval-trace.js';

const stage = (id: string): RetrievalStage => ({ id, kind: 'retrieve', startMs: 0, endMs: 10, status: 'success', evidence: { text: `${id} evidence` } });

it('keeps keyboard focus on the same stage when an earlier stage is removed', async () => {
  const el = await fixture<LyraRetrievalTrace>(html`<lr-retrieval-trace .stages=${[stage('a'), stage('b'), stage('c')]}></lr-retrieval-trace>`);
  const toggles = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="evidence-toggle"]')];
  await focusByKeyboard(toggles[1]!);
  el.stages = [stage('b'), stage('c')];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.closest<HTMLElement>('[part="evidence-row"]')?.dataset['id']).to.equal('b');
});
