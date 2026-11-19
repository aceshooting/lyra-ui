/** One capture-phase `pointerdown` listener on the host's current document. Binding again for the
 *  same document keeps the existing listener; presses after a disconnect or a move to another
 *  document are ignored. */
export class DocumentPointerListener {
  document?: Document;
  listener?: (event: PointerEvent) => void;

  constructor(
    private readonly host: Element,
    private readonly handler: (event: PointerEvent) => void,
  ) {}

  bind(): void {
    const doc = this.host.ownerDocument;
    if (this.document === doc && this.listener) return;
    this.unbind();
    const listener = (event: PointerEvent): void => {
      if (this.listener === listener && this.host.isConnected && this.host.ownerDocument === doc) this.handler(event);
    };
    this.document = doc;
    this.listener = listener;
    doc.addEventListener('pointerdown', listener, true);
  }

  unbind(): void {
    if (this.document && this.listener) this.document.removeEventListener('pointerdown', this.listener, true);
    this.document = undefined;
    this.listener = undefined;
  }
}

/** Options for {@link listenUntilPointerEnd}. */
export interface PointerEndListenOptions {
  capture?: boolean;
  passive?: boolean;
  /** Also treats `lostpointercapture` as an end of the press. */
  lostCapture?: boolean;
  /** Further listeners (for example `pointermove`) bound and released together with the end listeners. */
  extra?: Readonly<Record<string, (event: Event) => void>>;
}

/**
 * Binds `pointerup` and `pointercancel` (optionally `lostpointercapture`) on `target` as one set,
 * calling `onEnd` for each. The returned release removes every listener, is idempotent, and may be
 * called from inside `onEnd`.
 */
export function listenUntilPointerEnd(
  target: EventTarget,
  onEnd: (event: PointerEvent) => void,
  options: PointerEndListenOptions = {},
): () => void {
  const listenerOptions = { capture: options.capture ?? false, passive: options.passive ?? false };
  const end = (event: Event): void => onEnd(event as PointerEvent);
  const bound: Array<[string, (event: Event) => void]> = [
    ['pointerup', end],
    ['pointercancel', end],
    ...(options.lostCapture ? [['lostpointercapture', end] as [string, (event: Event) => void]] : []),
    ...Object.entries(options.extra ?? {}),
  ];
  for (const [type, listener] of bound) target.addEventListener(type, listener, listenerOptions);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const [type, listener] of bound) target.removeEventListener(type, listener, listenerOptions);
  };
}
