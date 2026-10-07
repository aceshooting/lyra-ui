import { DebounceController } from './debounce-controller.js';
import { resolveIntlLocale } from './intl-cache.js';

/** A listbox type-ahead buffer: printable keys accumulate and clear 500 ms after the last one, on the
 *  realm the host lives in, so "b" then "a" narrows to "ba" and an adopted host never clears a buffer
 *  that belongs to another document. */
export class TypeAheadBuffer {
  text = '';
  readonly #reset: DebounceController<Window>;

  constructor(private readonly host: Element) {
    this.#reset = new DebounceController<Window>(
      500,
      (armedIn) => {
        if (host.isConnected && host.ownerDocument.defaultView === armedIn) this.text = '';
      },
      () => host.ownerDocument.defaultView,
    );
  }

  /** Appends one key (case-folded for `locale`), restarts the reset timer and returns the buffer. */
  add(key: string, locale: string): string {
    this.#reset.cancel();
    this.text += key.toLocaleLowerCase(resolveIntlLocale(locale));
    const view = this.host.ownerDocument.defaultView;
    if (this.host.isConnected && view) this.#reset.push(view);
    return this.text;
  }

  clear(): void {
    this.#reset.cancel();
    this.text = '';
  }
}
