import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './notebook-viewer.js';
import type { LyraNotebookViewer } from './notebook-viewer.js';
import { __setNotebookSanitizerForTesting } from './dompurify-loader.js';
import { DEFAULT_MAX_RESOURCE_BYTES, LyraUserFacingError } from '../../../internal/resource-loader.js';
import type { LyraTextViewerTarget } from '../../../internal/text-viewer-target.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { styles } from './notebook-viewer.styles.js';

/** The search half of the shared viewer contract -- `lr-notebook-viewer` resolves its own anchor
 *  kinds rather than the mixin's, so only the search methods are asserted assignable. */
type SearchContract = Pick<LyraTextViewerTarget, 'search' | 'searchNext' | 'searchPrevious' | 'clearSearch'>;

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
 *  `renderItem()`'s TemplateResult into its own render output, so a `[part~="cell"]` search has to
 *  pierce that boundary rather than stopping at this component's own shadow root. */
function rowRoot(el: LyraNotebookViewer): ShadowRoot {
  return el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
}

describe('defaults', () => {
  it('defaults to empty src/notebook/name, outputCollapseLines 40', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    expect(el.src).to.equal('');
    expect(el.notebook).to.be.undefined;
    expect(el.source).to.equal(null);
    expect(el.outputCollapseLines).to.equal(40);
  });

  it('exposes a readonly discriminated effective-source snapshot', () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    el.src = 'https://example.test/fallback.ipynb';
    expect(el.source).to.deep.equal({ kind: 'url', url: 'https://example.test/fallback.ipynb' });
    el.notebook = '';
    expect(el.source).to.deep.equal({ kind: 'inline', value: '' });
    el.notebook = undefined;
    expect(el.source).to.deep.equal({ kind: 'url', url: 'https://example.test/fallback.ipynb' });
  });

  it('synchronously owns and freezes parsed notebook assignments', () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    const source = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'markdown', source: ['before'] }],
    };

    el.notebook = source as typeof el.notebook;
    source.cells[0]!.source[0] = 'after';
    source.cells.push({ cell_type: 'markdown', source: ['later'] });

    const snapshot = el.notebook;
    expect(snapshot).not.to.equal(source);
    expect(typeof snapshot).to.equal('object');
    if (typeof snapshot !== 'object' || snapshot === null) throw new Error('expected parsed notebook');
    expect(snapshot.cells.length).to.equal(1);
    expect(snapshot.cells[0]!.source).to.deep.equal(['before']);
    expect(Object.isFrozen(snapshot)).to.be.true;
    expect(Object.isFrozen(snapshot.cells)).to.be.true;
    expect(Object.isFrozen(snapshot.cells[0])).to.be.true;
    expect(Object.isFrozen(snapshot.cells[0]!.source)).to.be.true;
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
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part~="cell"]')];
    expect(cells.length).to.equal(3);
    expect(cells[0].getAttribute('data-cell-type')).to.equal('markdown');
    expect(cells[1].getAttribute('data-cell-type')).to.equal('code');
    expect(cells[2].getAttribute('data-cell-type')).to.equal('raw');
  });

  it('renders a markdown cell through lr-markdown and a code cell through lr-code-block', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="cell"]').length > 0);
    const cells = [...rowRoot(el).querySelectorAll('[part~="cell"]')];
    expect(cells[0].querySelector('lr-markdown')).to.exist;
    expect(cells[1].querySelector('lr-code-block')).to.exist;
    expect((cells[1].querySelector('lr-code-block') as HTMLElement).getAttribute('language')).to.equal('python');
  });

  it('renders a stream output tinted by stream name and a stdout/stderr data attribute', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"][data-output-type="error"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"][data-output-type="error"]')!;
    const label = output.querySelector('[part="error-output-label"]')!;
    expect((label) != null).to.equal(true);
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    expect(output.textContent).to.equal('red text plain');
    const styledSpan = output.querySelector('span')!;
    expect((styledSpan) != null).to.equal(true);
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"][data-output-type="error"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"][data-output-type="error"]')!;
    expect(output.textContent).to.include('bold frame plain frame');
    const styledSpan = [...output.querySelectorAll('span')].find((s) => s.textContent === 'bold frame');
    expect((styledSpan) != null).to.equal(true);
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

  it('rejects malformed nested cell/output shapes without rejecting updateComplete', async () => {
    const malformed = [
      { nbformat: 4, nbformat_minor: 5, cells: [null] },
      { nbformat: 4, nbformat_minor: 5, cells: [{ cell_type: 'raw', source: 42 }] },
      {
        nbformat: 4,
        nbformat_minor: 5,
        cells: [{
          cell_type: 'code',
          source: '',
          outputs: [{ output_type: 'display_data', data: { 'application/json': '{bad json' } }],
        }],
      },
    ];
    for (const notebook of malformed) {
      const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.notebook = notebook as never;
      await errorPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This file is not a valid Jupyter notebook.',
      );
    }
  });

  it('rejects invalid notebook cell fields, output fields, and MIME payloads independently', async () => {
    const codeCell = (overrides: Record<string, unknown> = {}) => ({
      cell_type: 'code',
      source: '',
      ...overrides,
    });
    const output = (overrides: Record<string, unknown>) =>
      codeCell({ outputs: [{ output_type: 'display_data', ...overrides }] });
    const oversizedArray = new Array(100_001);
    const malformed: Array<[string, unknown]> = [
      ['null notebook', null],
      ['unknown cell type', codeCell({ cell_type: 'heading' })],
      ['non-string cell id', codeCell({ id: 42 })],
      ['fractional execution count', codeCell({ execution_count: 1.5 })],
      ['negative execution count', codeCell({ execution_count: -1 })],
      ['non-array outputs', codeCell({ outputs: {} })],
      ['null output', codeCell({ outputs: [null] })],
      ['unknown output type', codeCell({ outputs: [{ output_type: 'unknown' }] })],
      ['mixed text array', codeCell({ outputs: [{ output_type: 'stream', text: ['ok', 42] }] })],
      ['mixed traceback array', codeCell({
        outputs: [{ output_type: 'error', traceback: ['frame', false] }],
      })],
      ['non-string error name', output({ ename: 42 })],
      ['non-string error value', output({ evalue: 42 })],
      ['unknown stream name', codeCell({
        outputs: [{ output_type: 'stream', name: 'console', text: 'message' }],
      })],
      ['null MIME bundle', output({ data: null })],
      ['array MIME bundle', output({ data: [] })],
      ['non-finite JSON number', output({ data: { 'application/json': Number.NaN } })],
      ['unsupported MIME payload', output({ data: { 'application/octet-stream': Symbol('bytes') } })],
      ['oversized JSON array', output({ data: { 'application/json': oversizedArray } })],
    ];

    for (const [description, cell] of malformed) {
      const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.notebook = (cell === null
        ? cell
        : { nbformat: 4, nbformat_minor: 5, cells: [cell] }) as never;
      await errorPromise;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')?.textContent,
        description,
      ).to.equal('This file is not a valid Jupyter notebook.');
    }
  });

  it('accepts dense text arrays and bounded JSON values without inspecting inherited properties', async () => {
    const inheritedPayload = Object.create({ ignored: Symbol('inherited') }) as Record<string, unknown>;
    inheritedPayload['own'] = true;
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{
        cell_type: 'code',
        source: ['print(', '"ok"', ')'],
        outputs: [
          { output_type: 'stream', name: 'stdout', text: ['first', ' second'] },
          {
            output_type: 'display_data',
            data: {
              'application/json': '{"count": 2, "ready": true, "empty": null}',
              'application/x-custom+json': inheritedPayload,
            },
          },
        ],
      }],
    };
    const el = (await fixture(
      html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`,
    )) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="output"]').length === 2);
    expect(rowRoot(el).textContent).to.include('first second');
    const snapshot = el.notebook as {
      readonly cells: readonly {
        readonly outputs?: readonly {
          readonly data?: Readonly<Record<string, unknown>>;
        }[];
      }[];
    };
    const snapshotPayload = snapshot.cells[0]!.outputs![1]!.data![
      'application/x-custom+json'
    ] as Readonly<Record<string, unknown>>;
    inheritedPayload['own'] = false;
    expect(snapshot).not.to.equal(notebook);
    expect(snapshotPayload).to.deep.equal({ own: true });
    expect(Object.getPrototypeOf(snapshotPayload)).to.equal(Object.prototype);
    expect(Object.isFrozen(snapshot)).to.be.true;
    expect(Object.isFrozen(snapshot.cells)).to.be.true;
    expect(Object.isFrozen(snapshotPayload)).to.be.true;
  });

  it('rejects notebook accessors without invoking them', async () => {
    let getterReads = 0;
    const payload = Object.create({ ignored: true }) as Record<string, unknown>;
    Object.defineProperty(payload, 'own', {
      enumerable: true,
      get() {
        getterReads += 1;
        return true;
      },
    });
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{
        cell_type: 'code',
        source: '',
        outputs: [{
          output_type: 'display_data',
          data: { 'application/x-custom+json': payload },
        }],
      }],
    };
    const el = (await fixture(
      html`<lr-notebook-viewer></lr-notebook-viewer>`,
    )) as LyraNotebookViewer;
    const errorPromise = oneEvent(el, 'lr-render-error');

    el.notebook = notebook as never;
    await errorPromise;

    expect(getterReads).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
      'This file is not a valid Jupyter notebook.',
    );
  });

  it('atomically rejects cycles outside the fields traversed by nbformat validation', async () => {
    const metadata: { language_info?: unknown } = {};
    metadata.language_info = metadata;
    const el = (await fixture(
      html`<lr-notebook-viewer></lr-notebook-viewer>`,
    )) as LyraNotebookViewer;
    let loadCount = 0;
    el.addEventListener('lr-load', () => loadCount++);
    const errorPromise = oneEvent(el, 'lr-render-error');

    el.notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [],
      metadata,
    } as never;
    await errorPromise;

    expect(loadCount).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
      'This file is not a valid Jupyter notebook.',
    );
  });

  it('rejects sparse cell arrays supplied as public values or serialized with null holes', async () => {
    const validCell = { cell_type: 'raw', id: 'raw1', source: 'plain text', metadata: {} };
    const sparseCells = [validCell, validCell];
    delete sparseCells[1];
    const values: unknown[] = [
      { nbformat: 4, nbformat_minor: 5, cells: sparseCells },
      JSON.stringify({ nbformat: 4, nbformat_minor: 5, cells: [validCell, null] }),
    ];
    for (const notebook of values) {
      const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
      const errorPromise = oneEvent(el, 'lr-render-error');
      el.notebook = notebook as never;
      await errorPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
        'This file is not a valid Jupyter notebook.',
      );
    }
  });

  it('rejects sparse nested public arrays without firing lr-load', async () => {
    const sparse = (value: unknown): unknown[] => {
      const values = [value, value];
      delete values[1];
      return values;
    };
    const validStream = { output_type: 'stream', name: 'stdout', text: 'ok' };
    const notebooks = [
      {
        nbformat: 4, nbformat_minor: 5,
        cells: [{ cell_type: 'raw', source: sparse('plain text') }],
      },
      {
        nbformat: 4, nbformat_minor: 5,
        cells: [{ cell_type: 'code', source: '', outputs: sparse(validStream) }],
      },
      {
        nbformat: 4, nbformat_minor: 5,
        cells: [{
          cell_type: 'code',
          source: '',
          outputs: [{ output_type: 'stream', name: 'stdout', text: sparse('line') }],
        }],
      },
      {
        nbformat: 4, nbformat_minor: 5,
        cells: [{
          cell_type: 'code',
          source: '',
          outputs: [{ output_type: 'error', ename: 'Error', evalue: 'bad', traceback: sparse('frame') }],
        }],
      },
    ];
    for (const notebook of notebooks) {
      const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
      let loadCount = 0;
      let errorCount = 0;
      el.addEventListener('lr-load', () => loadCount++);
      el.addEventListener('lr-render-error', () => errorCount++);
      el.notebook = notebook as never;
      await el.updateComplete;
      expect(loadCount).to.equal(0);
      expect(errorCount).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
        'This file is not a valid Jupyter notebook.',
      );
    }
  });

  it('rejects pathologically deep JSON output without overflowing the JavaScript stack', async () => {
    const payload: Record<string, unknown> = {};
    let cursor = payload;
    for (let depth = 0; depth < 120_000; depth++) {
      const child: Record<string, unknown> = {};
      cursor['child'] = child;
      cursor = child;
    }
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{
        cell_type: 'code',
        source: '',
        outputs: [{ output_type: 'display_data', data: { 'application/json': payload } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const errorPromise = oneEvent(el, 'lr-render-error');
    expect(() => { el.notebook = notebook as never; }).to.not.throw();
    const event = await errorPromise;
    await el.updateComplete;
    expect(event.detail.error).to.not.be.instanceOf(RangeError);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
      'This file is not a valid Jupyter notebook.',
    );
  });

  it('parses a JSON string passed to notebook, winning over src', async () => {
    const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/should-not-fetch.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
    el.notebook = JSON.stringify(NOTEBOOK);
    await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
    expect(rowRoot(el).querySelectorAll('[part~="cell"]').length).to.equal(3);
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

  it('accepts a valid notebook with zero cells, firing lr-load with cellCount 0 and rendering an empty virtualized list', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-load');
    el.notebook = { nbformat: 4, nbformat_minor: 5, cells: [] };
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ cellCount: 0, language: '' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-virtual-list') !== null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    expect(rowRoot(el).querySelectorAll('[part~="cell"]').length).to.equal(0);
  });

  it('rejects a valid major with an unsupported minor version, interpolating the version into the localized message', async () => {
    // The sibling "unsupported nbformat major version" test above always fails on the major-mismatch
    // arm of `raw.nbformat !== SUPPORTED_MAJOR || !SUPPORTED_MINORS.includes(raw.nbformat_minor)`
    // short-circuiting before the minor check ever runs -- this exercises the second arm directly,
    // and also asserts the interpolated `{version}` text, which no existing test does.
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = { nbformat: 4, nbformat_minor: 99, cells: [] };
    const event = await eventPromise;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
      'Notebook format 4.99 is not supported.',
    );
  });
});

describe('loading a notebook from src', () => {
  it('paints a visible busy treatment while pending and removes it on failure', async () => {
    const original = window.fetch;
    let rejectFetch!: (error: unknown) => void;
    window.fetch = (() => new Promise<Response>((_resolve, reject) => { rejectFetch = reject; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
      el.src = 'https://example.test/pending.ipynb';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="spinner"]') !== null);
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-label')!;
      expect(base.getAttribute('aria-busy')).to.equal('true');
      expect(label.textContent).to.equal('Loading document…');
      expect(label.getBoundingClientRect().height).to.be.greaterThan(0);
      rejectFetch(new Error('offline'));
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(base.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelector('[part="spinner"]') === null).to.equal(true);
    } finally {
      window.fetch = original;
    }
  });

  it('treats an empty inline string as present authority instead of fetching src', async () => {
    const original = window.fetch;
    let fetches = 0;
    window.fetch = (() => {
      fetches++;
      return Promise.reject(new Error('inline authority must suppress src'));
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`
        <lr-notebook-viewer
          src="https://example.test/fallback.ipynb"
          .notebook=${''}
        ></lr-notebook-viewer>
      `);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent)
        .to.equal('This file is not a valid Jupyter notebook.');
      expect(fetches).to.equal(0);
    } finally {
      window.fetch = original;
    }
  });

  it('clears inline authority and immediately resumes the unchanged fallback src', async () => {
    const original = window.fetch;
    const fallback = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'raw', id: 'from-url', source: 'Fallback URL document' }],
    };
    let fetches = 0;
    window.fetch = (() => {
      fetches++;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(fallback)),
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`
        <lr-notebook-viewer
          src="https://example.test/fallback.ipynb"
          .notebook=${NOTEBOOK}
        ></lr-notebook-viewer>
      `);
      await waitUntil(() => rowRoot(el).textContent?.includes('plain text') ?? false);
      expect(fetches).to.equal(0);

      const loaded = oneEvent(el, 'lr-load');
      el.notebook = undefined;
      await loaded;
      await waitUntil(() => rowRoot(el).textContent?.includes('Fallback URL document') ?? false);
      expect(fetches).to.equal(1);
      expect(el.source).to.deep.equal({ kind: 'url', url: 'https://example.test/fallback.ipynb' });
      expect(rowRoot(el).textContent).to.not.include('plain text');
    } finally {
      window.fetch = original;
    }
  });

  it('clearing inline authority without src exposes idle instead of retaining stale cells', async () => {
    const el = await fixture<LyraNotebookViewer>(html`
      <lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>
    `);
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="cell"]').length > 0);
    el.notebook = undefined;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') === null);
    expect(el.source).to.equal(null);
    expect(el.shadowRoot!.textContent).to.contain('No document to display.');
  });

  it('assigning inline authority aborts and cannot be overwritten by an in-flight src', async () => {
    const original = window.fetch;
    let signal: AbortSignal | null | undefined;
    window.fetch = ((_url: string, init?: RequestInit) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`
        <lr-notebook-viewer src="https://example.test/slow.ipynb"></lr-notebook-viewer>
      `);
      await waitUntil(() => signal !== undefined);
      el.notebook = NOTEBOOK;
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot != null);
      await waitUntil(() => rowRoot(el).textContent?.includes('plain text') ?? false);
      expect(signal?.aborted).to.equal(true);
      expect(el.source?.kind).to.equal('inline');
      expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    } finally {
      window.fetch = original;
    }
  });

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
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
      expect(rowRoot(el).querySelectorAll('[part~="cell"]').length).to.equal(3);
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
      expect((el.shadowRoot!.querySelector('[part~="cell"]')) == null).to.be.true;
      expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.true;
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
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
      // the aborted first request must not have surfaced any error state
      expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.true;
    } finally { window.fetch = original; }
  });

  it('drops a stale response body when src changes after the first response resolves', async () => {
    const original = window.fetch;
    const freshNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'raw', id: 'fresh', source: 'Fresh notebook' }],
    };
    const staleNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'raw', id: 'stale', source: 'Stale notebook' }],
    };
    let staleReadStarted = false;
    let resolveStale!: (value: string) => void;
    window.fetch = ((url: RequestInfo | URL) => {
      const body = String(url).includes('stale')
        ? new Promise<string>((resolve) => {
            staleReadStarted = true;
            resolveStale = resolve;
          })
        : Promise.resolve(JSON.stringify(freshNotebook));
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => body,
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
      el.src = 'https://example.test/stale.ipynb';
      await waitUntil(() => staleReadStarted);
      el.src = 'https://example.test/fresh.ipynb';
      await waitUntil(
        () => el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.textContent
          ?.includes('Fresh notebook') ?? false,
      );

      resolveStale(JSON.stringify(staleNotebook));
      await aTimeout(0);

      expect(rowRoot(el).textContent).to.include('Fresh notebook');
      expect(rowRoot(el).textContent).not.to.include('Stale notebook');
    } finally {
      window.fetch = original;
    }
  });

  it('loads a source without a signal when AbortController is unavailable', async () => {
    const originalAbortController = globalThis.AbortController;
    const originalFetch = window.fetch;
    let observedSignal: AbortSignal | null | undefined = null;
    globalThis.AbortController = undefined as unknown as typeof AbortController;
    window.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
      observedSignal = init?.signal;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify(NOTEBOOK)),
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
      el.src = 'https://example.test/no-abort-controller.ipynb';
      await waitUntil(
        () => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot
          ?.querySelectorAll('[part~="cell"]').length ?? 0) > 0,
      );
      expect(observedSignal).to.equal(undefined);
    } finally {
      window.fetch = originalFetch;
      globalThis.AbortController = originalAbortController;
    }
  });

  it('resets to idle on disconnect and re-fetches from src on reconnect (a pure DOM move, unlike the inline-authority reconnect above)', async () => {
    const original = window.fetch;
    let fetches = 0;
    window.fetch = (() => {
      fetches++;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(JSON.stringify(NOTEBOOK)),
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lr-notebook-viewer src="https://example.test/nb.ipynb"></lr-notebook-viewer>`)) as LyraNotebookViewer;
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
      expect(fetches).to.equal(1);

      el.remove();
      expect((el as unknown as { loadState: { kind: string } }).loadState.kind).to.equal('idle');

      document.body.append(el);
      await waitUntil(() => fetches === 2);
      await waitUntil(() => (el.shadowRoot?.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
      expect(rowRoot(el).querySelectorAll('[part~="cell"]').length).to.equal(3);
    } finally { window.fetch = original; }
  });
});

describe('rendering non-text outputs', () => {
  it('restarts an invalidated inline sanitization after reconnect', async () => {
    let resolveFirst!: (value: { sanitize(raw: string): string }) => void;
    let resolveSecond!: (value: { sanitize(raw: string): string }) => void;
    const first = new Promise<{ sanitize(raw: string): string }>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<{ sanitize(raw: string): string }>((resolve) => { resolveSecond = resolve; });
    __setNotebookSanitizerForTesting(first);
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x',
        outputs: [{ output_type: 'display_data', data: { 'text/html': '<b>Safe</b>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).textContent?.includes('Loading document') ?? false);
    await aTimeout(0);
    await el.updateComplete;
    await aTimeout(0);
    el.remove();
    expect((el as unknown as { sanitizationTasks: Map<string, unknown> }).sanitizationTasks.size).to.equal(0);
    __setNotebookSanitizerForTesting(second);
    document.body.append(el);
    await waitUntil(
      () => (el as unknown as { sanitizationTasks: Map<string, unknown> }).sanitizationTasks.size === 1,
    );
    resolveSecond({ sanitize: (raw) => raw });
    await waitUntil(() => rowRoot(el).querySelector('b')?.textContent === 'Safe');
    expect(rowRoot(el).querySelectorAll('b').length).to.equal(1);
    resolveFirst({ sanitize: (raw) => `stale:${raw}` });
    await aTimeout(0);
    expect(rowRoot(el).textContent).to.include('Safe');
    expect(rowRoot(el).textContent).to.not.include('stale:');
  });

  it('renders image/png and image/jpeg outputs as base64 data-URL images', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, outputs: [{ output_type: 'display_data', data: { 'image/png': 'AAAA', 'text/plain': 'Chart showing revenue' } }] },
        { cell_type: 'code', id: 'c2', source: 'y', execution_count: 2, outputs: [{ output_type: 'display_data', data: { 'image/jpeg': 'BBBB' } }] },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="output"] img').length >= 2);
    const imgs = [...rowRoot(el).querySelectorAll('[part~="output"] img')];
    expect(imgs[0].getAttribute('src')).to.equal('data:image/png;base64,AAAA');
    expect(imgs[1].getAttribute('src')).to.equal('data:image/jpeg;base64,BBBB');
    expect(imgs[0].getAttribute('alt')).to.equal('Chart showing revenue');
    expect(imgs[1].getAttribute('alt')).to.equal('Code cell 2');
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"] circle') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    expect((output.querySelector('script')) == null).to.equal(true);
    expect((output.querySelector('circle')) != null).to.equal(true);
    expect(output.getAttribute('role')).to.equal('img');
    expect(output.getAttribute('aria-label')).to.equal('Code cell 1');
  });

  it('lazily sanitizes and renders a text/html output, stripping unsafe markup', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'execute_result', data: { 'text/html': '<style>@import url(https://example.test/a.css)</style><h1 style="background:url(https://example.test/bg.png)">Safe</h1><img src="https://example.test/pixel.png"><a href="https://example.test/nav">link</a><form><button>send</button></form><script>alert(1)</script>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"] h1') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    expect((output.querySelector('script')) == null).to.equal(true);
    expect(output.querySelectorAll('style,a,form,button').length).to.equal(0);
    expect(output.querySelector('h1')!.hasAttribute('style')).to.equal(false);
    expect(output.querySelector('img')!.hasAttribute('src')).to.equal(false);
    expect(output.textContent).to.include('link');
    expect(output.textContent).to.include('send');
    expect(output.textContent).to.include('Safe');
  });

  // Note: the missing-sanitizer notice is itself a <p>, so never assert `querySelector('p')` here.
  // A *failing* chai assertion whose `actual` is a live DOM node/NodeList hangs the whole wtr
  // session: @web/test-runner-mocha copies `err.actual`/`err.expected` verbatim into the
  // `wtr-session-finished` message, and @web/dev-server-core's browser `sendMessage` serializes it
  // with `stable()`, whose first statement is `structuredClone(obj)` -- which throws DataCloneError
  // on any DOM node. The message is never sent, so the run reports `0 passed, 0 failed` only when
  // the per-file `testsFinishTimeout` expires. Assert structured-cloneable counts/strings instead.
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]')?.textContent?.trim() !== '');
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    // Exactly one <p> -- the notice itself. The raw `<p>Safe</p>` payload is never rendered, which
    // the textContent equality below also proves.
    expect(output.querySelectorAll('p').length).to.equal(1);
    expect(output.textContent).to.equal('This viewer needs the optional "dompurify" package installed to render safely.');
  });

  it('also announces the missing-sanitizer failure through the shared assertive live region, not just the visible notice', async () => {
    // The visible fallback is asserted above; a screen-reader user who cannot see shadow-DOM
    // content depends on this separate document-level announcement (ViewerAnnouncementController /
    // acquireAnnouncementSink) to learn the same thing.
    __setNotebookSanitizerForTesting(null);
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'execute_result', data: { 'text/html': '<p>Safe</p>' } }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]')?.textContent?.trim() !== '');
    const sink = document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`);
    expect(sink?.textContent).to.equal('This viewer needs the optional "dompurify" package installed to render safely.');
  });

  it('fails closed and announces once when the sanitizer peer itself throws, not only when it is missing', async () => {
    // ensureSanitized()'s catch branch (a thrown/rejected loadNotebookSanitizer()/sanitize() call)
    // is a distinct code path from the `!sanitizer` (peer absent) branch every other missing-peer
    // test above exercises -- neither this file nor any other exercised it before.
    __setNotebookSanitizerForTesting({
      sanitize: () => { throw new Error('sanitizer exploded'); },
    });
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', source: '',
        outputs: [
          { output_type: 'display_data', data: { 'text/html': '<b>Chart</b>', 'text/plain': 'Chart fallback' } },
          { output_type: 'display_data', data: { 'text/html': '<b>Chart</b>', 'text/plain': 'Chart fallback' } },
        ],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    let errorCount = 0;
    let lastErrorMessage: string | undefined;
    el.addEventListener('lr-render-error', (event) => {
      errorCount++;
      lastErrorMessage = ((event as CustomEvent<{ error: unknown }>).detail.error as Error)?.message;
    });
    el.notebook = notebook as never;
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.textContent?.includes('Chart fallback') ?? false,
    );
    expect(errorCount).to.equal(1);
    expect(lastErrorMessage).to.equal('sanitizer exploded');
    expect(rowRoot(el).textContent).to.include('Chart fallback');
    const sink = document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`);
    expect(sink?.textContent).to.equal('This viewer needs the optional "dompurify" package installed to render safely.');
  });

  it('falls back to text/plain and emits one render error when the sanitizer peer is missing', async () => {
    __setNotebookSanitizerForTesting(null);
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', source: '',
        outputs: [
          { output_type: 'display_data', data: { 'text/html': '<b>Chart</b>', 'text/plain': 'Chart fallback' } },
          { output_type: 'display_data', data: { 'text/html': '<b>Chart</b>', 'text/plain': 'Chart fallback' } },
        ],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    let errorCount = 0;
    el.addEventListener('lr-render-error', () => { errorCount++; });
    el.notebook = notebook as never;
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.textContent?.includes('Chart fallback') ?? false,
    );
    expect(errorCount).to.equal(1);
    expect(rowRoot(el).textContent).to.include('Chart fallback');
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
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    expect(output.getAttribute('data-output-type')).to.equal('execute_result');
    expect(output.textContent).to.equal('This output type cannot be displayed.');
  });

  it('shows the same unrendered-output notice for an output with no data field at all', async () => {
    // `data` is entirely optional on display_data/execute_result outputs (isNotebookOutput()
    // accepts an output with no `data` key), distinct from the sibling test above whose output
    // carries a present-but-unsupported MIME payload.
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [{
        cell_type: 'code', id: 'c1', source: 'x', execution_count: 1,
        outputs: [{ output_type: 'display_data' }],
      }],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelector('[part~="output"]') !== null);
    const output = rowRoot(el).querySelector('[part~="output"]')!;
    expect(output.getAttribute('data-output-type')).to.equal('display_data');
    expect(output.textContent).to.equal('This output type cannot be displayed.');
  });
});

describe('event boundaries', () => {
  it('does not expose the internal virtual-list range event under the canonical lr-visible-range-change name', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    let leaked = 0;
    el.addEventListener('lr-visible-range-change', () => leaked++);
    el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(
      'lr-visible-range-change',
      { detail: { start: 0, end: 1 }, bubbles: true, composed: true },
    ));
    expect(leaked).to.equal(0);
  });

  it('does not expose the internal virtual-list scroll event', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    let leaked = 0;
    el.addEventListener('lr-virtual-scroll', () => leaked++);
    el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(new CustomEvent(
      'lr-virtual-scroll',
      { detail: { scrollTop: 0, viewportHeight: 100 }, bubbles: true, composed: true },
    ));
    expect(leaked).to.equal(0);
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
    expect((toggle) != null).to.equal(true);
    toggle.click();
    await el.updateComplete;
    expect(rowRoot(el).querySelector('[part~="output"]')!.textContent).to.include('line 59');
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

  it('does not collide expand state across cells sharing a cellIndex*1000+outputIndex product', async () => {
    // cellIndex 0 / outputIndex 1000 and cellIndex 1 / outputIndex 0 both reduce to the numeric
    // key 1000 under a `cellIndex * 1000 + outputIndex` scheme -- expanding the first must not
    // also expand the second.
    const longText = (label: string) => Array.from({ length: 60 }, (_v, i) => `${label} line ${i}`).join('\n');
    const fillerOutputs = Array.from({ length: 1000 }, () => ({ output_type: 'stream', name: 'stdout', text: '' }));
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: 'code', id: 'c0', source: 'x', execution_count: 1, metadata: {},
          outputs: [...fillerOutputs, { output_type: 'execute_result', data: { 'text/plain': longText('cell0-out1000') } }],
        },
        {
          cell_type: 'code', id: 'c1', source: 'y', execution_count: 2, metadata: {},
          outputs: [{ output_type: 'execute_result', data: { 'text/plain': longText('cell1-out0') } }],
        },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part="output-toggle"]').length >= 2);
    const toggles = [...rowRoot(el).querySelectorAll('[part="output-toggle"]')] as HTMLButtonElement[];
    expect(toggles.length).to.equal(2);
    toggles[0].click();
    await el.updateComplete;
    expect(toggles[0].getAttribute('aria-expanded'), 'cell 0 / output 1000 expands').to.equal('true');
    expect(
      toggles[1].getAttribute('aria-expanded'),
      'cell 1 / output 0 shares the colliding numeric key and must stay collapsed',
    ).to.equal('false');
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
    expect(rowRoot(el).querySelector('[part~="output"]')!.textContent).to.include('line 59');
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(rowRoot(el).querySelector('[part~="output"]')!.textContent).to.not.include('line 59');
  });
});

describe('search', () => {
  it('search() matches cell source and text outputs, one match per cell', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    const count = await el.search('hi');
    expect(count).to.equal(1);
  });

  it('scrolls the virtualized target cell for the initial and next search matches', async () => {
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'raw', source: 'needle' },
        { cell_type: 'raw', source: 'other' },
        { cell_type: 'raw', source: 'needle' },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    const calls: number[] = [];
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      scrollToIndex(index: number): void;
    };
    list.scrollToIndex = (index) => { calls.push(index); };
    await el.search('needle');
    await aTimeout(10);
    el.searchNext();
    await aTimeout(10);
    expect(calls).to.deep.equal([0, 2]);
    expect(rowRoot(el).querySelector('[part~="cell-active"]')?.getAttribute('data-cell-type')).to.equal('raw');
  });

  it('clearSearch() resets and emits lr-search-change', async () => {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await el.search('hi');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    expect((await eventPromise).detail).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
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

  it('searchNext()/searchPrevious() resolve true when they moved and false when they could not', async () => {
    // A host driving several viewers polymorphically through the shared
    // LyraTextViewerTarget shape writes `if (await viewer.searchNext()) { ... }`, or awaits the
    // call before reading its own match counter. Resolving nothing makes the falsy "no more
    // matches" branch fire on every press, even mid-notebook.
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'code', id: 'c1', source: 'needle', execution_count: 1 },
        { cell_type: 'code', id: 'c2', source: 'needle', execution_count: 2 },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    // Driven through the shared contract type rather than the concrete class, so a regression back
    // to `void` returns breaks this assignment for any typechecker pointed at the test sources as
    // well as failing the runtime assertions below.
    const viewer: SearchContract = el;

    expect(await viewer.searchNext(), 'no query has run yet').to.be.false;
    expect(await viewer.searchPrevious(), 'no query has run yet').to.be.false;

    expect(await viewer.search('needle')).to.equal(2);
    expect(await viewer.searchNext(), 'advanced to the second match').to.be.true;
    expect(await viewer.searchPrevious(), 'stepped back to the first match').to.be.true;

    expect(await viewer.search('__definitely_absent__')).to.equal(0);
    expect(await viewer.searchNext(), 'the current query has no matches').to.be.false;
    expect(await viewer.searchPrevious(), 'the current query has no matches').to.be.false;
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
    expect((await eventPromise).detail).to.deep.equal({ query: 'needle', matchCount: 2, matchCountExact: true, activeIndex: 1 });

    eventPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    expect((await eventPromise).detail.activeIndex, 'wraps forward past the last match').to.equal(0);

    eventPromise = oneEvent(el, 'lr-search-change');
    el.searchPrevious();
    expect((await eventPromise).detail.activeIndex, 'wraps backward past the first match').to.equal(1);
  });

  it('recomputes an active search when the host language changes', async () => {
    // Same fixture idiom csv-viewer.test.ts's "recomputes an active search when the host language
    // changes" uses: dotted capital I (U+0130) folds to "i" cleanly only under a Turkish locale, so
    // the match count itself proves updated()'s lastSearchLocale branch actually re-ran search()
    // rather than merely re-rendering with stale matches.
    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      cells: [
        { cell_type: 'raw', id: 'r1', source: 'İSTANBUL' },
        { cell_type: 'raw', id: 'r2', source: 'istanbul' },
      ],
    };
    const el = (await fixture(html`<lr-notebook-viewer lang="en" .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="cell"]').length > 0);
    expect(await el.search('istanbul')).to.equal(1);

    el.lang = 'tr';
    await el.updateComplete;
    await aTimeout(0);
    expect((el as unknown as { searchMatches: unknown[] }).searchMatches).to.have.lengthOf(2);
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
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [1] })).to.be.true;
    const event = await eventPromise as CustomEvent<{ found: boolean }>;
    expect(event.detail).to.deep.equal({ found: true });
    expect(event.cancelable).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'raw1' })).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [99] })).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });
});

describe('highlights', () => {
  async function mountHighlighted(): Promise<{ el: LyraNotebookViewer; vlistRoot: ShadowRoot }> {
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await waitUntil(() => rowRoot(el).querySelectorAll('[part~="cell"]').length > 0);
    return { el, vlistRoot: rowRoot(el) };
  }

  it('paints the resolved cell for a node-path highlight with its default accent tone', async () => {
    const { el, vlistRoot } = await mountHighlighted();
    el.highlights = [{ id: 'h1', anchor: { kind: 'node-path', path: [1] } }];
    await el.updateComplete;
    const highlighted = [...vlistRoot.querySelectorAll('[part~="cell-highlighted"]')];
    expect(highlighted.length).to.equal(1);
    expect(highlighted[0]!.getAttribute('data-cell-type')).to.equal('code');
    expect(highlighted[0]!.hasAttribute('data-highlighted')).to.be.true;
    expect(highlighted[0]!.getAttribute('part')).to.contain('cell-highlighted-accent');
  });

  it('resolves a fragment highlight against a cell id and paints its explicit tone', async () => {
    const { el, vlistRoot } = await mountHighlighted();
    el.highlights = [{ id: 'h1', anchor: { kind: 'fragment', id: 'raw1' }, tone: 'danger' }];
    await el.updateComplete;
    const cell = vlistRoot.querySelector('[data-cell-type="raw"]')!;
    expect(cell.getAttribute('part')).to.contain('cell-highlighted-danger');
    expect(cell.getAttribute('part')).to.not.contain('cell-highlighted-accent');
  });

  it('adds cell-highlight-active only to the entry matching activeHighlightId', async () => {
    const { el, vlistRoot } = await mountHighlighted();
    el.highlights = [
      { id: 'h1', anchor: { kind: 'node-path', path: [0] } },
      { id: 'h2', anchor: { kind: 'node-path', path: [1] } },
    ];
    el.activeHighlightId = 'h2';
    await el.updateComplete;
    const cells = [...vlistRoot.querySelectorAll('[part~="cell"]')];
    expect(cells[0]!.getAttribute('part')).to.not.contain('cell-highlight-active');
    expect(cells[1]!.getAttribute('part')).to.contain('cell-highlight-active');
  });

  it('never paints a highlight whose anchor kind this viewer does not resolve', async () => {
    const { el, vlistRoot } = await mountHighlighted();
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Some text.' } }];
    await el.updateComplete;
    expect(vlistRoot.querySelector('[part~="cell-highlighted"]') === null).to.be.true;
  });

  it('clears painted highlights once highlights is reassigned empty', async () => {
    const { el, vlistRoot } = await mountHighlighted();
    el.highlights = [{ id: 'h1', anchor: { kind: 'node-path', path: [1] } }];
    await el.updateComplete;
    expect(vlistRoot.querySelector('[part~="cell-highlighted"]')).to.not.be.null;
    el.highlights = [];
    await el.updateComplete;
    expect(vlistRoot.querySelector('[part~="cell-highlighted"]') === null).to.be.true;
  });

  it('bounds candidates considered per repaintHighlights() pass at MAX_NOTEBOOK_PAINTED_HIGHLIGHTS while still retaining the active entry', async () => {
    // Mirrors xml-viewer.test.ts's/svg-viewer.test.ts's own "bounds painted highlights ... beyond
    // the candidate cap" tests for their sibling per-pass ceilings. Asserted against the internal
    // `highlightedCells` map (sizes/ids only, never a DOM node) rather than the virtualized DOM,
    // since most of these 1,001 cells are never actually mounted by <lr-virtual-list> at once.
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: Array.from({ length: 1001 }, (_v, index) => ({ cell_type: 'raw', id: `c${index}`, source: `cell ${index}` })),
    };
    const el = (await fixture(html`<lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await el.updateComplete;
    el.highlights = Array.from({ length: 1001 }, (_v, index) => ({
      id: `h${index}`,
      anchor: { kind: 'node-path' as const, path: [index] },
    }));
    el.activeHighlightId = 'h1000';
    await el.updateComplete;

    const highlightedCells = (el as unknown as { highlightedCells: Map<number, { id: string }> }).highlightedCells;
    expect(highlightedCells.size).to.equal(100);
    expect(highlightedCells.get(1000)?.id, 'the active entry always wins its cell slot').to.equal('h1000');
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

describe('i18n', () => {
  it('honors a strings override for the default accessible label and the invalid-notebook error', async () => {
    const el = (await fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`)) as LyraNotebookViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Notebook viewer');
    el.strings = { notebookViewerLabel: 'Visionneuse de bloc-notes', notebookViewerInvalid: 'Bloc-notes invalide.' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse de bloc-notes');

    const eventPromise = oneEvent(el, 'lr-render-error');
    el.notebook = { not: 'a notebook' };
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Bloc-notes invalide.');
  });
});

describe('accessibility', () => {
  it('keeps a non-empty host name on the host and preserves an explicit-empty shadow owner', async () => {
    const labeled = await fixture<LyraNotebookViewer>(
      html`<lr-notebook-viewer name="demo.ipynb" aria-label="Analysis notebook"></lr-notebook-viewer>`,
    );
    const labeledBase = labeled.shadowRoot!.querySelector('[part="base"]')!;
    expect(labeledBase.getAttribute('role')).to.be.null;
    expect(labeledBase.getAttribute('aria-label')).to.be.null;

    const decorative = await fixture<LyraNotebookViewer>(
      html`<lr-notebook-viewer name="demo.ipynb" aria-label=""></lr-notebook-viewer>`,
    );
    const decorativeBase = decorative.shadowRoot!.querySelector('[part="base"]')!;
    expect(decorativeBase.getAttribute('role')).to.equal('region');
    expect(decorativeBase.hasAttribute('aria-label')).to.be.true;
    expect(decorativeBase.getAttribute('aria-label')).to.equal('');
  });

  it('is accessible with a rendered notebook', async () => {
    const el = await fixture(html`<lr-notebook-viewer name="demo.ipynb" .notebook=${NOTEBOOK}></lr-notebook-viewer>`);
    await expect(el).to.be.accessible();
  });
});

// `renderCell`/`renderOutput` emit their parts into `<lr-virtual-list>`'s own shadow root, so this
// component's stylesheet reaches them through `lr-virtual-list::part(...)` rather than a bare
// `[part='...']` selector. Everything below asserts the RENDERED result on the real element in the
// real state -- a stylesheet-text assertion cannot tell a matching selector apart from an inert one.
describe('virtualized cell part styling', () => {
  const LONG_OUTPUT = { output_type: 'stream', name: 'stdout', text: Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n') };
  const ERROR_NOTEBOOK = {
    nbformat: 4, nbformat_minor: 5,
    cells: [{
      cell_type: 'code', id: 'c1', source: 'x', execution_count: 1, metadata: {},
      outputs: [
        { output_type: 'error', ename: 'NameError', evalue: "name 'x' is not defined", traceback: ['Traceback line 1'] },
        { output_type: 'stream', name: 'stderr', text: 'warning\n' },
        LONG_OUTPUT,
      ],
    }],
  };

  it('makes an overflowing raw cell independently keyboard-scrollable at 320px', async () => {
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'raw', source: 'x'.repeat(400) }],
    };
    const wrapper = await fixture<HTMLElement>(
      html`<div style="width: 320px"><lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer></div>`,
    );
    const el = wrapper.querySelector('lr-notebook-viewer') as LyraNotebookViewer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector(
      '[part="raw-source"]',
    ) !== null);
    const raw = rowRoot(el).querySelector('[part="raw-source"]') as HTMLElement;
    expect(raw.getAttribute('tabindex')).to.equal('0');
    expect(getComputedStyle(raw).overflowX).to.equal('auto');
    expect(raw.scrollWidth).to.be.greaterThan(raw.clientWidth);
  });

  /** A design token's own rendered value, resolved by a throwaway probe in the same shadow root and
   *  custom-property context -- `getComputedStyle().getPropertyValue()` hands back the token's raw
   *  declared text (`#cf222e`), never the `rgb()` form a computed color assertion compares against. */
  function tokenValue(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function mount(notebook: unknown, wrapperStyle = ''): Promise<{ el: LyraNotebookViewer; vlistRoot: ShadowRoot }> {
    const wrapper = (await fixture(
      html`<div style=${wrapperStyle}><lr-notebook-viewer .notebook=${notebook}></lr-notebook-viewer></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-notebook-viewer') as LyraNotebookViewer;
    await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) > 0);
    return { el, vlistRoot: rowRoot(el) };
  }

  async function activeCell(wrapperStyle = ''): Promise<{ el: LyraNotebookViewer; vlistRoot: ShadowRoot; cell: HTMLElement }> {
    const { el, vlistRoot } = await mount(NOTEBOOK, wrapperStyle);
    // Public anchor API is the supported way to mark a cell active.
    await el.scrollToAnchor({ kind: 'node-path', path: [0] });
    await el.updateComplete;
    const cell = vlistRoot.querySelector('[part~="cell-active"]') as HTMLElement;
    expect((cell) != null, 'a cell is marked active').to.equal(true);
    expect(cell.hasAttribute('data-active'), 'the active cell still carries data-active').to.equal(true);
    return { el, vlistRoot, cell };
  }

  it('lays out a cell as a two-column grid with the gutter treatment', async () => {
    const { vlistRoot } = await mount(NOTEBOOK, 'inline-size: 900px');
    const cell = vlistRoot.querySelector('[part~="cell"]') as HTMLElement;
    expect(getComputedStyle(cell).display).to.equal('grid');
    expect(getComputedStyle(cell).gridTemplateColumns.split(' ').length, 'two grid columns at a wide allocation').to.equal(2);
    const gutter = vlistRoot.querySelector('[part="cell-gutter"]') as HTMLElement;
    expect(getComputedStyle(gutter).textAlign).to.equal('end');
    expect(getComputedStyle(gutter).fontFamily).to.equal(getComputedStyle(cell).getPropertyValue('--lr-font-mono').trim());
  });

  it('collapses the cell grid to one column in a narrow container', async () => {
    const { vlistRoot } = await mount(NOTEBOOK, 'inline-size: 320px');
    const cell = vlistRoot.querySelector('[part~="cell"]') as HTMLElement;
    const columns = getComputedStyle(cell).gridTemplateColumns;
    // `none` would mean the cell never became a grid at all -- i.e. an inert base rule, not a
    // narrow-container collapse.
    expect(columns, 'the cell is still a grid').to.not.equal('none');
    expect(columns.split(' ').length, 'one grid column at a narrow allocation').to.equal(1);
    const gutter = vlistRoot.querySelector('[part="cell-gutter"]') as HTMLElement;
    expect(getComputedStyle(gutter).textAlign).to.equal('start');
  });

  it('paints the active cell with --lr-notebook-viewer-active-bg', async () => {
    const { cell } = await activeCell('--lr-notebook-viewer-active-bg: rgb(0, 51, 102)');
    expect(getComputedStyle(cell).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('falls back to the brand-quiet token when the active-cell prop is unset', async () => {
    const { vlistRoot, cell } = await activeCell();
    expect(getComputedStyle(cell).backgroundColor).to.equal(
      tokenValue(vlistRoot, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
  });

  it('tints stderr streams and error outputs danger, and blocks out the error label', async () => {
    const { vlistRoot } = await mount(ERROR_NOTEBOOK);
    const errorOutput = vlistRoot.querySelector('[part~="output"][data-output-type="error"]') as HTMLElement;
    const danger = tokenValue(vlistRoot, 'color: var(--lr-color-danger)', 'color');
    expect(getComputedStyle(errorOutput).color).to.equal(danger);
    const stderr = vlistRoot.querySelector('[part~="output"][data-stream="stderr"]') as HTMLElement;
    expect(getComputedStyle(stderr).color).to.equal(danger);
    const stdout = vlistRoot.querySelector('[part~="output"][data-stream="stdout"]') as HTMLElement;
    expect(getComputedStyle(stdout).color, 'a stdout stream keeps the default text color').to.not.equal(danger);
    const label = vlistRoot.querySelector('[part="error-output-label"]') as HTMLElement;
    expect(getComputedStyle(label).display).to.equal('block');
    expect(getComputedStyle(label).fontWeight).to.equal(getComputedStyle(label).getPropertyValue('--lr-font-weight-semibold').trim());
  });

  it('styles the outputs wrapper and the output-toggle button', async () => {
    const { vlistRoot } = await mount(ERROR_NOTEBOOK);
    const outputs = vlistRoot.querySelector('[part="outputs"]') as HTMLElement;
    expect(getComputedStyle(outputs).display).to.equal('flex');
    expect(getComputedStyle(outputs).flexDirection).to.equal('column');
    const toggle = vlistRoot.querySelector('[part="output-toggle"]') as HTMLElement;
    // A raw UA button would report a border, a grey background and 1px 6px padding here.
    expect(getComputedStyle(toggle).borderStyle).to.equal('none');
    expect(getComputedStyle(toggle).padding).to.equal('0px');
    expect(getComputedStyle(toggle).cursor).to.equal('pointer');
    expect(getComputedStyle(toggle).color).to.equal(tokenValue(vlistRoot, 'color: var(--lr-color-brand)', 'color'));
  });

  it('keeps a stream output LTR-isolated and left-aligned under dir="rtl", matching the code input', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div dir="rtl" style="inline-size: 900px"><lr-notebook-viewer .notebook=${NOTEBOOK}></lr-notebook-viewer></div>`,
    );
    const el = wrapper.querySelector('lr-notebook-viewer') as LyraNotebookViewer;
    await waitUntil(() => (el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="output"]').length ?? 0) > 0);
    const vlistRoot = rowRoot(el);
    const output = vlistRoot.querySelector('[part~="output"]') as HTMLElement;
    const codeBlock = vlistRoot.querySelector('lr-code-block') as HTMLElement;
    // lr-code-block may render a loading skeleton before shiki resolves and swaps in
    // [part="pre"] (see code-block.test.ts's "shiki highlighting" describe block) -- wait for it
    // instead of assuming it's already there, so this isn't racy against shiki's load time.
    await waitUntil(() => codeBlock.shadowRoot!.querySelector('[part="pre"]') !== null);
    const codePre = codeBlock.shadowRoot!.querySelector('[part="pre"]') as HTMLElement;

    // The output stays LTR-isolated, matching the code input rendered above it, instead of
    // inheriting the ambient dir="rtl" from the host.
    expect(getComputedStyle(output).direction).to.equal('ltr');
    expect(getComputedStyle(output).direction).to.equal(getComputedStyle(codePre).direction);
    expect(getComputedStyle(output).unicodeBidi).to.equal('isolate');

    // Confirm the rendered pixels: a short output line hugs the output box's own start (left) edge
    // rather than right-aligning under the ambient RTL direction.
    const textNode = output.querySelector('span')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 2); // "hi", excluding the trailing newline
    const outputRect = output.getBoundingClientRect();
    const textRect = range.getBoundingClientRect();
    expect(textRect.left - outputRect.left).to.be.lessThan(20);
  });

  it('exposes the cell parts to a consumer through exportparts', async () => {
    const style = document.createElement('style');
    style.textContent = `
      lr-notebook-viewer::part(cell) { outline-color: rgb(1, 2, 3); }
      lr-notebook-viewer::part(cell-gutter) { color: rgb(4, 5, 6); }
      lr-notebook-viewer::part(output-toggle) { color: rgb(7, 8, 9); }
      lr-notebook-viewer::part(error-output-label) { color: rgb(10, 11, 12); }
    `;
    document.head.append(style);
    try {
      const { vlistRoot } = await mount(ERROR_NOTEBOOK);
      expect(getComputedStyle(vlistRoot.querySelector('[part~="cell"]') as HTMLElement).outlineColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(vlistRoot.querySelector('[part="cell-gutter"]') as HTMLElement).color).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(vlistRoot.querySelector('[part="output-toggle"]') as HTMLElement).color).to.equal('rgb(7, 8, 9)');
      expect(getComputedStyle(vlistRoot.querySelector('[part="error-output-label"]') as HTMLElement).color).to.equal('rgb(10, 11, 12)');
    } finally {
      style.remove();
    }
  });

  // A light themed value: the override now genuinely paints the cell, so a dark one would put the
  // cell's own quiet-toned gutter text below the contrast threshold.
  it('is accessible in the active-cell state with the prop themed', async () => {
    const { el, cell } = await activeCell('--lr-notebook-viewer-active-bg: rgb(255, 255, 240)');
    expect(getComputedStyle(cell).backgroundColor).to.equal('rgb(255, 255, 240)');
    await expect(el).to.be.accessible();
  });
});

// `:hover` has no scriptable state in this runner (no pointer-control plugin is installed), so the
// hover/focus-visible variants are asserted on the shipped selector text. Their reachability is
// already proven by the rendered `output-toggle` assertions above, which share the same selector
// prefix -- an inert prefix would fail those first.
it('gives the output-toggle hover/focus-visible', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/lr-virtual-list::part\(output-toggle\):hover/);
  expect(css).to.match(/lr-virtual-list::part\(output-toggle\):focus-visible[^{]*\{[^}]*outline:/);
});

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraNotebookViewer>(html`<lr-notebook-viewer></lr-notebook-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-notebook-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-notebook-viewer-max-height')).to.equal('calc(10rem + 2px)');
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a application/x-ipynb+json renderer whose matches() and render() behave as declared', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('application/x-ipynb+json');
  expect(def, 'importing the module registers the renderer').to.exist;
  expect(def!.matches!({ name: 'Analysis.IPYNB', mimeType: 'application/x-ipynb+json', src: 'https://example.test/f' }), 'Analysis.IPYNB').to.be.true;
  expect(def!.matches!({ name: 'script.py', mimeType: 'text/x-python', src: 'https://example.test/f' }), 'script.py').to.be.false;
  expect(def!.capabilities, 'capabilities are declared for host feature-detection').to.exist;

  const host = (await fixture(html`<div>${def!.render!({
    name: 'Analysis.IPYNB', mimeType: 'application/x-ipynb+json', src: 'https://example.test/f',
  })}</div>`)) as HTMLElement;
  expect(host.querySelector('lr-notebook-viewer'), 'render() produces the viewer element').to.exist;
});

describe('hostile notebook snapshot boundaries', () => {
  it('preserves an explicitly user-facing fetch failure message', async () => {
    const originalFetch = window.fetch;
    window.fetch = (() => Promise.reject(
      new LyraUserFacingError('Localized policy rejection.'),
    )) as typeof window.fetch;
    try {
      const el = await fixture<LyraNotebookViewer>(html`
        <lr-notebook-viewer></lr-notebook-viewer>
      `);
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/notebook.ipynb';
      await event;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent)
        .to.equal('Localized policy rejection.');
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('rejects nested proxies whose prototype, array identity, length, keys, or descriptors become unreadable', () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    const rejected: unknown[] = [];

    rejected.push(new Proxy({}, {
      getPrototypeOf: () => { throw new Error('prototype denied'); },
    }));

    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    rejected.push(revoked.proxy);

    rejected.push(new Proxy([], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') throw new Error('length denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }));

    rejected.push(new Proxy({}, {
      ownKeys: () => { throw new Error('keys denied'); },
    }));

    let descriptorReads = 0;
    rejected.push(new Proxy({ retained: true }, {
      getOwnPropertyDescriptor(target, key) {
        descriptorReads++;
        if (descriptorReads > 1) throw new Error('descriptor denied');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }));

    let disappearingReads = 0;
    rejected.push(new Proxy({ retained: true }, {
      getOwnPropertyDescriptor(target, key) {
        disappearingReads++;
        return disappearingReads > 1
          ? undefined
          : Reflect.getOwnPropertyDescriptor(target, key);
      },
    }));

    for (const hostile of rejected) {
      el.notebook = {
        nbformat: 4,
        nbformat_minor: 5,
        cells: [],
        metadata: hostile,
      } as typeof el.notebook;
      expect(el.notebook).to.deep.equal({});
    }
  });

  it('validates JSON arrays iteratively and searches only their string fragments', async () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    el.notebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{
        cell_type: 'code',
        source: '',
        outputs: [{
          output_type: 'display_data',
          data: { 'application/json': [1, true, 'hidden needle', null] },
        }],
      }],
    });

    expect(await el.search('needle')).to.equal(1);

    el.notebook = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{
        cell_type: 'code',
        source: '',
        outputs: [{
          output_type: 'display_data',
          data: { 'application/json': new Array(100_000).fill(null) },
        }],
      }],
    });
    expect(el.notebook).to.be.a('string');
  });

  it('reports a lower-bound search result when one admitted cell exhausts the work budget', async () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    el.notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [{ cell_type: 'raw', source: 'x'.repeat(4_000_000) }],
    } as typeof el.notebook;

    const events: CustomEvent[] = [];
    el.addEventListener('lr-search-change', (event) => events.push(event));
    expect(await el.search('absent')).to.equal(0);
    expect(events.at(-1)?.detail).to.deep.include({
      matchCount: 0,
      matchCountExact: false,
      activeIndex: -1,
    });
  });

  it('keeps stale, duplicate, and unloaded private transitions inert', async () => {
    const el = document.createElement('lr-notebook-viewer') as LyraNotebookViewer;
    const target = el as unknown as {
      generation: number;
      loadState: unknown;
      highlightedCells: Map<number, unknown>;
      parseInline(): void;
      loadFromSrc(): Promise<void>;
      setDoc(raw: unknown, generation: number): void;
      repaintHighlights(): void;
    };
    target.parseInline();
    await target.loadFromSrc();
    target.setDoc(NOTEBOOK, target.generation - 1);
    target.highlightedCells = new Map([[1, {}]]);
    target.loadState = { kind: 'idle' };
    target.repaintHighlights();
    expect(target.highlightedCells.size).to.equal(0);

    el.notebook = JSON.stringify(NOTEBOOK);
    const first = el.notebook;
    el.notebook = first;
    expect(el.notebook).to.equal(first);
  });
});
