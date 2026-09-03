import { render } from "lit";
import { expect } from "@open-wc/testing";
import {
  CodeBlockInteractionController,
  codeBlockActiveHighlightLineSet,
  codeBlockEventLine,
  codeBlockLineHasFocus,
  codeBlockLineHighlightSet,
  codeBlockLineTransformer,
  parseHighlightLines,
  renderCodeBlockPlainCode,
  restoreCodeBlockLineFocus,
  scrollCodeBlockToAnchor,
} from "./code-block-shared.js";
import type { LyraHighlight } from '../../viewers/document-viewer/anchors.js';

type LitWarningRuntime = typeof globalThis & { litIssuedWarnings?: Set<string> };

function breakActiveElement(root: DocumentOrShadowRoot): () => void {
  Object.defineProperty(root, 'activeElement', {
    configurable: true,
    get(): never {
      throw new Error('active-element getter failed');
    },
  });
  return () => {
    delete (root as unknown as Record<string, unknown>)['activeElement'];
  };
}

describe("parseHighlightLines", () => {
  it("parses a single range", () => {
    expect([...parseHighlightLines("3-5")].sort((a, b) => a - b)).to.deep.equal(
      [3, 4, 5]
    );
  });

  it("parses multiple comma-separated segments, tolerating whitespace", () => {
    expect(
      [...parseHighlightLines(" 3-5, 7 ")].sort((a, b) => a - b)
    ).to.deep.equal([3, 4, 5, 7]);
  });

  it("normalizes a reversed range", () => {
    expect([...parseHighlightLines("5-3")].sort((a, b) => a - b)).to.deep.equal(
      [3, 4, 5]
    );
  });

  it("merges overlapping ranges into a set with no duplicates", () => {
    expect(
      [...parseHighlightLines("1-3,2-4")].sort((a, b) => a - b)
    ).to.deep.equal([1, 2, 3, 4]);
  });

  it('uses one fixed, bounded development diagnostic without exposing highlight values', () => {
    const runtime = globalThis as LitWarningRuntime;
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const originalWarn = console.warn;
    const messages: string[] = [];
    runtime.litIssuedWarnings = new Set();
    console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
    try {
      expect(
        [...parseHighlightLines('2,private-highlight-value,4')].sort((a, b) => a - b)
      ).to.deep.equal([2, 4]);
      expect(
        [...parseHighlightLines('2,private-highlight-value,4')].sort((a, b) => a - b)
      ).to.deep.equal([2, 4]);
      expect(messages).to.have.lengthOf(1);
      expect(messages[0]).to.contain('highlight-lines');
      const diagnostics = messages.join('\n');
      expect(diagnostics).to.not.contain('private-highlight-value');

      messages.length = 0;
      delete runtime.litIssuedWarnings;
      expect(
        [...parseHighlightLines('2,private-highlight-value,4')].sort((a, b) => a - b)
      ).to.deep.equal([2, 4]);
      expect(messages).to.deep.equal([]);
    } finally {
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
      console.warn = originalWarn;
    }
  });

  it("returns an empty set for an empty string", () => {
    expect(parseHighlightLines("").size).to.equal(0);
  });

  it("bounds arbitrarily large ranges to the rendered line count", () => {
    expect([...parseHighlightLines("1-999999999", 3)]).to.deep.equal([1, 2, 3]);
  });
});

describe('malformed highlight boundaries', () => {
  const malformedCollections: readonly unknown[] = [
    null,
    [null],
    'not-a-collection',
    [{ id: 'missing-anchor' }],
  ];

  for (const malformed of malformedCollections) {
    const label = malformed === null ? 'null' : JSON.stringify(malformed);

    it(`ignores ${label} while building the merged line-highlight set`, () => {
      const result = codeBlockLineHighlightSet(
        '',
        malformed as readonly LyraHighlight[],
        10,
      );
      expect(result.size).to.equal(0);
    });

    it(`ignores ${label} while building the active-highlight set`, () => {
      const result = codeBlockActiveHighlightLineSet(
        malformed as readonly LyraHighlight[],
        'missing-anchor',
        10,
      );
      expect(result.size).to.equal(0);
    });
  }
});

describe("codeBlockLineTransformer", () => {
  it('normalizes scalar and absent pre classes while removing shiki tabindex', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: true,
      activatableLines: false,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set(),
      lineLabel: String,
      lineNumberText: String,
    });
    const scalar = { properties: { class: 'language-ts', tabindex: '0' } as Record<string, unknown> };
    const array = { properties: { class: ['language-js', 7] } as Record<string, unknown> };
    const absent = { properties: {} as Record<string, unknown> };

    transformer.pre!(scalar);
    transformer.pre!(array);
    transformer.pre!(absent);

    expect(scalar.properties['class']).to.deep.equal(['language-ts', 'line-numbers']);
    expect(scalar.properties).not.to.have.property('tabindex');
    expect(array.properties['class']).to.deep.equal(['language-js', '7', 'line-numbers']);
    expect(absent.properties['class']).to.deep.equal(['line-numbers']);
  });

  it("stamps data-line, data-highlighted, and part on a highlighted line node", () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      activatableLines: false,
      focusedLine: 1,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      lineLabel: () => "",
      lineNumberText: String,
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line!(node, 2);
    expect(node.properties["data-line"]).to.equal("2");
    expect(node.properties["data-highlighted"]).to.equal("");
    expect(node.properties['part']).to.deep.equal(["line-highlight"]);
  });

  it("does not stamp part on a non-highlighted line", () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      activatableLines: false,
      focusedLine: 1,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      lineLabel: () => "",
      lineNumberText: String,
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line!(node, 5);
    expect(node.properties['part']).to.equal(undefined);
    expect(node.properties["data-highlighted"]).to.equal(undefined);
  });

  it("stamps data-active for an active line", () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      activatableLines: false,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set([3]),
      lineLabel: () => "",
      lineNumberText: String,
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line!(node, 3);
    expect(node.properties["data-active"]).to.equal("");
  });

  it("prepends a named gutter button without turning highlighted source text into a control", () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: true,
      activatableLines: true,
      focusedLine: 2,
      highlightedLines: new Set(),
      activeLines: new Set(),
      lineLabel: (line) => `Line ${line}`,
      lineNumberText: String,
    });
    const node = {
      properties: {} as Record<string, unknown>,
      children: [] as unknown[],
    };
    transformer.line!(node, 2);
    expect(node.properties['part']).to.equal(undefined);
    expect(node.properties['role']).to.equal(undefined);
    const gutter = node.children[0] as {
      tagName: string;
      properties: Record<string, unknown>;
      children: unknown[];
    };
    expect(gutter.tagName).to.equal("button");
    expect(gutter.properties['part']).to.deep.equal(["line-button"]);
    expect(gutter.properties['tabindex']).to.equal("0");
    expect(gutter.properties["aria-label"]).to.equal("Line 2");
    const source = node.children[1] as {
      tagName: string;
      properties: Record<string, unknown>;
    };
    expect(source.tagName).to.equal("span");
    expect(source.properties['class']).to.deep.equal(["line-source"]);
  });
});

// renderCodeBlockPlainCode() replaces a formerly duplicated private method on both
// <lr-code-block> and <lr-code-block-core>. It is
// exercised here directly (in isolation from either custom element) so both components' own tests
// only need to prove they delegate to it, not re-prove its rendering logic.
describe("renderCodeBlockPlainCode", () => {
  const localize = (
    key: string,
    _fallback?: string,
    values?: Record<string, string | number>
  ): string => (values ? `${key}:${JSON.stringify(values)}` : key);

  function renderInto(
    options: Parameters<typeof renderCodeBlockPlainCode>[0]
  ): HTMLElement {
    const container = document.createElement("div");
    render(renderCodeBlockPlainCode(options), container);
    return container;
  }

  it('renders one non-interactive <span class="line"> per line, carrying data-line', () => {
    const container = renderInto({
      code: "first\nsecond",
      lineNumbers: true,
      activatableLines: false,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set(),
      localize,
      lineLabel: (line) => `Line ${line}`,
      lineNumberText: String,
      onLineActivate: () => {},
      onLineKeyDown: () => {},
    });
    const lines = container.querySelectorAll(".line");
    expect(lines).to.have.lengthOf(2);
    expect(lines[0]!.tagName).to.equal("SPAN");
    expect(lines[0]!.getAttribute("data-line")).to.equal("1");
    expect(lines[1]!.getAttribute("data-line")).to.equal("2");
  });

  it("renders a separately named gutter button and keeps source text outside it", () => {
    const container = renderInto({
      code: "a\nb\nc",
      lineNumbers: true,
      activatableLines: true,
      focusedLine: 2,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
      localize,
      lineLabel: (line) => `Line ${line}`,
      lineNumberText: String,
      onLineActivate: () => {},
      onLineKeyDown: () => {},
    });
    const buttons = container.querySelectorAll("button.line-gutter");
    expect(buttons).to.have.lengthOf(3);
    expect(buttons[0]!.getAttribute("tabindex")).to.equal("-1");
    expect(buttons[1]!.getAttribute("tabindex")).to.equal("0");
    expect(buttons[1]!.getAttribute("part")).to.equal("line-button");
    expect(buttons[1]!.getAttribute("aria-label")).to.equal("Line 2");
    expect(buttons[1]!.closest(".line")?.getAttribute("part")).to.equal(
      "line-highlight"
    );
  });

  it("invokes onLineActivate/onLineKeyDown with the clicked/pressed line number", () => {
    const activated: number[] = [];
    const keyed: Array<{ key: string; line: number }> = [];
    const container = renderInto({
      code: "a\nb",
      lineNumbers: true,
      activatableLines: true,
      focusedLine: 1,
      highlightedLines: new Set(),
      activeLines: new Set(),
      localize,
      lineLabel: (line) => `Line ${line}`,
      lineNumberText: String,
      onLineActivate: (line) => activated.push(line),
      onLineKeyDown: (e, line) => keyed.push({ key: e.key, line }),
    });
    const buttons = container.querySelectorAll("button.line-gutter");
    (buttons[1] as HTMLButtonElement).click();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    expect(activated).to.deep.equal([2]);
    expect(keyed).to.deep.equal([{ key: "ArrowDown", line: 1 }]);
  });
});

describe("owner-realm line interactions", () => {
  const matchMedia = (ownerWindow: Window, matches: boolean): typeof window.matchMedia => {
    const originalMatchMedia = ownerWindow.matchMedia;
    return (query: string) => {
      const nativeQuery = originalMatchMedia.call(ownerWindow, query);
      return new Proxy(nativeQuery, {
        get(target, property) {
          if (property === 'matches') return matches;
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    };
  };

  function anchorHost(ownerDocument: Document): {
    host: Parameters<typeof scrollCodeBlockToAnchor>[0];
    readBehavior: () => ScrollBehavior | undefined;
  } {
    const root = ownerDocument.createElement("div");
    const body = ownerDocument.createElement("div");
    const line = ownerDocument.createElement("span");
    body.setAttribute("part", "body");
    line.dataset["line"] = "1";
    body.append(line);
    root.append(body);
    let behavior: ScrollBehavior | undefined;
    body.scrollTo = ((options: ScrollToOptions) => {
      behavior = options.behavior;
    }) as typeof body.scrollTo;
    return {
      host: {
        code: "line one",
        highlights: [],
        renderRoot: root,
        updateComplete: Promise.resolve(true),
      },
      readBehavior: () => behavior,
    };
  }

  it("uses an iframe-owned body's reduced-motion preference when scrolling to an anchor", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const ownerWindow = frame.contentWindow!;
    const originalTopMatchMedia = window.matchMedia;
    const originalOwnerMatchMedia = ownerWindow.matchMedia;
    const { host, readBehavior } = anchorHost(frame.contentDocument!);
    try {
      window.matchMedia = matchMedia(window, false);
      ownerWindow.matchMedia = matchMedia(ownerWindow, true);
      expect(
        await scrollCodeBlockToAnchor(host, { kind: "line-range", start: 1 })
      ).to.be.true;
      expect(readBehavior()).to.equal("auto");
    } finally {
      window.matchMedia = originalTopMatchMedia;
      ownerWindow.matchMedia = originalOwnerMatchMedia;
      frame.remove();
    }
  });

  it("fails closed to non-animated scrolling when the body belongs to an ownerless document", async () => {
    const ownerlessDocument =
      document.implementation.createHTMLDocument("ownerless");
    const originalMatchMedia = window.matchMedia;
    const { host, readBehavior } = anchorHost(ownerlessDocument);
    try {
      window.matchMedia = matchMedia(window, false);
      expect(ownerlessDocument.defaultView === null).to.be.true;
      expect(
        await scrollCodeBlockToAnchor(host, { kind: "line-range", start: 1 })
      ).to.be.true;
      expect(readBehavior()).to.equal("auto");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("recognizes an interactive line from a foreign-realm composed path", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    try {
      const line = frame.contentDocument!.createElement("button");
      line.dataset["line"] = "4";
      line.setAttribute("part", "line-button");
      const event = { composedPath: () => [line] } as unknown as Event;
      expect(codeBlockEventLine(event)).to.equal(4);
    } finally {
      frame.remove();
    }
  });

  it('rejects non-element and invalid line event targets', () => {
    expect(codeBlockEventLine({ composedPath: () => ['line'] } as unknown as Event)).to.equal(null);
    const button = document.createElement('button');
    button.dataset['line'] = '0';
    button.setAttribute('part', 'line-button');
    expect(codeBlockEventLine({ composedPath: () => [button] } as unknown as Event)).to.equal(null);
  });

  it('does not steal focus from an external control during line restoration', () => {
    const element = document.createElement('div');
    const root = element.attachShadow({ mode: 'open' });
    const host = Object.assign(element, { renderRoot: root });
    const line = document.createElement('button');
    line.dataset['line'] = '1';
    line.setAttribute('part', 'line-button');
    root.append(line);
    const external = document.createElement('button');
    document.body.append(host, external);
    try {
      external.focus();
      expect(restoreCodeBlockLineFocus(host, 1)).to.equal(false);
      expect(document.activeElement === external).to.equal(true);
    } finally {
      host.remove();
      external.remove();
    }
  });

  it('restores a replaced focused line when the owner document activeElement getter throws', () => {
    const element = document.createElement('div');
    const root = element.attachShadow({ mode: 'open' });
    const host = Object.assign(element, { renderRoot: root });
    const focusedLine = document.createElement('button');
    focusedLine.dataset['line'] = '1';
    focusedLine.setAttribute('part', 'line-button');
    const replacement = focusedLine.cloneNode() as HTMLButtonElement;
    root.append(focusedLine);
    document.body.append(host);
    let restore: (() => void) | undefined;
    try {
      focusedLine.focus();
      focusedLine.remove();
      root.append(replacement);
      restore = breakActiveElement(host.ownerDocument);
      let restored = false;
      expect(() => {
        restored = restoreCodeBlockLineFocus(host, 1);
      }).to.not.throw();
      expect(restored).to.equal(true);
      expect(root.activeElement === replacement).to.equal(true);
    } finally {
      restore?.();
      host.remove();
    }
  });

  it('restores a replaced focused line when a partial owner document has no activeElement', () => {
    const element = document.createElement('div');
    const root = element.attachShadow({ mode: 'open' });
    const host = Object.assign(element, { renderRoot: root });
    const focusedLine = document.createElement('button');
    focusedLine.dataset['line'] = '1';
    focusedLine.setAttribute('part', 'line-button');
    const replacement = focusedLine.cloneNode() as HTMLButtonElement;
    root.append(focusedLine);
    document.body.append(host);
    try {
      focusedLine.focus();
      focusedLine.remove();
      root.append(replacement);
      Object.defineProperty(host, 'ownerDocument', {
        configurable: true,
        value: { body: document.body },
      });
      expect(restoreCodeBlockLineFocus(host, 1)).to.equal(true);
      expect(root.activeElement === replacement).to.equal(true);
    } finally {
      delete (host as unknown as Record<string, unknown>)['ownerDocument'];
      host.remove();
    }
  });

  it('contains a throwing shadow-root activeElement getter during update focus checks', () => {
    const element = document.createElement('div');
    const root = element.attachShadow({ mode: 'open' });
    const host = Object.assign(element, { renderRoot: root });
    const line = document.createElement('button');
    line.dataset['line'] = '1';
    line.setAttribute('part', 'line-button');
    root.append(line);
    document.body.append(host);
    const restore = breakActiveElement(root);
    try {
      expect(() => codeBlockLineHasFocus(host)).to.not.throw();
      expect(codeBlockLineHasFocus(host)).to.equal(false);
      expect(() => restoreCodeBlockLineFocus(host, 1)).to.not.throw();
    } finally {
      restore();
      host.remove();
    }
  });

  it('routes delegated gutter key events through roving focus', async () => {
    const element = document.createElement('div');
    const root = element.attachShadow({ mode: 'open' });
    const host = Object.assign(element, {
      renderRoot: root,
      updateComplete: Promise.resolve(true),
      code: 'first\nsecond',
      collapsed: false,
    });
    const first = document.createElement('button');
    const second = document.createElement('button');
    for (const [index, button] of [first, second].entries()) {
      button.dataset['line'] = String(index + 1);
      button.setAttribute('part', 'line-button');
      root.append(button);
    }
    const focused: number[] = [];
    const controller = new CodeBlockInteractionController({
      host,
      setFocusedLine: (line) => focused.push(line),
      setJustCopied: () => undefined,
      setCopyFailed: () => undefined,
      setDarkTheme: () => undefined,
      emitLineActivate: () => undefined,
      emitCopy: () => undefined,
      emitError: () => undefined,
      emitCopyError: () => undefined,
      requestToggle: () => true,
      emitToggle: () => undefined,
      emitTextSelect: () => undefined,
    });
    root.addEventListener('keydown', controller.onBodyKeyDown as EventListener);
    document.body.append(host);
    try {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      first.dispatchEvent(event);
      await Promise.resolve();

      expect(event.defaultPrevented).to.equal(true);
      expect(focused).to.deep.equal([2]);
      expect(root.activeElement === second).to.equal(true);
    } finally {
      host.remove();
    }
  });
});
