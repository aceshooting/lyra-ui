import { twoFrames } from '../../../../test/frames.js';
import { assertHighlightedCellActivation, describeCellHighlightStyling, highlightedCellAction } from '../../../../test/contracts/viewer-cell-highlight.js';
import {
  aTimeout,
  expect,
  fixture,
  html,
  oneEvent,
  waitUntil,
} from '@open-wc/testing';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import './spreadsheet-viewer.js';
import type { LyraSpreadsheetViewer } from './spreadsheet-viewer.js';
import { assertScrollFrameFollowsAdoption, shrinkAnchorRetry } from '../../../../test/viewer-scroll-test-support.js';
import { LYRA_DEFAULT_STRINGS, registerLyraLocale } from '../../../internal/localization.js';

// Numeric formatting and case-folding need these locales; their UI text is fixture data.
for (const locale of ['ar', 'tr', 'de']) {
  registerLyraLocale(locale, LYRA_DEFAULT_STRINGS);
}

function buffer(workbook: Record<string, unknown[][]>): ArrayBuffer {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(workbook))
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  const binary = XLSX.write(book, {
    type: 'binary',
    bookType: 'xlsx',
  }) as string;
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    result[i] = binary.charCodeAt(i) & 255;
  return result.buffer;
}

function fetchBuffer(value: ArrayBuffer): () => void {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: () => Promise.resolve(value),
    } as Response)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

/** A promise plus its externally-callable resolve/reject, for precisely timing a stale in-flight
 *  `load()` against a later superseding `src` change. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const GRID_WORKBOOK = {
  Sheet1: [
    ['Name', 'Role'],
    ['Ada', 'Mathematician'],
    ['Grace', 'Scientist'],
    ['Ada', 'Programmer'],
  ],
};

describe('lr-spreadsheet-viewer', () => {
  it('keeps the shared anchor live region visually hidden once it carries an announcement', async () => {
    const el = await fixture<LyraSpreadsheetViewer>(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    );
    await el.scrollToAnchor('no-such-highlight');
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector(
      '[part="anchor-live-region"]'
    ) as HTMLElement;
    expect(region !== null, 'the mixin live region is rendered').to.equal(true);
    expect((region.textContent ?? '').trim().length).to.be.greaterThan(0);
    const rect = region.getBoundingClientRect();
    expect(
      rect.height,
      'live-region block size stays clipped to 1px'
    ).to.be.at.most(1);
    expect(
      rect.width,
      'live-region inline size stays clipped to 1px'
    ).to.be.at.most(1);
  });

  it('renders an empty localized state by default', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal(
      'No document to display.'
    );
  });

  it('defaults --lr-spreadsheet-viewer-max-height to none, leaving the body unconstrained', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(el.maxHeight).to.equal('');
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(getComputedStyle(body).maxBlockSize).to.equal('none');
  });

  it('applies max-height as a custom property on the base part', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer max-height="20rem"></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).style.getPropertyValue('--lr-spreadsheet-viewer-max-height')
    ).to.equal('20rem');
  });

  it('never scrolls vertically on the sheet wrapper -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar', async () => {
    // Same bug/fix as lr-tab-group: pinning only overflow-x to a non-'visible' value forces the browser
    // to resolve the unset y axis to 'auto' too (never leaves it 'visible'), risking a phantom empty
    // vertical scrollbar on a workbook that fits horizontally.
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({
        Sheet1: [
          ['Name', 'Qty'],
          ['Widget', 12],
        ],
      })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
      );
      expect(
        getComputedStyle(
          el.shadowRoot!.querySelector('[part="sheet"]') as HTMLElement
        ).overflowY
      ).to.equal('hidden');
    } finally {
      restore();
    }
  });

  it('renders a workbook header and virtualized body rows', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({
        Sheet1: [
          ['Name', 'Qty'],
          ['Widget', 12],
          ['Gadget', 3],
        ],
      })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="header-row"]')!.textContent
      ).to.equal('NameQty');
      expect(
        (
          el.shadowRoot!.querySelector('lr-virtual-list') as unknown as HTMLElement & {
            items: unknown[][];
          }
        ).items
      ).to.deep.equal([
        ['Widget', 12],
        ['Gadget', 3],
      ]);
    } finally {
      restore();
    }
  });

  it('exposes a complete ARIA table, row, header, and cell ownership tree', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer name="Inventory"></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({
        Sheet1: [
          ['Name', 'Qty'],
          ['Widget', 12],
        ],
      })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const sheet = el.shadowRoot!.querySelector('[part="sheet"]')!;
      const header = el.shadowRoot!.querySelector('[part="header-row"]')!;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(
        () => list.shadowRoot!.querySelector('[part="data-row"]') !== null
      );
      expect(sheet.getAttribute('role')).to.equal('table');
      expect(sheet.getAttribute('aria-rowcount')).to.equal('2');
      expect(sheet.getAttribute('aria-colcount')).to.equal('2');
      expect(header.getAttribute('role')).to.equal('row');
      expect(
        Array.from(header.querySelectorAll('[part~="cell"]')).map((cell) =>
          cell.getAttribute('role')
        )
      ).to.deep.equal(['columnheader', 'columnheader']);
      expect(list.getAttribute('item-role')).to.equal('row');
      expect(
        Array.from(list.shadowRoot!.querySelectorAll('[part~="cell"]')).map(
          (cell) => cell.getAttribute('role')
        )
      ).to.deep.equal(['cell', 'cell']);
    } finally {
      restore();
    }
  });

  it('locale-formats numeric cell values', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer lang="ar"></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer({ Sheet1: [['Qty'], [1234.5]] }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(
        () => list.shadowRoot!.querySelector('[part~="cell"]') !== null
      );
      expect(
        list.shadowRoot!.querySelector('[part~="cell"]')!.textContent
      ).to.equal(new Intl.NumberFormat('ar', { useGrouping: false }).format(1234.5));
    } finally {
      restore();
    }
  });

  it('renders cells through their number formats', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Time', 'Share', 'Price', 'Zip', 'Year'],
      [new Date(Date.UTC(2024, 0, 2)), 0.5, 0.25, 1234.5, 2134, 2024],
    ]);
    sheet['B2']!.z = 'h:mm';
    sheet['C2']!.z = '0%';
    sheet['D2']!.z = '"$"#,##0.00';
    sheet['E2']!.z = '00000';
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
    const el = await fixture<LyraSpreadsheetViewer>(
      html`<lr-spreadsheet-viewer lang="de"></lr-spreadsheet-viewer>`
    );
    const restore = fetchBuffer(
      XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(() => list.shadowRoot!.querySelector('[part="data-row"]') !== null);
      const texts = Array.from(
        list.shadowRoot!.querySelectorAll('[part~="cell"]'),
        (cell) => cell.textContent
      );
      expect(texts).to.deep.equal([
        new Intl.DateTimeFormat('de', { timeZone: 'UTC', dateStyle: 'medium' }).format(Date.UTC(2024, 0, 2)),
        new Intl.DateTimeFormat('de', { timeZone: 'UTC', timeStyle: 'short' }).format(Date.UTC(1899, 11, 31, 12)),
        '25%',
        '$1,234.50',
        '02134',
        '2024',
      ]);
    } finally {
      restore();
    }
  });

  it('bounds the declared sheet range before expanding it', async () => {
    const zip = await JSZip.loadAsync(buffer({ Sheet1: [['x']] }));
    const sheetPath = 'xl/worksheets/sheet1.xml';
    const withDimension = async (ref: string): Promise<ArrayBuffer> => {
      const xml = await zip.file(sheetPath)!.async('string');
      zip.file(sheetPath, xml.replace(/<dimension ref="[^"]*"/, `<dimension ref="${ref}"`));
      return zip.generateAsync({ type: 'arraybuffer' });
    };
    const walked: unknown[] = [];
    const load = async (source: ArrayBuffer): Promise<LyraSpreadsheetViewer> => {
      const el = await fixture<LyraSpreadsheetViewer>(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      );
      (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () =>
        Promise.resolve({
          read: XLSX.read,
          utils: {
            sheet_to_json: (sheet: XLSX.WorkSheet, options: XLSX.Sheet2JSONOpts) => {
              walked.push(sheet['!ref']);
              return XLSX.utils.sheet_to_json(sheet, options);
            },
          },
        });
      const restore = fetchBuffer(source);
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="error"], [part="header-row"]') !== null
        );
      } finally {
        restore();
      }
      return el;
    };

    const wide = await load(await withDimension('A1:XFD300'));
    expect(wide.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
      'This document is too large to preview.'
    );
    expect(walked).to.deep.equal([]);
    const bloated = await load(await withDimension('A1:XFD1048576'));
    expect(bloated.shadowRoot!.querySelector('[part="header-row"]')?.textContent).to.equal('x');
    expect(walked).to.deep.equal(['A1']);
  });

  it('renders data rows as a grid, matching the header row, not as unstyled stacked text', async () => {
    // Regression test: renderRow()/renderCell()'s output for data rows is rendered inside
    // <lr-virtual-list>'s own shadow root via its renderItem callback, a different shadow tree
    // than spreadsheet-viewer.styles.ts's stylesheet is scoped to -- a plain [part='data-row']/
    // [part='cell'] CSS selector there can never reach it, only the header row (rendered directly
    // by this component). Same bug/fix as lr-csv-viewer's identical architecture.
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      await waitUntil(
        () => list.shadowRoot!.querySelector('[part="data-row"]') !== null
      );
      const headerRow = el.shadowRoot!.querySelector(
        '[part="header-row"]'
      ) as HTMLElement;
      const dataRow = list.shadowRoot!.querySelector(
        '[part="data-row"]'
      ) as HTMLElement;
      expect(getComputedStyle(dataRow).display).to.equal('grid');
      expect(getComputedStyle(dataRow).display).to.equal(
        getComputedStyle(headerRow).display
      );
      const headerCell = headerRow.querySelector(
        '[part="cell"]'
      ) as HTMLElement;
      const dataCell = dataRow.querySelector('[part="cell"]') as HTMLElement;
      expect(getComputedStyle(dataCell).paddingInlineStart).to.not.equal('0px');
      expect(getComputedStyle(dataCell).paddingInlineStart).to.equal(
        getComputedStyle(headerCell).paddingInlineStart
      );
      expect(getComputedStyle(dataCell).borderInlineEndStyle).to.equal('solid');
    } finally {
      restore();
    }
  });

  it('renders tabs for multiple sheets', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
      );
      const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> })
        .updateComplete;
      expect(
        tabs.shadowRoot!.querySelectorAll('[part="tab"]')
      ).to.have.lengthOf(2);
    } finally {
      restore();
    }
  });

  it('does not leak internal virtual-list or real tab lifecycle events through the viewer host', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({ Sheet1: [['Name'], ['Ada']], Sheet2: [['Name'], ['Grace']] })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
      );
      let leaked = 0;
      for (const name of ['lr-load-more', 'lr-virtual-scroll']) {
        el.addEventListener(name as never, () => {
          leaked++;
        });
        el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
          new CustomEvent(name, { bubbles: true, composed: true })
        );
      }
      for (const name of ['lr-tab-hide', 'lr-tab-show']) {
        el.addEventListener(name as never, () => {
          leaked++;
        });
      }
      const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> })
        .updateComplete;
      tabs
        .shadowRoot!.querySelectorAll<HTMLElement>('[part="tab"]')[1]!
        .click();
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> })
        .updateComplete;
      expect(leaked).to.equal(0);
    } finally {
      restore();
    }
  });

  it('does not leak the internal virtual-list events through the viewer host under the canonical lr-visible-range-change name', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({ Sheet1: [['Name'], ['Ada']], Sheet2: [['Name'], ['Grace']] })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
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

  it('is accessible', async () => {
    const el = await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    );
    await expect(el).to.be.accessible();
  });
  it('is accessible once a workbook has loaded', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({ Sheet1: [['Name'], ['Ada']], Sheet2: [['Name'], ['Grace']] })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
      );
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(
      html`<lr-spreadsheet-viewer
        name="quarterly.xlsx"
      ></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      named
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.equal('quarterly.xlsx');
    const unnamed = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      unnamed
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.equal('Spreadsheet');
  });
  it('leaves a non-empty host aria-label on the host instead of duplicating the shadow region', async () => {
    // Regression test: render() previously checked `this.name || this.getAttribute('aria-label')`,
    // so a consumer-supplied host aria-label could never override an also-set `name` -- unlike every
    // sibling viewer (notebook-viewer, xml-viewer, pdf-viewer), which check the host attribute first.
    const overridden = (await fixture(
      html`<lr-spreadsheet-viewer
        name="quarterly.xlsx"
        aria-label="Q3 Financial Report"
      ></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      overridden
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.be.null;
    expect(
      overridden
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('role')
    ).to.be.null;

    const labeled = (await fixture(
      html`<lr-spreadsheet-viewer
        aria-label="Q3 Financial Report"
      ></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      labeled
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.be.null;
    expect(
      labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
    ).to.be.null;
  });
  it('preserves an explicitly empty host aria-label on the region owner', async () => {
    const el = await fixture<LyraSpreadsheetViewer>(
      html`<lr-spreadsheet-viewer
        name="quarterly.xlsx"
        aria-label=""
      ></lr-spreadsheet-viewer>`
    );
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('region');
    expect(base.hasAttribute('aria-label')).to.be.true;
    expect(base.getAttribute('aria-label')).to.equal('');
  });
  it('supports a .strings override for the spreadsheetViewerLabel fallback', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer
        .strings=${{ spreadsheetViewerLabel: 'Tableur' }}
      ></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
    ).to.equal('Tableur');
  });

  it('shows a localized url-not-allowed error and emits exactly one render error', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
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
    expect(count).to.equal(1);
  });

  it('surfaces a load error and emits lr-render-error when the fetch response is not ok', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as Response)) as typeof window.fetch;
    try {
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/missing.xlsx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal('Failed to load document.');
    } finally {
      window.fetch = original;
    }
  });

  it('loads without an abort signal when AbortController is unavailable', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController =
      undefined;
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="header-row"]')!.textContent
      ).to.equal('NameRole');
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it('shows the localized spreadsheet-unavailable error when the optional xlsx peer fails to load', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => Promise.resolve(null);
    const restore = fetchBuffer(buffer(GRID_WORKBOOK));
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/book.xlsx';
      await event;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal('Spreadsheet preview is unavailable.');
    } finally {
      restore();
    }
  });

  it('paints a visible busy treatment while pending and clears it on failure', async () => {
    const original = window.fetch;
    const responseGate = deferred<Response>();
    window.fetch = (() => responseGate.promise) as typeof window.fetch;
    try {
      const el = await fixture<LyraSpreadsheetViewer>(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      );
      (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
        async () => XLSX;
      el.src = 'https://example.test/pending.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="spinner"]') !== null
      );
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>(
        '.viewer-loading-label'
      )!;
      expect(base.getAttribute('aria-busy')).to.equal('true');
      expect(label.textContent).to.equal('Loading document…');
      expect(label.getBoundingClientRect().height).to.be.greaterThan(0);
      responseGate.reject(new Error('offline'));
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      expect(base.getAttribute('aria-busy')).to.equal('false');
      expect(
        el.shadowRoot!.querySelector('[part="spinner"]') === null
      ).to.equal(true);
    } finally {
      window.fetch = original;
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    const value = buffer(GRID_WORKBOOK);
    window.fetch = (() => {
      calls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(value),
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer
          src="https://example.test/book.xlsx"
        ></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      await waitUntil(
        () =>
          calls === 1 &&
          el.shadowRoot!.querySelector('[part="header-row"]') !== null
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

  it('shows idle/loading, not the stale grid, during the reload window after reconnecting', async () => {
    const original = window.fetch;
    const value = buffer(GRID_WORKBOOK);
    let calls = 0;
    const gate = deferred<Response>();
    window.fetch = ((): Promise<Response> => {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(value),
        } as Response);
      }
      return gate.promise;
    }) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer
          src="https://example.test/book.xlsx"
        ></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      await waitUntil(
        () =>
          calls === 1 &&
          el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );

      const parent = el.parentElement!;
      el.remove();
      await aTimeout(0);
      expect(
        (el as unknown as { fetchState: { kind: string } }).fetchState.kind
      ).to.equal('idle');
      parent.append(el);
      await el.updateComplete;

      // Before the reconnect-triggered second fetch resolves, the previously-loaded sheet grid
      // must not still be rendered as if it were live/current data.
      expect(el.shadowRoot!.querySelector('[part="header-row"]') === null).to.be
        .true;
      const emptyOrLoading =
        el.shadowRoot!.querySelector('.empty-note') !== null ||
        el.shadowRoot!.querySelector('[part="spinner"]') !== null;
      expect(emptyOrLoading, 'renders idle or loading, not the stale grid').to
        .be.true;

      gate.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(value),
      } as Response);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
    } finally {
      window.fetch = original;
    }
  });

  it('keeps the workbook and search across a same-task DOM move', async () => {
    const original = window.fetch;
    let calls = 0;
    const value = buffer(GRID_WORKBOOK);
    window.fetch = (() => {
      calls++;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', arrayBuffer: () => Promise.resolve(value) } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraSpreadsheetViewer>(
        html`<lr-spreadsheet-viewer src="https://example.test/book.xlsx"></lr-spreadsheet-viewer>`
      );
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      expect(await el.search('ada')).to.equal(2);
      const parent = el.parentElement!;
      parent.append(document.createElement('span'), el);
      await twoFrames();
      expect(calls).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="header-row"]') !== null).to.be.true;
      el.remove();
      await aTimeout(0);
      const reran = oneEvent(el, 'lr-search-change');
      parent.append(el);
      expect((await reran).detail).to.include({ query: 'ada', matchCount: 2 });
      expect(calls).to.equal(2);
    } finally {
      window.fetch = original;
    }
  });

  it('accepts twelve individually bounded 1,000-row sheets', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const sheetNames = Array.from(
      { length: 12 },
      (_unused, index) => `Month ${index + 1}`
    );
    const rows = Array.from({ length: 1_000 }, (_unused, index) => [index]);
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () =>
        Promise.resolve({
          read: () => ({
            SheetNames: sheetNames,
            Sheets: Object.fromEntries(sheetNames.map((name) => [name, {}])),
          }),
          utils: { sheet_to_json: () => rows },
        });
    const restore = fetchBuffer(
      new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer
    );
    try {
      el.src = 'https://example.test/book.xls';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
      );
      expect(el.shadowRoot!.querySelectorAll('lr-tab')).to.have.lengthOf(12);
      expect(el.shadowRoot!.querySelectorAll('[part="sheet"]')).to.have.lengthOf(1);
      expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(
        true
      );
    } finally {
      restore();
    }
  });

  it('rejects excessive sheet and expanded-cell counts before eagerly rendering workbook tabs', async () => {
    const run = async (sheetNames: string[], ref: string): Promise<void> => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
        () =>
          Promise.resolve({
            read: () => ({
              SheetNames: sheetNames,
              Sheets: Object.fromEntries(sheetNames.map((name) => [name, { '!ref': ref }])),
            }),
            utils: { sheet_to_json: () => [] },
          });
      const restore = fetchBuffer(
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer
      );
      try {
        const event = oneEvent(el, 'lr-render-error');
        el.src = 'https://example.test/book.xls';
        await event;
        expect(
          el.shadowRoot!.querySelector('[part="error"]')!.textContent
        ).to.equal('This document is too large to preview.');
        expect(el.shadowRoot!.querySelector('lr-tab-group') === null).to.be
          .true;
      } finally {
        restore();
      }
    };

    await run(
      Array.from({ length: 257 }, (_unused, index) => `Sheet ${index}`),
      'A1'
    );
    await run(['One'], 'A1:ALL1001');
    await run(['One'], 'A1:ALM1');
    await run(['One'], 'A1:A10001');
  });

  it('surfaces the standard load-failure state when the xlsx peer returns a SheetNames array with non-string entries', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    // `workbook.SheetNames` is trusted third-party-peer output parsed from consumer-supplied,
    // untrusted `src` content -- a malformed/hostile file (or a buggy peer version) could hand
    // back a real, iterable array whose entries still aren't strings (unlike an outright
    // non-array value, this shape iterates fine and would otherwise reach `workbook.Sheets[name]`
    // and the rendered sheet tabs unvalidated), same threat model every other viewer here
    // validates parsed-library output against.
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () =>
        Promise.resolve({
          read: () => ({
            SheetNames: [{ toString: (): string => 'evil' }, 'Real Sheet'],
            Sheets: { 'Real Sheet': {} },
          }),
          utils: { sheet_to_json: () => [] },
        });
    const restore = fetchBuffer(
      new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer
    );
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/book.xlsx';
      await event;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal('Failed to load document.');
    } finally {
      restore();
    }
  });

  it('a src change while awaiting the sheetjs library import supersedes the earlier load (stale generation)', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const lib = deferred<unknown>();
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => lib.promise;
    const firstRestore = fetchBuffer(buffer({ Sheet1: [['First'], ['A']] }));
    try {
      el.src = 'https://example.test/first.xlsx';
      await twoFrames(); // let load() reach `await this.loadLibrary()` and suspend there
      firstRestore();
      const secondRestore = fetchBuffer(
        buffer({ Sheet1: [['Second'], ['B']] })
      );
      try {
        el.src = 'https://example.test/second.xlsx'; // bumps generation, superseding the first load
        await twoFrames(); // let the second load also reach and suspend on the same shared import
        lib.resolve(XLSX); // release both suspended loads together
        // The stale first load's library import now resolves late; it must bail silently instead of
        // clobbering the second (current) document.
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
        expect(
          el.shadowRoot!.querySelector('[part="header-row"]')!.textContent
        ).to.equal('Second');
      } finally {
        secondRestore();
      }
    } finally {
      // firstRestore was already invoked above once load() had moved past the fetch step.
    }
  });

  it('switches sheets when a tab is clicked directly (not just via scrollToAnchor/search)', async () => {
    const el = (await fixture(
      html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    )) as LyraSpreadsheetViewer;
    const restore = fetchBuffer(
      buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] })
    );
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-tab-group') !== null
      );
      const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
      await (tabs as HTMLElement & { updateComplete: Promise<boolean> })
        .updateComplete;
      const tabButtons = tabs.shadowRoot!.querySelectorAll('[part="tab"]');
      expect(tabButtons).to.have.lengthOf(2);
      (tabButtons[1] as HTMLElement).click();
      await el.updateComplete;
      expect(
        (el as unknown as { activeSheetIndex: number }).activeSheetIndex
      ).to.equal(1);
    } finally {
      restore();
    }
  });

  it('does not carry the active row onto another sheet when a tab is clicked', async () => {
    const rows = (label: string): unknown[][] =>
      [['Name'], ...Array.from({ length: 60 }, (_unused, index) => [`${label} ${index}`])];
    const el = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
    const restore = fetchBuffer(buffer({ Q1: rows('first'), Q2: rows('second') }));
    try {
      el.src = 'https://example.test/book.xlsx';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-tab-group') !== null);
      expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A40' })).to.be.true;
      const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
      (tabs.shadowRoot!.querySelectorAll('[part="tab"]')[1] as HTMLElement).click();
      await el.updateComplete;
      const list = el.shadowRoot!.querySelector('lr-virtual-list[data-sheet-index="1"]') as HTMLElement & {
        activeItemId: unknown;
      };
      expect(list.activeItemId).to.equal('');
    } finally {
      restore();
    }
  });

  describe('cell-range anchor-target', () => {
    it('scrolls to a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        // Row 2 (raw, 1-based, header at row 1) is the first data row ("Ada,Mathematician").
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to
          .be.true;
      } finally {
        restore();
      }
    });

    it('resolves a header-row anchor and paints only the first occurrence of a duplicate highlight id', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
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
        const highlighted = el.shadowRoot!.querySelector(
          '[part~="cell-highlight"]'
        ) as HTMLElement;
        expect(
          el.shadowRoot!.querySelectorAll('[part~="cell-highlight"]')
        ).to.have.lengthOf(1);
        expect(getComputedStyle(highlighted).outlineStyle).to.equal('solid');
      } finally {
        restore();
      }
    });

    it('paints at most the bounded highlight candidates, always keeping the active one', async () => {
      const el = await fixture<LyraSpreadsheetViewer>(html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { updateComplete: Promise<unknown> };
        await waitUntil(() => list.shadowRoot!.querySelector('[part="data-row"]') !== null);
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

    it('reports a failed jump when a concurrent src reassignment lands during the scroll wait', async () => {
      // Byte-for-byte the guard <lr-csv-viewer>/<lr-dataset-viewer> already carry: this viewer used
      // to `return true` unconditionally, so a document replaced mid-jump still fired
      // `lr-anchor-result: { found: true }` for a coordinate nothing had scrolled to.
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
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
              el.src = 'https://example.test/other.xlsx';
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

    it('resolves false for an anchor targeting a sheet that does not exist', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(
          await el.scrollToAnchor({
            kind: 'cell-range',
            sheet: 'NoSuchSheet',
            range: 'A1',
          })
        ).to.be.false;
      } finally {
        restore();
      }
    });

    it('keeps loaded rows and later updates working when a highlight omits its anchor', async () => {
      const el = await fixture<LyraSpreadsheetViewer>(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      );
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );

        el.highlights = [
          { id: 'missing-anchor' },
        ] as unknown as LyraSpreadsheetViewer['highlights'];
        await el.updateComplete;
        el.name = 'Updated workbook';
        await el.updateComplete;

        expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal(
          []
        );
        expect(
          el.shadowRoot!.querySelectorAll('lr-virtual-list').length
        ).to.equal(1);
        expect(
          el
            .shadowRoot!.querySelector('[part="base"]')!
            .getAttribute('aria-label')
        ).to.equal('Updated workbook');
      } finally {
        restore();
      }
    });

    it('keeps the highlighted cell structural and emits from a nested native action', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First result',
          },
        ];
        await el.updateComplete;
        await assertHighlightedCellActivation(el, { id: 'h1', name: 'Highlight: Ada — First result' });
      } finally {
        restore();
      }
    });

    it('localizes the complete highlighted-cell name with independently ordered value and label placeholders', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      el.strings = {
        cellHighlightWithLabel: '{label} ⇐ {value}',
      };
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
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

    it('places keyboard focus on the nested native highlight action', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First result',
          },
        ];
        await el.updateComplete;
        const { action, root } = highlightedCellAction(el);
        action.focus();
        expect(root.activeElement === action).to.be.true;
      } finally {
        restore();
      }
    });

    it('ignores a keydown for a key other than Enter/Space, leaving the highlight inert', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        el.highlights = [
          {
            id: 'h1',
            anchor: { kind: 'cell-range', range: 'A2' },
            label: 'First result',
          },
        ];
        await el.updateComplete;
        const { action: highlighted } = highlightedCellAction(el);
        let activated = false;
        el.addEventListener('lr-highlight-activate', () => {
          activated = true;
        });
        highlighted.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'a',
            bubbles: true,
            cancelable: true,
          })
        );
        await twoFrames();
        expect(activated).to.be.false;
      } finally {
        restore();
      }
    });

    it('resolves true when a cell-range anchor targets the header row itself', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A1' })).to
          .be.true;
      } finally {
        restore();
      }
    });

    it('resolves false when scrollToAnchor is called before any document has loaded', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A2' })).to.be
        .false;
    });

    it('resolves false for a malformed cell-range anchor', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(
          await el.scrollToAnchor({ kind: 'cell-range', range: 'not-a-range' })
        ).to.be.false;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A0' })).to
          .be.false;
        expect(
          await el.scrollToAnchor({
            kind: 'cell-range',
            range: 'A9007199254740992',
          })
        ).to.be.false;
        expect(
          await el.scrollToAnchor({
            kind: 'cell-range',
            range: `${'Z'.repeat(32)}1`,
          })
        ).to.be.false;

        el.highlights = [
          { id: 'invalid', anchor: { kind: 'cell-range', range: 'A0' } },
        ];
        await el.updateComplete;
        expect(
          el.shadowRoot!.querySelectorAll('[part~="cell-highlight"]').length
        ).to.equal(0);
      } finally {
        restore();
      }
    });

    it('resolves false for a row beyond the addressed sheet', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' }))
          .to.be.false;
      } finally {
        restore();
      }
    });

    it("truthfully rejects a cell-range anchor beyond the sheet's rendered width", async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      shrinkAnchorRetry(el);
      const restore = fetchBuffer(buffer(GRID_WORKBOOK)); // only 2 rendered columns (Name, Role)
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to
          .be.false;
      } finally {
        restore();
      }
    });

    it('cancels a stale scroll frame in its source realm and uses the current realm after iframe adoption', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const scrollColumnIntoView = (): Promise<void> =>
        (
          el as unknown as {
            scrollColumnIntoView: (
              sheetIndex: number,
              col: number
            ) => Promise<void>;
          }
        ).scrollColumnIntoView(0, 1);

      await assertScrollFrameFollowsAdoption(el, scrollColumnIntoView);
    });

    it('jumpToCell resolves false when no document is loaded yet', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const result = await (
        el as unknown as {
          jumpToCell: (
            sheetIndex: number,
            rawRow: number,
            col: number
          ) => Promise<boolean>;
        }
      ).jumpToCell(0, 2, 0);
      expect(result).to.be.false;
    });

    it('jumpToCell resolves false for a sheet index outside the loaded workbook', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        const result = await (
          el as unknown as {
            jumpToCell: (
              sheetIndex: number,
              rawRow: number,
              col: number
            ) => Promise<boolean>;
          }
        ).jumpToCell(5, 2, 0);
        expect(result).to.be.false;
      } finally {
        restore();
      }
    });
  });

  describe('cross-sheet scrollToAnchor', () => {
    it('switches the active tab to resolve a sheet-qualified anchor', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(
        buffer({
          Sheet1: [['X'], [1], [2]],
          Sheet2: [['Name'], ['Ada'], ['Grace']],
        })
      );
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-tab-group') !== null
        );
        const result = await el.scrollToAnchor({
          kind: 'cell-range',
          sheet: 'Sheet2',
          range: 'A2',
        });
        expect(result).to.be.true;
        expect(
          (el as unknown as { activeSheetIndex: number }).activeSheetIndex
        ).to.equal(1);
      } finally {
        restore();
      }
    });

    it('targets the requested sheet header instead of the first workbook header', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(
        buffer({ Sheet1: [['First'], [1]], Sheet2: [['Second'], [2]] })
      );
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
        const scrolled: (string | undefined)[] = [];
        const original = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function (this: HTMLElement): void {
          scrolled.push(this.closest<HTMLElement>('[part="sheet"]')?.dataset['sheetIndex']);
        };
        try {
          expect(
            await el.scrollToAnchor({
              kind: 'cell-range',
              sheet: 'Sheet2',
              range: 'A1',
            })
          ).to.be.true;
        } finally {
          HTMLElement.prototype.scrollIntoView = original;
        }
        expect(scrolled).to.deep.equal(['1']);
      } finally {
        restore();
      }
    });
  });

  describe('search', () => {
    it('finds matches ordered row -> column', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener(
          'lr-search-change',
          (e) => (detail = (e as CustomEvent).detail)
        );
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(1);
        expect(await el.searchNext()).to.be.true;
        expect(detail!.activeIndex).to.equal(0); // wraps
      } finally {
        restore();
      }
    });

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const loadedSheet = (rows: unknown[][]) => ({ name: 'One', rows, body: rows.slice(1), columns: 1 });
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        sheets: [loadedSheet(Array.from({ length: 1_001 }, () => ['hit']))],
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
        sheets: [loadedSheet(Array.from({ length: 1_000 }, () => ['hit']))],
      };
      expect(await el.search('hit')).to.equal(1_000);
      expect(cappedDetail).to.deep.include({
        matchCount: 1_000,
        matchCountExact: true,
      });
    });

    it('case-folds with the effective locale and navigates a header match', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer lang="tr"></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(
        buffer({ Sheet1: [['İSTANBUL'], ['Ankara']] })
      );
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
        expect(await el.search('istanbul')).to.equal(1);
      } finally {
        restore();
      }
    });

    it('recomputes an active search when the host language changes', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer lang="en"></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(
        buffer({ Sheet1: [['City'], ['İSTANBUL'], ['istanbul']] })
      );
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
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

    it('scans every sheet, switching tabs when a match lives on a different one', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(
        buffer({
          Sheet1: [['X'], ['nothing']],
          Sheet2: [['Name'], ['Ada'], ['Grace']],
        })
      );
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-tab-group') !== null
        );
        const count = await el.search('ada');
        expect(count).to.equal(1);
        expect(
          (el as unknown as { activeSheetIndex: number }).activeSheetIndex
        ).to.equal(1);
      } finally {
        restore();
      }
    });

    it('resolves 0 and leaves no active match for a query with no hits', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        const count = await el.search('zzz-not-present');
        expect(count).to.equal(0);
        expect(await el.searchNext()).to.be.false;
      } finally {
        restore();
      }
    });

    it('searchNext and searchPrevious resolve false when there is no active search', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      expect(await el.searchNext()).to.be.false;
      expect(await el.searchPrevious()).to.be.false;
    });

    it('searchPrevious wraps to the last match, mirroring searchNext in reverse', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        const count = await el.search('ada');
        expect(count).to.equal(2); // "Ada" appears in two data rows, column 0
        let detail: { matchCount: number; activeIndex: number } | undefined;
        el.addEventListener(
          'lr-search-change',
          (e) => (detail = (e as CustomEvent).detail)
        );
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(1); // wraps backward from 0 to the last match
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(0);
      } finally {
        restore();
      }
    });

    it('clearSearch resets matchCount/activeIndex to 0/-1', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        await el.search('ada');
        const listener = oneEvent(el, 'lr-search-change');
        el.clearSearch();
        const event = (await listener) as CustomEvent<{
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
  });

  describeCellHighlightStyling({
    tag: 'lr-spreadsheet-viewer',
    src: 'https://example.test/book.xlsx',
    install: () => fetchBuffer(buffer(GRID_WORKBOOK)),
    outlineOffsetHook: true,
    cellCursor: false,
  });

  describe('back-compat', () => {
    it('rendering is unchanged with highlights empty and no search active', async () => {
      const el = (await fixture(
        html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
      )) as LyraSpreadsheetViewer;
      const restore = fetchBuffer(buffer(GRID_WORKBOOK));
      try {
        el.src = 'https://example.test/book.xlsx';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
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
  const el = await fixture<LyraSpreadsheetViewer>(
    html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
  );
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(
    base.style.getPropertyValue('--lr-spreadsheet-viewer-max-height')
  ).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(
    base.style.getPropertyValue('--lr-spreadsheet-viewer-max-height')
  ).to.equal('calc(10rem + 2px)');
});

// -- Document-renderer registry entry ---------------------------------------

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

it('registers the same renderer under both spreadsheet MIME types', async () => {
  const { getDefaultDocumentRendererRegistry } = await import(
    '../document-viewer/registry.js'
  );
  const registry = getDefaultDocumentRendererRegistry();
  const xlsx = registry.get(XLSX_MIME);
  const xls = registry.get('application/vnd.ms-excel');
  expect(xlsx, 'importing spreadsheet-viewer.js registers the renderer').to
    .exist;
  expect(xls, 'both MIME types share one definition').to.equal(xlsx);

  expect(
    xlsx!.matches!({
      name: 'Budget.XLSX',
      mimeType: XLSX_MIME,
      src: 'https://example.test/a.xlsx',
    })
  ).to.be.true;
  expect(
    xlsx!.matches!({
      name: 'legacy.xls',
      mimeType: 'application/vnd.ms-excel',
      src: 'https://example.test/a.xls',
    })
  ).to.be.true;
  expect(
    xlsx!.matches!({
      name: 'notes.csv',
      mimeType: 'text/csv',
      src: 'https://example.test/a.csv',
    })
  ).to.be.false;
  expect(xlsx!.capabilities).to.deep.equal({
    anchors: ['cell-range'],
    search: true,
    textSelect: false,
  });

  const host = (await fixture(
    html`<div>
      ${xlsx!.render!({
        name: 'a.xlsx',
        mimeType: XLSX_MIME,
        src: 'https://example.test/a.xlsx',
      })}
    </div>`
  )) as HTMLElement;
  const viewer = host.querySelector(
    'lr-spreadsheet-viewer'
  ) as LyraSpreadsheetViewer;
  expect(viewer).to.exist;
  expect(viewer.name).to.equal('a.xlsx');
  expect(viewer.anchor).to.be.null;
  expect(viewer.highlights).to.deep.equal([]);
});

it('keeps a stable items reference and keyFunction on the composed lr-virtual-list across an unrelated re-render', async () => {
  const el = (await fixture(
    html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
  )) as LyraSpreadsheetViewer;
  const restore = fetchBuffer(
    buffer({
      Sheet1: [
        ['Name', 'Qty'],
        ['Widget', 12],
        ['Gadget', 5],
      ],
    })
  );
  try {
    el.src = 'https://example.test/book.xlsx';
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
    // though the sheet's row data never changed.
    el.maxHeight = '400px';
    await el.updateComplete;

    expect(virtual.items, 'items reference').to.equal(items);
    expect(virtual.keyFunction, 'keyFunction reference').to.equal(keyFunction);
  } finally {
    restore();
  }
});

it("contains the composed lr-tab-group's lr-activate on a real repeat pick of the active sheet tab", async () => {
  const el = (await fixture(
    html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
  )) as LyraSpreadsheetViewer;
  const restore = fetchBuffer(
    buffer({ Inventory: [['Name'], ['Widget']], Summary: [['Total'], [12]] })
  );
  try {
    el.src = 'https://example.test/book.xlsx';
    await waitUntil(() => el.shadowRoot!.querySelector('lr-tab-group') !== null);
    const tabs = el.shadowRoot!.querySelector('lr-tab-group')!;
    await (tabs as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    const activeTab = tabs.shadowRoot!.querySelector<HTMLElement>(
      '[part="tab"][aria-selected="true"]'
    );
    expect(activeTab?.getAttribute('data-slot')).to.equal('sheet-0');
    let escaped = 0;
    const listener = (): void => {
      escaped++;
    };
    document.addEventListener('lr-activate', listener);
    try {
      activeTab!.click();
      await el.updateComplete;
    } finally {
      document.removeEventListener('lr-activate', listener);
    }
    expect(
      escaped,
      "this viewer owns its own event surface; the child's raw event never escapes"
    ).to.equal(0);
  } finally {
    restore();
  }
});
