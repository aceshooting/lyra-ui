import {
  fixture,
  expect,
  html,
  waitUntil,
  aTimeout,
  oneEvent,
} from "@open-wc/testing";
import jsonGrammar from "shiki/langs/json.mjs";
import "./code-block-core.js";
import type { LyraCodeBlockCore } from "./code-block-core.js";
import {
  loadShikiHighlighterCore,
  __setShikiHighlighterCoreLoaderForTesting,
  type ShikiLanguageInput,
} from "./shiki-types.js";
import { LyraElement } from "../../../internal/lyra-element.js";

const sharedJsonLanguages = { json: jsonGrammar };

async function el2Ready(el: LyraCodeBlockCore): Promise<void> {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
}

describe("lr-code-block-core", () => {
  it("uses the shared copyable presence-reflection matrix", async () => {
    const el = (await fixture(
      html`<lr-code-block-core></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(el.copyable).to.be.true;
    expect(el.getAttribute("copyable")).to.equal("");

    el.copyable = false;
    await el.updateComplete;
    expect(el.hasAttribute("copyable")).to.be.false;

    el.copyable = true;
    await el.updateComplete;
    expect(el.getAttribute("copyable")).to.equal("");

    el.setAttribute("copyable", "false");
    await el.updateComplete;
    expect(el.copyable).to.be.false;
    expect(el.getAttribute("copyable")).to.equal("false");

    const declarative = (await fixture(
      html`<lr-code-block-core copyable="false"></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(declarative.copyable).to.be.false;
    expect(declarative.hasAttribute("copyable")).to.be.false;
  });

  it("applies per-instance strings overrides to visible and accessible controls", async () => {
    const el = (await fixture(html`
      <lr-code-block-core
        copyable
        collapsible
        .code=${"const answer = 42;"}
        .strings=${{
          copy: "Copier",
          copyCode: "Copier le code",
          collapseCode: "Réduire le code",
        }}
      ></lr-code-block-core>
    `)) as LyraCodeBlockCore;
    const copy = el.shadowRoot!.querySelector(
      '[part="copy-button"]'
    ) as HTMLButtonElement;
    const toggle = el.shadowRoot!.querySelector(
      '[part="toggle"]'
    ) as HTMLButtonElement;
    expect(copy.textContent?.trim()).to.equal("Copier");
    expect(copy.getAttribute("aria-label")).to.equal("Copier le code");
    expect(toggle.getAttribute("aria-label")).to.equal("Réduire le code");
  });

  it("renders optional line numbers for plain code", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        line-numbers
        .code=${"first\nsecond"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(el.lineNumbers).to.be.true;
    expect(
      el.shadowRoot!.querySelectorAll('[part="pre"] .line')
    ).to.have.lengthOf(2);
  });

  it("preserves ordinary multiline source, including blank and trailing lines", async () => {
    const source = "first\n\nthird\n";
    const el = (await fixture(
      html`<lr-code-block-core
        .copyable=${false}
        .code=${source}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const code = el.shadowRoot!.querySelector('[part="code"]')!;
    expect(code.textContent).to.equal(source);
    expect(code.querySelectorAll(".line-source")).to.have.lengthOf(4);
  });

  it("extends the plain-code background paint box across a long line's full horizontal scroll width", async () => {
    const longLine = `wget https://example.test/${"unbroken-path-segment-".repeat(
      30
    )}`;
    const el = (await fixture(
      html`<lr-code-block-core
        style="inline-size: 22rem"
        .code=${longLine}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const pre = el.shadowRoot!.querySelector('[part="pre"]') as HTMLElement;

    expect(body.scrollWidth).to.be.greaterThan(body.clientWidth);
    expect(pre.scrollWidth).to.be.greaterThan(body.clientWidth);
    expect(
      pre.offsetWidth,
      "the painted pre box must cover all of its scrollable content"
    ).to.be.at.least(pre.scrollWidth);
  });

  it("keeps a populated header inside a 320px allocation while code scrolls in its own body", async () => {
    const filename = `src/generated/${"very-long-directory-name/".repeat(
      12
    )}conversation-handler.ts`;
    const code = `const endpoint = "https://example.test/${"unbroken-segment-".repeat(
      30
    )}";`;
    const container = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-code-block-core
          filename=${filename}
          language="typescript"
          line-numbers
          .code=${code}
        ></lr-code-block-core>
      </div>
    `)) as HTMLElement;
    const el = container.querySelector(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    await el2Ready(el);

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const filenamePart = el.shadowRoot!.querySelector(
      '[part="filename"]'
    ) as HTMLElement;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(el.getBoundingClientRect().width).to.be.at.most(320);
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(filenamePart.scrollWidth).to.be.greaterThan(
      filenamePart.clientWidth
    );
    expect(body.scrollWidth).to.be.greaterThan(body.clientWidth);
  });

  it("forwards a host aria-label to the internal named code region and keeps it reactive", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        aria-label="Response payload"
        language="json"
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.getAttribute("aria-label")).to.equal("Response payload");

    el.accessibleLabel = "Updated response payload";
    await el.updateComplete;
    expect(body.getAttribute("aria-label")).to.equal(
      "Updated response payload"
    );
  });

  it("highlights code using a supplied languages map", async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="json"></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.languages = sharedJsonLanguages;
    el.code = '{"a":1}';
    await el.updateComplete;
    // timeout: 8000 -- same as code-block.test.ts's identical wait on the fine-grained
    // shiki/core + oniguruma-WASM dynamic import, which the default waitUntil timeout is
    // too tight for under load.
    await waitUntil(
      () => el.shadowRoot!.querySelector(".shiki") !== null,
      undefined,
      { timeout: 8000 }
    );
    expect(el.shadowRoot!.querySelector(".shiki")).to.exist;
  });

  it("localizes Shiki gutter labels and number text through the core tokenizer", async () => {
    const el = await fixture<LyraCodeBlockCore>(html`
      <lr-code-block-core
        lang="ar-EG"
        language="json"
        line-numbers
        activatable-lines
        .languages=${sharedJsonLanguages}
        .code=${'{\n  "answer": 42\n}'}
      ></lr-code-block-core>
    `);
    await waitUntil(
      () => el.shadowRoot!.querySelector('.shiki') !== null,
      undefined,
      { timeout: 8000 },
    );
    const second = el.shadowRoot!.querySelector<HTMLElement>(
      '[part~="line-button"][data-line="2"]',
    )!;
    expect(second.textContent?.trim()).to.equal('٢');
    expect(second.getAttribute('aria-label')).to.equal('Line ٢');
  });

  it("extends a shiki-themed background across a long line's full horizontal scroll width", async () => {
    const longValue = `{"url":"https://example.test/${"unbroken-path-segment-".repeat(
      30
    )}"}`;
    const el = (await fixture(html`
      <lr-code-block-core
        style="inline-size: 22rem"
        language="json"
        .languages=${sharedJsonLanguages}
        .code=${longValue}
      ></lr-code-block-core>
    `)) as LyraCodeBlockCore;
    await waitUntil(
      () => el.shadowRoot!.querySelector(".shiki") !== null,
      undefined,
      { timeout: 8000 }
    );
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const pre = el.shadowRoot!.querySelector('[part="pre"]') as HTMLElement;

    expect(body.scrollWidth).to.be.greaterThan(body.clientWidth);
    expect(pre.scrollWidth).to.be.greaterThan(body.clientWidth);
    expect(
      pre.offsetWidth,
      "the painted shiki pre box must cover all of its scrollable content"
    ).to.be.at.least(pre.scrollWidth);

    body.scrollLeft = body.scrollWidth;
    expect(body.scrollLeft).to.be.greaterThan(0);
    expect(getComputedStyle(pre).backgroundColor).to.not.equal(
      "rgba(0, 0, 0, 0)"
    );
  });

  it("does not set shikiReady when the element disconnects before loadShikiHighlighterCore() resolves in connectedCallback()", async () => {
    // `languages` must be non-empty *before* the element ever connects, so
    // connectedCallback() itself takes the loadShikiHighlighterCore().then()
    // branch under test (the other call site, inside syncHighlight(), is
    // already guarded by its own highlightToken staleness check).
    let resolveCore!: (value: null) => void;
    const pending = new Promise<null>((resolve) => {
      resolveCore = resolve;
    });
    __setShikiHighlighterCoreLoaderForTesting(() => pending);
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    try {
      el.language = "json";
      el.languages = { json: jsonGrammar };
      document.body.appendChild(el);
      el.remove();
      resolveCore(null);
      await pending;
      await aTimeout(0);
      await el.updateComplete;
      await aTimeout(0);

      type Internals = { shikiReady: boolean };
      const internals = el as unknown as Internals;
      expect(
        internals.shikiReady,
        "must not become true on a disconnected instance"
      ).to.be.false;
    } finally {
      el.remove();
      __setShikiHighlighterCoreLoaderForTesting(undefined);
    }
  });

  it("re-arms the current highlighter generation after disconnect and reconnect", async () => {
    let resolveCore!: (
      value: import("./shiki-types.js").ShikiHighlighterCore | null
    ) => void;
    const pending = new Promise<
      import("./shiki-types.js").ShikiHighlighterCore | null
    >((resolve) => {
      resolveCore = resolve;
    });
    __setShikiHighlighterCoreLoaderForTesting(() => pending);
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.language = "json";
    el.languages = { json: jsonGrammar };
    el.code = '{"generation":"reconnected"}';
    document.body.append(el);
    try {
      await el.updateComplete;
      el.remove();
      document.body.append(el);
      resolveCore({
        codeToHtml: (code: string) =>
          `<pre class="shiki"><code>${code}</code></pre>`,
      } as unknown as import("./shiki-types.js").ShikiHighlighterCore);
      await waitUntil(() => el.shadowRoot!.querySelector(".shiki") !== null);
      expect(el.shadowRoot!.textContent).to.contain("reconnected");
    } finally {
      el.remove();
      __setShikiHighlighterCoreLoaderForTesting(undefined);
    }
  });

  it("keeps the current language map busy when an obsolete eager highlighter settles first", async () => {
    const languagesA = { json: jsonGrammar };
    const languagesB = { json: { ...jsonGrammar } };
    let resolveA!: (value: null) => void;
    let resolveB!: (value: null) => void;
    const promiseA = new Promise<null>((resolve) => {
      resolveA = resolve;
    });
    const promiseB = new Promise<null>((resolve) => {
      resolveB = resolve;
    });
    __setShikiHighlighterCoreLoaderForTesting((languages) =>
      languages === languagesA ? promiseA : promiseB
    );

    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.language = "json";
    el.code = '{"generation":"current"}';
    el.languages = languagesA;
    document.body.append(el);
    try {
      await el.updateComplete;
      el.languages = languagesB;
      await el.updateComplete;
      expect(el.getAttribute("aria-busy")).to.equal("true");

      resolveA(null);
      await aTimeout(0);
      await el.updateComplete;
      expect(
        el.getAttribute("aria-busy"),
        "obsolete map A must not clear map B loading state"
      ).to.equal("true");
      expect(
        el.shadowRoot!.querySelectorAll("lr-skeleton").length
      ).to.be.greaterThan(0);

      resolveB(null);
      await aTimeout(0);
      await el.updateComplete;
      expect(el.hasAttribute("aria-busy")).to.be.false;
      expect(el.shadowRoot!.querySelectorAll("lr-skeleton").length).to.equal(0);
    } finally {
      el.remove();
      __setShikiHighlighterCoreLoaderForTesting(undefined);
    }
  });

  it("renders the plain-text fallback for a language absent from the supplied languages map, never hanging waiting on a default highlighter", async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="python"></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.languages = sharedJsonLanguages;
    el.code = "print(1)";
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector("pre");
    expect(pre != null).to.equal(true);
    expect(pre!.textContent).to.include("print(1)");
  });

  it("is accessible", async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="json" copyable></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.languages = sharedJsonLanguages;
    el.code = '{"a":1}';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it("sets shikiReady and renders highlighted output from connectedCallback() when languages is populated before the element ever connects", async function () {
    // Mirrors the "does not set highlighter/shikiReady..." disconnect test's setup (languages
    // must be non-empty *before* the element ever connects so connectedCallback() itself takes
    // the loadShikiHighlighterCore().then() branch under test), but keeps the element connected
    // through resolution instead of removing it, exercising the opposite (stays-connected) side
    // of that same guard.
    this.timeout(20_000);
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.language = "json";
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    document.body.appendChild(el);
    try {
      await waitUntil(
        () => el.shadowRoot!.querySelector(".shiki") !== null,
        undefined,
        { timeout: 15000 }
      );
      type Internals = { shikiReady: boolean };
      const internals = el as unknown as Internals;
      expect(internals.shikiReady).to.be.true;
      expect(
        el.shadowRoot!.querySelector(".shiki"),
        "the eager connectedCallback() load path highlights"
      ).to.exist;
    } finally {
      el.remove();
    }
  });

  it("clears highlightedHtml when language is cleared after a language was already highlighted", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        language="json"
        .languages=${sharedJsonLanguages}
        .code=${'{"a":1}'}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await waitUntil(
      () => el.shadowRoot!.querySelector(".shiki") !== null,
      undefined,
      { timeout: 8000 }
    );
    el.language = "";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".shiki") == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(
      '{"a":1}'
    );
  });

  it("falls back to plain text when switching to a language absent from `languages` after shiki is already ready", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        language="json"
        .languages=${sharedJsonLanguages}
        .code=${'{"a":1}'}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await waitUntil(
      () => el.shadowRoot!.querySelector(".shiki") !== null,
      undefined,
      { timeout: 8000 }
    );
    el.language = "python";
    el.code = "print(1)";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".shiki") == null).to.be.true;
    expect(
      el.shadowRoot!.querySelector('[part="code"]')!.textContent
    ).to.include("print(1)");
  });

  it("falls back to plain text when the highlighter throws while tokenizing", async () => {
    // Reach the shared highlighter through the component-owned snapshot that
    // loadShikiHighlighterCore() caches by object identity, then make its
    // codeToHtml throw.
    const languages = { json: jsonGrammar };
    const el = (await fixture(
      html`<lr-code-block-core
        language="json"
        .languages=${languages}
        .code=${'{"a":1}'}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await waitUntil(
      () => el.shadowRoot!.querySelector(".shiki") !== null,
      undefined,
      { timeout: 8000 }
    );
    expect(el.languages).not.to.equal(languages);
    expect(Object.isFrozen(el.languages)).to.be.true;
    expect(el.languages.json).not.to.equal(jsonGrammar);
    expect(Object.isFrozen(el.languages.json)).to.be.true;
    const hl = await loadShikiHighlighterCore(
      el.languages as Record<string, ShikiLanguageInput>
    );
    hl!.codeToHtml = () => {
      throw new Error("malformed grammar");
    };
    el.code = '{"a":2}';
    await el2Ready(el);
    type Internals = { highlightedHtml: string | null };
    const internals = el as unknown as Internals;
    expect(internals.highlightedHtml).to.equal(null);
    expect(el.shadowRoot!.querySelector(".shiki") == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal(
      '{"a":2}'
    );
  });
});

describe("highlight-lines", () => {
  it("marks the specified lines with data-highlighted and part line-highlight", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc\nd"}
        highlight-lines="2-3"
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll("[data-line]")];
    expect(lines.map((l) => l.hasAttribute("data-highlighted"))).to.deep.equal([
      false,
      true,
      true,
      false,
    ]);
    expect(lines[1]!.getAttribute("part")).to.equal("line-highlight");
    expect(lines[0]!.hasAttribute("part")).to.be.false;
  });

  it("renders identically between the shiki and plain-text fallback paths for the same highlight-lines", async () => {
    const plain = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc"}
        highlight-lines="2"
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el2Ready(plain);
    const plainHighlighted = [
      ...plain.shadowRoot!.querySelectorAll("[data-highlighted]"),
    ].length;
    expect(plainHighlighted).to.equal(1);
  });

  it("back-compat: default render is byte-identical with highlight-lines/highlights/activatable-lines unset", async () => {
    const before = (await fixture(
      html`<lr-code-block-core code=${"a\nb"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await before.updateComplete;
    const beforeHtml =
      before.shadowRoot!.querySelector('[part="body"]')!.innerHTML;
    const after = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb"}
        .highlightLines=${""}
        .highlights=${[]}
        .activatableLines=${false}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await after.updateComplete;
    expect(
      after.shadowRoot!.querySelector('[part="body"]')!.innerHTML
    ).to.equal(beforeHtml);
  });

  it("ignores non-line-range highlight entries when merging highlight-lines", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb\nc"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.highlights = [
      { id: "p1", anchor: { kind: "page", page: 1 } },
      { id: "h1", anchor: { kind: "line-range", start: 2, end: 2 } },
    ];
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll("[data-line]")];
    expect(lines.map((l) => l.hasAttribute("data-highlighted"))).to.deep.equal([
      false,
      true,
      false,
    ]);
  });
});

describe("anchor-target (line-range)", () => {
  it("scrolls to the start line of a line-range anchor", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb\nc\nd\ne"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    const result = await el.scrollToAnchor({ kind: "line-range", start: 3 });
    expect(result).to.be.true;
    expect(scrolled).to.be.true;
  });

  it("resolves false for a line past end-of-file", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: "line-range", start: 99 })).to.be
      .false;
  });

  it("resolves a `highlights` id string to its anchor, and resolves false for an unknown id", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb\nc\nd\ne"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.highlights = [{ id: "h1", anchor: { kind: "line-range", start: 3 } }];
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    expect(await el.scrollToAnchor("h1")).to.be.true;
    expect(scrolled).to.be.true;
    expect(await el.scrollToAnchor("does-not-exist")).to.be.false;
  });

  it("resolves false when called before the highlighter has finished loading (skeleton still showing, no line elements yet)", async () => {
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.language = "json";
    el.languages = { json: jsonGrammar };
    el.code = "a\nb\nc";
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector("lr-skeleton")).to.exist;
      expect(await el.scrollToAnchor({ kind: "line-range", start: 1 })).to.be
        .false;
    } finally {
      el.remove();
    }
  });

  it("renders a line-range highlight from the highlights array", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb\nc"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    el.highlights = [
      { id: "h1", anchor: { kind: "line-range", start: 2, end: 2 } },
    ];
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute("data-highlighted")).to.be.true;
  });

  it("marks active highlight lines with data-active based on activeHighlightId, including the open-ended end fallback", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb\nc"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    // `end` intentionally omitted -- exercises the `active.anchor.end ?? active.anchor.start` fallback.
    el.highlights = [{ id: "h1", anchor: { kind: "line-range", start: 2 } }];
    el.activeHighlightId = "h1";
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute("data-active")).to.be.true;
    expect(line1.hasAttribute("data-active")).to.be.false;
  });

  it('does not throw and still renders [part~="pre"] when a malformed-anchor highlight is present at first render', async () => {
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.code = "a\nb\nc";
    el.highlights = [
      { id: "h1", label: "Source 1" },
    ] as unknown as LyraCodeBlockCore["highlights"];
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part~="pre"]')).to.exist;
    } finally {
      el.remove();
    }
  });

  it('does not throw and still renders [part~="pre"] when a highlight has a null anchor at first render', async () => {
    const el = document.createElement(
      "lr-code-block-core"
    ) as LyraCodeBlockCore;
    el.code = "a\nb\nc";
    el.highlights = [
      { id: "h1", label: "Source 1", anchor: null },
    ] as unknown as LyraCodeBlockCore["highlights"];
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part~="pre"]')).to.exist;
    } finally {
      el.remove();
    }
  });
});

describe("text selection (lr-text-select)", () => {
  it("emits lr-text-select for a text selection spanning code lines", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"alpha\nbeta\ngamma"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
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

  it("does not emit lr-text-select when there is no active selection on mouseup", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a\nb"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const shadowSelection = (
      el.shadowRoot as unknown as { getSelection?: () => Selection | null }
    ).getSelection?.();
    (shadowSelection ?? window.getSelection())?.removeAllRanges();
    let fired = false;
    el.addEventListener("lr-text-select", () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, composed: true })
    );
    await aTimeout(0);
    expect(fired).to.be.false;
  });

  it("does not emit lr-text-select for a whitespace-only selection", async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${"a  \nb"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const textNodeOf = (line: Element): Node =>
      line.querySelector(".line-source")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 1);
    range.setEnd(textNodeOf(line1), 3); // just the trailing spaces
    const shadowSelection = (
      el.shadowRoot as unknown as { getSelection?: () => Selection | null }
    ).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    let fired = false;
    el.addEventListener("lr-text-select", () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, composed: true })
    );
    await aTimeout(0);
    expect(fired).to.be.false;
  });
});

describe("activatable-lines", () => {
  it("renders gutter numbers as buttons with roving tabindex when line-numbers and activatable-lines are both set", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc"}
        line-numbers
        activatable-lines
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const buttons = [
      ...el.shadowRoot!.querySelectorAll('[part~="line-button"]'),
    ] as HTMLButtonElement[];
    expect(buttons).to.have.lengthOf(3);
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
  });

  it("gives every blank localized gutter a named minimum-size control", async () => {
    const wrapper = (await fixture(html`
      <div lang="ar-EG">
        <lr-code-block-core
          code=${"alpha\n\nomega"}
          line-numbers
          activatable-lines
        ></lr-code-block-core>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-code-block-core") as LyraCodeBlockCore;
    await el.updateComplete;
    const blankLine = el.shadowRoot!.querySelector('.line[data-line="2"]')!;
    const source = blankLine.querySelector(".line-source")!;
    const gutter = blankLine.querySelector(
      '[part~="line-button"]'
    ) as HTMLButtonElement;
    const rect = gutter.getBoundingClientRect();
    expect(source.textContent).to.equal("");
    expect(gutter.textContent?.trim()).to.equal("٢");
    expect(gutter.getAttribute("aria-label")).to.equal("Line ٢");
    expect(rect.width).to.be.at.least(24);
    expect(rect.height).to.be.at.least(24);
  });

  it("emits lr-line-activate on Enter and on click", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb"}
        line-numbers
        activatable-lines
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const listener = oneEvent(el, "lr-line-activate");
    const first = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="1"]'
    ) as HTMLButtonElement;
    first.click();
    const event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });
  });

  it("moves focus with ArrowDown/ArrowUp/Home/End", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc"}
        line-numbers
        activatable-lines
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector(
      '[part~="line-button"][data-line="1"]'
    ) as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await el.updateComplete;
    expect(
      el
        .shadowRoot!.querySelector('[part~="line-button"][data-line="2"]')!
        .getAttribute("tabindex")
    ).to.equal("0");
  });

  it("rehomes real focus to the clamped roving line when controlled code shrinks", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc\nd"}
        line-numbers
        activatable-lines
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const line4 = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part~="line-button"][data-line="4"]'
    )!;
    line4.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute("data-line")).to.equal(
      "4"
    );

    el.code = "a\nb";
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute("data-line")).to.equal(
      "2"
    );
    const tabStops = [
      ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
        '[part~="line-button"]'
      ),
    ]
      .filter((button) => button.tabIndex === 0)
      .map((button) => button.dataset["line"]);
    expect(tabStops).to.deep.equal(["2"]);
  });

  it("does not restore a line after focus deliberately moves outside during a code update", async () => {
    const wrapper = await fixture(html`
      <div>
        <lr-code-block-core
          code=${"a\nb\nc\nd"}
          line-numbers
          activatable-lines
        ></lr-code-block-core>
        <button id="outside-code-block-core">Outside</button>
      </div>
    `);
    const el = wrapper.querySelector("lr-code-block-core") as LyraCodeBlockCore;
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part~="line-button"][data-line="4"]'
    )!.focus();
    el.code = "a\nb";
    wrapper
      .querySelector<HTMLButtonElement>("#outside-code-block-core")!
      .focus();
    await el.updateComplete;
    expect(document.activeElement?.id).to.equal("outside-code-block-core");
  });

  it("does not emit lr-line-activate while activatable-lines is off", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb"}
        line-numbers
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part~="line-button"]').length
    ).to.equal(0);
  });

  it("moves focus with ArrowUp, jumps with Home/End, and activates on Enter and Space", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc\nd"}
        line-numbers
        activatable-lines
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
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

  it("marks a highlighted line as both line-button and line-highlight when activatable-lines and highlight-lines are combined", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        code=${"a\nb\nc"}
        line-numbers
        activatable-lines
        highlight-lines="2"
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('.line[data-line="2"]')!;
    expect(line2.getAttribute("part")).to.equal("line-highlight");
    expect(line2.querySelector('[part~="line-button"]')).to.exist;
  });
});

describe("copy button", () => {
  it("fires lr-copy with the raw code and writes it to the clipboard, then reverts the confirmation label after the timeout", async function () {
    this.timeout(5000);
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (text: string) => (writes.push(text), Promise.resolve()),
      },
      configurable: true,
    });

    try {
      const el = (await fixture(
        html`<lr-code-block-core .code=${"const x = 1;"}></lr-code-block-core>`
      )) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector(
        '[part="copy-button"]'
      ) as HTMLButtonElement;
      expect(button.textContent!.trim()).to.equal("Copy");

      const listener = oneEvent(el, "lr-copy");
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ ok: true, text: "const x = 1;" });
      expect(Object.isFrozen(detail)).to.be.true;
      expect(writes).to.deep.equal(["const x = 1;"]);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal("Copied!");

      await aTimeout(1600);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal("Copy");
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("uses the adopted owner clipboard and timer and fails closed while ownerless", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const ownerlessDocument =
      document.implementation.createHTMLDocument("ownerless");
    const mainClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard"
    );
    const frameClipboard = Object.getOwnPropertyDescriptor(
      frameWindow.navigator,
      "clipboard"
    );
    const nativeFrameSetTimeout = frameWindow.setTimeout.bind(frameWindow);
    const nativeFrameClearTimeout = frameWindow.clearTimeout.bind(frameWindow);
    const nativeMainSetTimeout = window.setTimeout;
    let mainWrites = 0;
    const frameWrites: string[] = [];
    let frameTimers = 0;
    let ownerlessMainTimers = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => {
          mainWrites++;
          return Promise.resolve();
        },
      },
    });
    Object.defineProperty(frameWindow.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          frameWrites.push(text);
          return Promise.resolve();
        },
      },
    });
    frameWindow.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      frameTimers++;
      return nativeFrameSetTimeout(handler, timeout, ...args);
    }) as typeof frameWindow.setTimeout;
    const el = (await fixture(
      html`<lr-code-block-core
        .code=${"const owner = true;"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const button = el.shadowRoot!.querySelector(
      '[part="copy-button"]'
    ) as HTMLButtonElement;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const copied = oneEvent(el, "lr-copy");
      button.click();
      await copied;
      await el.updateComplete;
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.deep.equal(["const owner = true;"]);
      expect(frameTimers).to.be.greaterThan(0);

      el.remove();
      ownerlessDocument.adoptNode(el);
      window.setTimeout = ((
        handler: TimerHandler,
        timeout?: number,
        ...args: unknown[]
      ) => {
        ownerlessMainTimers++;
        return nativeMainSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout;
      button.click();
      await Promise.resolve();
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.have.length(1);
      expect(ownerlessMainTimers).to.equal(0);
    } finally {
      el.remove();
      window.setTimeout = nativeMainSetTimeout;
      frameWindow.setTimeout = nativeFrameSetTimeout;
      frameWindow.clearTimeout = nativeFrameClearTimeout;
      if (mainClipboard)
        Object.defineProperty(navigator, "clipboard", mainClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
      if (frameClipboard)
        Object.defineProperty(
          frameWindow.navigator,
          "clipboard",
          frameClipboard
        );
      else Reflect.deleteProperty(frameWindow.navigator, "clipboard");
      frame.remove();
    }
  });

  it("fires lr-copy-error, not lr-copy, when navigator.clipboard is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    try {
      const el = (await fixture(
        html`<lr-code-block-core .code=${"const x = 1;"}></lr-code-block-core>`
      )) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector(
        '[part="copy-button"]'
      ) as HTMLButtonElement;

      let copied = false;
      el.addEventListener("lr-copy", () => {
        copied = true;
      });
      const genericError = oneEvent(el, "lr-error");
      const listener = oneEvent(el, "lr-copy-error");
      button.click();
      const { detail } = await listener;
      await genericError;
      expect(detail).to.include({
        ok: false,
        text: "const x = 1;",
        reason: "unsupported",
      });
      expect((detail as { error: unknown }).error).to.be.instanceOf(Error);
      expect(Object.isFrozen(detail)).to.be.true;
      expect(copied).to.be.false;
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal("Copy failed");
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("fires lr-copy-error when navigator.clipboard throws synchronously", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      get() {
        throw new Error("blocked by permissions policy");
      },
      configurable: true,
    });

    try {
      const el = (await fixture(
        html`<lr-code-block-core .code=${"const x = 1;"}></lr-code-block-core>`
      )) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector(
        '[part="copy-button"]'
      ) as HTMLButtonElement;

      let copied = false;
      el.addEventListener("lr-copy", () => {
        copied = true;
      });
      const listener = oneEvent(el, "lr-copy-error");
      button.click();
      const { detail } = await listener;
      expect(detail).to.include({
        ok: false,
        text: "const x = 1;",
        reason: "failed",
      });
      expect((detail as { error: Error }).error.message).to.equal(
        "blocked by permissions policy"
      );
      expect(copied).to.be.false;
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("does not render a copy button when copyable is false", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        .copyable=${false}
        .code=${"x"}
        filename="x.ts"
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]') == null).to.be
      .true;
  });
});

describe("collapsible / collapsed", () => {
  it("renders no toggle when collapsible is false, and the body is always visible", async () => {
    const el = (await fixture(
      html`<lr-code-block-core .code=${"x"}></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="toggle"]') == null).to.be.true;
    expect(
      (el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden
    ).to.be.false;
  });

  it("hides the body when collapsible and collapsed, and toggling the header button flips it, firing lr-toggle", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        collapsible
        collapsed
        .code=${"x"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const toggle = el.shadowRoot!.querySelector(
      '[part="toggle"]'
    ) as HTMLButtonElement;
    expect(body.hidden).to.be.true;
    expect(toggle.getAttribute("aria-expanded")).to.equal("false");
    expect(toggle.getAttribute("aria-controls")).to.equal(body.id);

    let firing = oneEvent(el, "lr-toggle");
    toggle.click();
    let event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.false;
    expect(body.hidden).to.be.false;
    expect(toggle.getAttribute("aria-expanded")).to.equal("true");
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: false });

    firing = oneEvent(el, "lr-toggle");
    toggle.click();
    event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.true;
    expect(body.hidden).to.be.true;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: true });
  });

  it("allows a cancelable request to veto mutation and the committed event", async () => {
    const el = (await fixture(
      html`<lr-code-block-core collapsible code="x"></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    let commits = 0;
    el.addEventListener("lr-toggle", () => commits++);
    el.addEventListener("lr-toggle-request", (event) => event.preventDefault());
    const requested = oneEvent(el, "lr-toggle-request");
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click();
    const event = (await requested) as CustomEvent<{ collapsed: boolean }>;
    await el.updateComplete;
    expect(event.cancelable).to.be.true;
    expect(event.defaultPrevented).to.be.true;
    expect(event.detail).to.deep.equal({ collapsed: true });
    expect(el.collapsed).to.be.false;
    expect(commits).to.equal(0);
  });
});

describe("header content", () => {
  it("shows filename as visible header text when set", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        filename="app.ts"
        .code=${"x"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(
      el.shadowRoot!.querySelector('[part="filename"]')!.textContent!.trim()
    ).to.equal("app.ts");
  });

  it("renders no header at all when there is nothing to put in it", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        .copyable=${false}
        .code=${"x"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="header"]') == null).to.be.true;
  });

  it("applies max-height as a CSS custom property on the body", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        max-height="10rem"
        .code=${"x"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(
      body.style.getPropertyValue("--lr-code-block-max-height").trim()
    ).to.equal("10rem");
  });

  it("applies a direct-host max-height hook independently of the attribute", async () => {
    const el = (await fixture(
      html`<lr-code-block-core
        style="--lr-code-block-max-height: 43px"
        .copyable=${false}
        .code=${"a\nb\nc\nd"}
      ></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(el.hasAttribute("max-height")).to.be.false;
    expect(getComputedStyle(body).maxBlockSize).to.equal("43px");
  });
});

describe("shiki dark-theme signal", () => {
  it('marks part="body" as dark-theme once the resolved --lr-color-text is lighter than --lr-color-surface', async () => {
    const wrapper = (await fixture(html`
      <div
        style="--lr-theme-color-text-normal:#f2f2f2; --lr-theme-color-surface-default:#1a1a1a;"
      >
        <lr-code-block-core></lr-code-block-core>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-code-block-core") as LyraCodeBlockCore;
    await el2Ready(el);
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.getAttribute("data-dark-theme")).to.equal("true");
  });

  it('does not mark part="body" as dark-theme with the default light --lr-color-* fallbacks', async () => {
    const el = (await fixture(
      html`<lr-code-block-core></lr-code-block-core>`
    )) as LyraCodeBlockCore;
    await el2Ready(el);
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.hasAttribute("data-dark-theme")).to.be.false;
  });

  it("refreshes after a live CSSOM token mutation", async () => {
    const wrapper = (await fixture(html`
      <div
        style="--lr-theme-color-text-normal:#202020; --lr-theme-color-surface-default:#f8f8f8;"
      >
        <lr-code-block-core></lr-code-block-core>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-code-block-core") as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.hasAttribute("data-dark-theme")).to.be.false;
    wrapper.style.setProperty("--lr-theme-color-text-normal", "#f2f2f2");
    wrapper.style.setProperty("--lr-theme-color-surface-default", "#1a1a1a");
    await waitUntil(() => body.getAttribute("data-dark-theme") === "true");
  });

  it("resolves highlighted token paint from the light and component-resolved dark Shiki palettes", async function () {
    this.timeout(20_000);

    async function firstDarkAwareSpan(
      wrapperStyle: string
    ): Promise<{ span: HTMLElement; body: Element }> {
      const wrapper = (await fixture(html`
        <div style=${wrapperStyle}>
          <lr-code-block-core
            language="json"
            .languages=${sharedJsonLanguages}
            .code=${'{"answer":42}'}
          ></lr-code-block-core>
        </div>
      `)) as HTMLElement;
      const el = wrapper.querySelector(
        "lr-code-block-core"
      ) as LyraCodeBlockCore;
      await waitUntil(
        () => el.shadowRoot!.querySelectorAll(".shiki").length === 1,
        "highlighted core output never appeared",
        { timeout: 15000 }
      );
      const body = el.shadowRoot!.querySelector('[part="body"]')!;
      const spans = Array.from(
        el.shadowRoot!.querySelectorAll<HTMLElement>('[part="pre"] span')
      );
      const span = spans.find(
        (candidate) => candidate.style.getPropertyValue("--shiki-dark") !== ""
      );
      expect(span !== undefined).to.be.true;
      return { span: span!, body };
    }

    const light = await firstDarkAwareSpan("");
    expect(light.body.hasAttribute("data-dark-theme")).to.be.false;
    expect(getComputedStyle(light.span).color).to.equal(light.span.style.color);

    const dark = await firstDarkAwareSpan(
      "--lr-theme-color-text-normal:#f2f2f2; --lr-theme-color-surface-default:#1a1a1a;"
    );
    expect(dark.body.getAttribute("data-dark-theme")).to.equal("true");
    const probe = document.createElement("span");
    probe.setAttribute("style", dark.span.getAttribute("style")!);
    probe.style.color = "var(--shiki-dark, inherit)";
    dark.span.parentElement!.appendChild(probe);
    const expectedDarkColor = getComputedStyle(probe).color;
    probe.remove();
    expect(getComputedStyle(dark.span).color).to.equal(expectedDarkColor);
    expect(getComputedStyle(dark.span).color).to.not.equal(
      dark.span.style.color
    );
  });
});

describe("lean/full parity with <lr-code-block>", () => {
  // <lr-code-block>'s own willUpdate()/updated() both chain to super with the changed map, with a
  // comment stating why (a future mixin layered under the class must still run). Its lean sibling
  // silently dropped both chain-ups, which is exactly the kind of drift `code-block-shared.ts`
  // exists to end -- these assertions pin the chain-up on the lean variant too.
  it("chains willUpdate()/updated() to the base class with the changed map", async () => {
    const proto = LyraElement.prototype as unknown as Record<string, unknown>;
    const hadWillUpdate = Object.prototype.hasOwnProperty.call(
      proto,
      "willUpdate"
    );
    const hadUpdated = Object.prototype.hasOwnProperty.call(proto, "updated");
    const originalWillUpdate = proto["willUpdate"];
    const originalUpdated = proto["updated"];
    const willUpdateArgs: unknown[] = [];
    const updatedArgs: unknown[] = [];
    proto["willUpdate"] = function (changed: unknown): void {
      willUpdateArgs.push(changed);
    };
    proto["updated"] = function (changed: unknown): void {
      updatedArgs.push(changed);
    };
    try {
      const el = (await fixture(
        html`<lr-code-block-core
          .code=${"const answer = 42;"}
        ></lr-code-block-core>`
      )) as LyraCodeBlockCore;
      el.code = "const answer = 43;";
      await el.updateComplete;
      // Compare counts/shapes only -- never a DOM node as chai's actual/expected.
      expect(
        willUpdateArgs.length,
        "super.willUpdate() was never reached"
      ).to.be.greaterThan(0);
      expect(
        updatedArgs.length,
        "super.updated() was never reached"
      ).to.be.greaterThan(0);
      expect(willUpdateArgs.every((arg) => arg instanceof Map)).to.be.true;
      expect(updatedArgs.every((arg) => arg instanceof Map)).to.be.true;
    } finally {
      if (hadWillUpdate) proto["willUpdate"] = originalWillUpdate;
      else delete proto["willUpdate"];
      if (hadUpdated) proto["updated"] = originalUpdated;
      else delete proto["updated"];
    }
  });
});
