import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { MarkdownRuntimeBase } from '../../src/components/conversation/markdown/markdown-base.class.js';

export function assertMarkdownSanitizerDiagnostics(tag: 'lr-markdown' | 'lr-markdown-core'): void {
  async function mount(): Promise<MarkdownRuntimeBase> {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = document.createElement(tag) as MarkdownRuntimeBase;
    el.content = '**bold**';
    wrapper.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it("uses one fixed sanitizer diagnostic in development, stays silent in production, and preserves the sanitize fallback", async () => {
    const el = await mount();
    type Internals = {
      deps?: { marked: unknown; DOMPurify: unknown };
      renderMarkdown(): void;
    };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;
    expect(
      internals.deps!.marked,
      "precondition: marked must have actually loaded"
    ).to.exist;

    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    runtime.litIssuedWarnings = new Set();
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(" "));
    try {
      const renderFallback = async (): Promise<void> => {
        const listener = oneEvent(el, "lr-render-error");
        internals.deps = { marked: internals.deps!.marked, DOMPurify: undefined };
        internals.renderMarkdown();
        const { detail } = await listener;
        expect(detail.error).to.exist;
      };
      await renderFallback();
      await renderFallback();
      expect(messages).to.deep.equal([
        "<lr-markdown>/<lr-markdown-core>: HTML sanitization is unavailable because the optional DOMPurify peer could not load. Content is rendered as plain text unless trusted HTML is explicitly selected.",
      ]);

      messages.length = 0;
      delete runtime.litIssuedWarnings;
      await renderFallback();
      expect(messages).to.deep.equal([]);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }

    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part="content"]')!
        .hasAttribute("data-fallback")
    ).to.be.true;
  });

  it("fails closed with the bounded sanitizer diagnostic when a capability-valid sanitizer throws", async () => {
    const el = await mount();
    type Internals = {
      deps?: { marked: unknown; DOMPurify: unknown };
      renderMarkdown(): void;
    };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;
    const failure = new Error("private sanitizer failure");
    const errors: unknown[] = [];
    const onRenderError = (event: Event): void => {
      errors.push((event as CustomEvent<{ error: unknown }>).detail.error);
    };
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    runtime.litIssuedWarnings = new Set();
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(" "));
    el.addEventListener("lr-render-error", onRenderError);
    try {
      const renderFallback = (): void => {
        internals.deps = {
          marked: internals.deps!.marked,
          DOMPurify: {
            sanitize(): never {
              throw failure;
            },
          },
        };
        expect(() => internals.renderMarkdown()).to.not.throw();
      };
      renderFallback();
      renderFallback();
      expect(messages).to.deep.equal([
        "<lr-markdown>/<lr-markdown-core>: HTML sanitization is unavailable because the optional DOMPurify peer could not load. Content is rendered as plain text unless trusted HTML is explicitly selected.",
      ]);
      expect(messages.join(" ")).to.not.contain(failure.message);

      messages.length = 0;
      delete runtime.litIssuedWarnings;
      renderFallback();
      expect(messages).to.deep.equal([]);
    } finally {
      el.removeEventListener("lr-render-error", onRenderError);
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }

    expect(errors).to.have.lengthOf(3);
    expect(errors.every((error) => error === failure)).to.equal(true);
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part="content"]')!
        .hasAttribute("data-fallback")
    ).to.be.true;
  });

}
