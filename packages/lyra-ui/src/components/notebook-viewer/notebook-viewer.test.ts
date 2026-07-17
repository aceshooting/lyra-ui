import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './notebook-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import { __setNotebookSanitizerForTesting } from './dompurify-loader.js';

afterEach(() => {
  __setNotebookSanitizerForTesting(undefined);
});

const NOTEBOOK = {
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { language_info: { name: 'python' } },
  cells: [
    { cell_type: 'markdown', id: 'md1', source: ['# Title\n', 'Some text.'], metadata: {} },
    {
      cell_type: 'code', id: 'code1', source: 'print("hi")', execution_count: 1, metadata: {},
      outputs: [{ output_type: 'stream', name: 'stdout', text: 'hi\n' }],
    },
    { cell_type: 'raw', id: 'raw1', source: 'plain text', metadata: {} },
  ],
};

/** Rendered cell content lives inside `<lyra-virtual-list>`'s own nested shadow root -- it composes
 *  `renderItem()`'s TemplateResult into its own render output, so a `[part="cell"]` search has to
 *  pierce that boundary rather than stopping at this component's own shadow root. */
function rowRoot(el: LyraNotebookViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lyra-virtual-list')!.shadowRoot!;
}

describe('defaults', () => {
  it('defaults to empty src/notebook/name, outputCollapseLines 40', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    expect(el.src).to.equal('');
    expect(el.notebook).to.be.undefined;
    expect(el.outputCollapseLines).to.equal(40);
  });
});

describe('parsing and rendering', () => {
  it('renders one row per cell and fires lyra-load with cellCount and language', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lyra-load');
    el.notebook = NOTEBOOK;
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ cellCount: 3, language: 'python' });
    // lyra-virtual-list measures its own viewport asynchronously (ResizeObserver), so its first
    // paint after this element's own updateComplete can still be an empty window.
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part="cell"]')];
    expect(cells.length).to.equal(3);
    expect(cells[0].getAttribute('data-cell-type')).to.equal('markdown');
    expect(cells[1].getAttribute('data-cell-type')).to.equal('code');
    expect(cells[2].getAttribute('data-cell-type')).to.equal('raw');
  });

  it('renders a markdown cell through lyra-markdown and a code cell through lyra-code-block', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${NOTEBOOK}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part="cell"]')];
    expect(cells[0].querySelector('lyra-markdown')).to.exist;
    expect(cells[1].querySelector('lyra-code-block')).to.exist;
    expect((cells[1].querySelector('lyra-code-block') as HTMLElement).getAttribute('language')).to.equal('python');
  });

  it('renders a stream output tinted by stream name and a stdout/stderr data attribute', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${NOTEBOOK}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.getAttribute('data-output-type')).to.equal('stream');
    expect(output.getAttribute('data-stream')).to.equal('stdout');
    expect(output.textContent).to.include('hi');
  });

  it('rejects an unsupported nbformat major version with the localized error', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    el.notebook = { nbformat: 3, nbformat_minor: 0, cells: [] };
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('rejects malformed notebook shape as invalid', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    el.notebook = { not: 'a notebook' };
    await eventPromise;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('parses a JSON string passed to notebook, winning over src', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer src="https://example.test/should-not-fetch.ipynb"></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    el.notebook = JSON.stringify(NOTEBOOK);
    await waitUntil(() => (el.shadowRoot!.querySelector('lyra-virtual-list')?.shadowRoot?.querySelectorAll('[part="cell"]').length ?? 0) > 0);
    expect(rowRoot(el).querySelectorAll('[part="cell"]').length).to.equal(3);
  });
});

describe('output collapsing', () => {
  it('collapses a text/plain output longer than outputCollapseLines behind a toggle', async () => {
    const longText = Array.from({ length: 60 }, (_v, i) => `line ${i}`).join('\n');
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{ cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {}, outputs: [{ output_type: 'execute_result', data: { 'text/plain': longText } }] }],
    };
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${notebook}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output-toggle"]') !== null);
    const toggle = rowRoot(el).querySelector('[part="output-toggle"]') as HTMLButtonElement;
    expect(toggle).to.exist;
    toggle.click();
    await el.updateComplete;
    expect(rowRoot(el).querySelector('[part="output"]')!.textContent).to.include('line 59');
  });
});

describe('search', () => {
  it('search() matches cell source and text outputs, one match per cell', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${NOTEBOOK}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    const count = await el.search('hi');
    expect(count).to.equal(1);
  });

  it('clearSearch() resets and emits lyra-search-change', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${NOTEBOOK}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    await el.search('hi');
    const eventPromise = oneEvent(el, 'lyra-search-change');
    el.clearSearch();
    expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
  });
});

describe('node-path and fragment anchors', () => {
  it('scrollToAnchor resolves a node-path [cellIndex] and a fragment cell id', async () => {
    const el = (await fixture(html`<lyra-notebook-viewer .notebook=${NOTEBOOK}></lyra-notebook-viewer>`)) as LyraNotebookViewer;
    // Shrunk from the 5000ms/250ms defaults -- an anchor that never resolves (out-of-bounds index,
    // an unsupported kind) otherwise retries for the full real timeout before settling false.
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [1] })).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'raw1' })).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [99] })).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });
});

describe('accessibility', () => {
  it('is accessible with a rendered notebook', async () => {
    const el = await fixture(html`<lyra-notebook-viewer name="demo.ipynb" .notebook=${NOTEBOOK}></lyra-notebook-viewer>`);
    await expect(el).to.be.accessible();
  });
});
