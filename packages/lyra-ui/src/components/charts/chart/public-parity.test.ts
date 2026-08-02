import { aTimeout, expect, fixture, html, waitUntil } from "@open-wc/testing";
import "./chart.js";
import type { LyraChart } from "./chart.js";

it("publishes the documented chart defaults and reflected negative controls", async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;

  expect(el.type).to.equal("bar");
  expect(el.description).to.equal(null);
  expect(el.grid).to.equal("both");
  expect(el.indexAxis).to.equal("x");
  expect(el.label).to.equal(null);
  expect(el.legendPosition).to.equal("top");
  expect(el.max).to.equal(null);
  expect(el.min).to.equal(null);
  expect(el.plugins).to.deep.equal([]);
  expect(el.stacked).to.equal(false);
  expect(el.withoutAnimation).to.equal(false);
  expect(el.withoutLegend).to.equal(false);
  expect(el.withoutTooltip).to.equal(false);
  expect(el.xLabel).to.equal(null);
  expect(el.yLabel).to.equal(null);

  el.withoutAnimation = true;
  el.withoutLegend = true;
  el.withoutTooltip = true;
  await el.updateComplete;
  expect(el.hasAttribute("without-animation")).to.equal(true);
  expect(el.hasAttribute("without-legend")).to.equal(true);
  expect(el.hasAttribute("without-tooltip")).to.equal(true);
});

it("reads a Chart.js configuration object from the default JSON script slot", async () => {
  const el = (await fixture(html`
    <lr-chart>
      <script type="application/json">
        {
          "type": "radar",
          "data": {
            "labels": ["A"],
            "datasets": [{ "label": "Score", "data": [4] }]
          }
        }
      </script>
    </lr-chart>
  `)) as LyraChart;
  await el.updateComplete;
  await aTimeout(0);

  expect(el.shadowRoot!.querySelectorAll("slot:not([name])").length).to.equal(
    1
  );
  const config = (el as unknown as { buildConfig(): any }).buildConfig();
  expect(config.type).to.equal("radar");
  expect(config.data.labels).to.deep.equal(["A"]);
  expect(config.data.datasets[0].label).to.equal("Score");
});

it("gives an explicit config property precedence over the JSON slot and ignores invalid JSON", async () => {
  const el = (await fixture(html`
    <lr-chart>
      <script type="application/json">
        { "type": "radar" }
      </script>
    </lr-chart>
  `)) as LyraChart;
  await aTimeout(0);
  el.config = { type: "line" };
  expect((el as unknown as { buildConfig(): any }).buildConfig().type).to.equal(
    "line"
  );

  const invalid = (await fixture(html`
    <lr-chart>
      <script type="application/json">
        not json
      </script>
    </lr-chart>
  `)) as LyraChart;
  await aTimeout(0);
  expect(
    (invalid as unknown as { buildConfig(): any }).buildConfig().type
  ).to.equal("bar");
});

it("maps the documented grid, axis, bounds, plugins, and negative controls into Chart.js", () => {
  const el = document.createElement("lr-chart") as LyraChart;
  const plugin = { id: "public-plugin" };
  el.type = "bar";
  el.grid = "x";
  el.indexAxis = "y";
  el.min = 2;
  el.max = 12;
  el.plugins = [plugin];
  el.withoutAnimation = true;
  el.withoutTooltip = true;

  const config = (el as unknown as { buildConfig(): any }).buildConfig();
  expect(config.options.indexAxis).to.equal("y");
  expect(config.options.animation).to.equal(false);
  expect(config.options.plugins.tooltip.enabled).to.equal(false);
  expect(config.options.scales.x.type).to.equal("linear");
  expect(config.options.scales.y.type).to.equal("category");
  expect(config.options.scales.x.beginAtZero).to.equal(true);
  expect(config.options.scales.x.min).to.equal(2);
  expect(config.options.scales.x.max).to.equal(12);
  expect(config.options.scales.x.grid.display).to.equal(true);
  expect(config.options.scales.y.grid.display).to.equal(false);
  expect(config.plugins.includes(plugin)).to.equal(true);
});

it("combines plugins from the public property and raw config without duplicate identities", () => {
  const el = document.createElement("lr-chart") as LyraChart;
  const propertyPlugin = { id: "property-plugin" };
  const configPlugin = { id: "config-plugin" };
  el.plugins = [propertyPlugin];
  el.config = { plugins: [configPlugin, propertyPlugin] };

  const config = (el as unknown as { buildConfig(): any }).buildConfig();
  expect(config.plugins).to.deep.equal([configPlugin, propertyPlugin]);
});

it("drops non-finite public min/max values before they reach Chart.js", () => {
  const el = document.createElement("lr-chart") as LyraChart;
  el.min = Number.NEGATIVE_INFINITY;
  el.max = Number.NaN;
  const config = (el as unknown as { buildConfig(): any }).buildConfig();
  expect(config.options.scales.y.min).to.equal(undefined);
  expect(config.options.scales.y.max).to.equal(undefined);
});

it("shows the legend by default, lets without-legend hide it, and keeps legend as a positive alias", async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: "Revenue", data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll("canvas").length === 1);
  expect(el.shadowRoot!.querySelectorAll('[part="legend"]').length).to.equal(1);

  el.withoutLegend = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend"]').length).to.equal(0);

  el.withoutLegend = false;
  el.legend = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend"]').length).to.equal(1);
});

it("forwards label and description to the semantic canvas and description node", async () => {
  const el = (await fixture(html`
    <lr-chart
      label="Quarterly revenue"
      description="Revenue grew each quarter"
    ></lr-chart>
  `)) as LyraChart;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll("canvas").length === 1);

  expect(
    el.shadowRoot!.querySelector("canvas")?.getAttribute("aria-label")
  ).to.equal("Quarterly revenue");
  expect(
    el.shadowRoot!.querySelector('[part="description"]')?.textContent
  ).to.equal("Revenue grew each quarter");
});

it("maps logical legend positions to the inline start and end in both directions", () => {
  const el = document.createElement("lr-chart") as LyraChart;
  el.legendPosition = "start";
  expect(
    (
      el as unknown as { legendPositionForConfig(): unknown }
    ).legendPositionForConfig()
  ).to.equal("left");
  el.setAttribute("dir", "rtl");
  expect(
    (
      el as unknown as { legendPositionForConfig(): unknown }
    ).legendPositionForConfig()
  ).to.equal("right");
  el.legendPosition = "end";
  expect(
    (
      el as unknown as { legendPositionForConfig(): unknown }
    ).legendPositionForConfig()
  ).to.equal("left");
});

it("resolves every chart styling category through the documented CSS hook aliases", async () => {
  const el = (await fixture(
    html`<lr-chart type="bar"></lr-chart>`
  )) as LyraChart;
  el.labels = ["A"];
  el.datasets = [{ label: "Revenue", data: [4] }];
  el.style.setProperty("--border-color-1", "rgb(11, 12, 13)");
  el.style.setProperty("--fill-color-1", "rgb(21, 22, 23)");
  el.style.setProperty("--border-radius", "7");
  el.style.setProperty("--border-width", "3");
  el.style.setProperty("--grid-border-width", "4");
  el.style.setProperty("--grid-color", "rgb(31, 32, 33)");
  el.style.setProperty("--line-border-width", "5");
  el.style.setProperty("--point-radius", "6");
  await el.updateComplete;

  const config = (el as unknown as { buildConfig(): any }).buildConfig();
  const dataset = config.data.datasets[0];
  expect(dataset.borderColor).to.equal("rgb(11, 12, 13)");
  expect(dataset.backgroundColor).to.equal("rgb(21, 22, 23)");
  expect(dataset.borderRadius).to.equal(7);
  expect(dataset.borderWidth).to.equal(3);
  expect(dataset.pointRadius).to.equal(6);
  expect(config.options.scales.x.grid.color).to.equal("rgb(31, 32, 33)");
  expect(config.options.scales.x.grid.lineWidth).to.equal(4);

  el.type = "line";
  const line = (el as unknown as { buildConfig(): any }).buildConfig().data
    .datasets[0];
  expect(line.borderWidth).to.equal(5);
});

it("resolves all six public border and fill color hooks for proportional slices", async () => {
  const el = (await fixture(
    html`<lr-chart type="pie"></lr-chart>`
  )) as LyraChart;
  el.labels = ["A", "B", "C", "D", "E", "F"];
  el.datasets = [{ label: "Share", data: [1, 2, 3, 4, 5, 6] }];
  const borders: string[] = [];
  const fills: string[] = [];
  for (let index = 1; index <= 6; index++) {
    const border = `rgb(${index}, ${index + 10}, ${index + 20})`;
    const fill = `rgb(${index + 30}, ${index + 40}, ${index + 50})`;
    el.style.setProperty(`--border-color-${index}`, border);
    el.style.setProperty(`--fill-color-${index}`, fill);
    borders.push(border);
    fills.push(fill);
  }
  await el.updateComplete;

  const dataset = (el as unknown as { buildConfig(): any }).buildConfig().data
    .datasets[0];
  expect(dataset.borderColor).to.deep.equal(borders);
  expect(dataset.backgroundColor).to.deep.equal(fills);
});
