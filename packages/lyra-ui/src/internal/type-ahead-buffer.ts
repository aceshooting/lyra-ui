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
        if (host.ownerDocument.defaultView === armedIn) this.text = '';
      },
      () => host.ownerDocument.defaultView,
    );
  }

  /** Appends one key (case-folded for `locale`), restarts the reset timer and returns the buffer. */
  add(key: string, locale: string): string {
    this.#reset.cancel();
    this.text += key.toLocaleLowerCase(resolveIntlLocale(locale));
    const view = this.host.ownerDocument.defaultView;
    if (view) this.#reset.push(view);
    return this.text;
  }

  /** Printable, unmodified keys only; composition must finish before a list moves. */
  accepts(event: KeyboardEvent): boolean {
    return !event.defaultPrevented && !event.isComposing && event.keyCode !== 229 &&
      !event.altKey && !event.ctrlKey && !event.metaKey && event.key.length === 1;
  }

  /** Finds the next prefix match after `current`, wrapping across available entries. */
  match<T>(
    items: readonly T[],
    current: number,
    label: (item: T) => string,
    locale: string,
    isAvailable: (item: T) => boolean = () => true,
  ): number | null {
    if (!this.text || items.length === 0) return null;
    const resolvedLocale = resolveIntlLocale(locale);
    for (let step = 1; step <= items.length; step++) {
      const index = ((current + step) % items.length + items.length) % items.length;
      const item = items[index];
      if (item !== undefined && isAvailable(item) &&
          label(item).toLocaleLowerCase(resolvedLocale).startsWith(this.text)) return index;
    }
    return null;
  }

  clear(): void {
    this.#reset.cancel();
    this.text = '';
  }
}
