/** The {@link MouseEvent} fields {@link isPlainPrimaryClick} reads. */
export type LyraPlainClickInput = Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'>;

/**
 * Reports whether a click is an unmodified primary-button activation that nothing has handled yet:
 * `button` is 0, no Ctrl, Meta, Shift or Alt key is held, and `defaultPrevented` is false.
 *
 * A single-page application intercepts exactly these clicks on a link, or on an `href`-bearing
 * component such as `lr-button`, `lr-card` or `lr-menu-item`, and routes on the client. Every other
 * click keeps the browser behaviour the user asked for: a new tab or window, a download, or the
 * handling another listener already claimed. Keyboard activation of a link dispatches a click with
 * `button` 0, so it routes too. The function reads plain fields only and has no side effects.
 */
export function isPlainPrimaryClick(event: LyraPlainClickInput): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    && !event.defaultPrevented;
}
