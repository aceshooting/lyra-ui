import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { supportsCustomHighlights } from '../../src/internal/text-highlights.js';
import type { MarkdownRuntimeBase } from '../../src/components/conversation/markdown/markdown-base.class.js';

export function assertMarkdownHighlightActivation(tag: 'lr-markdown' | 'lr-markdown-core'): void {
  async function mount(content: string, prefix?: string): Promise<MarkdownRuntimeBase> {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = document.createElement(tag) as MarkdownRuntimeBase;
    el.content = content;
    if (prefix) el.setAttribute('internal-link-prefix', prefix);
    wrapper.appendChild(el);
    await el.updateComplete;
    return el;
  }

  function highlightPainted(el: MarkdownRuntimeBase): boolean {
    if (supportsCustomHighlights()) {
      const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
      return (registry.get('lr-highlight-accent')?.size ?? 0) > 0;
    }
    return el.shadowRoot!.querySelector('[part="content"] mark[data-lr-highlight-tone="accent"]') !== null;
  }

  function withNavigationBlocked<T>(run: () => T): T {
    const blockNav = (event: Event): void => event.preventDefault();
    document.addEventListener('click', blockNav, { capture: true });
    try { return run(); }
    finally { document.removeEventListener('click', blockNav, { capture: true }); }
  }

  async function observeLinkDefault(anchor: Element, activate: () => void | Promise<void>): Promise<{ seen: boolean; defaultPrevented: boolean }> {
    let seen = false;
    let defaultPrevented = false;
    const observe = (event: Event): void => {
      if (!event.composedPath().includes(anchor)) return;
      seen = true;
      defaultPrevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', observe);
    try { await activate(); }
    finally { document.removeEventListener('click', observe); }
    return { seen, defaultPrevented };
  }

  it("emits lr-highlight-activate when a painted highlight is clicked", async () => {
    const el = await mount('Hello world');
    el.highlights = [
      { id: "h1", anchor: { kind: "text-quote", quote: "world" } },
    ];
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="paragraph"]') !== null
    );
    await el.updateComplete;

    const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
    const textNode = paragraph.firstChild as Text;
    const offset = textNode.data.indexOf("world");
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.setEnd(textNode, offset + "world".length);
    const rect = range.getClientRects()[0];

    const listener = oneEvent(el, "lr-highlight-activate");
    paragraph.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        composed: true,
        clientX: rect!.left + rect!.width / 2,
        clientY: rect!.top + rect!.height / 2,
      })
    );
    const event = await listener;
    expect((event as CustomEvent).detail).to.deep.equal({ highlightId: "h1" });
  });

  it("does not activate a highlight, and falls through to normal link handling, on a click elsewhere in the content", async () => {
    const el = await mount('Hello [world](/docs/world) and highlighted brown fox', '/docs/');
    el.highlights = [
      { id: "h1", anchor: { kind: "text-quote", quote: "brown fox" } },
    ];
    await waitUntil(() => el.shadowRoot!.querySelector("a") !== null);
    await el.updateComplete;

    let highlightFired = false;
    el.addEventListener("lr-highlight-activate", () => (highlightFired = true));
    const listener = oneEvent(el, "lr-link-activate");
    withNavigationBlocked(() =>
      (el.shadowRoot!.querySelector("a") as HTMLElement).click()
    );
    const { detail } = await listener;
    expect(detail).to.deep.equal({ href: "/docs/world" });
    expect(highlightFired).to.be.false;
  });

  it("activates an overlapping internal link highlight before its link event and prevents navigation for native, pointer, and keyboard clicks", async () => {
    const el = await mount('[linked text](/docs/link)', '/docs/');
    el.highlights = [
      { id: "linked-highlight", anchor: { kind: "text-quote", quote: "linked text" } },
    ];
    await waitUntil(() => el.shadowRoot!.querySelector("a") !== null);
    await waitUntil(() => highlightPainted(el));
    const anchor = el.shadowRoot!.querySelector("a")!;
    const range = document.createRange();
    range.selectNodeContents(anchor);
    const rect = range.getClientRects()[0]!;
    const order: string[] = [];
    const details: unknown[] = [];
    el.addEventListener("lr-highlight-activate", (event) => {
      order.push("highlight");
      details.push((event as CustomEvent).detail);
    });
    el.addEventListener("lr-link-activate", (event) => {
      order.push("link");
      details.push((event as CustomEvent).detail);
    });

    const assertInternalActivation = async (
      activate: () => void | Promise<void>
    ): Promise<void> => {
      const observed = await observeLinkDefault(anchor, activate);
      expect(observed.seen).to.be.true;
      expect(observed.defaultPrevented).to.be.true;
      expect(order).to.deep.equal(["highlight", "link"]);
      expect(details).to.deep.equal([
        { highlightId: "linked-highlight" },
        { href: "/docs/link" },
      ]);
      order.length = 0;
      details.length = 0;
    };

    await assertInternalActivation(() => anchor.click());
    await assertInternalActivation(() => {
      anchor.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          composed: true,
          detail: 1,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        })
      );
    });
    anchor.focus();
    await assertInternalActivation(() => sendKeys({ press: "Enter" }));
  });

}
