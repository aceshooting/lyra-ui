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
