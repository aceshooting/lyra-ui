import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "./breadcrumb.js";
import "./breadcrumb-item.js";
import type { LyraBreadcrumb } from "./breadcrumb.js";

class BreadcrumbSeparatorTestControl extends HTMLElement {
  static connectedCount = 0;
  static disconnectedCount = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = '<button type="button">Decorative custom action</button>';
  }

  connectedCallback(): void { BreadcrumbSeparatorTestControl.connectedCount += 1; }
  disconnectedCallback(): void { BreadcrumbSeparatorTestControl.disconnectedCount += 1; }
}

if (!customElements.get("breadcrumb-separator-test-control")) {
  customElements.define("breadcrumb-separator-test-control", BreadcrumbSeparatorTestControl);
}

it("renders navigable breadcrumb items and marks the current page", async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const current = el.querySelector("lr-breadcrumb-item")?.nextElementSibling;
  expect(current?.shadowRoot?.querySelector('[aria-current="page"]')).to.exist;
  expect(
    el.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")
  ).to.equal("Breadcrumb");
  await expect(el).to.be.accessible();
});

it("forwards a host aria-label to the shadow <nav> landmark, overriding the localized default", async () => {
  const el = await fixture(html`<lr-breadcrumb aria-label="Docs breadcrumb">
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  expect(
    el.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")
  ).to.equal("Docs breadcrumb");
});

it("localizes the nav landmark default accessible name via .strings, proving the call site is wired up", async () => {
  const el = await fixture(html`<lr-breadcrumb
    .strings=${{ breadcrumb: "Fil d’Ariane" }}
  >
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  expect(
    el.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")
  ).to.equal("Fil d’Ariane");
});

it("names the trail from the accessibleLabel property, not only from the aria-label attribute", async () => {
  const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const nav = (): string | null =>
    el.shadowRoot!.querySelector("nav")?.getAttribute("aria-label") ?? null;
  expect(nav()).to.equal("Breadcrumb");

  // A plain property assignment writes no attribute (accessibleLabel does not reflect), so this
  // only reaches the landmark if render() consults the property rather than the host attribute.
  el.accessibleLabel = "Docs trail";
  await el.updateComplete;
  expect(el.hasAttribute("aria-label")).to.equal(false);
  expect(nav()).to.equal("Docs trail");

  // It outranks the mapped `label`, and a host attribute still outranks it.
  el.label = "Mapped trail";
  await el.updateComplete;
  expect(nav()).to.equal("Docs trail");

  el.setAttribute("aria-label", "Host trail");
  await el.updateComplete;
  expect(nav()).to.equal("Host trail");

  // An explicitly empty host attribute stays empty rather than falling back.
  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(nav()).to.equal("");
});

it("accepts the mapped label property while preserving host aria-label priority", async () => {
  const mapped = await fixture(html`<lr-breadcrumb label="Project trail"></lr-breadcrumb>`);
  expect(mapped.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")).to.equal("Project trail");

  const overridden = await fixture(html`
    <lr-breadcrumb label="Project trail" aria-label="Host trail"></lr-breadcrumb>
  `);
  expect(overridden.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")).to.equal("Host trail");
});

it("treats an explicitly empty accessibleLabel/label property as a real override, distinct from an omitted one", async () => {
  const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const nav = (): string | null =>
    el.shadowRoot!.querySelector("nav")?.getAttribute("aria-label") ?? null;
  expect(nav()).to.equal("Breadcrumb");

  // A plain JS assignment writes no attribute, so this only reaches an empty landmark name if
  // render() distinguishes the explicit empty string from an omitted (undefined) property.
  el.accessibleLabel = "";
  await el.updateComplete;
  expect(nav()).to.equal("");

  el.accessibleLabel = undefined;
  el.label = "";
  await el.updateComplete;
  expect(nav()).to.equal("");
});

it("distributes the breadcrumb-level separator slot to every item", async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <span slot="separator">→</span>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const items = Array.from(el.querySelectorAll("lr-breadcrumb-item"));
  await waitUntil(
    () => items.every((item) => item.querySelector('[slot="separator"]')?.textContent === "→"),
    "the shared separator must reach each item",
  );
  const secondSlot = items[1]!.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="separator"]')!;
  expect(secondSlot.assignedNodes({ flatten: true }).map((node) => node.textContent).join("" )).to.equal("→");
});

it("updates shared separator clones in place when source content mutates", async () => {
  BreadcrumbSeparatorTestControl.connectedCount = 0;
  BreadcrumbSeparatorTestControl.disconnectedCount = 0;
  const el = await fixture(html`<lr-breadcrumb>
    <breadcrumb-separator-test-control slot="separator" data-tone="old"><span>Old</span></breadcrumb-separator-test-control>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const source = el.querySelector<BreadcrumbSeparatorTestControl>(':scope > [slot="separator"]')!;
  const second = el.querySelectorAll("lr-breadcrumb-item")[1]!;
  await waitUntil(() => second.querySelector('[slot="separator"]') !== null, "initial clone missing");
  const clone = second.querySelector<BreadcrumbSeparatorTestControl>('[slot="separator"]')!;
  const initialConnections = BreadcrumbSeparatorTestControl.connectedCount;

  source.setAttribute("data-tone", "new");
  source.querySelector("span")!.textContent = "New";
  await waitUntil(
    () => clone.getAttribute("data-tone") === "new" && clone.querySelector("span")?.textContent === "New",
    "live clone did not refresh",
  );
  expect(second.querySelector('[slot="separator"]') === clone).to.equal(true);
  expect(BreadcrumbSeparatorTestControl.connectedCount).to.equal(initialConnections);
  expect(BreadcrumbSeparatorTestControl.disconnectedCount).to.equal(0);
});

it("keeps generated focusable shared separators decorative and strips cloned identities", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <form id="breadcrumb-separator-form"></form>
      <span id="source-controls"></span>
      <span id="source-description"></span>
      <span id="source-label">Next</span>
      <lr-breadcrumb>
        <button
          slot="separator"
          id="breadcrumb-shared-separator"
          name="separator-action"
          form="breadcrumb-separator-form"
          aria-controls="source-controls"
          aria-describedby="source-description"
          aria-labelledby="source-label"
          formaction="/ignored"
          formenctype="multipart/form-data"
          formmethod="post"
          formnovalidate
          formtarget="_blank"
          type="button"
        >
          <span
            id="breadcrumb-shared-separator-child"
            name="separator-child"
            form="breadcrumb-separator-form"
            aria-describedby="source-description"
          >Next</span>
        </button>
        <lr-breadcrumb-item href="/home">Home</lr-breadcrumb-item>
        <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
        <lr-breadcrumb-item current>Current</lr-breadcrumb-item>
      </lr-breadcrumb>
    </div>
  `);
  const el = wrapper.querySelector("lr-breadcrumb")!;
  const items = Array.from(el.querySelectorAll<HTMLElement>("lr-breadcrumb-item"));
  const second = items[1]!;
  await waitUntil(
    () => second.querySelector<HTMLButtonElement>('button[slot="separator"]') !== null,
    "the shared separator must reach the visible second item",
  );

  const clone = second.querySelector<HTMLButtonElement>('button[slot="separator"]')!;
  const base = second.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  base.focus();
  const priorFocus = document.activeElement;
  clone.focus();

  expect(document.activeElement === clone, "a decorative clone must not accept focus").to.equal(false);
  expect(document.activeElement === priorFocus, "focus remains on the breadcrumb item").to.equal(true);
  expect(el.querySelectorAll("#breadcrumb-shared-separator").length).to.equal(1);
  const nestedClone = clone.querySelector<HTMLElement>("span")!;
  expect(el.querySelectorAll("#breadcrumb-shared-separator-child").length).to.equal(1);
  const unsafeCloneAttributes = [
    "id",
    "name",
    "form",
    "aria-controls",
    "aria-describedby",
    "aria-labelledby",
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
  ];
  expect(unsafeCloneAttributes.some((attribute) => clone.hasAttribute(attribute))).to.equal(false);
  expect(unsafeCloneAttributes.some((attribute) => nestedClone.hasAttribute(attribute))).to.equal(false);
  await expect(el).to.be.accessible();
});

it("keeps local native separator controls decorative", async () => {
  const el = await fixture(html`
    <lr-breadcrumb>
      <lr-breadcrumb-item href="/home">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/reports">
        <button slot="separator" type="button">Next</button>
        Reports
      </lr-breadcrumb-item>
    </lr-breadcrumb>
  `);
  const item = el.querySelectorAll<HTMLElement>("lr-breadcrumb-item")[1]!;
  const base = item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const separator = item.querySelector<HTMLButtonElement>('button[slot="separator"]')!;
  base.focus();
  const priorFocus = document.activeElement;
  separator.focus();

  expect(document.activeElement === separator).to.equal(false);
  expect(document.activeElement === priorFocus).to.equal(true);
  await expect(el).to.be.accessible();
});

it("keeps custom shared separator controls decorative", async () => {
  const el = await fixture(html`
    <lr-breadcrumb>
      <breadcrumb-separator-test-control slot="separator"></breadcrumb-separator-test-control>
      <lr-breadcrumb-item href="/home">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
    </lr-breadcrumb>
  `);
  const second = el.querySelectorAll<HTMLElement>("lr-breadcrumb-item")[1]!;
  await waitUntil(
    () => second.querySelector("breadcrumb-separator-test-control") !== null,
    "the custom shared separator must reach the visible second item",
  );

  const base = second.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const separator = second.querySelector<HTMLElement>("breadcrumb-separator-test-control")!;
  const separatorButton = separator.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
  base.focus();
  const priorFocus = document.activeElement;
  separatorButton.focus();

  expect(document.activeElement === priorFocus).to.equal(true);
  expect(separator.shadowRoot!.activeElement === separatorButton).to.equal(false);
  await expect(el).to.be.accessible();
});

it("renders separators as explicitly decorative content", async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const [first, second] = Array.from(el.querySelectorAll("lr-breadcrumb-item"));
  expect(first.getAttribute("role")).to.equal("listitem");
  const firstSeparator = first.shadowRoot!.querySelector('[part="separator"]')!;
  const secondSeparator =
    second.shadowRoot!.querySelector('[part="separator"]')!;
  expect(firstSeparator.getAttribute("aria-hidden")).to.equal("true");
  expect(secondSeparator.getAttribute("aria-hidden")).to.equal("true");
  expect(firstSeparator.hasAttribute("inert")).to.equal(true);
  expect(secondSeparator.hasAttribute("inert")).to.equal(true);
  expect(getComputedStyle(firstSeparator).display).to.equal("none");
  expect(getComputedStyle(secondSeparator).display).to.not.equal("none");
});

it("hides the first owned item's separator regardless of auxiliary sibling order", async () => {
  const el = await fixture(html`<lr-breadcrumb>
    <span slot="separator">/</span>
    <span>Ignored auxiliary content</span>
    <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
    <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
  </lr-breadcrumb>`);
  const [first, second] = [...el.querySelectorAll("lr-breadcrumb-item")];
  await waitUntil(() => first!.hasAttribute("data-lr-breadcrumb-first"), "first-item state missing");
  expect(getComputedStyle(first!.shadowRoot!.querySelector('[part="separator"]')!).display).to.equal("none");
  expect(getComputedStyle(second!.shadowRoot!.querySelector('[part="separator"]')!).display).to.not.equal("none");

  el.append(first!);
  await waitUntil(() => second!.hasAttribute("data-lr-breadcrumb-first"), "first-item state did not follow reorder");
  expect(getComputedStyle(second!.shadowRoot!.querySelector('[part="separator"]')!).display).to.equal("none");
  expect(getComputedStyle(first!.shadowRoot!.querySelector('[part="separator"]')!).display).to.not.equal("none");
});

it("contains a long localized RTL trail at an exact 320px allocation", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-breadcrumb label="مسار المشروع">
        <lr-breadcrumb-item href="/">الصفحة-الرئيسية-ذات-العنوان-الطويل-جداً</lr-breadcrumb-item>
        <lr-breadcrumb-item href="/reports">التقارير-التحليلية-المفصلة-جداً</lr-breadcrumb-item>
        <lr-breadcrumb-item current>النتيجة-الحالية-ذات-العنوان-الطويل-جداً</lr-breadcrumb-item>
      </lr-breadcrumb>
    </div>
  `);
  const el = wrapper.querySelector("lr-breadcrumb") as HTMLElement;
  const list = el.shadowRoot!.querySelector<HTMLElement>('[part="list"]')!;

  expect(el.scrollWidth).to.be.at.most(el.clientWidth);
  expect(list.scrollWidth).to.be.at.most(list.clientWidth);
  expect(getComputedStyle(list).direction).to.equal("rtl");
});
