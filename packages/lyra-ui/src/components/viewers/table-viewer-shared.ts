import { prefersReducedMotion } from '../../internal/motion.js';
import { OwnerAnimationFrameWaiter } from '../../internal/owner-animation-frame.js';

interface CellHighlightRange {
  parsed: { startRow: number; endRow: number; startCol: number; endCol: number };
  sheet?: string;
}

export function tableHighlightsForRow<T extends CellHighlightRange>(
  highlights: readonly T[], rawRow: number, sheet?: string,
): T[] {
  return highlights.filter((entry) =>
    (sheet === undefined || entry.sheet === undefined || entry.sheet === sheet)
    && rawRow - 1 >= entry.parsed.startRow
    && rawRow - 1 <= entry.parsed.endRow);
}

export function tableHighlightsForColumn<T extends CellHighlightRange>(highlights: readonly T[], col: number): T[] {
  return highlights.filter((entry) => col >= entry.parsed.startCol && col <= entry.parsed.endCol);
}

/** Coordinates virtualized table scrolling with the host's current document realm. */
export class TableViewerScrollController {
  private readonly frames: OwnerAnimationFrameWaiter;
  private generation = 0;

  constructor(private readonly host: HTMLElement) {
    this.frames = new OwnerAnimationFrameWaiter(host);
  }

  cancel(): void { this.generation++; this.frames.cancel(); }

  async scrollColumnIntoView(list: HTMLElement & { updateComplete?: Promise<unknown> } | null, col: number): Promise<void> {
    this.frames.cancel();
    const generation = ++this.generation;
    const ownerDocument = this.host.ownerDocument;
    const isCurrent = () => generation === this.generation &&
      this.host.ownerDocument === ownerDocument && list?.isConnected === true;
    if (list?.updateComplete) await list.updateComplete;
    if (!list || !isCurrent()) return;
    if (!(await this.frames.wait()) || !isCurrent()) return;
    const row = list?.shadowRoot?.querySelector('[part="row"][aria-current="true"]');
    const target = row?.querySelectorAll('[part~="cell"]')[col] as HTMLElement | undefined;
    target?.scrollIntoView({
      behavior: prefersReducedMotion(this.host) ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}
