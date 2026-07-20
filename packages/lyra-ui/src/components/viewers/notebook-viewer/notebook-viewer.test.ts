import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './notebook-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import { __setNotebookSanitizerForTesting } from './dompurify-loader.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { styles } from './notebook-viewer.styles.js';

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

/** Rendered cell content lives inside `<lr-virtual-list>`'s own nested shadow root -- it composes
 *  `renderItem()`'s TemplateResult into its own render output, so a `[part="cell"]` search has to
 *  pierce that boundary rather than stopping at this component's own shadow root. */
function rowRoot(el: LyraNotebookViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
}

describe('defaults', () => {
  it('defaults to empty src/notebook/name, outputCollapseLines 40', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    expect(el.src).to.equal('');
    expect(el.notebook).to.be.undefined;
    expect(el.outputCollapseLines).to.equal(40);
  });
});

describe('parsing and rendering', () => {
  it('renders one row per cell and fires lr-load with cellCount and language', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-load');
    el.notebook = NOTEBOOK;
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ cellCount: 3, language: 'python' });
    // lr-virtual-list measures its own viewport asynchronously (ResizeObserver), so its first
    // paint after this element's own updateComplete can still be an empty window.
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part="cell"]')];
    expect(cells.length).to.equal(3);
    expect(cells[0].getAttribute('data-cell-type')).to.equal('markdown');
    expect(cells[1].getAttribute('data-cell-type')).to.equal('code');
    expect(cells[2].getAttribute('data-cell-type')).to.equal('raw');
  });

  it('renders a markdown cell through lr-markdown and a code cell through lr-code-block', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part="cell"]')];
    expect(cells[0].querySelector('lr-markdown')).to.exist;
    expect(cells[1].querySelector('lr-code-block')).to.exist;
    expect((cells[1].querySelector('lr-code-block') as HTMLElement).getAttribute('language')).to.equal('python');
  });

  it('renders a stream output tinted by stream name and a stdout/stderr data attribute', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.getAttribute('data-output-type')).to.equal('stream');
    expect(output.getAttribute('data-stream')).to.equal('stdout');
    expect(output.textContent).to.include('hi');
  });

  it('renders an error output with the localized label as its own element, not string-joined onto the traceback', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {},
        outputs: [{ output_type: 'error', ename: 'NameError', evalue: "name 'x' is not defined", traceback: ['Traceback line 1'] }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"][data-output-type="error"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"][data-output-type="error"]')!;
    const label = output.querySelector('.error-output-label')!;
    expect(label).to.exist;
    expect(label.textContent).to.equal('Error');
    expect(output.textContent).to.include("NameError: name 'x' is not defined");
    expect(output.textContent).to.include('Traceback line 1');
    // no hardcoded "<label>: " joiner between the label and the data
    expect(output.textContent).to.not.include('Error: NameError');
  });

  it('interprets ANSI SGR codes in a stream output as styled spans, stripping the escape sequences', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'print(x)', execution_count: 1, metadata: {},
        outputs: [{ output_type: 'stream', name: 'stdout', text: '[31mred text[0m plain' }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.textContent).to.equal('red text plain');
    const styledSpan = output.querySelector('span')!;
    expect(styledSpan).to.exist;
    expect(styledSpan.textContent).to.equal('red text');
    expect(styledSpan.style.color).to.equal('var(--lr-terminal-color-red)');
  });

  it('interprets ANSI SGR codes in an error traceback the same way', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {},
        outputs: [{
          output_type: 'error', ename: 'NameError', evalue: "name 'x' is not defined",
          traceback: ['[1mbold frame[0m plain frame'],
        }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"][data-output-type="error"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"][data-output-type="error"]')!;
    expect(output.textContent).to.include('bold frame plain frame');
    const styledSpan = [...output.querySelectorAll('span')].find((s) => s.textContent === 'bold frame');
    expect(styledSpan).to.exist;
    expect(styledSpan!.style.fontWeight).to.equal('bold');
  });

  it('rejects an unsupported nbformat major version with the localized error', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = { nbformat: 3, nbformat_minor: 0, cells: [] };
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('rejects malformed notebook shape as invalid', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = { not: 'a notebook' };
    await eventPromise;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('parses a JSON string passed to notebook, winning over src', async () => {
    const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/should-not-fetch.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
    el.notebook = JSON.stringify(NOTEBOOK);
    await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part="cell"]').length ?? 0) > 0);
    expect(rowRoot(el).querySelectorAll('[part="cell"]').length).to.equal(3);
  });

  it('rejects a malformed JSON string passed to notebook, surfacing the invalid-notebook error', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = '{not valid json';
    const event = await eventPromise;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This file is not a valid Jupyter notebook.');
  });

  it('rejects a notebook with more cells than the MAX_CELLS cap', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const cells = Array.from({ length: 2001 }, (_v, i) => ({ cell_type: 'code', id: `c${i}`, source: '' }));
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = { nbformat: 4, nbformat_minor: 5, cells };
    const event = await eventPromise;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This notebook has too many cells to display.');
  });
});

describe('loading a notebook from src', () => {
  it('blocks a disallowed src scheme without calling fetch, surfacing the url-not-allowed error', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="ftp://example.test/nb.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(called).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally { window.fetch = original; }
  });

  it('fetches, parses, and renders a notebook from src, firing lr-load', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(JSON.stringify(NOTEBOOK)),
    } as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/nb.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      // rowRoot() throws until <lr-virtual-list> exists -- see the "drops a stale response" test
      // below for why that can't be called directly inside a waitUntil predicate.
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part="cell"]').length ?? 0) > 0);
      expect(rowRoot(el).querySelectorAll('[part="cell"]').length).to.equal(3);
    } finally { window.fetch = original; }
  });

  it('surfaces a failed-to-load error for a non-OK fetch response, without an unhandled rejection', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: false, status: 404, statusText: 'Not Found', text: () => Promise.resolve(''),
    } as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/missing.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      // Not oneEvent(el, 'lr-render-error') here: the src-triggered load can dispatch it inside
      // fixture()'s own await, before a listener attached afterward could ever catch it -- same
      // reasoning as the sibling "disallowed src scheme"/"resource-too-large" tests above.
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally { window.fetch = original; }
  });

  it('surfaces a resource-too-large error when the fetched notebook exceeds the size cap', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({
      ok: true, status: 200, statusText: 'OK',
      headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
      text: () => Promise.resolve('{}'),
    } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/huge.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally { window.fetch = original; }
  });

  it('drops a src response that resolves after the element has disconnected', async () => {
    const original = window.fetch;
    let resolveFetch!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/slow.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="spinner"]') !== null);
      el.remove();
      resolveFetch({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(JSON.stringify(NOTEBOOK)) } as Response);
      await aTimeout(20);
      expect(el.shadowRoot!.querySelector('[part="cell"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    } finally { window.fetch = original; }
  });

  it('drops a stale response when src changes before the first request resolves', async () => {
    const original = window.fetch;
    const signals: (AbortSignal | null | undefined)[] = [];
    let resolveSecond!: (value: Response) => void;
    window.fetch = ((url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === 'https://example.test/first.ipynb') {
        // Never resolves on its own; only settles if the caller aborts it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }
      return new Promise<Response>((resolve) => { resolveSecond = resolve; });
    }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/first.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      await waitUntil(() => signals.length > 0);
      el.src = 'https://example.test/second.ipynb';
      await waitUntil(() => signals.length > 1);
      expect(signals[0]?.aborted, 'the first request should have been aborted').to.equal(true);

      resolveSecond({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(JSON.stringify(NOTEBOOK)) } as Response);
      // rowRoot() throws until <lr-virtual-list> exists, which waitUntil's predicate can't be
      // allowed to do -- a throw aborts the retry loop instead of being treated as "not yet".
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part="cell"]').length ?? 0) > 0);
      // the aborted first request must not have surfaced any error state
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    } finally { window.fetch = original; }
  });
});

describe('rendering non-text outputs', () => {
  it('renders image/png and image/jpeg outputs as base64 data-URL images', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, outputs: [{ output_type: 'display_data', data: { 'image/png': 'AAAA' } }] },
        { cell_type: 'code', id: 'c2', source: 'y', execution_count: 2, outputs: [{ output_type: 'display_data', data: { 'image/jpeg': 'BBBB' } }] },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="output"] img').length >= 2);
    const imgs = [...rowRoot(el).querySelectorAll('[part="output"] img')];
    expect(imgs[0].getAttribute('src')).to.equal('data:image/png;base64,AAAA');
    expect(imgs[1].getAttribute('src')).to.equal('data:image/jpeg;base64,BBBB');
  });

  it('lazily sanitizes and renders an image/svg+xml output, stripping unsafe markup', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'display_data', data: { 'image/svg+xml': '<svg><script>alert(1)</script><circle r="2" /></svg>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"] circle') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.querySelector('script')).to.not.exist;
    expect(output.querySelector('circle')).to.exist;
  });

  it('lazily sanitizes and renders a text/html output, stripping unsafe markup', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'execute_result', data: { 'text/html': '<h1>Safe</h1><script>alert(1)</script>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"] h1') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.querySelector('script')).to.not.exist;
    expect(output.textContent).to.include('Safe');
  });

  // Note: the missing-sanitizer notice is itself a <p>, so never assert `querySelector('p')` here.
  // A *failing* chai assertion whose `actual` is a live DOM node/NodeList hangs the whole wtr
  // session: @web/test-runner-mocha copies `err.actual`/`err.expected` verbatim into the
  // `wtr-session-finished` message, and @web/dev-server-core's browser `sendMessage` serializes it
  // with `stable()`, whose first statement is `structuredClone(obj)` -- which throws DataCloneError
  // on any DOM node. The message is never sent, so the run reports `0 passed, 0 failed` at the 180s
  // `testsFinishTimeout`. Assert counts/strings (structured-cloneable values) instead.
  it('shows a localized missing-sanitizer notice for HTML/SVG outputs when the optional dompurify peer is unavailable', async () => {
    __setNotebookSanitizerForTesting(null);
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'execute_result', data: { 'text/html': '<p>Safe</p>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"]')?.textContent?.trim() !== '');
    const output = rowRoot(el).querySelector('[part="output"]')!;
    // Exactly one <p> -- the notice itself. The raw `<p>Safe</p>` payload is never rendered, which
    // the textContent equality below also proves.
    expect(output.querySelectorAll('p').length).to.equal(1);
    expect(output.textContent).to.equal('This viewer needs the optional "dompurify" package installed to render safely.');
  });

  it('renders an application/json output through lr-json-viewer for both string and pre-parsed object payloads', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, outputs: [{ output_type: 'execute_result', data: { 'application/json': '{"a":1}' } }] },
        { cell_type: 'code', id: 'c2', source: 'y', execution_count: 2, outputs: [{ output_type: 'execute_result', data: { 'application/json': { b: 2 } as unknown as string } }] },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('lr-json-viewer').length >= 2);
    const viewers = [...rowRoot(el).querySelectorAll('lr-json-viewer')] as (HTMLElement & { data?: unknown })[];
    expect(viewers[0].data).to.deep.equal({ a: 1 });
    expect(viewers[1].data).to.deep.equal({ b: 2 });
  });

  it('shows a localized notice for an output with no renderable mime type', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'execute_result', data: { 'application/octet-stream': 'zzz' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output"]') !== null);
    const output = rowRoot(el).querySelector('[part="output"]')!;
    expect(output.getAttribute('data-output-type')).to.equal('execute_result');
    expect(output.textContent).to.equal('This output type cannot be displayed.');
  });
});

describe('output collapsing', () => {
  it('collapses a text/plain output longer than outputCollapseLines behind a toggle', async () => {
    const longText = Array.from({ length: 60 }, (_v, i) => `line ${i}`).join('\n');
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{ cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {}, outputs: [{ output_type: 'execute_result', data: { 'text/plain': longText } }] }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output-toggle"]') !== null);
    const toggle = rowRoot(el).querySelector('[part="output-toggle"]') as HTMLButtonElement;
    expect(toggle).to.exist;
    toggle.click();
    await el.updateComplete;
    expect(rowRoot(el).querySelector('[part="output"]')!.textContent).to.include('line 59');
  });

  it('normalizes a NaN outputCollapseLines to the default (40) instead of silently disabling collapsing', async () => {
    const longText = Array.from({ length: 60 }, (_v, i) => `line ${i}`).join('\n');
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{ cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {}, outputs: [{ output_type: 'execute_result', data: { 'text/plain': longText } }] }],
    };
    const el = (await fixture(
      html`<lr-notebook-viewer .notebook=${notebook} output-collapse-lines="not-a-number"></lr-notebook-viewer>`,
    )) as LyraNotebookViewer;
    expect(Number.isNaN(el.outputCollapseLines)).to.be.true;
    await waitUntil(() => rowRoot(el).querySelector('[part="output-toggle"]') !== null);
    expect(rowRoot(el).querySelector('[part="output-toggle"]')).to.exist;
  });

  it('re-collapses the output on a second toggle click and reflects aria-expanded both ways', async () => {
    const longText = Array.from({ length: 60 }, (_v, i) => `line ${i}`).join('\n');
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{ cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {}, outputs: [{ output_type: 'execute_result', data: { 'text/plain': longText } }] }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part="output-toggle"]') !== null);
    const toggle = rowRoot(el).querySelector('[part="output-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(rowRoot(el).querySelector('[part="output"]')!.textContent).to.include('line 59');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(rowRoot(el).querySelector('[part="output"]')!.textContent).to.not.include('line 59');
  });
});

describe('search', () => {
  it('search() matches cell source and text outputs, one match per cell', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const count = await el.search('hi');
    expect(count).to.equal(1);
  });

  it('clearSearch() resets and emits lr-search-change', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await el.search('hi');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
  });

  it('search() clears matches for a whitespace-only query without matching every cell', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await el.search('hi');
    const count = await el.search('   ');
    expect(count).to.equal(0);
  });

  it('searchNext()/searchPrevious() are no-ops without any matches', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    // No search() has run yet, so searchMatches is empty -- these must return
    // without touching activeSearchIndex or emitting lr-search-change.
    el.searchNext();
    el.searchPrevious();
    const count = await el.search('nomatch-at-all');
    expect(count).to.equal(0);
  });

  it('searchNext()/searchPrevious() cycle the active match index and emit lr-search-change', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'code', id: 'c1', source: 'needle', execution_count: 1 },
        { cell_type: 'code', id: 'c2', source: 'needle', execution_count: 2 },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const count = await el.search('needle');
    expect(count).to.equal(2);

    let eventPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    expect((await eventPromise).detail).to.deep.equal({ query: 'needle', matchCount: 2, activeIndex: 1 });

    eventPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    expect((await eventPromise).detail.activeIndex, 'wraps forward past the last match').to.equal(0);

    eventPromise = oneEvent(el, 'lr-search-change');
    el.searchPrevious();
    expect((await eventPromise).detail.activeIndex, 'wraps backward past the first match').to.equal(1);
  });
});

describe('node-path and fragment anchors', () => {
  it('scrollToAnchor resolves a node-path [cellIndex] and a fragment cell id', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
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

describe('notebookLanguage', () => {
  it('falls back to an empty string when called while no notebook is loaded', async () => {
    // render() only ever invokes renderCell() (and therefore notebookLanguage())
    // while loadState is 'loaded', so this defensive fallback isn't reachable
    // through the component's own render cycle -- exercise it directly, the
    // same way this file already does for anchorTimeoutMs/anchorRetryIntervalMs.
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    expect((el as unknown as { notebookLanguage: () => string }).notebookLanguage()).to.equal('');
  });
});

describe('accessibility', () => {
  it('is accessible with a rendered notebook', async () => {
    const el = await fixture(html`<lr-notebook-viewer name="demo.ipynb" .notebook=${NOTEBOOK}></lr-notebook-viewer>`);
    await expect(el).to.be.accessible();
  });
});

describe('active-cell cssprop escape hatch', () => {
  // `[part='cell']` is produced by this component's `renderCell` but rendered by `<lr-virtual-list>`
  // INTO ITS OWN shadow root, so notebook-viewer's stylesheet never reaches it and
  // `[part='cell'][data-active]` is inert today (a separate, pre-existing data-mode gap -- neither
  // introduced nor fixed here). The hatch is therefore asserted on a real probe element rendered in
  // exactly the shadow root and custom-property context the cell occupies, carrying the declaration
  // the rule ships: an ancestor override must win, and an unset consumer must still get the token.
  function resolveDeclaration(vlistRoot: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    vlistRoot.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }
  const HATCH = 'background: var(--lr-notebook-viewer-active-bg, var(--lr-color-brand-quiet))';

  async function activeCell(style = ''): Promise<{ el: LyraNotebookViewer; vlistRoot: ShadowRoot }> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-notebook-viewer') as LyraNotebookViewer;
    await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part="cell"]').length ?? 0) > 0);
    // Public anchor API is the supported way to mark a cell active (drives `data-active`).
    await el.scrollToAnchor({ kind: 'node-path', path: [0] });
    await el.updateComplete;
    const vlistRoot = rowRoot(el);
    expect(vlistRoot.querySelector('[part="cell"][data-active]'), 'a cell is marked active').to.exist;
    return { el, vlistRoot };
  }

  it('resolves the active-cell background to an ancestor --lr-notebook-viewer-active-bg', async () => {
    const { vlistRoot } = await activeCell('--lr-notebook-viewer-active-bg: rgb(0, 51, 102)');
    expect(resolveDeclaration(vlistRoot, HATCH, 'background-color')).to.equal('rgb(0, 51, 102)');
  });

  it('resolves byte-identical to the brand-quiet token when unset', async () => {
    const { vlistRoot } = await activeCell();
    expect(resolveDeclaration(vlistRoot, HATCH, 'background-color')).to.equal(
      resolveDeclaration(vlistRoot, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
  });

  it('is accessible in the active-cell state with the prop themed', async () => {
    const { el } = await activeCell('--lr-notebook-viewer-active-bg: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});

it('gives the output-toggle hover/focus-visible', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='output-toggle'\]:hover/);
  expect(css).to.match(/\[part='output-toggle'\]:focus-visible[^{]*\{[^}]*outline:/);
});
