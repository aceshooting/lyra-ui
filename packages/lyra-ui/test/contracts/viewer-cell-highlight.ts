import { expect, fixture, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../wtr-focus.js';
import { resetMouse, sendMouse } from '../wtr-mouse.js';

/** Resolve the structural cell and its separate native action inside a viewer's virtual list. */
export function highlightedCellAction(host: HTMLElement): { cell: HTMLElement; action: HTMLButtonElement; root: ShadowRoot } {
  const list = host.shadowRoot!.querySelector('lr-virtual-list')!;
  const root = list.shadowRoot!;
  const cell = root.querySelector<HTMLElement>('[part~="cell-highlight"]')!;
  expect(cell != null).to.equal(true);
  expect(cell.getAttribute('role')).to.equal('cell');
  expect(cell.hasAttribute('tabindex')).to.be.false;
  const action = cell.querySelector<HTMLButtonElement>('[part="cell-highlight-action"]')!;
  expect(action != null).to.equal(true);
  expect(action.tagName).to.equal('BUTTON');
  return { cell, action, root };
}

export async function assertHighlightedCellActivation(
  host: HTMLElement,
  options: { id: string; name?: string; hitArea?: string },
): Promise<void> {
  const { action } = highlightedCellAction(host);
  if (options.name !== undefined) expect(action.getAttribute('aria-label')).to.equal(options.name);
  if (options.hitArea !== undefined) {
    expect(getComputedStyle(action).minInlineSize).to.equal(options.hitArea);
    expect(getComputedStyle(action).minBlockSize).to.equal(options.hitArea);
  }
  const listener = oneEvent(host, 'lr-highlight-activate');
  action.click();
  const event = (await listener) as CustomEvent<{ highlightId: string }>;
  expect(event.detail).to.deep.equal({ highlightId: options.id });
}

interface HighlightHost extends HTMLElement {
  src: string;
  highlights: unknown[];
  activeHighlightId: string | null;
  updateComplete: Promise<unknown>;
}

export interface CellHighlightStylingOptions {
  /** Viewer tag, e.g. `lr-csv-viewer`. */
  tag: string;
  /** URL assigned to `src`. */
  src: string;
  /** Installs the fetch stub for the viewer's fixture and returns its restore callback. */
  install: () => () => void;
  /** The viewer exposes `--<tag>-highlight-outline-offset`. */
  outlineOffsetHook?: boolean;
  /** The structural highlighted cell itself carries `cursor: pointer` (not only its action). */
  cellCursor?: boolean;
}

/** Registers the rendered-style contract every table viewer's highlighted cell must satisfy. */
export function describeCellHighlightStyling(options: CellHighlightStylingOptions): void {
  const { tag, outlineOffsetHook = false, cellCursor = true } = options;
  describe('cell-highlight styling', () => {
    const injected: HTMLStyleElement[] = [];
    let restore: () => void = () => {};
    beforeEach(() => {
      restore = options.install();
    });
    afterEach(async () => {
      await resetMouse();
      restore();
      for (const style of injected.splice(0)) style.remove();
    });

    function injectStyle(cssText: string): void {
      const style = document.createElement('style');
      style.textContent = cssText;
      document.head.append(style);
      injected.push(style);
    }

    /** Loads the grid, highlights A2, and resolves the highlighted cell beside a plain one. */
    async function mountHighlighted(
      el: HighlightHost,
      activeId: string | null = null,
    ): Promise<{ highlighted: HTMLElement; plain: HTMLElement; dataRow: HTMLElement; action: HTMLElement }> {
      el.src = options.src;
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      el.highlights = [{ id: 'h1', anchor: { kind: 'cell-range', range: 'A2' }, label: 'First result' }];
      el.activeHighlightId = activeId;
      await el.updateComplete;
      const root = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
      await waitUntil(() => root.querySelector('[part~="cell-highlight"]') !== null);
      const highlighted = root.querySelector<HTMLElement>('[part~="cell-highlight"]')!;
      return {
        highlighted,
        plain: root.querySelector<HTMLElement>('[part="cell"]')!,
        dataRow: root.querySelector<HTMLElement>('[part="data-row"]')!,
        action: highlighted.querySelector<HTMLElement>('[part="cell-highlight-action"]')!,
      };
    }

    const create = async (attrs = ''): Promise<HighlightHost> =>
      (await fixture(`<${tag} ${attrs}></${tag}>`)) as HighlightHost;

    it('paints a highlighted cell with an outline no plain cell has', async () => {
      injectStyle(`${tag} { --lr-theme-color-brand-fill-loud: rgb(1, 2, 3); }`);
      const { highlighted, plain, action } = await mountHighlighted(await create());
      const style = getComputedStyle(highlighted);
      expect(style.outlineStyle).to.equal('solid');
      expect(style.outlineWidth).to.not.equal('0px');
      expect(style.outlineColor).to.equal('rgb(1, 2, 3)');
      if (cellCursor) expect(style.cursor).to.equal('pointer');
      expect(getComputedStyle(action).cursor).to.equal('pointer');
      expect(getComputedStyle(plain).outlineStyle).to.equal('none');
    });

    if (outlineOffsetHook) {
      it(`lets --${tag}-highlight-outline-offset override the default outline offset`, async () => {
        const { highlighted } = await mountHighlighted(await create(`style="--${tag}-highlight-outline-offset: 4px;"`));
        expect(getComputedStyle(highlighted).outlineOffset).to.equal('4px');
      });
    }

    it('tints the active highlight apart from an inactive one', async () => {
      injectStyle(`${tag} { --lr-theme-color-focus: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }`);
      const { highlighted } = await mountHighlighted(await create(), 'h1');
      expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
    });

    it('keeps inherited and direct highlight-color inputs authoritative for the active cell', async () => {
      const wrapper = (await fixture(
        `<div style="--${tag}-highlight-color: rgb(7, 8, 9)"><${tag}></${tag}></div>`,
      )) as HTMLElement;
      const el = wrapper.querySelector(tag) as HighlightHost;
      const { highlighted } = await mountHighlighted(el, 'h1');
      expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(7, 8, 9)');
      el.style.setProperty(`--${tag}-highlight-color`, 'rgb(10, 11, 12)');
      expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(10, 11, 12)');
    });

    it('shows the shared focus ring on the nested highlight action', async () => {
      injectStyle(`${tag} { --lr-theme-color-focus: rgb(1, 2, 3); --lr-theme-color-warning-fill-loud: rgb(4, 5, 6); }`);
      const { highlighted, action } = await mountHighlighted(await create(), 'h1');
      expect(getComputedStyle(highlighted).outlineColor).to.equal('rgb(4, 5, 6)');
      await focusByKeyboard(action);
      expect(getComputedStyle(action).outlineStyle).to.equal('solid');
      expect(getComputedStyle(action).outlineWidth).to.equal('3px');
      expect(getComputedStyle(action).outlineColor).to.equal('rgb(1, 2, 3)');
    });

    it('changes the rendered highlight action background under real pointer hover', async () => {
      const { action } = await mountHighlighted(await create('style="--lr-color-brand-quiet: rgb(1, 2, 3)"'));
      const resting = getComputedStyle(action).backgroundColor;
      const box = action.getBoundingClientRect();
      await resetMouse();
      await sendMouse({
        type: 'move',
        position: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)],
      });
      await waitUntil(
        () => getComputedStyle(action).backgroundColor !== resting,
        'the highlighted-cell action never entered its rendered hover state',
      );
      expect(getComputedStyle(action).backgroundColor).to.not.equal(resting);
    });

    it('exports data-row, cell, and cell-highlight to a consumer stylesheet', async () => {
      injectStyle(`
        ${tag}::part(data-row) { opacity: 0.75; }
        ${tag}::part(cell) { padding-block-start: 3px; }
        ${tag}::part(cell-highlight) { padding-block-start: 5px; }
      `);
      const { highlighted, plain, dataRow } = await mountHighlighted(await create());
      expect(getComputedStyle(dataRow).opacity).to.equal('0.75');
      expect(getComputedStyle(plain).paddingBlockStart).to.equal('3px');
      expect(getComputedStyle(highlighted).paddingBlockStart).to.equal('5px');
    });

    it('is accessible with a highlighted cell rendered', async () => {
      const el = await create();
      const { highlighted, action } = await mountHighlighted(el);
      expect(highlighted.getAttribute('role')).to.equal('cell');
      expect(action.localName).to.equal('button');
      await expect(el).to.be.accessible();
    });
  });
}
