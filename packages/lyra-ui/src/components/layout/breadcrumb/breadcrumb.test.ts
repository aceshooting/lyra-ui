import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "./breadcrumb.js";
import "./breadcrumb-item.js";

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

it("accepts the mapped label property while preserving host aria-label priority", async () => {
  const mapped = await fixture(html`<lr-breadcrumb label="Project trail"></lr-breadcrumb>`);
  expect(mapped.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")).to.equal("Project trail");

  const overridden = await fixture(html`
    <lr-breadcrumb label="Project trail" aria-label="Host trail"></lr-breadcrumb>
  `);
  expect(overridden.shadowRoot!.querySelector("nav")?.getAttribute("aria-label")).to.equal("Host trail");
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
  expect(getComputedStyle(firstSeparator).display).to.equal("none");
  expect(getComputedStyle(secondSeparator).display).to.not.equal("none");
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
