import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { MarkdownRuntimeBase } from '../../src/components/conversation/markdown/markdown-base.class.js';

export function assertMarkdownTextSelection(tag: 'lr-markdown' | 'lr-markdown-core'): void {
  async function mount(): Promise<MarkdownRuntimeBase> {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = document.createElement(tag) as MarkdownRuntimeBase;
    el.content = 'The quick brown fox jumps over the lazy dog.';
    wrapper.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it("emits lr-text-select with a text-quote anchor on selection", async () => {
    const el = await mount();
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="paragraph"]') !== null
    );
    await el.updateComplete;
    const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
    const textNode = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 15);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // WebKit intentionally rejects a programmatic Selection range whose endpoints live in a
    // shadow tree. Feed the component's composed-selection reader the same real Range in that
    // engine so this event-plumbing test remains deterministic; native drag-selection behavior
    // belongs to the browser and is not reproducible with synthetic pointer events.
    const needsSelectionFacade =
      selection.rangeCount === 0 || selection.isCollapsed;
    const ownGetSelectionDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "getSelection"
    );
    if (needsSelectionFacade) {
      const composedRange: StaticRange = {
        startContainer: textNode,
        startOffset: 10,
        endContainer: textNode,
        endOffset: 15,
        collapsed: false,
      };
      const facade = {
        rangeCount: 1,
        isCollapsed: false,
        getRangeAt: () => range,
        getComposedRanges: () => [composedRange],
      } as unknown as Selection;
      Object.defineProperty(window, "getSelection", {
        configurable: true,
        value: () => facade,
      });
    }
    try {
      const listener = oneEvent(el, "lr-text-select");
      (paragraph as HTMLElement).dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, composed: true })
      );
      const event = (await listener) as CustomEvent<{
        text: string;
        anchor: unknown;
      }>;
      expect(event.detail.text).to.equal("brown");
    } finally {
      selection.removeAllRanges();
      if (needsSelectionFacade) {
        if (ownGetSelectionDescriptor)
          Object.defineProperty(
            window,
            "getSelection",
            ownGetSelectionDescriptor
          );
        else Reflect.deleteProperty(window, "getSelection");
      }
    }
  });
}
