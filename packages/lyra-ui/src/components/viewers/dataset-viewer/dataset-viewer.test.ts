import { twoFrames } from '../../../../test/frames.js';
import { assertHighlightedCellActivation, describeCellHighlightStyling, highlightedCellAction } from '../../../../test/contracts/viewer-cell-highlight.js';
import { assertScrollFrameFollowsAdoption, shrinkAnchorRetry } from '../../../../test/viewer-scroll-test-support.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import {
  aTimeout,
  expect,
  fixture,
  html,
  oneEvent,
  waitUntil,
} from '@open-wc/testing';
import './dataset-viewer.js';
import type { LyraDatasetViewer } from './dataset-viewer.js';
import { findDocumentRenderer } from '../document-viewer/registry.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { VIEWER_SEARCH_WORK_LIMIT } from '../viewer-search-limits.js';

const TAB_DATA = 'name\tage\tcity\nAda\t30\tLondon\nGrace\t85\tArlington';
const GRID_DATASET =
  'name,role\nAda,Mathematician\nGrace,Scientist\nAda,Programmer';
function response(body: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(body),
  } as Response;
}
function fetchText(value: string): () => void {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve(response(value))) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}
expectLocaleFallback('ar', ['datasetViewerCaption', 'documentPreviewEmpty', 'documentPreviewTypeDataset', 'loadingDocument', 'noData']);
expectLocaleFallback('tr', ['datasetViewerCaption', 'documentPreviewEmpty', 'documentPreviewTypeDataset', 'loadingDocument']);

describe('lr-dataset-viewer', () => {
  it('keeps loaded cells and later updates working when a highlight omits its anchor', async () => {
    const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
    const restore = fetchText(GRID_DATASET);
    try {
      el.src = 'https://example.test/data.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);

      el.highlights = [{ id: 'missing-anchor' }] as unknown as LyraDatasetViewer['highlights'];
      await el.updateComplete;
      el.maxHeight = '12rem';
      await el.updateComplete;

      expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(1);
      expect(
        (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue(
          '--lr-dataset-viewer-max-height',
        ),
      ).to.equal('12rem');
    } finally {
      restore();
    }
  });

  it('renders an empty localized state by default', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal(
      'No dataset to display.'
    );
  });
  it('auto-detects tab-separated data and renders an accessible table', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer name="Data"></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      await el.updateComplete;
      expect(
        Array.from(el.shadowRoot!.querySelectorAll('[part="header-cell"]')).map(
          (th) => th.textContent
        )
      ).to.deep.equal(['name', 'age', 'city']);
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.equal('Data: 2 rows');
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-rowcount')
      ).to.equal('3');
    } finally {
      restore();
    }
  });
  it('retints the header row from --lr-dataset-viewer-header-row-bg', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer
        name="Data"
        style="--lr-dataset-viewer-header-row-bg: rgb(1, 2, 3);"
      ></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
      const header = el.shadowRoot!.querySelector(
        '[part="header-row"]'
      ) as HTMLElement;
      expect(getComputedStyle(header).backgroundColor).to.equal(
        'rgb(1, 2, 3)'
      );
    } finally {
      restore();
    }
  });
  it('preserves pipe delimiters and quoted newlines through the bounded record parser', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(
      'name|notes\nAda|"first | clause\nsecond clause"\nGrace|plain'
    );
    try {
      el.src = 'https://example.test/a.psv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const list = el.shadowRoot!.querySelector(
        'lr-virtual-list'
      ) as unknown as HTMLElement & {
        items: Record<string, string>[];
      };
      expect(list.items).to.deep.equal([
        { name: 'Ada', notes: 'first | clause\nsecond clause' },
        { name: 'Grace', notes: 'plain' },
      ]);
    } finally {
      restore();
    }
  });
  it('falls back to the count-only caption when name is unset', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.equal('2 rows');
    } finally {
      restore();
    }
  });
  it('renders a neutral empty-note, not assertively-announced error chrome, for a well-formed file with no rows', async () => {
    // Regression test: a delimited-text file that parses fine but has zero data rows (or zero
    // columns) used to throw the same LyraUserFacingError funneled through the generic catch
    // block into `case 'error'` -- assertive announcement and error-styled chrome for a state that isn't
    // actually a failure (matching <lr-calendar-viewer>'s identical zero-events handling).
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    let renderErrors = 0;
    el.addEventListener('lr-render-error', () => {
      renderErrors++;
    });
    const restore = fetchText('name\tage\tcity');
    try {
      el.src = 'https://example.test/empty.tsv';
      await waitUntil(
        () =>
          el.shadowRoot!.querySelector('.empty-note')?.textContent ===
          'This dataset has no rows.'
      );
      expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal(
        'This dataset has no rows.'
      );
      expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.be
        .true;
      expect(renderErrors).to.equal(0);
    } finally {
      restore();
    }
  });
  it('loads a single-column table without a parser diagnostic or render error', async () => {
    const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
    const events: string[] = [];
    el.addEventListener('lr-viewer-diagnostic', () => events.push('diagnostic'));
    el.addEventListener('lr-render-error', () => events.push('error'));
    const restore = fetchText('name\nAda\nGrace');
    try {
      el.src = 'https://example.test/names.tsv';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      expect(events).to.deep.equal([]);
    } finally {
      restore();
    }
  });
  it('emits parser diagnostics while retaining the recoverable partial table', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const diagnostics: Array<{ code: string; source: string; fatal: boolean; cause: unknown }> = [];
    const renderErrors: unknown[] = [];
    el.addEventListener('lr-viewer-diagnostic', (event) => diagnostics.push(event.detail.diagnostic));
    el.addEventListener('lr-render-error', (event) => renderErrors.push(event.detail.error));
    const restore = fetchText('name,role\nAda,Math,unexpected');
    try {
      el.src = 'https://example.test/malformed.tsv';
      await waitUntil(() => diagnostics.length === 1);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );

      const codes = (diagnostics[0]!.cause as Array<{ code?: string }>).map(
        (error) => error.code
      );
      expect(codes).to.include('TooManyFields');
      expect(diagnostics[0]!.code).to.equal('delimited-parse-diagnostic');
      expect(diagnostics[0]!.source).to.equal('papaparse');
      expect(diagnostics[0]!.fatal).to.equal(false);
      expect(renderErrors).to.deep.equal([]);
      expect(el.shadowRoot!.querySelectorAll('[part="table"]').length).to.equal(
        1
      );
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(
        0
      );
    } finally {
      restore();
    }
  });
  it('emits malformed header diagnostics consumed by PapaParse header mode', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const diagnostics: Array<{ cause: unknown }> = [];
    el.addEventListener('lr-viewer-diagnostic', (event) => diagnostics.push(event.detail.diagnostic));
    const restore = fetchText('"na"me",role\nAda,Math');
    try {
      el.src = 'https://example.test/malformed-header.csv';
      await waitUntil(() => diagnostics.length === 1);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );

      const codes = (diagnostics[0]!.cause as Array<{ code?: string }>).map(
        (error) => error.code
      );
      expect(codes).to.include('InvalidQuotes');
      expect(
        el.shadowRoot!.querySelectorAll('[part="table"]')
      ).to.have.lengthOf(1);
      expect(
        el.shadowRoot!.querySelectorAll('[part="error"]')
      ).to.have.lengthOf(0);
    } finally {
      restore();
    }
  });
  it('leaves a host aria-label on the host while retaining a purpose-specific table caption', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer aria-label="Team roster"></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      expect(base.getAttribute('role')).to.be.null;
      expect(base.getAttribute('aria-label')).to.be.null;
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.equal('2 rows');
    } finally {
      restore();
    }
  });
  it('does not reuse an explicit host aria-label as the named table caption', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer
        name="Data"
        aria-label="Team roster"
      ></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.equal('Data: 2 rows');
    } finally {
      restore();
    }
  });
  it('preserves an explicitly empty host aria-label ahead of the name-derived caption', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer name="Data" aria-label=""></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const table = el.shadowRoot!.querySelector('[part="table"]')!;
      expect(base.hasAttribute('aria-label')).to.be.true;
      expect(base.getAttribute('aria-label')).to.equal('');
      expect(table.getAttribute('aria-label')).to.equal('Data: 2 rows');
    } finally {
      restore();
    }
  });
  it('names a persistent region landmark on [part="base"] in every fetch state, not only once loaded', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer name="Quarterly sales"></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;

    // idle -- before any src is set. A screen-reader user navigating by landmark previously found
    // nothing here at all, despite `name` being set.
    expect(base().getAttribute('role')).to.equal('region');
    expect(base().getAttribute('aria-label')).to.equal('Quarterly sales');

    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await el.updateComplete;
      // loading
      expect(base().getAttribute('role')).to.equal('region');
      expect(base().getAttribute('aria-label')).to.equal('Quarterly sales');
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      // loaded -- the outer region keeps the plain display name while the inner table keeps its
      // richer row-count caption; the two are not mutually exclusive.
      expect(base().getAttribute('role')).to.equal('region');
      expect(base().getAttribute('aria-label')).to.equal('Quarterly sales');
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.contain('2');
    } finally {
      restore();
    }
  });

  it('keeps a non-empty host name on the host across fetch states', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer
        name="Data"
        aria-label="Team roster"
      ></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base().getAttribute('aria-label')).to.be.null;
    expect(base().getAttribute('role')).to.be.null;

    const restore = fetchText('not,a\nvalid');
    try {
      window.fetch = (() =>
        Promise.reject(new Error('boom'))) as typeof window.fetch;
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      // error state
      expect(base().getAttribute('role')).to.be.null;
      expect(base().getAttribute('aria-label')).to.be.null;
    } finally {
      restore();
    }
  });

  it('adds no unnamed region when neither name nor a host aria-label is set', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('role')).to.equal(false);
    expect(base.hasAttribute('aria-label')).to.equal(false);
  });

  it('localizes the interpolated row count', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer lang="ar"></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(TAB_DATA);
    try {
      el.src = 'https://example.test/a.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      expect(
        el
          .shadowRoot!.querySelector('[part="table"]')!
          .getAttribute('aria-label')
      ).to.contain(new Intl.NumberFormat('ar').format(2));
    } finally {
      restore();
    }
  });
  it('supports a .strings override for the empty-state message', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer
        .strings=${{
          documentPreviewEmpty: 'Aucun {type} à afficher.',
          documentPreviewTypeDataset: 'jeu de données',
        }}
      ></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal(
      'Aucun jeu de données à afficher.'
    );
  });
  it('rejects unsafe URLs and emits exactly one render error', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => {
      count++;
    });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector('[part="error"]')!.textContent
    ).to.equal('Document URL is not allowed.');
    expect(
      el.shadowRoot!.querySelectorAll(
        '[role="alert"], [role="status"], [aria-live]'
      ).length
    ).to.equal(0);
    expect(count).to.equal(1);
  });
  it('registers tsv/psv/dat but not csv or unrelated files', () => {
    expect(
      findDocumentRenderer({
        name: 'a.tsv',
        mimeType: 'application/octet-stream',
        src: 'x',
      })
    ).to.exist;
    expect(
      findDocumentRenderer({ name: 'a.csv', mimeType: 'text/csv', src: 'x' })
    ).to.not.exist;
  });
  it('keeps the loaded data across a same-task DOM move', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => {
      calls++;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve('name\trole\nAda\tOne') } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer src="https://example.test/a.tsv"></lr-dataset-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
      el.parentElement!.append(document.createElement('span'), el);
      await twoFrames();
      expect(calls).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="table"]') !== null).to.be.true;
    } finally {
      window.fetch = original;
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => {
      calls++;
      return Promise.resolve(response(TAB_DATA));
    }) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-dataset-viewer
          src="https://example.test/a.tsv"
        ></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      await waitUntil(
        () =>
          calls === 1 && el.shadowRoot!.querySelector('[part="table"]') !== null
      );
      const parent = el.parentElement!;
      el.remove();
      await aTimeout(0);
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally {
      window.fetch = original;
    }
  });
  it('is accessible', async () => {
    const el = await fixture(html`<lr-dataset-viewer></lr-dataset-viewer>`);
    await expect(el).to.be.accessible();
  });

  describe('virtualized table structure', () => {
    it('maps to role=table / role=row / role=rowgroup with correct rowcount/rowindex', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        const table = el.shadowRoot!.querySelector('[part="table"]')!;
        expect(table.getAttribute('role')).to.equal('table');
        expect(table.getAttribute('aria-rowcount')).to.equal('4'); // 3 data rows + header
        expect(table.getAttribute('aria-colcount')).to.equal('2');
        expect(
          el
            .shadowRoot!.querySelector('[part="header-row"]')!
            .getAttribute('role')
        ).to.equal('row');
        expect(
          el
            .shadowRoot!.querySelector('[part="header-row"]')!
            .getAttribute('aria-rowindex')
        ).to.equal('1');
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(
          list.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
        ).to.equal('rowgroup');
        await aTimeout(0);
        const firstRow = list.shadowRoot!.querySelector('[part="row"]')!;
        expect(firstRow.getAttribute('role')).to.equal('row');
        expect(firstRow.getAttribute('aria-rowindex')).to.equal('2'); // first body row, offset by the header
      } finally {
        restore();
      }
    });

    it('is accessible on the mapped table/rowgroup/row tree', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        await expect(el).to.be.accessible();
      } finally {
        restore();
      }
    });

    it('is accessible with cell-range highlights painting their focusable action buttons', async () => {
      // Populated-state axe check: the `cell-highlight` cells and their nested
      // `cell-highlight-action` buttons only render once `highlights` resolve against a loaded
      // grid — no highlight-free axe run can see them. Assert the highlight actually rendered
      // (inside the nested virtual-list shadow root, which axe also traverses) before running axe.
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2:B2' },
            label: 'First data row',
          },
        ];
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        await waitUntil(
          () =>
            list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null
        );
        expect(list.shadowRoot!.querySelector('[part="cell-highlight-action"]'))
          .to.exist;
        await expect(el).to.be.accessible();
      } finally {
        restore();
      }
    });

    it('exports the virtualized row parts so a consumer stylesheet reaches them', async () => {
      // Row markup is rendered inside <lr-virtual-list>'s own shadow root, two hops from a
      // consumer: without exportparts on that element, lr-dataset-viewer::part(cell) and friends
      // match nothing at all.
      const style = document.createElement('style');
      style.textContent = `
        lr-dataset-viewer::part(data-row) { opacity: 0.75; }
        lr-dataset-viewer::part(cell) { padding-block-start: 3px; }
        lr-dataset-viewer::part(cell-highlight) { padding-block-start: 5px; }
        lr-dataset-viewer::part(cell-highlight-action) { padding-block-start: 7px; }
      `;
      document.head.append(style);
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First data row',
          },
        ];
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        await waitUntil(
          () =>
            list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null
        );
        const dataRow = list.shadowRoot!.querySelector(
          '[part="data-row"]'
        ) as HTMLElement;
        const plain = list.shadowRoot!.querySelector(
          '[part="cell"]'
        ) as HTMLElement;
        const highlighted = list.shadowRoot!.querySelector(
          '[part~="cell-highlight"]'
        ) as HTMLElement;
        const action = list.shadowRoot!.querySelector(
          '[part="cell-highlight-action"]'
        ) as HTMLElement;
        expect(getComputedStyle(dataRow).opacity).to.equal('0.75');
        expect(getComputedStyle(plain).paddingBlockStart).to.equal('3px');
        expect(getComputedStyle(highlighted).paddingBlockStart).to.equal('5px');
        expect(getComputedStyle(action).paddingBlockStart).to.equal('7px');
      } finally {
        restore();
        style.remove();
      }
    });

    it('renders files above the old 1,000-row cap up to the shared 10k default', async () => {
      const bigRows = Array.from(
        { length: 5000 },
        (_unused, i) => `row${i},value${i}`
      ).join('\n');
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(`name,val\n${bigRows}`);
      try {
        el.src = 'https://example.test/big.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(el.shadowRoot!.querySelector('[part="error"]') == null).to.be
          .true;
        expect(
          el
            .shadowRoot!.querySelector('[part="table"]')!
            .getAttribute('aria-rowcount')
        ).to.equal('5001');
      } finally {
        restore();
      }
    });

    it('still errors above 10,000 rows', async () => {
      const bigRows = Array.from(
        { length: 10001 },
        (_unused, i) => `row${i},value${i}`
      ).join('\n');
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(`name,val\n${bigRows}`);
      try {
        const errorEvent = oneEvent(el, 'lr-render-error');
        el.src = 'https://example.test/toobig.tsv';
        const event = (await errorEvent) as CustomEvent<{ error: unknown }>;
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="error"]') !== null
        );
        expect(event.detail.error instanceof LyraResourceLimitError).to.be.true;
        expect(
          el.shadowRoot!.querySelectorAll('[part="error"]')
        ).to.have.lengthOf(1);
        expect(
          el.shadowRoot!.querySelectorAll('[part="table"]')
        ).to.have.lengthOf(0);
      } finally {
        restore();
      }
    });
  });

  describe('cell-range anchor-target and search', () => {
    it('resolves a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to
          .be.true;
      } finally {
        restore();
      }
    });

    it('scrolls a header-row anchor with the same reduced-motion-gated behavior as every other row', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      const originalMatchMedia = window.matchMedia;
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
        const cell = el
          .shadowRoot!.querySelector('[part="header-row"]')!
          .querySelectorAll('[part~="header-cell"]')[1] as HTMLElement;
        const behaviors: (ScrollBehavior | undefined)[] = [];
        cell.scrollIntoView = ((options?: ScrollIntoViewOptions) => {
          behaviors.push(options?.behavior);
        }) as HTMLElement['scrollIntoView'];

        window.matchMedia = (() =>
          ({ matches: false } as MediaQueryList)) as typeof window.matchMedia;
        expect(
          await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })
        ).to.equal(true);
        // <lr-csv-viewer>'s structurally identical header branch already does this, as does this
        // component's own scrollColumnIntoView() for every non-header row.
        expect(behaviors).to.deep.equal(['smooth']);

        window.matchMedia = (() =>
          ({ matches: true } as MediaQueryList)) as typeof window.matchMedia;
        expect(
          await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })
        ).to.equal(true);
        expect(behaviors).to.deep.equal(['smooth', 'auto']);
      } finally {
        window.matchMedia = originalMatchMedia;
        restore();
      }
    });

    it('reports a failed jump when a concurrent src reassignment lands during the scroll wait', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        // One attempt only: the mixin's retry loop would otherwise re-resolve against the newly
        // loaded document, which is correct behavior but hides this call's own result.
        (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 0;
        (
          el as unknown as { anchorRetryIntervalMs: number }
        ).anchorRetryIntervalMs = 0;

        // Reassign `src` through the real public setter from inside the await that jumpToCell is
        // already suspended on -- exactly the citation/file-tab click that lands mid-jump.
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        let swapped = false;
        Object.defineProperty(list, 'updateComplete', {
          configurable: true,
          get: () => {
            if (swapped) return Promise.resolve(true);
            swapped = true;
            return (async () => {
              el.src = 'https://example.test/other.tsv';
              await el.updateComplete;
              await aTimeout(0);
              return true;
            })();
          },
        });

        const found = await el.scrollToAnchor({
          kind: 'cell-range',
          range: 'A2',
        });
        expect(
          swapped,
          'the reassignment really landed inside the jump'
        ).to.equal(true);
        expect(
          found,
          'a jump whose document was replaced mid-flight is not a success'
        ).to.equal(false);
      } finally {
        restore();
      }
    });

    it('resolves an anchor and highlight in the header row, deduplicating repeated public ids', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to
          .be.true;
        el.highlights = [
          {
            id: 'duplicate',
            anchor: { kind: 'cell-range', range: 'A1' },
            label: 'First',
          },
          {
            id: 'duplicate',
            anchor: { kind: 'cell-range', range: 'B1' },
            label: 'Ignored duplicate',
          },
        ];
        await el.updateComplete;
        const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
        expect(
          header.querySelectorAll('[part~="cell-highlight"]')
        ).to.have.lengthOf(1);
        const highlighted = header.querySelector('[part~="cell-highlight"]')!;
        expect(highlighted.getAttribute('role')).to.equal('columnheader');
        const action = highlighted.querySelector(
          '[part="cell-highlight-action"]'
        ) as HTMLElement;
        expect(action !== null).to.be.true;
        expect(getComputedStyle(highlighted).outlineStyle).to.equal('solid');
        expect(getComputedStyle(action).minBlockSize).to.equal('36px');
      } finally {
        restore();
      }
    });

    it('resolves false for an anchor with a sheet set', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(
          await el.scrollToAnchor({
            kind: 'cell-range',
            sheet: 'Sheet1',
            range: 'A1',
          })
        ).to.be.false;
      } finally {
        restore();
      }
    });

    it('truthfully rejects rows and columns outside the parsed grid', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' }))
          .to.be.false;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to
          .be.false;
      } finally {
        restore();
      }
    });

    it('scrolls the addressed body column horizontally into view', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () =>
            el
              .shadowRoot!.querySelector('lr-virtual-list')
              ?.shadowRoot?.querySelector('[part="data-row"]') != null
        );
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const target = list
          .shadowRoot!.querySelector('[part="data-row"]')!
          .querySelectorAll('[part~="cell"]')[1] as HTMLElement;
        let scrolled = false;
        target.scrollIntoView = () => {
          scrolled = true;
        };
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B2' })).to
          .be.true;
        expect(scrolled).to.be.true;
      } finally {
        restore();
      }
    });

    it('cancels a stale scroll frame in its source realm and uses the current realm after iframe adoption', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const scrollColumnIntoView = (): Promise<void> =>
        (
          el as unknown as {
            scrollColumnIntoView: (col: number) => Promise<void>;
          }
        ).scrollColumnIntoView(1);

      await assertScrollFrameFollowsAdoption(el, scrollColumnIntoView);
    });

    it('finds search matches ordered row -> column', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.search('ada')).to.equal(2);
      } finally {
        restore();
      }
    });

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        table: {
          fields: ['value'],
          rows: Array.from({ length: 1_001 }, () => ({ value: 'hit' })),
        },
      };
      await el.updateComplete;
      let cappedDetail:
        | { matchCount: number; matchCountExact: boolean }
        | undefined;
      el.addEventListener('lr-search-change', (event) => {
        cappedDetail = event.detail;
      });
      expect(await el.search('hit')).to.equal(1_000);
      expect(
        (el as unknown as { table: { search: { matches: unknown[] } } }).table.search.matches
      ).to.have.lengthOf(1_000);
      expect(cappedDetail).to.deep.include({
        matchCount: 1_000,
        matchCountExact: false,
      });

      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        table: {
          fields: ['value'],
          rows: Array.from({ length: 1_000 }, () => ({ value: 'hit' })),
        },
      };
      expect(await el.search('hit')).to.equal(1_000);
      expect(cappedDetail).to.deep.include({
        matchCount: 1_000,
        matchCountExact: true,
      });
    });

    it('searches header fields and case-folds with the effective locale', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer lang="tr"></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText('İSTANBUL,role\nAnkara,capital');
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.search('istanbul')).to.equal(1);
      } finally {
        restore();
      }
    });

    it('recomputes an active search when the host language changes', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer lang="en"></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText('City\nİSTANBUL\nistanbul');
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(await el.search('istanbul')).to.equal(1);
        el.lang = 'tr';
        await el.updateComplete;
        await aTimeout(0);
        expect(
          (el as unknown as { table: { search: { matches: unknown[] } } }).table.search.matches
        ).to.have.lengthOf(2);
      } finally {
        restore();
      }
    });

    it('paints at most the bounded highlight candidates, always keeping the active one', async () => {
      const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<unknown> };
        await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell"]') !== null);
        el.highlights = [
          ...Array.from({ length: 1_000 }, (_unused, index) => ({
            id: `far-${index}`,
            anchor: { kind: 'cell-range' as const, range: 'Z9999' },
          })),
          { id: 'near', anchor: { kind: 'cell-range', range: 'A2' } },
        ];
        await el.updateComplete;
        await list.updateComplete;
        expect(list.shadowRoot!.querySelector('[part~="cell-highlight"]') === null).to.be.true;
        el.activeHighlightId = 'near';
        await waitUntil(() => list.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
      } finally {
        restore();
      }
    });

    it('searchNext/searchPrevious wrap, and clearSearch resets to 0/-1', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        await el.search('ada');
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener(
          'lr-search-change',
          (e) => (detail = (e as CustomEvent).detail)
        );
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(1); // wraps backward
        const listener = oneEvent(el, 'lr-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{
          query: string;
          matchCount: number;
          matchCountExact: boolean;
          activeIndex: number;
        }>;
        expect(event.detail).to.deep.equal({
          query: '',
          matchCount: 0,
          matchCountExact: true,
          activeIndex: -1,
        });
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeItemId: unknown };
        expect(list.activeItemId).to.equal('');
      } finally {
        restore();
      }
    });

    it('an empty query behaves like clearSearch and resolves 0', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        await el.search('ada');
        expect(await el.search('   ')).to.equal(0);
      } finally {
        restore();
      }
    });

    it('renders a structural highlighted cell with a native activation action', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        el.highlights = [
          { id: 'h1', anchor: { kind: 'cell-range', range: 'A2' } },
        ];
        await el.updateComplete;
        await assertHighlightedCellActivation(el, { id: 'h1', hitArea: '36px' });
      } finally {
        restore();
      }
    });

    it('exposes an activation button only inside a highlighted cell, never a plain cell', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First result',
          },
        ];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const plain = list.shadowRoot!.querySelector(
          '[part="cell"]'
        ) as HTMLElement;
        expect(plain.hasAttribute('tabindex')).to.be.false;
        expect(plain.querySelector('button') === null).to.equal(true);
        // A native <button> provides Enter/Space activation as built-in behavior, so proving the
        // control is a button with the highlight's accessible name covers the keyboard contract.
        await assertHighlightedCellActivation(el, { id: 'h1', name: 'Highlight: Ada — First result' });
      } finally {
        restore();
      }
    });

    it('localizes the complete highlighted-cell name with independently ordered value and label placeholders', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      el.strings = {
        cellHighlightWithLabel: '{label} ⇐ {value}',
      };
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First result',
          },
        ];
        await el.updateComplete;
        const { action } = highlightedCellAction(el);
        expect(action.getAttribute('aria-label')).to.equal(
          'First result ⇐ Ada'
        );
      } finally {
        restore();
      }
    });
  });

  it('does not leak internal virtual-list events through the viewer host', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(GRID_DATASET);
    try {
      el.src = 'https://example.test/data.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      let leaked = 0;
      for (const name of [
        'lr-load-more',
        'lr-virtual-scroll',
      ]) {
        el.addEventListener(name as never, () => {
          leaked++;
        });
        el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
          new CustomEvent(name, { bubbles: true, composed: true })
        );
      }
      expect(leaked).to.equal(0);
    } finally {
      restore();
    }
  });

  it('does not leak the internal virtual-list events through the viewer host under the canonical lr-visible-range-change name', async () => {
    const el = (await fixture(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    )) as LyraDatasetViewer;
    const restore = fetchText(GRID_DATASET);
    try {
      el.src = 'https://example.test/data.tsv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      let leaked = 0;
      el.addEventListener('lr-visible-range-change' as never, () => {
        leaked++;
      });
      el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
        new CustomEvent('lr-visible-range-change', {
          bubbles: true,
          composed: true,
        })
      );
      expect(leaked).to.equal(0);
    } finally {
      restore();
    }
  });

  describe('back-compat', () => {
    it('::part(table) still matches, and no cell-highlight renders unset', async () => {
      const el = (await fixture(
        html`<lr-dataset-viewer></lr-dataset-viewer>`
      )) as LyraDatasetViewer;
      const restore = fetchText(GRID_DATASET);
      try {
        el.src = 'https://example.test/data.tsv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="table"]') !== null
        );
        expect(el.shadowRoot!.querySelector('[part~="table"]')).to.exist;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        expect(
          list.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length
        ).to.equal(0);
      } finally {
        restore();
      }
    });
  });
});

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraDatasetViewer>(
    html`<lr-dataset-viewer></lr-dataset-viewer>`
  );
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(
    base.style.getPropertyValue('--lr-dataset-viewer-max-height')
  ).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(
    base.style.getPropertyValue('--lr-dataset-viewer-max-height')
  ).to.equal('calc(10rem + 2px)');
});

// A scroll container clips both axes. Leaving the uncapped body at `overflow: auto` therefore
// makes it the sticky header's containing block even though the body itself never scrolls; the
// header then leaves the viewport with the rest of the page.
describe('scrollMode', () => {
  const body = (el: LyraDatasetViewer): HTMLElement =>
    el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  it('defaults to self-contained scrolling for compatibility', async () => {
    const el = await fixture<LyraDatasetViewer>(
      html`<lr-dataset-viewer></lr-dataset-viewer>`
    );

    expect(el.scrollMode).to.equal('self');
    expect(getComputedStyle(body(el)).overflowY).to.equal('auto');
  });

  it('hands an uncapped sticky header to the page scrollport in page mode', async () => {
    const el = await fixture<LyraDatasetViewer>(
      html`<lr-dataset-viewer scroll-mode="page"></lr-dataset-viewer>`
    );

    const style = getComputedStyle(body(el));
    expect(style.overflowX).to.equal('visible');
    expect(style.overflowY).to.equal('visible');
    expect(style.maxBlockSize).to.equal('none');
  });

  it('lets rows continue in the page scroll in page mode', async () => {
    const restore = fetchText(['name', ...Array.from({ length: 200 }, (_unused, index) => `row ${index}`)].join('\n'));
    try {
      const el = await fixture<LyraDatasetViewer>(
        html`<lr-dataset-viewer scroll-mode="page" src="https://example.test/rows.csv"></lr-dataset-viewer>`
      );
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="base"]') !== null);
      const base = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(base.hasAttribute('data-external-scroll')).to.be.true;
      expect(base.getBoundingClientRect().height).to.be.greaterThan(1_000);
    } finally {
      restore();
    }
  });

  it('normalizes unsupported scroll modes back to self', async () => {
    const el = await fixture<LyraDatasetViewer>(
      html`<lr-dataset-viewer scroll-mode="sideways"></lr-dataset-viewer>`
    );

    expect(el.scrollMode).to.equal('self');
    expect(el.getAttribute('scroll-mode')).to.equal('self');
    expect(getComputedStyle(body(el)).overflowY).to.equal('auto');
  });
});

describeCellHighlightStyling({
  tag: 'lr-dataset-viewer',
  src: 'https://example.test/data.tsv',
  install: () => fetchText(GRID_DATASET),
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a lyra:dataset renderer whose matches() and render() behave as declared', async () => {
  const { getDefaultDocumentRendererRegistry, loadDocumentRenderer } = await import(
    '../document-viewer/registry.js'
  );
  const def = getDefaultDocumentRendererRegistry().get('lyra:dataset');
  expect(def, 'importing the module registers the renderer').to.exist;
  expect(
    def!.matches!({
      name: 'data.TSV',
      mimeType: 'text/tab-separated-values',
      src: 'https://example.test/f',
    }),
    'data.TSV'
  ).to.be.true;
  expect(
    def!.matches!({
      name: 'data.psv',
      mimeType: 'text/plain',
      src: 'https://example.test/f',
    }),
    'data.psv'
  ).to.be.true;
  expect(
    def!.matches!({
      name: 'data.dat',
      mimeType: 'text/plain',
      src: 'https://example.test/f',
    }),
    'data.dat'
  ).to.be.true;
  expect(
    def!.matches!({
      name: 'data.csv',
      mimeType: 'text/csv',
      src: 'https://example.test/f',
    }),
    'data.csv'
  ).to.be.false;
  expect(
    def!.capabilities,
    'capabilities are declared for host feature-detection'
  ).to.exist;

  const loaded = await loadDocumentRenderer(def!);
  const host = (await fixture(
    html`<div>
      ${loaded.render!({
        name: 'data.TSV',
        mimeType: 'text/tab-separated-values',
        src: 'https://example.test/f',
      })}
    </div>`
  )) as HTMLElement;
  expect(
    host.querySelector('lr-dataset-viewer'),
    'render() produces the viewer element'
  ).to.exist;
});

it('keeps a stable items reference and keyFunction on the composed lr-virtual-list across an unrelated re-render', async () => {
  const el = (await fixture(
    html`<lr-dataset-viewer></lr-dataset-viewer>`
  )) as LyraDatasetViewer;
  const restore = fetchText(GRID_DATASET);
  try {
    el.src = 'https://example.test/data.csv';
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
    );
    const virtual = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      items: unknown;
      keyFunction: unknown;
    };
    const items = virtual.items;
    const keyFunction = virtual.keyFunction;
    expect(items, 'items should be populated').to.not.be.undefined;

    // An unrelated reactive property must not rebind fresh array/closure references, or the
    // composed lr-virtual-list clears its measured row heights and recomputes every offset even
    // though the row data itself never changed.
    el.name = 'Renamed dataset';
    await el.updateComplete;

    expect(virtual.items, 'items reference').to.equal(items);
    expect(virtual.keyFunction, 'keyFunction reference').to.equal(keyFunction);
  } finally {
    restore();
  }
});


describe('dataset header and cell search ceilings', () => {
  for (const location of ['header', 'body'] as const) {
    it(`reports an inexact lower bound when the ${location} exceeds search work`, async () => {
      const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
      const oversized = 'x'.repeat(VIEWER_SEARCH_WORK_LIMIT);
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        table: {
          fields: location === 'header' ? [oversized] : ['value'],
          rows: location === 'header' ? [{ [oversized]: 'hit' }] : [{ value: oversized }, { value: 'hit' }],
        },
      };
      let exact: boolean | undefined;
      el.addEventListener('lr-search-change', (event) => { exact = event.detail.matchCountExact; });
      expect(await el.search('hit')).to.equal(0);
      expect(exact).to.equal(false);
      el.clearSearch();
      expect(exact).to.equal(true);
    });
  }

  it('caps matches in the header before searching later body cells', async () => {
    const el = await fixture<LyraDatasetViewer>(html`<lr-dataset-viewer></lr-dataset-viewer>`);
    const fields = Array.from({ length: 1_001 }, (_, index) => `hit-${index}`);
    (el as unknown as { fetchState: unknown }).fetchState = {
      kind: 'loaded', table: { fields, rows: [{ [fields[0]!]: 'hit' }] },
    };
    let detail: { matchCount: number; matchCountExact: boolean } | undefined;
    el.addEventListener('lr-search-change', (event) => { detail = event.detail; });
    expect(await el.search('hit')).to.equal(1_000);
    expect(detail).to.deep.include({ matchCount: 1_000, matchCountExact: false });
  });
});
