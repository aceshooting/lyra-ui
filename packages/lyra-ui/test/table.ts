import { html } from '@open-wc/testing';
import '../src/components/data/table/table.js';
import '../src/components/forms/select/select.js';
import type { LyraTable, TableColumn } from '../src/components/data/table/table.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../src/internal/announcer.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../src/translations/ar/data.js';


export class TableOpaqueControlElement extends HTMLElement {
  private readonly control: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'closed' });
    this.control = document.createElement('button');
    this.control.type = 'button';
    root.append(this.control);
  }

  connectedCallback(): void {
    this.control.textContent = this.textContent ?? '';
  }

  activate(): void {
    this.control.click();
  }
}

if (!customElements.get('table-opaque-control')) {
  customElements.define('table-opaque-control', TableOpaqueControlElement);
}

/** An OPEN-shadow, non-interactive custom element -- unlike the closed-mode opaque control above,
 *  clicking its inner span exposes its own ShadowRoot as a real entry in `event.composedPath()`,
 *  which is not an Element (`nodeType === 11`, not `1`). */
export class TableOpenShellElement extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const span = document.createElement('span');
    span.textContent = this.textContent ?? '';
    root.append(span);
  }

  get innerSpan(): HTMLSpanElement {
    return this.shadowRoot!.querySelector('span')!;
  }
}

if (!customElements.get('table-open-shell')) {
  customElements.define('table-open-shell', TableOpenShellElement);
}

export function sinkElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
}

export function sinkTexts(doc: Document = document): string[] {
  const sink = sinkElement(doc);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

export interface Row {
  id: string;
  name: string;
  score: number;
}

export const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true, cell: (r) => r.name },
  {
    key: 'score',
    label: 'Score',
    sortable: true,
    align: 'end',
    cell: (r) => r.score,
  },
];

export const editableColumns: TableColumn<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    editTrigger: 'double-click',
    editValue: (r) => r.name,
    cell: (r) => r.name,
  },
  {
    key: 'score',
    label: 'Score',
    editTrigger: 'double-click',
    editType: 'number',
    editValue: (r) => r.score,
    cell: (r) => r.score,
  },
];
export const rows: Row[] = [
  { id: 'a', name: 'Alpha', score: 3 },
  { id: 'b', name: 'Beta', score: 1 },
];

/** Forces a column's header -- and, in the default `table-layout: auto`, the whole rendered column
 *  -- to a fixed pixel width regardless of engine font metrics or whether a real `cell()`/skeleton
 *  placeholder renders any content at all. The priority-hiding tests below need a deterministic,
 *  cross-engine (`WTR_BROWSER=firefox`/`webkit`) measured overflow, which a string's rendered text
 *  width can't reliably give: `headerCell` always renders (loading, empty, and populated states
 *  alike), unlike `cell()`, so it is the one hook wide enough to drive every fixture below. */
export function forcedWidthHeaderCell(px: number, label: string) {
  return () => html`<span style="display:inline-block;inline-size:${px}px">${label}</span>`;
}

// Sized so a 300px container overflows even with 'low' (350px) hidden -- both tiers hide. A 700px
// container overflows only until 'low' is hidden -- only 'low' hides. A 1000px container never
// overflows at all -- neither hides. Each case keeps a wide margin (at least ~90px) against
// per-engine padding/border/scrollbar variance.
export const priorityColumns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (r) => r.name },
  {
    key: 'score',
    label: 'Score',
    align: 'end',
    priority: 'medium',
    headerCell: forcedWidthHeaderCell(300, 'Score'),
    cell: (r) => r.score,
  },
  { key: 'id', label: 'Id', priority: 'low', headerCell: forcedWidthHeaderCell(350, 'Id'), cell: (r) => r.id },
];

/** Counts flips of `[part='base']`'s priority-hide attributes and detaches `el` once they pass
 *  `limit`. A hide/reveal loop runs entirely in microtasks, starving timers and animation frames
 *  alike, so without this the regression would wedge the whole file instead of failing one test. */
export function watchPriorityChurn(el: LyraTable<Row>, limit = 16) {
  let mutations = 0;
  const observer = new MutationObserver((records) => {
    mutations += records.length;
    if (mutations > limit) el.remove();
  });
  observer.observe(el.shadowRoot!, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-hide-priority-low', 'data-hide-priority-medium'],
  });
  return { count: () => mutations, disconnect: () => observer.disconnect() };
}

export const nextPriorityFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function hostileIterable<V>(items: readonly V[], throwAt: number): Iterable<V> {
  return {
    [Symbol.iterator]() {
      let i = 0;
      return {
        next(): IteratorResult<V> {
          if (i === throwAt) throw new Error('hostile iterable');
          if (i >= items.length) return { done: true, value: undefined as never };
          return { done: false, value: items[i++]! };
        },
      };
    },
  };
}
export function installTableTestHooks(): void {


  // These table fixtures render a bare <lr-table> with no accessibleLabel /
  // caption / host aria-label, which trips firstUpdated()'s intentional
  // "no accessible name" dev warning. Under CI's WTR_STRICT_CONSOLE guard an
  // unexpected console.warn is thrown as a test failure, so swallow *only* that
  // one expected message here while still re-throwing every other warning
  // (delegating to whatever console.warn the harness installed). The dedicated
  // "accessible name" describe block installs its own console.warn stub in
  // a nested beforeEach, so its assertions on the warning are unaffected.
  let previousWarn: typeof console.warn;
  beforeEach(() => {
    previousWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes('no accessible name')) return;
      return previousWarn(...args);
    };
  });
  afterEach(() => {
    console.warn = previousWarn;
  });
}
