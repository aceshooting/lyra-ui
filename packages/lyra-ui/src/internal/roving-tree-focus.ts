import { isRovingTargetAvailable, resolveListMove, shouldIgnoreNavigationKey } from './list-navigation.js';

export interface RovingTreeFocusOptions {
  /** The rendered tree element, or null while none is rendered. */
  tree: () => HTMLElement | null;
  /** Selector of one row; a control's closest match groups it with the row's other controls. */
  row: string;
  /** Selector of every interactive control inside the tree. */
  control: string;
  direction: () => 'ltr' | 'rtl';
}

/**
 * One Tab stop for a long tree of rows whose controls would otherwise each be a tab stop.
 * ArrowUp/ArrowDown move to the previous/next row that has a control, preferring a control with
 * the same `part` as the focused one; ArrowLeft/ArrowRight move between one row's controls
 * (mirrored under RTL); Home/End reach the first/last row. The stop is the last focused control,
 * else the first available one. Hidden, inert and disabled controls are skipped.
 */
export class RovingTreeFocus {
  private stop?: HTMLElement;

  constructor(private readonly options: RovingTreeFocusOptions) {}

  private available(control: HTMLElement, tree: HTMLElement): boolean {
    return isRovingTargetAvailable(control, tree);
  }

  /** Re-applies the single tab stop; call after every render of the tree. */
  sync(): void {
    const tree = this.options.tree();
    if (!tree) { this.stop = undefined; return; }
    const controls = Array.from(tree.querySelectorAll<HTMLElement>(this.options.control));
    const kept = this.stop && this.stop.isConnected && tree.contains(this.stop) && this.available(this.stop, tree);
    const stop = kept ? this.stop : controls.find(control => this.available(control, tree));
    this.stop = stop;
    for (const control of controls) control.tabIndex = control === stop ? 0 : -1;
  }

  private rows(tree: HTMLElement): HTMLElement[][] {
    const rows = new Map<Element, HTMLElement[]>();
    for (const control of tree.querySelectorAll<HTMLElement>(this.options.control)) {
      if (!this.available(control, tree)) continue;
      const row = control.closest(this.options.row) ?? control;
      const list = rows.get(row);
      if (list) list.push(control);
      else rows.set(row, [control]);
    }
    return [...rows.values()];
  }

  readonly onFocusIn = (event: FocusEvent): void => {
    const tree = this.options.tree();
    const control = (event.target as Element | null)?.closest<HTMLElement>(this.options.control);
    if (!tree || !control || !tree.contains(control)) return;
    this.stop = control;
    this.sync();
  };

  readonly onKeyDown = (event: KeyboardEvent): void => {
    const tree = this.options.tree();
    const current = (event.target as Element | null)?.closest<HTMLElement>(this.options.control);
    if (event.defaultPrevented || shouldIgnoreNavigationKey(event) || !tree || !current) return;
    const rows = this.rows(tree);
    const row = rows.findIndex(controls => controls.includes(current));
    if (row < 0) return;
    const column = rows[row]!.indexOf(current);
    let next: HTMLElement | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = resolveListMove(event, { count: rows[row]!.length, current: column, orientation: 'horizontal',
        direction: this.options.direction(), wrap: false });
      next = index === null ? undefined : rows[row]![index];
    } else {
      const index = resolveListMove(event, { count: rows.length, current: row, orientation: 'vertical', wrap: false, clamp: true });
      const target = index === null ? undefined : rows[index];
      if (target) {
        const part = current.getAttribute('part');
        next = event.key === 'Home' ? target[0] : event.key === 'End' ? target.at(-1)
          : target.find(control => control.getAttribute('part') === part) ?? target[Math.min(column, target.length - 1)];
      }
    }
    if (!next) return;
    event.preventDefault();
    if (next !== current) next.focus();
  };
}
