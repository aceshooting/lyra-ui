import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-notebook-viewer.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import type { LyraNotebookViewer } from '../../lr-notebook-viewer.js';

const notebook = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [
    { cell_type: 'markdown', id: 'md', source: ['![x](https://example.test/cell.png)\n\n[l](https://example.invalid/)'], metadata: {} },
    {
      cell_type: 'code', id: 'code', source: 'print(1)', metadata: {}, execution_count: 1,
      outputs: [{ output_type: 'stream', name: 'stderr', text: 'warning text' }, { output_type: 'stream', name: 'stdout', text: 'result' }],
    },
  ],
};

async function mount(): Promise<{ el: LyraNotebookViewer; list: HTMLElement }> {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`);
  const list = el.shadowRoot!.querySelector<HTMLElement>('lr-virtual-list')!;
  await waitUntil(() => (list.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) === 2, 'cells did not render');
  return { el, list };
}

describe('lr-notebook-viewer cell output', () => {
  it('labels a stderr stream with visually hidden text', async () => {
    const { list } = await mount();
    const label = list.shadowRoot!.querySelector<HTMLElement>('[data-stream="stderr"] [part~="output-stream-label"]')!;
    expect(label !== null).to.equal(true);
    expect(label.textContent!.trim().length).to.be.greaterThan(0);
    const rect = label.getBoundingClientRect();
    expect(rect.width).to.be.at.most(1);
    expect(rect.height).to.be.at.most(1);
  });

  it('visually distinguishes stderr from stdout without relying on its color', async () => {
    const { list } = await mount();
    const style = (stream: string) => getComputedStyle(list.shadowRoot!.querySelector(`[data-stream="${stream}"]`)!);
    expect(parseFloat(style('stderr').borderInlineStartWidth)).to.be.greaterThan(parseFloat(style('stdout').borderInlineStartWidth));
  });

  it('does not render remote images from a markdown cell', async () => {
    const { list } = await mount();
    const markdown = list.shadowRoot!.querySelector('lr-markdown')!;
    await waitUntil(() => markdown.shadowRoot?.querySelector('a') != null, 'markdown did not render');
    const remote = [...markdown.shadowRoot!.querySelectorAll('img')].filter((img) => (img.getAttribute('src') ?? '').includes('example.test/cell.png')).length;
    expect(remote).to.equal(0);
  });

  it('seals the markdown link activation event so it does not reach the host', async () => {
    const { el, list } = await mount();
    const markdown = list.shadowRoot!.querySelector('lr-markdown')!;
    let leaked = 0;
    const listener = () => { leaked++; };
    el.addEventListener('lr-link-activate', listener);
    markdown.dispatchEvent(new CustomEvent('lr-link-activate', { bubbles: true, composed: true, detail: {} }));
    el.removeEventListener('lr-link-activate', listener);
    expect(leaked).to.equal(0);
  });

  it('outlines the active cell under forced colors', async () => {
    await setForcedColors('active');
    try {
      const { el, list } = await mount();
      expect(await el.scrollToAnchor({ kind: 'node-path', path: [1] })).to.equal(true);
      await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-active"]') !== null, 'active cell did not render');
      const style = getComputedStyle(list.shadowRoot!.querySelector('[part~="cell-active"]')!);
      expect(style.outlineStyle).to.equal('solid');
      expect(parseFloat(style.outlineWidth)).to.be.greaterThan(0);
    } finally {
      await setForcedColors('none');
    }
  });
});

it('shrinks a one-cell notebook to its content inside the height cap', async () => {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer dir="rtl" max-height="500px"
    .notebook=${{ nbformat: 4, nbformat_minor: 5, cells: [{ cell_type: 'raw', source: 'total = 1' }] }}></lr-notebook-viewer>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => !!list.shadowRoot?.querySelector('[part="raw-source"]'));
  const raw = list.shadowRoot!.querySelector<HTMLElement>('[part="raw-source"]')!;
  expect(getComputedStyle(raw).direction).to.equal('ltr');
  expect(raw.tabIndex).to.equal(0);
  const port = list.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const spacer = list.shadowRoot!.querySelector<HTMLElement>('[part="spacer"]')!;
  expect(port.clientHeight).to.be.closeTo(spacer.offsetHeight, 1);
});

it('lets a wide raster output shrink to the cell', async () => {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer style="inline-size: 240px" .notebook=${{
    nbformat: 4, nbformat_minor: 5,
    cells: [{ cell_type: 'code', source: 'x', outputs: [{ output_type: 'display_data', data: { 'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAfQAAAABCAYAAAA=', 'text/plain': 'wide' } }] }],
  }}></lr-notebook-viewer>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => !!list.shadowRoot?.querySelector('[part~="output-image"]'));
  const style = getComputedStyle(list.shadowRoot!.querySelector('[part~="output-image"]')!);
  expect(style.maxWidth).to.equal('100%');
});

it('keeps one parsed JSON object per output across row re-renders', async () => {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer .notebook=${{
    nbformat: 4, nbformat_minor: 5,
    cells: [{ cell_type: 'code', source: 'x', outputs: [{ output_type: 'display_data', data: { 'application/json': '{"a":{"b":1}}' } }] }],
  }}></lr-notebook-viewer>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => !!list.shadowRoot?.querySelector('lr-json-viewer'));
  const first = (list.shadowRoot!.querySelector('lr-json-viewer') as unknown as { data: unknown }).data;
  el.requestUpdate();
  await el.updateComplete;
  await waitUntil(() => !!list.shadowRoot?.querySelector('lr-json-viewer'));
  const second = (list.shadowRoot!.querySelector('lr-json-viewer') as unknown as { data: unknown }).data;
  expect(first === second).to.equal(true);
});

it('reuses sanitized output without joining markup chunks on a row repaint', async () => {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer .notebook=${{
    nbformat: 4, nbformat_minor: 5, cells: [{ cell_type: 'code', source: 'x',
      outputs: [{ output_type: 'display_data', data: { 'text/html': ['<b>chunk', 'ed</b>'] } }] }],
  }}></lr-notebook-viewer>`);
  const root = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
  await waitUntil(() => root.querySelector('b')?.textContent === 'chunked');
  const join = Array.prototype.join;
  let joins = 0;
  Array.prototype.join = function (separator?: string) {
    if (this[0] === '<b>chunk') joins++;
    return join.call(this, separator);
  };
  try {
    el.requestUpdate();
    await el.updateComplete;
    await (el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect(root.querySelector('b')?.textContent).to.equal('chunked');
    expect(joins).to.equal(0);
  } finally { Array.prototype.join = join; }
});
