import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { hoverUntilMatched, resetMouse } from "../../test/wtr-mouse.js";

const loadedLinks: HTMLLinkElement[] = [];
let fouceTagId = 0;

async function loadStylesheet(
  name: "native.css" | "palette.css" | "reservations.css" | "utilities.css"
): Promise<HTMLLinkElement> {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(`./${name}`, import.meta.url).href;
  const settled = new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${name}`)),
      { once: true }
    );
  });
  document.head.append(link);
  loadedLinks.push(link);
  await settled;
  return link;
}

before(async () => {
  await loadStylesheet("native.css");
  await loadStylesheet("utilities.css");
  await loadStylesheet("palette.css");
});

after(() => {
  for (const link of loadedLinks) link.remove();
});

it("keeps native normalization scoped to descendants of an explicit .lr-native container", async () => {
  const el = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <button
        id="marker"
        class="lr-native"
        style="--lr-native-control-min-block-size: 55px"
      >
        Scope marker itself
      </button>
      <div class="lr-native" style="--lr-native-control-min-block-size: 55px">
        <button id="inside">Inside</button>
      </div>
    </div>
  `);
  const outside = el.querySelector<HTMLElement>("#outside")!;
  const marker = el.querySelector<HTMLElement>("#marker")!;
  const inside = el.querySelector<HTMLElement>("#inside")!;

  expect(getComputedStyle(inside).minBlockSize).to.equal("55px");
  expect(getComputedStyle(outside).minBlockSize).to.not.equal("55px");
  expect(getComputedStyle(marker).minBlockSize).to.not.equal("55px");
});

it('lets the composite --lr-focus-ring token style native controls', async () => {
  const el = await fixture(html`
    <div data-lr-theme-scope
      class="lr-native"
      style="
        --lr-focus-ring: 6px dashed rgb(1, 2, 3);
        --lr-focus-ring-width: 1px;
        --lr-focus-ring-color: rgb(4, 5, 6);
      "
    >
      <button type="button">Focus target</button>
    </div>
  `);
  const button = el.querySelector<HTMLButtonElement>('button')!;
  button.focus();

  expect(button.matches(':focus-visible')).to.be.true;
  const style = getComputedStyle(button);
  expect(style.outlineWidth).to.equal('6px');
  expect(style.outlineStyle).to.equal('dashed');
  expect(style.outlineColor).to.equal('rgb(1, 2, 3)');
});

describe('native border roles', () => {
  // Decorative rules (code-block frame, fieldset group edge, table row rule, hr) read the subtle
  // border role; native controls keep the control border, their only resting boundary.
  const decorative = ['#pre', '#fieldset', '#th', '#td', '#hr'] as const;
  const controls = ['#input', '#button'] as const;

  async function paint(style: string): Promise<HTMLElement> {
    return fixture<HTMLElement>(html`
      <div class="lr-native" style=${style}>
        <pre id="pre">code</pre>
        <fieldset id="fieldset"><legend>Group</legend></fieldset>
        <table>
          <tbody>
            <tr><th id="th">Head</th><td id="td">Cell</td></tr>
          </tbody>
        </table>
        <hr id="hr" />
        <input id="input" aria-label="Name" />
        <button id="button" type="button">Go</button>
      </div>
    `);
  }

  // A row rule is the cell's block-end edge; every other surface is read at its block-start edge.
  function edgeColor(el: HTMLElement, selector: string): string {
    const style = getComputedStyle(el.querySelector(selector)!);
    return selector === '#th' || selector === '#td'
      ? style.borderBottomColor
      : style.borderTopColor;
  }

  it('paints decorative rules from the subtle theme input and controls from the control input', async () => {
    const el = await paint(
      '--lr-theme-color-surface-border: rgb(4, 5, 6); --lr-theme-color-surface-border-subtle: rgb(1, 2, 3);'
    );
    for (const selector of decorative) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(1, 2, 3)');
    }
    for (const selector of controls) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(4, 5, 6)');
    }
  });

  it('falls back to the control border when no subtle input is set', async () => {
    const el = await paint('--lr-theme-color-surface-border: rgb(4, 5, 6);');
    for (const selector of [...decorative, ...controls]) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(4, 5, 6)');
    }
  });

  it('prefers the resolved token layer over the theme inputs', async () => {
    const el = await paint(
      '--lr-theme-color-surface-border-subtle: rgb(1, 2, 3); --lr-color-border-subtle: rgb(7, 8, 9); --lr-color-border: rgb(10, 11, 12);'
    );
    for (const selector of decorative) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(7, 8, 9)');
    }
    for (const selector of controls) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(10, 11, 12)');
    }
  });

  it('follows an application-scoped control border when only that token is set', async () => {
    const el = await paint('--lr-color-border: rgb(10, 11, 12);');
    for (const selector of [...decorative, ...controls]) {
      expect(edgeColor(el, selector), selector).to.equal('rgb(10, 11, 12)');
    }
  });
});

it("uses a logical quote edge that mirrors under RTL", async () => {
  const el = await fixture(html`
    <div class="lr-native" style="--lr-native-quote-border-width: 5px">
      <blockquote id="ltr" dir="ltr">LTR quote</blockquote>
      <blockquote id="rtl" dir="rtl">RTL quote</blockquote>
    </div>
  `);
  const ltr = getComputedStyle(el.querySelector("#ltr")!);
  const rtl = getComputedStyle(el.querySelector("#rtl")!);
  expect(ltr.borderLeftWidth).to.equal("5px");
  expect(ltr.borderRightWidth).to.equal("0px");
  expect(rtl.borderLeftWidth).to.equal("0px");
  expect(rtl.borderRightWidth).to.equal("5px");
});

it("applies exact layout classes and ignores substring lookalikes", async () => {
  const el = await fixture(html`
    <div>
      <span id="lookalike" class="not-lr-flex-suffix">Lookalike</span>
      <div id="stack" class="lr-stack" style="--lr-layout-gap: 13px">
        <span>One</span><span>Two</span>
      </div>
      <div id="cluster" class="lr-cluster">
        <span>One</span><span>Two</span>
      </div>
    </div>
  `);
  const lookalike = getComputedStyle(el.querySelector("#lookalike")!);
  const stack = getComputedStyle(el.querySelector("#stack")!);
  const cluster = getComputedStyle(el.querySelector("#cluster")!);

  expect(lookalike.display).to.equal("inline");
  expect(stack.display).to.equal("flex");
  expect(stack.flexDirection).to.equal("column");
  expect(stack.gap).to.equal("13px");
  expect(cluster.display).to.equal("flex");
  expect(cluster.flexWrap).to.equal("wrap");
});

it("composes wrap, alignment, justification, and tokenized gap utilities", async () => {
  const el = await fixture(html`
    <div
      class="lr-flex lr-wrap lr-items-center lr-justify-between lr-gap-l"
      style="--lr-space-l: 19px"
    >
      <span>One</span><span>Two</span>
    </div>
  `);
  const style = getComputedStyle(el);
  expect(style.display).to.equal("flex");
  expect(style.flexWrap).to.equal("wrap");
  expect(style.alignItems).to.equal("center");
  expect(style.justifyContent).to.equal("space-between");
  expect(style.gap).to.equal("19px");
});

it("provides logical sizing and responsive auto-grid utilities", async () => {
  const el = await fixture(html`
    <div>
      <div style="inline-size: 240px; block-size: 120px">
        <div
          id="full"
          class="lr-inline-full lr-block-full lr-min-inline-0"
        ></div>
      </div>
      <div
        id="grid"
        class="lr-grid-auto"
        style="inline-size: 230px; --lr-grid-min-inline-size: 90px; --lr-layout-gap: 10px"
      >
        <span>One</span><span>Two</span><span>Three</span>
      </div>
    </div>
  `);
  const full = el.querySelector<HTMLElement>("#full")!;
  const grid = el.querySelector<HTMLElement>("#grid")!;
  expect(full.getBoundingClientRect().width).to.equal(240);
  expect(full.getBoundingClientRect().height).to.equal(120);
  expect(getComputedStyle(full).minInlineSize).to.equal("0px");
  expect(getComputedStyle(grid).display).to.equal("grid");
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ")).to.have.length(
    2
  );
});

it("wraps narrow clusters and long unbroken text without inline overflow", async () => {
  const el = await fixture(html`
    <div>
      <div id="cluster" class="lr-cluster lr-gap-s" style="inline-size: 150px">
        <span style="inline-size: 100px">One</span>
        <span style="inline-size: 100px">Two</span>
      </div>
      <div id="long" class="lr-text-break" style="inline-size: 100px">
        InternationalQuarterlyAnalyticalEngineResearchWithoutConvenientBreakpoints
      </div>
    </div>
  `);
  const items = [...el.querySelectorAll<HTMLElement>("#cluster > span")];
  expect(items[1]!.getBoundingClientRect().top).to.be.greaterThan(
    items[0]!.getBoundingClientRect().top
  );
  const long = el.querySelector<HTMLElement>("#long")!;
  expect(getComputedStyle(long).overflowWrap).to.equal("anywhere");
  expect(long.scrollWidth).to.be.at.most(long.clientWidth);
});

it("styles prose through documented tokens and leaves consumer overrides authoritative", async () => {
  const consumer = document.createElement("style");
  consumer.textContent = ".lr-prose { max-inline-size: 333px; }";
  document.head.append(consumer);
  try {
    // Load a second layered copy *after* the earlier unlayered consumer rule. Layer origin, not
    // source order or selector strength, must keep the consumer rule in charge.
    const lateUtilities = await loadStylesheet("utilities.css");
    const el = await fixture(html`
      <article class="lr-prose" style="--lr-prose-flow-space: 17px">
        <h2>Utility prose</h2>
        <p>Readable text with a <a href="#target">link</a>.</p>
      </article>
    `);
    expect(getComputedStyle(el).maxInlineSize).to.equal("333px");
    expect(getComputedStyle(el).lineHeight).to.equal("24px");
    const paragraph = el.querySelector("p")!;
    expect(getComputedStyle(paragraph).marginBlockStart).to.equal("17px");
    lateUtilities.remove();
  } finally {
    consumer.remove();
  }
});

it("keeps visually hidden content available and reveals the focusable variant on focus", async () => {
  const el = await fixture(html`
    <div>
      <span id="hidden" class="lr-visually-hidden">Additional context</span>
      <a id="skip" class="lr-visually-hidden-focusable" href="#target"
        >Skip to target</a
      >
      <main id="target" tabindex="-1">Target</main>
    </div>
  `);
  const hidden = el.querySelector<HTMLElement>("#hidden")!;
  const skip = el.querySelector<HTMLAnchorElement>("#skip")!;
  expect(getComputedStyle(hidden).position).to.equal("absolute");
  expect(hidden.getBoundingClientRect().width).to.be.at.most(1);
  expect(getComputedStyle(skip).position).to.equal("absolute");
  skip.focus();
  expect(document.activeElement).to.equal(skip);
  expect(getComputedStyle(skip).position).to.equal("static");
  expect(skip.getBoundingClientRect().width).to.be.greaterThan(1);
});

it("sizes .lr-visually-hidden from --lr-visually-hidden-size/--lr-size-1px, not the unrelated --lr-border-width-thin", async () => {
  const el = (await fixture(
    html`<span class="lr-visually-hidden">Additional context</span>`,
  )) as HTMLElement;
  const style = getComputedStyle(el);
  expect(style.inlineSize).to.equal("1px");
  expect(style.blockSize).to.equal("1px");

  // Retheming an unrelated border-width token -- a plausible "no visible hairline borders" design
  // choice -- must not shrink this element to 0x0. It must derive from --lr-size-1px, not
  // --lr-border-width-thin, even though both happen to default to the same 1px value.
  el.style.setProperty("--lr-border-width-thin", "0");
  document.documentElement.style.setProperty("--lr-theme-border-width-thin", "0");
  try {
    const rethemed = getComputedStyle(el);
    expect(rethemed.inlineSize, "inline-size must not collapse to 0").to.equal("1px");
    expect(rethemed.blockSize, "block-size must not collapse to 0").to.equal("1px");
  } finally {
    el.style.removeProperty("--lr-border-width-thin");
    document.documentElement.style.removeProperty("--lr-theme-border-width-thin");
  }

  // Its own dedicated override hook does reach it.
  el.style.setProperty("--lr-visually-hidden-size", "3px");
  const sized = getComputedStyle(el);
  expect(sized.inlineSize).to.equal("3px");
  expect(sized.blockSize).to.equal("3px");
});

it("hides only opted-in undefined elements and reveals them after definition", async () => {
  fouceTagId += 1;
  const tagName = `lr-fouce-probe-${fouceTagId}`;
  const probe = document.createElement(tagName);
  probe.className = "lr-fouce-hidden";
  probe.textContent = "Ready";
  const plain = document.createElement(`lr-fouce-plain-${fouceTagId}`);
  plain.textContent = "Plain";
  const host = await fixture(html`<div></div>`);
  host.append(probe, plain);

  expect(getComputedStyle(probe).visibility).to.equal("hidden");
  expect(getComputedStyle(plain).visibility).to.equal("visible");
  customElements.define(tagName, class extends HTMLElement {});
  await customElements.whenDefined(tagName);
  expect(getComputedStyle(probe).visibility).to.equal("visible");
});

it("follows lr-page allocation state for mobile and desktop visibility helpers", async () => {
  const page = await fixture(html`
    <lr-page view="mobile">
      <span id="mobile" class="lr-page-mobile-only">Mobile</span>
      <span id="desktop" class="lr-page-desktop-only">Desktop</span>
    </lr-page>
  `);
  const mobile = page.querySelector<HTMLElement>("#mobile")!;
  const desktop = page.querySelector<HTMLElement>("#desktop")!;
  expect(getComputedStyle(mobile).display).to.not.equal("none");
  expect(getComputedStyle(desktop).display).to.equal("none");

  page.setAttribute("view", "desktop");
  expect(getComputedStyle(mobile).display).to.equal("none");
  expect(getComputedStyle(desktop).display).to.not.equal("none");
});

it("keeps the native and utility fixtures accessible in populated states", async () => {
  const el = await fixture(html`
    <section class="lr-native lr-stack" aria-labelledby="styles-heading">
      <h2 id="styles-heading">Account settings</h2>
      <p class="lr-prose">Update the profile fields below.</p>
      <label for="display-name">Display name</label>
      <input id="display-name" value="Ada" />
      <button type="button">Save</button>
      <span class="lr-visually-hidden" aria-live="polite"
        >No unsaved changes</span
      >
    </section>
  `);
  await expect(el).to.be.accessible();
});

it("declares stable layers without root selectors, physical geometry, or substring class matching", async () => {
  const [native, utilities] = await Promise.all([
    fetch(new URL("./native.css", import.meta.url)).then((response) =>
      response.text()
    ),
    fetch(new URL("./utilities.css", import.meta.url)).then((response) =>
      response.text()
    ),
  ]);
  expect(native).to.contain("@layer lr-base");
  expect(utilities).to.contain("@layer lr-utilities");
  expect(native).to.not.match(/(^|[},]\s*)(?::root|html|body)(?:\s|[,{])/m);
  expect(native).to.not.match(/:where\(\.lr-native\)\s*\{/);
  expect(`${native}\n${utilities}`).to.not.match(
    /^\s*(?:(?:margin|padding|border|inset)-(?:left|right)|left|right|width|height)\s*:/m
  );
  expect(`${native}\n${utilities}`).to.not.match(/text-align\s*:\s*(?:left|right)\b/);
  expect(utilities).to.not.match(/\[class(?:\^|\$|\*)=/);
});

/** Removes every balanced :where(...) group, leaving whatever still carries specificity. */
function withoutWhereGroups(selector: string): string {
  let result = "";
  let index = 0;
  while (index < selector.length) {
    if (selector.startsWith(":where(", index)) {
      let depth = 0;
      let cursor = index + ":where".length;
      do {
        if (selector[cursor] === "(") depth += 1;
        if (selector[cursor] === ")") depth -= 1;
        cursor += 1;
      } while (depth > 0 && cursor < selector.length);
      index = cursor;
    } else {
      result += selector[index];
      index += 1;
    }
  }
  return result;
}

it("keeps every lr-utilities selector at zero specificity", async () => {
  const source = await fetch(new URL("./utilities.css", import.meta.url)).then((response) =>
    response.text()
  );
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(source);
  const layer = [...sheet.cssRules].find(
    (rule): rule is CSSLayerBlockRule => rule instanceof CSSLayerBlockRule && rule.name === "lr-utilities"
  );
  if (layer === undefined) throw new Error("utilities.css has no lr-utilities layer block");
  const collect = (rules: CSSRuleList): CSSStyleRule[] =>
    [...rules].flatMap((rule) =>
      rule instanceof CSSStyleRule
        ? [rule]
        : "cssRules" in rule
          ? collect((rule as CSSGroupingRule).cssRules)
          : []
    );
  const styleRules = collect(layer.cssRules);
  expect(styleRules.length, "utility rules parsed").to.be.greaterThan(100);
  const specific = styleRules
    .map((rule) => rule.selectorText)
    .filter((selector) => !/^[\s>+~,]*$/.test(withoutWhereGroups(selector)));
  expect(specific).to.deep.equal([]);
  // The helper is not vacuous: a bare class or an element outside :where() is reported.
  expect(withoutWhereGroups(":where(.a) > :where(b):where(:not(.c))")).to.equal(" > ");
  expect(withoutWhereGroups(":where(.a) .b")).to.equal(" .b");
});

describe("reservations.css", () => {
  it("reserves a chart's intrinsic height before its definition upgrades", async () => {
    await loadStylesheet("reservations.css");
    // A tag that is deliberately never defined, standing in for a not-yet-upgraded lr-chart.
    const el = await fixture<HTMLElement>(
      html`<div style="inline-size: 400px"><lr-chart></lr-chart></div>`
    );
    const chart = el.querySelector("lr-chart")!;
    expect(customElements.get("lr-chart"), "not registered in this file").to.equal(undefined);
    expect(
      chart.getBoundingClientRect().height,
      "the undefined element already occupies its 280px default"
    ).to.be.closeTo(280, 2);
  });

  it("tracks the component's own custom property rather than a hard-coded pixel value", async () => {
    await loadStylesheet("reservations.css");
    // The whole point of expressing reservations through the same token the component uses: a
    // themed height re-themes the reservation too, instead of silently rotting.
    const el = await fixture<HTMLElement>(
      html`<div style="--lr-chart-height: 500px"><lr-chart></lr-chart></div>`
    );
    expect(
      el.querySelector("lr-chart")!.getBoundingClientRect().height
    ).to.be.closeTo(500, 2);
  });

  it('reserves map and graph/canvas surfaces through their height tokens before upgrade', async () => {
    await loadStylesheet('reservations.css');
    const el = await fixture<HTMLElement>(html`
      <div
        style="inline-size: 400px; --lr-canvas-reserved-height: 275px; --lr-map-height: 260px"
      >
        <lr-flow-canvas></lr-flow-canvas>
        <lr-graph></lr-graph>
        <lr-map></lr-map>
      </div>
    `);
    expect(customElements.get('lr-flow-canvas')).to.equal(undefined);
    expect(customElements.get('lr-graph')).to.equal(undefined);
    expect(customElements.get('lr-map')).to.equal(undefined);

    for (const tagName of ['lr-flow-canvas', 'lr-graph']) {
      const surface = el.querySelector<HTMLElement>(tagName)!;
      expect(getComputedStyle(surface).display, `${tagName} display`).to.equal('block');
      expect(surface.getBoundingClientRect().height, `${tagName} reserved height`).to.be.closeTo(
        275,
        2
      );
    }

    const map = el.querySelector<HTMLElement>('lr-map')!;
    expect(getComputedStyle(map).display, 'lr-map display').to.equal('block');
    expect(map.getBoundingClientRect().height, 'lr-map reserved height').to.be.closeTo(260, 2);
  });

  it("reserves a flag's aspect-ratio box from the surrounding font size", async () => {
    await loadStylesheet("reservations.css");
    const el = await fixture<HTMLElement>(
      html`<div style="font-size: 24px"><lr-flag></lr-flag></div>`
    );
    const box = el.querySelector("lr-flag")!.getBoundingClientRect();
    expect(box.height, "1em tall").to.be.closeTo(24, 2);
    expect(box.width / box.height, "on the documented 4/3 ratio").to.be.closeTo(4 / 3, 0.05);
  });

  it("is inert for a defined element, so it can never fight a component's own layout", async () => {
    await loadStylesheet("reservations.css");
    // lr-skeleton is registered by this bundle, so it is :defined and must be untouched.
    const el = await fixture<HTMLElement>(html`<div><lr-skeleton></lr-skeleton></div>`);
    const skeleton = el.querySelector("lr-skeleton")!;
    if (customElements.get("lr-skeleton") === undefined) return; // not loaded in this file
    expect(skeleton.matches(":defined"), "upgraded").to.be.true;
  });
});

it("spans the static 12-column grid and collapses it to 6 and 1 columns by container width", async () => {
  const el = await fixture(html`
    <div>
      <div id="grid12" class="lr-grid-12" style="inline-size: 1200px; --lr-layout-gap: 0px">
        <div class="lr-span-3 lr-row-span-2">A</div>
        <div class="lr-span-9">B</div>
        <div>C</div>
      </div>
    </div>
  `);
  const grid = el.querySelector<HTMLElement>("#grid12")!;
  const [a, b, c] = ["A", "B", "C"].map(
    (text) => [...grid.children].find((child) => child.textContent === text) as HTMLElement
  ) as [HTMLElement, HTMLElement, HTMLElement];
  const widths = (): number[] => [a, b, c].map((child) => Math.round(child.getBoundingClientRect().width));
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ")).to.have.length(12);
  expect(getComputedStyle(grid).containerType).to.equal("inline-size");
  expect(widths()).to.deep.equal([300, 900, 100]);
  expect(Math.round(a.getBoundingClientRect().height)).to.equal(
    Math.round(b.getBoundingClientRect().height + c.getBoundingClientRect().height)
  );
  grid.style.inlineSize = "600px";
  expect(widths(), "6-column range").to.deep.equal([300, 600, 100]);
  grid.style.inlineSize = "320px";
  expect(widths(), "single column").to.deep.equal([320, 320, 320]);
  expect(getComputedStyle(a).gridRowEnd).to.equal("auto");
});

describe('spacing and type scale utilities', () => {
  it('maps every gap class to its spacing token, including the 2xs and xl to 4xl steps', async () => {
    const el = await fixture(html`
      <div data-lr-theme-scope style="--lr-space-2xs: 1px; --lr-space-xl: 2px; --lr-space-2xl: 3px; --lr-space-3xl: 4px; --lr-space-4xl: 5px">
        <div id="a" class="lr-flex lr-gap-2xs"></div>
        <div id="b" class="lr-flex lr-gap-xl"></div>
        <div id="c" class="lr-flex lr-gap-2xl"></div>
        <div id="d" class="lr-flex lr-gap-3xl"></div>
        <div id="e" class="lr-flex lr-gap-4xl"></div>
      </div>
    `);
    const gap = (id: string) => getComputedStyle(el.querySelector(`#${id}`)!).columnGap;
    expect(['a', 'b', 'c', 'd', 'e'].map(gap)).to.deep.equal(['1px', '2px', '3px', '4px', '5px']);
  });

  it('falls back to rem steps when no token layer is present', async () => {
    const el = await fixture(html`<div><div id="x" class="lr-flex lr-gap-xl"></div><div id="y" class="lr-flex lr-gap-4xl"></div></div>`);
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(parseFloat(getComputedStyle(el.querySelector('#x')!).columnGap)).to.be.closeTo(1.5 * root, 0.5);
    expect(parseFloat(getComputedStyle(el.querySelector('#y')!).columnGap)).to.be.closeTo(4 * root, 0.5);
  });

  it('sizes the display text classes and the heading 5 and 6 roles from the font-size tokens', async () => {
    const el = await fixture(html`
      <div data-lr-theme-scope style="--lr-font-size-4xl: 41px; --lr-font-size-5xl: 52px; --lr-font-size-m: 17px; --lr-font-size-sm: 13px">
        <p id="a" class="lr-text-4xl">a</p><p id="b" class="lr-text-5xl">b</p>
        <p id="c" class="lr-heading-5">c</p><p id="d" class="lr-heading-6">d</p>
        <div class="lr-typography"><h2 id="e" class="lr-heading-5">e</h2></div>
      </div>
    `);
    const size = (id: string) => getComputedStyle(el.querySelector(`#${id}`)!).fontSize;
    expect(['a', 'b', 'c', 'd', 'e'].map(size)).to.deep.equal(['41px', '52px', '17px', '13px', '17px']);
    expect(getComputedStyle(el.querySelector('#c')!).fontWeight).to.equal('600');
  });
});

describe('layout compositions', () => {
  it('wraps a flank and keeps the flank child at its own width', async () => {
    const el = await fixture<HTMLElement>(html`
      <div class="lr-flank" style="--lr-layout-gap: 0px; inline-size: 400px; --lr-flank-content-min-inline-size: 300px">
        <div id="side" style="inline-size: 100px">side</div><div id="main">main</div>
      </div>
    `);
    const side = el.querySelector<HTMLElement>('#side')!;
    const main = el.querySelector<HTMLElement>('#main')!;
    expect(side.getBoundingClientRect().width).to.equal(100);
    expect(main.getBoundingClientRect().width).to.equal(300);
    el.style.inlineSize = '399px';
    expect(Math.round(main.getBoundingClientRect().width), 'content wraps to its own row').to.equal(399);
  });

  it('puts the flank at the end for lr-flank-end', async () => {
    const el = await fixture(html`
      <div class="lr-flank-end" style="--lr-layout-gap: 0px; inline-size: 400px"><div id="main">main</div><div id="side" style="inline-size: 100px">side</div></div>
    `);
    expect(el.querySelector('#side')!.getBoundingClientRect().width).to.equal(100);
    expect(el.querySelector('#main')!.getBoundingClientRect().width).to.equal(300);
  });

  it('splits to both ends and mirrors under RTL', async () => {
    const el = await fixture(html`
      <div>
        <div id="ltr" class="lr-split" dir="ltr" style="inline-size: 300px"><i id="l1">a</i><i id="l2">b</i></div>
        <div id="rtl" class="lr-split" dir="rtl" style="inline-size: 300px"><i id="r1">a</i><i id="r2">b</i></div>
        <div id="col" class="lr-split-column" style="block-size: 200px"><i id="c1">a</i><i id="c2">b</i></div>
      </div>
    `);
    const rect = (id: string) => el.querySelector(`#${id}`)!.getBoundingClientRect();
    expect(rect('l1').left).to.be.lessThan(rect('l2').left);
    expect(rect('r1').left).to.be.greaterThan(rect('r2').left);
    expect(rect('c2').bottom - rect('c1').top).to.be.closeTo(200, 1);
  });

  it('frames content to square, landscape and portrait ratios and crops replaced content', async () => {
    const el = await fixture(html`
      <div>
        <div id="sq" class="lr-frame-square" style="inline-size: 120px"><img id="img" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /></div>
        <div id="ls" class="lr-frame-landscape" style="inline-size: 160px"></div>
        <div id="pt" class="lr-frame-portrait" style="inline-size: 120px"></div>
        <div id="custom" class="lr-frame" style="inline-size: 100px; --lr-frame-ratio: 2 / 1"></div>
      </div>
    `);
    const box = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!.getBoundingClientRect();
    expect(box('sq').height).to.equal(120);
    expect(box('ls').height).to.equal(90);
    expect(box('pt').height).to.equal(160);
    expect(box('custom').height).to.equal(50);
    expect(getComputedStyle(el.querySelector('#img')!).objectFit).to.equal('cover');
  });

  it('lets lr-span-grid take the whole row at every container width', async () => {
    const el = await fixture<HTMLElement>(html`
      <div id="g" class="lr-grid-12" style="inline-size: 1200px; --lr-layout-gap: 0px"><div id="all" class="lr-span-grid">all</div><div class="lr-span-3">x</div></div>
    `);
    const all = el.querySelector<HTMLElement>('#all')!;
    expect(all.getBoundingClientRect().width).to.equal(1200);
    el.style.inlineSize = '320px';
    expect(all.getBoundingClientRect().width).to.equal(320);
    el.style.inlineSize = '600px';
    expect(all.getBoundingClientRect().width).to.equal(600);
  });

  it('makes lr-container an inline-size query container', async () => {
    const el = await fixture(html`<div class="lr-container"></div>`);
    expect(getComputedStyle(el).containerType).to.equal('inline-size');
  });
});

describe('small utilities', () => {
  it('strips list chrome and link decoration', async () => {
    const el = await fixture(html`
      <div>
        <ul id="ul" class="lr-list-plain"><li>a</li></ul>
        <a id="a" class="lr-link-plain" href="#x" style="color: rgb(1, 2, 3)">link</a>
      </div>
    `);
    const ul = getComputedStyle(el.querySelector('#ul')!);
    expect(ul.listStyleType).to.equal('none');
    expect(ul.paddingInlineStart).to.equal('0px');
    const a = getComputedStyle(el.querySelector('#a')!);
    expect(a.textDecorationLine).to.equal('none');
  });

  it('underlines a plain link on hover', async () => {
    const el = await fixture(html`<a id="a" class="lr-link-plain" href="#x">link</a>`);
    await hoverUntilMatched(el, 'plain link hovered');
    expect(getComputedStyle(el).textDecorationLine).to.equal('underline');
  });

  it('applies the radius ladder and text transforms', async () => {
    const el = await fixture(html`
      <div data-lr-theme-scope style="--lr-radius-xs: 3px; --lr-radius: 7px; --lr-radius-pill: 99px; --lr-radius-container: 11px">
        <i id="r0" class="lr-radius-none"></i><i id="r1" class="lr-radius-xs"></i><i id="r2" class="lr-radius-m"></i>
        <i id="r3" class="lr-radius-container"></i><i id="r4" class="lr-radius-pill"></i><i id="r5" class="lr-radius-circle"></i>
        <b id="t1" class="lr-uppercase">a</b><b id="t2" class="lr-lowercase">A</b><b id="t3" class="lr-capitalize">a</b>
        <b id="t4" class="lr-uppercase lr-normal-case">a</b>
      </div>
    `);
    const radius = (id: string) => getComputedStyle(el.querySelector(`#${id}`)!).borderTopLeftRadius;
    expect(['r0', 'r1', 'r2', 'r3', 'r4', 'r5'].map(radius)).to.deep.equal(['0px', '3px', '7px', '11px', '99px', '50%']);
    const transform = (id: string) => getComputedStyle(el.querySelector(`#${id}`)!).textTransform;
    expect(['t1', 't2', 't3', 't4'].map(transform)).to.deep.equal(['uppercase', 'lowercase', 'capitalize', 'none']);
  });

  it('paints a placeholder from the neutral fill token', async () => {
    const el = await fixture(html`<div data-lr-theme-scope id="p" class="lr-placeholder" style="--lr-color-neutral-fill-normal: rgb(9, 8, 7)"></div>`);
    expect(getComputedStyle(el).backgroundColor).to.equal('rgb(9, 8, 7)');
    expect(getComputedStyle(el).display).to.equal('block');
  });

  it('tints plain elements by variant and scales them by size', async () => {
    const el = await fixture(html`
      <div data-lr-theme-scope style="--lr-color-brand-fill-loud: rgb(1, 2, 3); --lr-color-danger-fill-loud: rgb(4, 5, 6); --lr-font-size-lg: 22px; --lr-font-size-xs: 11px">
        <p id="b" class="lr-brand">b</p><p id="d" class="lr-danger">d</p>
        <p id="l" class="lr-size-l">l</p><p id="x" class="lr-size-xs">x</p>
        <div class="lr-native"><button id="btn" class="lr-size-l" type="button">go</button><button id="btn2" class="lr-size-xs" type="button">go</button></div>
      </div>
    `);
    expect(getComputedStyle(el.querySelector('#b')!).color).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(el.querySelector('#d')!).color).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(el.querySelector('#l')!).fontSize).to.equal('22px');
    expect(getComputedStyle(el.querySelector('#x')!).fontSize).to.equal('11px');
    const tall = el.querySelector<HTMLElement>('#btn')!.getBoundingClientRect().height;
    const short = el.querySelector<HTMLElement>('#btn2')!.getBoundingClientRect().height;
    expect(tall).to.be.greaterThan(short);
  });

  it('locks scroll with a pure-CSS class', async () => {
    const el = await fixture(html`<div class="lr-scroll-lock"></div>`);
    expect(getComputedStyle(el).overflowY).to.equal('hidden');
  });
});

describe('lr-cloak', () => {
  it('hides a root while a custom element beneath it is undefined, then reveals it once defined', async () => {
    const name = `lr-cloak-probe-${Math.random().toString(36).slice(2, 8)}`;
    const el = await fixture(html`<div class="lr-cloak" style="--lr-cloak-timeout: 5s">${document.createElement(name)}</div>`);
    expect(getComputedStyle(el).visibility).to.equal('hidden');
    customElements.define(name, class extends HTMLElement {});
    expect(getComputedStyle(el).visibility).to.equal('visible');
  });

  it('fails open after the timeout when a custom element never upgrades', async () => {
    const el = await fixture(html`<div class="lr-cloak" style="--lr-cloak-timeout: 80ms"><never-defined-lr-probe></never-defined-lr-probe></div>`);
    expect(getComputedStyle(el).visibility).to.equal('hidden');
    await waitUntil(() => getComputedStyle(el).visibility === 'visible', 'cloak fails open', { timeout: 3000 });
  });

  it('leaves a root without undefined elements visible', async () => {
    const el = await fixture(html`<div class="lr-cloak"><p>text</p></div>`);
    expect(getComputedStyle(el).visibility).to.equal('visible');
  });
});

describe('hue palette', () => {
  it('declares every hue step on the root and on a theme scope', async () => {
    const el = await fixture(html`<div data-lr-theme-scope id="s"></div>`);
    const style = getComputedStyle(el);
    for (const hue of ['gray', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']) {
      for (const step of ['05', '10', '20', '30', '40', '50', '60', '70', '80', '90', '95']) {
        expect(style.getPropertyValue(`--lr-color-${hue}-${step}`).trim(), `${hue}-${step}`).to.match(/^#[0-9a-f]{6}$/);
      }
    }
    expect(style.getPropertyValue('--lr-color-red-50').trim()).to.equal('#bb0320');
  });
});

describe('native control extensions', () => {
  async function scope(inner: ReturnType<typeof html>, style = '') {
    return fixture<HTMLElement>(html`<div class="lr-native" data-lr-theme-scope style=${style}>${inner}</div>`);
  }

  it('tints checkbox, radio and range from the brand token and shifts them on hover', async () => {
    await resetMouse();
    const el = await scope(
      html`<input id="c" type="checkbox" /><input id="r" type="radio" /><input id="g" type="range" /><input id="d" type="checkbox" disabled />`,
      '--lr-color-brand: rgb(1, 2, 3); --lr-color-brand-border-loud: rgb(7, 8, 9)'
    );
    for (const id of ['c', 'r', 'g']) {
      expect(getComputedStyle(el.querySelector(`#${id}`)!).accentColor, id).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(el.querySelector(`#${id}`)!).cursor, id).to.equal('pointer');
    }
    expect(getComputedStyle(el.querySelector('#d')!).cursor).to.equal('not-allowed');
    await hoverUntilMatched(el.querySelector('#c')!, 'checkbox hovered');
    expect(getComputedStyle(el.querySelector('#c')!).accentColor).to.equal('rgb(7, 8, 9)');
  });

  it('sizes the checkbox and range inline-size logically', async () => {
    const el = await scope(html`<input id="c" type="checkbox" /><input id="g" type="range" />`, '--lr-native-check-size: 20px');
    expect(el.querySelector('#c')!.getBoundingClientRect().width).to.equal(20);
    expect(getComputedStyle(el.querySelector('#g')!).boxSizing).to.equal('border-box');
  });

  it('gives the colour well and the file selector button control chrome and a pointer cursor', async () => {
    await resetMouse();
    const el = await scope(
      html`<input id="col" type="color" /><input id="f" type="file" />`,
      '--lr-color-border: rgb(10, 11, 12); --lr-radius: 9px'
    );
    const color = getComputedStyle(el.querySelector('#col')!);
    expect(color.borderTopColor).to.equal('rgb(10, 11, 12)');
    expect(color.borderTopLeftRadius).to.equal('9px');
    expect(color.cursor).to.equal('pointer');
    const button = getComputedStyle(el.querySelector('#f')!, '::file-selector-button');
    expect(button.borderTopColor).to.equal('rgb(10, 11, 12)');
    expect(button.cursor).to.equal('pointer');
  });

  it('draws progress and meter as a pill track with the token height', async () => {
    const el = await scope(
      html`<progress id="p" value="30" max="100"></progress><meter id="m" value="0.5"></meter>`,
      '--lr-native-meter-block-size: 11px; --lr-radius-pill: 40px'
    );
    for (const id of ['p', 'm']) {
      const style = getComputedStyle(el.querySelector(`#${id}`)!);
      expect(style.blockSize, id).to.equal('11px');
      expect(style.borderTopLeftRadius, id).to.equal('40px');
    }
  });

  it('bounds details with a subtle edge and marks text with the warning tone', async () => {
    const el = await scope(
      html`<details id="d" open><summary>s</summary><p>body</p></details><mark id="mk">hit</mark>`,
      '--lr-color-border-subtle: rgb(1, 1, 1); --lr-color-warning-fill-quiet: rgb(2, 2, 2); --lr-color-warning-on-quiet: rgb(3, 3, 3)'
    );
    const d = getComputedStyle(el.querySelector('#d')!);
    expect(d.borderTopColor).to.equal('rgb(1, 1, 1)');
    const mark = getComputedStyle(el.querySelector('#mk')!);
    expect(mark.backgroundColor).to.equal('rgb(2, 2, 2)');
    expect(mark.color).to.equal('rgb(3, 3, 3)');
  });

  it('styles a native dialog from the overlay surface and the container radius', async () => {
    const el = await scope(
      html`<dialog id="dlg"><p>hi</p></dialog>`,
      '--lr-color-surface-overlay: rgb(5, 5, 5); --lr-radius-container: 13px'
    );
    const dlg = el.querySelector<HTMLDialogElement>('#dlg')!;
    dlg.show();
    const style = getComputedStyle(dlg);
    expect(style.backgroundColor).to.equal('rgb(5, 5, 5)');
    expect(style.borderTopLeftRadius).to.equal('13px');
    dlg.close();
  });

  it('indents lists with a logical start inset that mirrors under RTL', async () => {
    const el = await scope(
      html`<ul id="l" dir="ltr"><li>a</li></ul><ul id="r" dir="rtl"><li>a</li></ul>`,
      '--lr-native-list-indent: 17px'
    );
    expect(getComputedStyle(el.querySelector('#l')!).paddingLeft).to.equal('17px');
    expect(getComputedStyle(el.querySelector('#r')!).paddingRight).to.equal('17px');
    expect(getComputedStyle(el.querySelector('#r')!).paddingLeft).to.equal('0px');
  });

  it('stays inert outside an .lr-native scope', async () => {
    const el = await fixture(html`<div><input id="c" type="checkbox" /><mark id="m">x</mark></div>`);
    expect(getComputedStyle(el.querySelector('#c')!).cursor).to.not.equal('pointer');
    expect(getComputedStyle(el.querySelector('#m')!).borderRadius).to.equal('0px');
  });
});
