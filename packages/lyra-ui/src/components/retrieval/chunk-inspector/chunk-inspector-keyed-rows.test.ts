import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-chunk-inspector.js';
import type { LyraChunk, LyraChunkInspector } from '../../lr-chunk-inspector.js';

const chunk = (id: string, score: number): LyraChunk => ({ id, text: `${id} text`, score, sourceId: 's', title: `${id} title` });

it('keeps keyboard focus on the same chunk when an earlier chunk is removed', async () => {
  const el = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector .chunks=${[chunk('a', 0.9), chunk('b', 0.8), chunk('c', 0.7)]}></lr-chunk-inspector>`);
  const opens = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="open-button"]')];
  await focusByKeyboard(opens[1]!);
  el.chunks = [chunk('b', 0.8), chunk('c', 0.7)];
  await el.updateComplete;
  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focused?.querySelector('[part="title"]')?.textContent).to.equal('b title');
});
