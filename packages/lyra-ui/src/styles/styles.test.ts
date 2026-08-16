import { expect, fixture, html } from "@open-wc/testing";

const loadedLinks: HTMLLinkElement[] = [];
let fouceTagId = 0;

async function loadStylesheet(
  name: "native.css" | "utilities.css"
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
  expect(utilities).to.not.match(/\[class(?:\^|\$|\*)=/);
});
