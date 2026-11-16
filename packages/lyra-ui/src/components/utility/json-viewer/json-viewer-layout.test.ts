import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

const data = { contributie_proprie_lei: 20000, status: 'approved', nested: { amount: 12.5 } };

async function mount(width: string, layout?: string, wrapperStyle = ''): Promise<LyraJsonViewer> {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="inline-size: ${width}; ${wrapperStyle}">
      <lr-json-viewer aria-label="Arguments" layout=${layout ?? 'auto'} .data=${data}></lr-json-viewer>
    </div>
  `);
  const viewer = wrapper.querySelector<LyraJsonViewer>('lr-json-viewer')!;
  if (layout === undefined) viewer.removeAttribute('layout');
  await viewer.updateComplete;
  await twoFrames();
  return viewer;
}

function leafRow(viewer: LyraJsonViewer, key: string): { row: DOMRect; key: DOMRect; value: DOMRect } {
  const keyEl = [...viewer.shadowRoot!.querySelectorAll<HTMLElement>('[part="key"]')].find(
    (el) => el.textContent === key
  )!;
  const rowEl = keyEl.closest<HTMLElement>('[part="row"]')!;
  const valueEl = rowEl.querySelector<HTMLElement>('[part="value"]')!;
  return {
    row: rowEl.getBoundingClientRect(),
    key: keyEl.getBoundingClientRect(),
    value: valueEl.getBoundingClientRect(),
  };
}

function iconButtonSize(viewer: LyraJsonViewer): number {
  const toggle = viewer.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]:not([hidden])')!;
  return parseFloat(getComputedStyle(toggle).minBlockSize);
}

describe('lr-json-viewer layout', () => {
  it('keeps key and value side by side in a wide container', async () => {
    const viewer = await mount('600px');
    expect(viewer.layout).to.equal('auto');
    const { key, value } = leafRow(viewer, 'status');
    expect(Math.abs(value.top - key.top)).to.be.below(2);
    expect(value.left).to.be.above(key.right);
  });

  it('stacks the value under the key below the 30rem container query', async () => {
    const viewer = await mount('300px');
    const { key, value } = leafRow(viewer, 'status');
    expect(value.top).to.be.at.least(key.bottom - 1);
    expect(Math.abs(value.left - key.left)).to.be.below(1);
  });

  it('tightens stacked rows: no hidden-toggle floor, while real toggles keep their hit area', async () => {
    const viewer = await mount('300px', undefined, '--lr-icon-button-size: 3rem');
    const { row, key, value } = leafRow(viewer, 'status');
    expect(value.top).to.be.at.least(key.bottom - 1);
    expect(row.height).to.be.at.most(key.height + value.height + 2);
    const toggle = viewer.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]:not([hidden])')!;
    const rect = toggle.getBoundingClientRect();
    expect(rect.height).to.be.at.least(iconButtonSize(viewer) - 0.5);
    expect(rect.width).to.be.at.least(iconButtonSize(viewer) - 0.5);
  });

  it('layout="inline" keeps the side-by-side row at every width', async () => {
    const viewer = await mount('300px', 'inline');
    const { row, key, value } = leafRow(viewer, 'status');
    expect(Math.abs(value.top - key.top)).to.be.below(2);
    expect(row.height).to.be.at.least(iconButtonSize(viewer) - 0.5);
  });

  it('layout="stacked" stacks at every width, and an invalid value falls back to auto', async () => {
    const viewer = await mount('600px', 'stacked');
    let { key, value } = leafRow(viewer, 'status');
    expect(value.top).to.be.at.least(key.bottom - 1);
    viewer.layout = 'sideways' as unknown as LyraJsonViewer['layout'];
    await viewer.updateComplete;
    ({ key, value } = leafRow(viewer, 'status'));
    expect(Math.abs(value.top - key.top)).to.be.below(2);
  });

  it('follows its own allocation as the container is resized', async () => {
    const viewer = await mount('600px');
    const wrapper = viewer.parentElement!;
    wrapper.style.inlineSize = '300px';
    await waitUntil(() => {
      const { key, value } = leafRow(viewer, 'status');
      return value.top >= key.bottom - 1;
    }, 'value did not move under its key after the container narrowed');
    wrapper.style.inlineSize = '600px';
    await waitUntil(() => {
      const { key, value } = leafRow(viewer, 'status');
      return Math.abs(value.top - key.top) < 2;
    }, 'value did not return beside its key after the container widened');
  });

  it('offers line breaks after key separators instead of mid-word only', async () => {
    const viewer = await mount('180px', 'stacked');
    const keyEl = [...viewer.shadowRoot!.querySelectorAll<HTMLElement>('[part="key"]')].find(
      (el) => el.textContent === 'contributie_proprie_lei'
    )!;
    expect(keyEl.querySelectorAll('wbr')).to.have.lengthOf(2);
    // Every rendered line of the key ends at a separator: the text before each <wbr> is whole.
    const range = document.createRange();
    range.selectNodeContents(keyEl);
    const lineTops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    expect(lineTops.size).to.be.above(1);
    const firstText = [...keyEl.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent)!;
    range.selectNodeContents(firstText);
    const firstLines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    expect(firstLines.size, 'contributie_ stays on one line').to.equal(1);
  });

  it('does not collapse in a shrink-to-fit allocation and passes axe while stacked', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="display: grid; place-items: center; inline-size: 600px">
        <lr-json-viewer aria-label="Arguments" layout="stacked" .data=${data}></lr-json-viewer>
      </div>
    `);
    const viewer = wrapper.querySelector<LyraJsonViewer>('lr-json-viewer')!;
    await viewer.updateComplete;
    expect(viewer.getBoundingClientRect().width).to.be.above(200);
    await expect(viewer).to.be.accessible();
  });
});
