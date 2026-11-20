import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import '../../lr-reorder-list.js';
import '../../lr-reorder-item.js';
import type { LyraReorderList } from './reorder-list.class.js';
import type { LyraReorderItem } from './reorder-item.class.js';

const values = (el: LyraReorderList): string[] =>
  [...el.querySelectorAll<LyraReorderItem>('lr-reorder-item')].map((item) => item.value);

async function holdMove(): Promise<{ el: LyraReorderList; other: HTMLElement; middle: LyraReorderItem }> {
  const root = await fixture<HTMLDivElement>(html`<div><lr-reorder-list>
    <lr-reorder-item value="a">Row A</lr-reorder-item>
    <lr-reorder-item value="b">Row B</lr-reorder-item>
    <lr-reorder-item value="c">Row C</lr-reorder-item>
  </lr-reorder-list><div></div></div>`);
  const el = root.querySelector<LyraReorderList>('lr-reorder-list')!;
  const middle = el.querySelectorAll<LyraReorderItem>('lr-reorder-item')[1]!;
  await middle.updateComplete;
  el.addEventListener('lr-reorder-request', (event) => event.preventDefault());
  middle.shadowRoot!.querySelector<HTMLButtonElement>('[part="move-up-button"]')!.click();
  await el.updateComplete;
  expect(middle.pending).to.equal(true);
  return { el, other: root.querySelector<HTMLElement>('div')!, middle };
}

describe('lr-reorder-list same-task DOM move', () => {
  it('keeps a held move across a move, so finalizePendingMove() still applies it', async () => {
    const { el, other, middle } = await holdMove();
    other.append(el);
    await el.updateComplete; await aTimeout(0);
    expect(middle.pending).to.equal(true);
    el.finalizePendingMove();
    await el.updateComplete;
    expect(values(el)).to.deep.equal(['b', 'a', 'c']);
  });

  it('drops a held move when the list is genuinely removed', async () => {
    const { el, other, middle } = await holdMove();
    el.remove(); await aTimeout(0);
    other.append(el);
    await el.updateComplete;
    el.finalizePendingMove();
    await el.updateComplete;
    expect(middle.pending).to.equal(false);
    expect(values(el)).to.deep.equal(['a', 'b', 'c']);
  });
});
