/**
 * One logical action contributed to a parent toolbar.
 *
 * Composite controls keep their implementation nodes private: the parent can move the sequential
 * tab stop, focus an action, and associate a composed event with that action without receiving the
 * underlying element. `id` must remain stable while the logical action remains available.
 */
export interface LyraToolbarAction {
  readonly id: string;
  readonly disabled: boolean;
  focus(options?: FocusOptions): void;
  setTabIndex(tabIndex: 0 | -1): void;
  matchesEventPath(path: readonly EventTarget[]): boolean;
}

/**
 * Public opt-in protocol for a composite child of `<lr-message-actions>`.
 *
 * Return actions in visual navigation order. Dispatch a bubbling, composed
 * `lr-toolbar-actions-change` event whenever their order or availability changes so an enclosing
 * toolbar can reconcile its roving tab stop without observing the component's shadow tree.
 */
export interface LyraToolbarActionProvider {
  getToolbarActions(): readonly LyraToolbarAction[];
}

/** Realm-neutral structural check for the logical-toolbar provider protocol. */
export function isLyraToolbarActionProvider(value: unknown): value is LyraToolbarActionProvider {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  ) && typeof (value as Partial<LyraToolbarActionProvider>).getToolbarActions === 'function';
}
