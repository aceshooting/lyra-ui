import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-memory-panel.js';
import type { LyraMemoryItem, LyraMemoryPanel } from '../../lr-memory-panel.js';

const item = (id: string): LyraMemoryItem => ({ id, text: `${id} memory` });

it('keeps keyboard focus on the same memory when an earlier memory is removed', async () => {
  const el = await fixture<LyraMemoryPanel>(html`<lr-memory-panel .longTerm=${[item('a'), item('b'), item('c')]}></lr-memory-panel>`);
  const removes = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="remove-button"]')];
  await focusByKeyboard(removes[1]!);
  el.longTerm = [item('b'), item('c')];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.closest<HTMLElement>('[part="item"]')?.dataset['id']).to.equal('b');
});
