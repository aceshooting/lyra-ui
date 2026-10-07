import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { LyraCodeBlockBase } from '../../src/components/conversation/code-block/code-block-base.class.js';

type CodeBlockTag = 'lr-code-block' | 'lr-code-block-core';

async function mount(tag: CodeBlockTag, code: string, activatable = false): Promise<LyraCodeBlockBase> {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const el = document.createElement(tag) as LyraCodeBlockBase;
  el.code = code;
  el.lineNumbers = activatable;
  el.activatableLines = activatable;
  wrapper.appendChild(el);
  await el.updateComplete;
  return el;
}

export function assertCodeBlockLineKeyboard(tag: CodeBlockTag): void {
  it("moves focus with ArrowUp, jumps with Home/End, and activates on Enter and Space", async () => {
    const el = await mount(tag, 'a\nb\nc\nd', true);
    await el.updateComplete;

    const line3 = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="3"]'
    ) as HTMLButtonElement;
    line3.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part~="line-button"][data-line="2"]')!
        .getAttribute("tabindex")
    ).to.equal("0");

    const line2 = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="2"]'
    ) as HTMLButtonElement;
    line2.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part~="line-button"][data-line="4"]')!
        .getAttribute("tabindex")
    ).to.equal("0");

    const line4 = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="4"]'
    ) as HTMLButtonElement;
    line4.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part~="line-button"][data-line="1"]')!
        .getAttribute("tabindex")
    ).to.equal("0");

    const line1 = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="1"]'
    ) as HTMLButtonElement;
    let listener = oneEvent(el, "lr-line-activate");
    line1.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
    let event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    listener = oneEvent(el, "lr-line-activate");
    line1.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      })
    );
    event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    // Home while already on line 1 is a no-op (next === line) -- must not move focus or throw.
    line1.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part~="line-button"][data-line="1"]')!
        .getAttribute("tabindex")
    ).to.equal("0");
  });

}

export function assertCodeBlockSelection(tag: CodeBlockTag): void {
  it("emits lr-text-select for a text selection spanning code lines", async () => {
    const el = await mount(tag, 'alpha\nbeta\ngamma');
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    // Lit inserts a static per-expression marker comment before the dynamic text node it commits,
    // so the real Text node is not reliably `firstChild` -- find it directly instead of assuming a
    // fixed sibling position (same precedent as terminal.test.ts's identical selection test).
    const textNodeOf = (line: Element): Node =>
      line.querySelector(".line-source")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 0);
    range.setEnd(textNodeOf(line2), 2);
    // `ShadowRoot.getSelection` is a Chromium-only extension -- same precedent the component
    // itself documents for onBodyMouseUp(). Falls back to window.getSelection() otherwise.
    const shadowSelection = (
      el.shadowRoot as unknown as { getSelection?: () => Selection | null }
    ).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    // WebKit rejects a programmatic Selection whose endpoints live in a shadow tree. Its native
    // drag selection is exposed through getComposedRanges(), so provide that same range shape when
    // the setup was rejected and restore the browser global in finally.
    const needsSelectionFacade =
      selection.rangeCount === 0 || selection.isCollapsed;
    const ownGetSelectionDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "getSelection"
    );
    if (needsSelectionFacade) {
      const composedRange = {
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      } as StaticRange;
      const facade = {
        getComposedRanges: () => [composedRange],
      } as unknown as Selection;
      Object.defineProperty(window, "getSelection", {
        configurable: true,
        value: () => facade,
      });
    }
    try {
      const listener = oneEvent(el, "lr-text-select");
      body.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, composed: true })
      );
      const event = (await listener) as CustomEvent<{
        text: string;
        anchor: unknown;
      }>;
      expect(event.detail.anchor).to.deep.equal({
        kind: "line-range",
        start: 1,
        end: 2,
      });
      expect(event.detail.text.length).to.be.greaterThan(0);
    } finally {
      selection.removeAllRanges();
      if (needsSelectionFacade) {
        if (ownGetSelectionDescriptor) {
          Object.defineProperty(
            window,
            "getSelection",
            ownGetSelectionDescriptor
          );
        } else {
          Reflect.deleteProperty(window, "getSelection");
        }
      }
    }
  });

}
