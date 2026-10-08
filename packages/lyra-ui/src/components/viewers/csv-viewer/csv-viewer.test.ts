import { twoFrames } from '../../../../test/frames.js';
import { assertHighlightedCellActivation, describeCellHighlightStyling, highlightedCellAction } from '../../../../test/contracts/viewer-cell-highlight.js';
import { assertScrollFrameFollowsAdoption, shrinkAnchorRetry } from '../../../../test/viewer-scroll-test-support.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import {
  aTimeout,
  expect,
  fixture,
  html,
  oneEvent,
  waitUntil,
} from '@open-wc/testing';
import './csv-viewer.js';
import '../../../translations/fr/viewers.js';
import type { LyraCsvViewer } from './csv-viewer.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';

// These fixtures deliberately verify that retired attributes remain inert.
expectStaleAttribute('lr-csv-viewer', 'has-header-row');

const CSV =
  'Name,Role\nAda Lovelace,Mathematician\nGrace Hopper,Computer scientist';
const GRID_CSV =
  'Name,Role\nAda,Mathematician\nGrace,Scientist\nAda,Programmer';
function fetchText(value: string): () => void {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(value),
    } as Response)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}
expectLocaleFallback('ar', ['noData']);
expectLocaleFallback('tr', ['csvViewerLabel', 'documentPreviewEmpty', 'documentPreviewTypeDocument', 'loadingDocument']);

describe('lr-csv-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    expect(el.withoutHeaderRow).to.be.false;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal(
      'No document to display.'
    );
  });
  it('parses quoted CSV and virtualizes body rows', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(
      'Name,Notes\nAda,"Wrote notes on the ""Engine"", 1843"'
    );
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
      expect(
        (
          el.shadowRoot!.querySelector('lr-virtual-list') as unknown as HTMLElement & {
            items: unknown[][];
          }
        ).items[0]
      ).to.deep.equal(['Ada', 'Wrote notes on the "Engine", 1843']);
    } finally {
      restore();
    }
  });
  it('keeps the header fixed above the actual virtualized row scrollport when capped', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer max-height="96px"></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText([
      'Name,Role',
      ...Array.from({ length: 100 }, (_unused, index) => `Person ${index},Role ${index}`),
    ].join('\n'));
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
      );
      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      const header = el.shadowRoot!.querySelector(
        '[part="header-row"]'
      ) as HTMLElement;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const scrollport = list.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      await waitUntil(() => scrollport.scrollHeight > scrollport.clientHeight);
      expect(body.scrollHeight).to.be.at.most(body.clientHeight + 1);
      const initialTop = header.getBoundingClientRect().top;
      scrollport.scrollTop = 64;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(scrollport.scrollTop).to.be.greaterThan(0);
      expect(Math.abs(header.getBoundingClientRect().top - initialTop))
        .to.be.at.most(1);
    } finally {
      restore();
    }
  });
  /**
   * Regression: a fresh `body` array and `renderItem`/`keyFunction` closures on every render()
   * defeated `<lr-virtual-list>`'s own offset-cache memoization on every unrelated re-render (a
   * search keystroke, active-row change, locale change), not just on data changes -- forcing its
   * O(n) recomputeOffsets() and clearing measured row heights.
   */
  it('keeps items and keyFunction referentially stable across an unrelated re-render', async () => {
    const el = (await fixture(html`<lr-csv-viewer></lr-csv-viewer>`)) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/stable.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as HTMLElement & {
        renderItem: unknown;
        keyFunction: unknown;
      };
      // renderItem/keyFunction are plain property assignments <lr-virtual-list> stores verbatim
      // (unlike items, which it normalizes on every write -- an internal detail of that owned-
      // elsewhere component, not what this fix controls), so reading them back through the DOM
      // directly proves csv-viewer passed a stable reference.
      const { renderItem, keyFunction } = list;
      const cachedBody = (
        el as unknown as { virtualListInputsCache?: { body: unknown[][] } }
      ).virtualListInputsCache?.body;
      expect(cachedBody, 'sanity: the memoized body must exist once loaded').to.not.equal(
        undefined
      );

      // locale is unrelated to the parsed CSV data.
      el.locale = 'fr-FR';
      await el.updateComplete;

      expect(
        (el as unknown as { virtualListInputsCache?: { body: unknown[][] } })
          .virtualListInputsCache?.body,
        'the memoized body must stay the same array across an unrelated re-render'
      ).to.equal(cachedBody);
      // `renderItem` is fresh per render on purpose (a highlight or search-state change must
      // repaint the visible rows); only the items array and the key function stay stable.
      expect(typeof list.renderItem).to.equal('function');
      expect(typeof renderItem).to.equal('function');
      expect(list.keyFunction).to.equal(keyFunction);
    } finally {
      restore();
    }
  });

  it('preserves auto-detected delimiters and quoted newlines through the bounded parser path', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(
      'Name;Notes\r\nAda;"first; clause\r\nsecond clause"\r\nGrace;plain'
    );
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const list = el.shadowRoot!.querySelector(
        'lr-virtual-list'
      ) as unknown as HTMLElement & { items: unknown[][] };
      expect(list.items).to.deep.equal([
        ['Ada', 'first; clause\r\nsecond clause'],
        ['Grace', 'plain'],
      ]);
    } finally {
      restore();
    }
  });
  it('emits bounded parser diagnostics while retaining a recoverable partial grid', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const diagnostics: Array<{ code: string; source: string; fatal: boolean; cause: unknown }> = [];
    const renderErrors: unknown[] = [];
    el.addEventListener('lr-viewer-diagnostic', (event) => diagnostics.push(event.detail.diagnostic));
    el.addEventListener('lr-render-error', (event) => renderErrors.push(event.detail.error));
    const restore = fetchText('Name,Role\nAda,Math\n"Grace,Science');
    try {
      el.src = 'https://example.test/recoverable.csv';
      await waitUntil(() => diagnostics.length === 1);
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      const codes = (diagnostics[0]!.cause as Array<{ code?: string }>).map(
        (error) => error.code
      );
      expect(codes).to.include('MissingQuotes');
      expect(diagnostics[0]!.code).to.equal('delimited-parse-diagnostic');
      expect(diagnostics[0]!.source).to.equal('papaparse');
      expect(diagnostics[0]!.fatal).to.equal(false);
      expect(renderErrors).to.deep.equal([]);
      expect(
        el.shadowRoot!.querySelectorAll('[part="error"]')
      ).to.have.lengthOf(0);
      expect(
        el.shadowRoot!.querySelectorAll('lr-virtual-list')
      ).to.have.lengthOf(1);
    } finally {
      restore();
    }
  });
  it('loads a single-column grid without a parser diagnostic or render error', async () => {
    const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
    const events: string[] = [];
    el.addEventListener('lr-viewer-diagnostic', () => events.push('diagnostic'));
    el.addEventListener('lr-render-error', () => events.push('error'));
    const restore = fetchText('Name\nAda\nGrace');
    try {
      el.src = 'https://example.test/names.csv';
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      expect(events).to.deep.equal([]);
    } finally {
      restore();
    }
  });
  it('rejects a compact million-row resource before PapaParse is invoked', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    let parseCalls = 0;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () =>
        Promise.resolve({
          parse() {
            parseCalls++;
            return { data: [], errors: [], meta: {} };
          },
        });
    const restore = fetchText('x\n'.repeat(1_000_000));
    try {
      const errorEvent = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/compact-million.csv';
      const event = (await errorEvent) as CustomEvent<{ error: unknown }>;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      expect(event.detail.error instanceof LyraResourceLimitError).to.be.true;
      expect(parseCalls).to.equal(0);
      expect(
        el.shadowRoot!.querySelectorAll('lr-virtual-list')
      ).to.have.lengthOf(0);
    } finally {
      restore();
    }
  });
  it('keeps a fetched empty document in neutral no-data state', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText('');
    try {
      el.src = 'https://example.test/empty.csv';
      await waitUntil(
        () =>
          el.shadowRoot!.querySelector('.empty-note')?.textContent === 'No data'
      );
      expect(
        el.shadowRoot!.querySelectorAll('[part="error"]')
      ).to.have.lengthOf(0);
    } finally {
      restore();
    }
  });
  it('renders data rows as a grid, matching the header row, not as unstyled stacked text', async () => {
    // Regression test: renderRow()/renderCell()'s output for data rows is rendered inside
    // <lr-virtual-list>'s own shadow root via its renderItem callback, a different shadow tree
    // than csv-viewer.styles.ts's stylesheet is scoped to -- a plain [part='data-row']/[part='cell']
    // CSS selector there can never reach it, only the header row (rendered directly by csv-viewer).
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
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

  it('loads a src that changed while detached once it is reconnected', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const parent = el.parentElement!;
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => {
      calls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(CSV),
      } as Response);
    }) as typeof window.fetch;
    try {
      el.remove();
      await aTimeout(0);
      el.src = 'https://example.test/detached.csv';
      await aTimeout(0);
      parent.append(el);
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="header-row"]') !== null,
        'src set while detached was never loaded after reconnect'
      );
      expect(calls).to.equal(1);
    } finally {
      window.fetch = original;
    }
  });
  it('keeps the loaded data across a same-task DOM move', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => {
      calls++;
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve('Name,Role\nAda,One') } as Response);
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer src="https://example.test/people.csv"></lr-csv-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);
      el.parentElement!.append(document.createElement('span'), el);
      await twoFrames();
      expect(calls).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="header-row"]') !== null).to.be.true;
    } finally {
      window.fetch = original;
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => {
      calls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(CSV),
      } as Response);
    }) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-csv-viewer
          src="https://example.test/people.csv"
        ></lr-csv-viewer>`
      )) as LyraCsvViewer;
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
  it('treats every row as data with without-header-row', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer without-header-row></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
      );
      expect(el.shadowRoot!.querySelector('[part="header-row"]') == null).to.be
        .true;
      expect(
        (
          el.shadowRoot!.querySelector('lr-virtual-list') as unknown as HTMLElement & {
            items: unknown[][];
          }
        ).items
      ).to.have.lengthOf(3);
    } finally {
      restore();
    }
  });
  describe('retired has-header-row alias', () => {
    async function renderedRows(el: LyraCsvViewer): Promise<{ header: boolean; body: number }> {
      const restore = fetchText(CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        const list = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as HTMLElement & {
          items: unknown[][];
        };
        return {
          header: el.shadowRoot!.querySelector('[part="header-row"]') !== null,
          body: list.items.length,
        };
      } finally {
        restore();
      }
    }

    it('ignores the retired attribute and property while the canonical option controls row selection', async () => {
      const alias = (await fixture(
        html`<lr-csv-viewer has-header-row="false"></lr-csv-viewer>`,
      )) as LyraCsvViewer;
      expect(await renderedRows(alias)).to.deep.equal({ header: true, body: 2 });
      Reflect.set(alias, 'hasHeaderRow', false);
      await alias.updateComplete;
      expect(await renderedRows(alias)).to.deep.equal({ header: true, body: 2 });

      const canonical = (await fixture(
        html`<lr-csv-viewer without-header-row></lr-csv-viewer>`,
      )) as LyraCsvViewer;
      expect(await renderedRows(canonical)).to.deep.equal({ header: false, body: 3 });
      alias.withoutHeaderRow = true;
      await alias.updateComplete;
      expect(await renderedRows(alias)).to.deep.equal({ header: false, body: 3 });
      canonical.setAttribute('has-header-row', 'true');
      Reflect.set(canonical, 'hasHeaderRow', true);
      await canonical.updateComplete;
      expect(await renderedRows(canonical)).to.deep.equal({ header: false, body: 3 });
    });
  });
  it('is accessible', async () => {
    const el = await fixture(html`<lr-csv-viewer></lr-csv-viewer>`);
    await expect(el).to.be.accessible();
  });
  it('is accessible once a table has loaded', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
      );
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });
  it('uses name as the accessible name, falling back to a localized default', async () => {
    const named = (await fixture(
      html`<lr-csv-viewer name="quarterly.csv"></lr-csv-viewer>`
    )) as LyraCsvViewer;
    expect(
      named
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.equal('quarterly.csv');
    const unnamed = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    expect(
      unnamed
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.equal('CSV document');
  });
  it('leaves a non-empty host aria-label on the host instead of duplicating a shadow owner', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer
        name="quarterly.csv"
        aria-label="Quarterly report"
      ></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.getAttribute('aria-label')).to.be.null;
    expect(el.getAttribute('aria-label')).to.equal('Quarterly report');
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/report.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="sheet"]')!.getAttribute('aria-label')
      ).to.equal('Quarterly report');
    } finally {
      restore();
    }
  });
  it('preserves an explicitly empty host aria-label on the stable region without duplicating it on the table', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer name="quarterly.csv" aria-label=""></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/report.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
      );
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const sheet = el.shadowRoot!.querySelector('[part="sheet"]')!;
      expect(base.hasAttribute('aria-label')).to.be.true;
      expect(base.getAttribute('aria-label')).to.equal('');
      expect(sheet.hasAttribute('aria-label')).to.be.true;
      expect(sheet.getAttribute('aria-label')).to.equal('');
    } finally {
      restore();
    }
  });
  it('emits exactly one render error for an unsafe URL', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    let count = 0;
    el.addEventListener('lr-render-error', () => {
      count++;
    });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'javascript:alert(1)';
    await event;
    await aTimeout(0);
    expect(count).to.equal(1);
  });
  it('emits a render error when the optional parser is unavailable', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => Promise.resolve(null);
    const restore = fetchText(CSV);
    try {
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/people.csv';
      await event;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal('CSV preview is unavailable.');
    } finally {
      restore();
    }
  });
  it('supports a .strings override for the csvViewerLabel fallback', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer
        .strings=${{ csvViewerLabel: 'Document CSV' }}
      ></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(CSV);
    try {
      el.src = 'https://example.test/people.csv';
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
      ).to.equal('Document CSV');
      expect(
        el.shadowRoot!.querySelector('[part="sheet"]')!.getAttribute('aria-label')
      ).to.equal('Document CSV');
    } finally {
      restore();
    }
  });
  it('applies max-height as a custom property on the base part', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer max-height="20rem"></lr-csv-viewer>`
    )) as LyraCsvViewer;
    expect(
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).style.getPropertyValue('--lr-csv-viewer-max-height')
    ).to.equal('20rem');
  });

  describe('cell-range anchor-target', () => {
    it('keeps loaded cells and later updates working when a highlight omits its anchor', async () => {
      const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('[part="header-row"]') !== null);

        el.highlights = [{ id: 'missing-anchor' }] as unknown as LyraCsvViewer['highlights'];
        await el.updateComplete;
        el.maxHeight = '12rem';
        await el.updateComplete;

        expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal([]);
        expect(el.shadowRoot!.querySelectorAll('[part="header-row"]').length).to.equal(1);
        expect(
          (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue(
            '--lr-csv-viewer-max-height',
          ),
        ).to.equal('12rem');
      } finally {
        restore();
      }
    });

    it('scrolls to a cell-range anchor addressing the raw grid (header included)', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        // Row 2 (raw, 1-based, header at row 1) is the first data row ("Ada,Mathematician").
        const result = await el.scrollToAnchor({
          kind: 'cell-range',
          range: 'A2',
        });
        expect(result).to.be.true;
      } finally {
        restore();
      }
    });

    it('resolves and scrolls a header-row anchor', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      const originalMatchMedia = window.matchMedia;
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
        const cell = el
          .shadowRoot!.querySelector('[part="header-row"]')!
          .querySelectorAll('[part~="cell"]')[1] as HTMLElement;
        const behaviors: (ScrollBehavior | undefined)[] = [];
        cell.scrollIntoView = ((options?: ScrollIntoViewOptions) => {
          behaviors.push(options?.behavior);
        }) as HTMLElement['scrollIntoView'];

        window.matchMedia = (() =>
          ({ matches: false } as MediaQueryList)) as typeof window.matchMedia;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to
          .be.true;
        // Pinned so this branch can't silently diverge from <lr-dataset-viewer>'s identical one.
        expect(behaviors).to.deep.equal(['smooth']);

        window.matchMedia = (() =>
          ({ matches: true } as MediaQueryList)) as typeof window.matchMedia;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'B1' })).to
          .be.true;
        expect(behaviors).to.deep.equal(['smooth', 'auto']);
      } finally {
        window.matchMedia = originalMatchMedia;
        restore();
      }
    });

    it('reports a failed jump when a concurrent src reassignment lands during the scroll wait', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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
              el.src = 'https://example.test/other.csv';
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

    it('renders header highlights with table-cell semantics and one nested action', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="header-row"]') !== null
        );
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
        expect(header.getAttribute('role')).to.equal('row');
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

    it('resolves false for an anchor with a sheet set (csv has no sheets)', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(
          await el.scrollToAnchor({
            kind: 'cell-range',
            sheet: 'Sheet1',
            range: 'A2',
          })
        ).to.be.false;
      } finally {
        restore();
      }
    });

    it('truthfully rejects rows and columns outside the parsed grid', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      shrinkAnchorRetry(el);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'A999' }))
          .to.be.false;
        expect(await el.scrollToAnchor({ kind: 'cell-range', range: 'K2' })).to
          .be.false;
      } finally {
        restore();
      }
    });

    it('cancels a stale scroll frame in its source realm and uses the current realm after iframe adoption', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const scrollColumnIntoView = (): Promise<void> =>
        (
          el as unknown as {
            scrollColumnIntoView: (col: number) => Promise<void>;
          }
        ).scrollColumnIntoView(1);

      await assertScrollFrameFollowsAdoption(el, scrollColumnIntoView);
    });

    it('renders a structural highlighted cell with a native activation action', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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

    it('repaints visible rows when the highlights change after the rows were rendered', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
        el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First' }];
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part~="cell-highlight"]') !== null);
        el.highlights = [];
        await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part~="cell-highlight"]') === null);
      } finally {
        restore();
      }
    });

    it('localizes the complete highlighted-cell name with independently ordered value and label placeholders', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      el.strings = {
        cellHighlightWithLabel: '{label} ⇐ {value}',
      };
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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

    it('uses a native keyboard-activatable button and never makes a plain cell interactive', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        el.highlights = [
          { id: 'h1', anchor: { kind: 'cell-range', range: 'A2' } },
        ];
        await el.updateComplete;
        const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
        const plain = list.shadowRoot!.querySelector(
          '[part="cell"]'
        ) as HTMLElement;
        expect(plain.hasAttribute('tabindex')).to.be.false;
        const { action } = highlightedCellAction(el);
        expect(action.tagName).to.equal('BUTTON');
      } finally {
        restore();
      }
    });
  });

  describe('search', () => {
    it('finds matches ordered row -> column', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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

    it('case-folds with the effective locale and can navigate a header match', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer lang="tr"></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText('İSTANBUL,Role\nAnkara,Capital');
      try {
        el.src = 'https://example.test/people.csv';
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
        html`<lr-csv-viewer lang="en"></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText('City\nİSTANBUL\nistanbul');
      try {
        el.src = 'https://example.test/people.csv';
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

    it('searchPrevious wraps backward', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        await el.search('ada');
        expect(await el.searchPrevious()).to.be.true;
        let detail: { activeIndex: number } | undefined;
        el.addEventListener(
          'lr-search-change',
          (e) => (detail = (e as CustomEvent).detail)
        );
        expect(await el.searchPrevious()).to.be.true;
        expect(detail!.activeIndex).to.equal(0);
      } finally {
        restore();
      }
    });

    it('paints at most the bounded highlight candidates, always keeping the active one', async () => {
      const el = await fixture<LyraCsvViewer>(html`<lr-csv-viewer></lr-csv-viewer>`);
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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

    it('clearSearch resets matchCount/activeIndex to 0/-1', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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

    it('an empty query behaves like clearSearch and resolves 0', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
        );
        await el.search('ada');
        expect(await el.search('   ')).to.equal(0);
      } finally {
        restore();
      }
    });

    it('caps retained search matches before allocating an unbounded result list', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        rows: Array.from({ length: 1_001 }, () => ['hit']),
      };
      await el.updateComplete;
      let detail: { matchCount: number; matchCountExact: boolean } | undefined;
      el.addEventListener('lr-search-change', (event) => {
        detail = event.detail;
      });
      expect(await el.search('hit')).to.equal(1_000);
      expect(
        (el as unknown as { table: { search: { matches: unknown[] } } }).table.search.matches
      ).to.have.lengthOf(1_000);
      expect(detail).to.deep.include({
        matchCount: 1_000,
        matchCountExact: false,
      });

      (el as unknown as { fetchState: unknown }).fetchState = {
        kind: 'loaded',
        rows: Array.from({ length: 1_000 }, () => ['hit']),
      };
      expect(await el.search('hit')).to.equal(1_000);
      expect(detail).to.deep.include({
        matchCount: 1_000,
        matchCountExact: true,
      });
    });
  });

  it('does not leak internal virtual-list events through the viewer host', async () => {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
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
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    const restore = fetchText(GRID_CSV);
    try {
      el.src = 'https://example.test/people.csv';
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

  describeCellHighlightStyling({
    tag: 'lr-csv-viewer',
    src: 'https://example.test/people.csv',
    install: () => fetchText(GRID_CSV),
  });

  describe('overflow', () => {
    it('pins overflow-y on [part="sheet"] alongside its overflow-x, avoiding a phantom scrollbar', async () => {
      // Per the CSS overflow spec, pinning only overflow-x to a non-'visible' value forces
      // overflow-y's used value to 'auto' too (never stays 'visible') -- risking a phantom/empty
      // vertical scrollbar from sub-pixel rounding on a grid that never actually overflows
      // vertically (the same bug shape already fixed on lr-tab-group). Pin both axes explicitly.
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(CSV);
      try {
        el.src = 'https://example.test/people.csv';
        await waitUntil(
          () => el.shadowRoot!.querySelector('[part="sheet"]') !== null
        );
        const sheet = el.shadowRoot!.querySelector(
          '[part="sheet"]'
        ) as HTMLElement;
        expect(getComputedStyle(sheet).overflowX).to.equal('auto');
        expect(getComputedStyle(sheet).overflowY).to.equal('hidden');
      } finally {
        restore();
      }
    });
  });


  describe('back-compat', () => {
    it('rendering is unchanged with highlights empty and no search active', async () => {
      const el = (await fixture(
        html`<lr-csv-viewer></lr-csv-viewer>`
      )) as LyraCsvViewer;
      const restore = fetchText(GRID_CSV);
      try {
        el.src = 'https://example.test/people.csv';
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
  const el = await fixture<LyraCsvViewer>(
    html`<lr-csv-viewer></lr-csv-viewer>`
  );
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-csv-viewer-max-height')).to.equal(
    ''
  );
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-csv-viewer-max-height')).to.equal(
    'calc(10rem + 2px)'
  );
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a text/csv renderer that matches .csv files and renders the viewer', async () => {
  const { getDefaultDocumentRendererRegistry } = await import(
    '../document-viewer/registry.js'
  );
  const def = getDefaultDocumentRendererRegistry().get('text/csv');
  expect(def, 'importing csv-viewer.js registers the renderer').to.exist;
  expect(
    def!.matches!({
      name: 'Q3-report.CSV',
      mimeType: 'text/csv',
      src: 'https://example.test/a.csv',
    })
  ).to.be.true;
  expect(
    def!.matches!({
      name: 'notes.txt',
      mimeType: 'text/plain',
      src: 'https://example.test/a.txt',
    })
  ).to.be.false;
  expect(def!.capabilities).to.deep.equal({
    anchors: ['cell-range'],
    search: true,
    textSelect: false,
  });

  const host = (await fixture(
    html`<div>
      ${def!.render!({
        name: 'a.csv',
        mimeType: 'text/csv',
        src: 'https://example.test/a.csv',
      })}
    </div>`
  )) as HTMLElement;
  const viewer = host.querySelector('lr-csv-viewer') as LyraCsvViewer;
  expect(viewer).to.exist;
  expect(viewer.name).to.equal('a.csv');
  expect(viewer.anchor).to.be.null;
  expect(viewer.highlights).to.deep.equal([]);
});

it('surfaces a non-OK HTTP response as a load error', async () => {
  const original = window.fetch;
  window.fetch = (() =>
    Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve(''),
    } as Response)) as typeof window.fetch;
  try {
    const el = (await fixture(
      html`<lr-csv-viewer></lr-csv-viewer>`
    )) as LyraCsvViewer;
    el.src = 'https://example.test/missing.csv';
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="error"]') !== null,
      'a rejected HTTP status never rendered the error state'
    );
    expect(
      el.shadowRoot!.querySelectorAll('[part="error"]').length
    ).to.equal(1);
  } finally {
    window.fetch = original;
  }
});

it('re-applies an active search when a reconnect reloads the source', async () => {
  const original = window.fetch;
  let body = GRID_CSV;
  window.fetch = (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(body),
    } as Response)) as typeof window.fetch;
  try {
    const el = (await fixture(
      html`<lr-csv-viewer src="https://example.test/people.csv"></lr-csv-viewer>`
    )) as LyraCsvViewer;
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list') !== null
    );
    expect(await el.search('ada')).to.equal(2);
    // A reconnect reloads the same `src`, which -- unlike a `src` change -- does not clear the
    // active query, so the reloaded grid must be searched again on the consumer's behalf.
    body = 'Name,Role\nAda,One\nAda,Two\nAda,Three';
    const parent = el.parentElement!;
    el.remove();
    await aTimeout(0);
    parent.append(el);
    await waitUntil(
      () =>
        (el as unknown as { table: { search: { matches: unknown[] } } }).table.search.matches
          .length === 3,
      'the active search was not re-applied to the reloaded source'
    );
  } finally {
    window.fetch = original;
  }
});
