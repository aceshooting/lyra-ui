import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-dataset-viewer.js';
import type { LyraDatasetViewer } from '../../lr-dataset-viewer.js';

function source(rowCount: number): string {
  return `data:text/csv,${encodeURIComponent(['name,value', ...Array.from({ length: rowCount }, (_, index) => `Row ${index},${index}`)].join('\n'))}`;
}

async function mount(rowCount: number, maxHeight?: string): Promise<LyraDatasetViewer> {
  const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer max-height=${maxHeight ?? ''} src=${source(rowCount)}></lr-dataset-viewer>`);
  await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="data-row"]').length ?? 0) > 0, 'rows did not render');
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  return el;
}

function parts(el: LyraDatasetViewer): { body: HTMLElement; listBase: HTMLElement } {
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  return {
    body: el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!,
    listBase: list.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!,
  };
}

const rem = (el: Element, n: number): number => parseFloat(getComputedStyle(el).fontSize) * n;

describe('lr-dataset-viewer max-height', () => {
  it('shrinks to a short table instead of reserving a fixed list height', async () => {
    const el = await mount(3, '40rem');
    const { body } = parts(el);
    expect(body.getBoundingClientRect().height).to.be.lessThan(200);
  });

  it('caps a long table at the max-height with the body as the only scroll container', async () => {
    const el = await mount(300, '10rem');
    const { body, listBase } = parts(el);
    expect(body.getBoundingClientRect().height).to.be.at.most(rem(el, 10) + 1);
    expect(body.scrollHeight).to.be.greaterThan(body.clientHeight);
    expect(listBase.scrollHeight).to.be.at.most(listBase.clientHeight + 1);
  });

  it('grows a long table to a cap larger than the default list height', async () => {
    const el = await mount(300, '40rem');
    const { body } = parts(el);
    expect(body.getBoundingClientRect().height).to.be.closeTo(rem(el, 40), 2);
  });

  it('keeps the default cap as the whole body height, header included', async () => {
    const el = await mount(300);
    const { body } = parts(el);
    expect(body.getBoundingClientRect().height).to.be.at.most(rem(el, 20) + 1);
    expect(body.scrollHeight).to.be.greaterThan(body.clientHeight);
  });
});
