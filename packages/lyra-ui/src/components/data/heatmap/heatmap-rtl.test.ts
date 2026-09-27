import { fixture, expect, html } from "@open-wc/testing";
import "./heatmap.js";
import type { LyraHeatmap } from "./heatmap.js";

it("mirrors the low-to-high legend ramp in RTL", async () => {
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-heatmap
        .data=${{
          kind: "matrix",
          rowLabels: [],
          colLabels: [],
          values: [[1, 2]],
        }}
      ></lr-heatmap>
    </div>
  `);
  const el = wrapper.querySelector("lr-heatmap") as LyraHeatmap;
  const bar = el.shadowRoot!.querySelector('[part="legend"] .bar')!;

  expect(getComputedStyle(bar).transform).to.equal("matrix(-1, 0, 0, 1, 0, 0)");
});

it("mirrors a consumer-provided multi-stop palette without rewriting its color order", async () => {
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-heatmap
        .colorSteps=${["#010203", "#040506", "#070809"]}
        .data=${{
          kind: "matrix",
          rowLabels: [],
          colLabels: [],
          values: [[1, 2]],
        }}
      ></lr-heatmap>
    </div>
  `);
  const el = wrapper.querySelector("lr-heatmap") as LyraHeatmap;
  const gradient = el.style.getPropertyValue(
    "--lr-heatmap-color-steps-gradient"
  );
  const bar = el.shadowRoot!.querySelector('[part="legend"] .bar')!;

  expect(gradient).to.include("#010203, #040506, #070809");
  expect(getComputedStyle(bar).transform).to.equal("matrix(-1, 0, 0, 1, 0, 0)");
});

describe('bidi isolation of formatted labels', () => {
  function renderedBox(root: Element, needle: string): DOMRect {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const index = node.data.indexOf(needle);
      if (index < 0) continue;
      const range = root.ownerDocument.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      return range.getBoundingClientRect();
    }
    throw new Error(`"${needle}" is not rendered in ${root.localName}`);
  }

  it('keeps a negative scale endpoint sign-first under dir="rtl"', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-heatmap
        .domain=${[-3, 7]}
        .data=${{ kind: 'matrix', rowLabels: ['A'], colLabels: ['x', 'y'], values: [[1, 7]] }}
      ></lr-heatmap>
    </div>`);
    const el = wrapper.querySelector('lr-heatmap') as LyraHeatmap;
    await el.updateComplete;
    const low = el.shadowRoot!.querySelector('[part="legend-lo"]')!;
    expect(low.textContent).to.equal('-3');
    expect(renderedBox(low, '-').left, 'minus before digits').to.be.below(renderedBox(low, '3').left);
  });

  it('keeps number-first legend-stop captions and the cellText tooltip in order under dir="rtl"', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-heatmap
        .data=${{ kind: 'matrix', rowLabels: ['A'], colLabels: ['x', 'y'], values: [[1, 2]] }}
        .legendStops=${[{ value: 1, label: '1.5 MiB/s', color: 'red' }, { value: 2, label: '2.5 MiB/s', color: 'blue' }]}
        .cellText=${(_pos: unknown, value: number) => `${value}.5 MiB/s`}
      ></lr-heatmap>
    </div>`);
    const el = wrapper.querySelector('lr-heatmap') as LyraHeatmap;
    await el.updateComplete;
    for (const caption of el.shadowRoot!.querySelectorAll('[part="legend-stop-label"]')) {
      const text = caption.textContent ?? '';
      expect(renderedBox(caption, text.slice(0, 3)).left, `"${text}"`).to.be.below(renderedBox(caption, 'MiB/s').left);
    }
    (el as unknown as { hoverCell: unknown }).hoverCell = { row: 0, col: 0 };
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]')!;
    expect(tooltip.textContent).to.equal('1.5 MiB/s');
    expect(renderedBox(tooltip, '1.5').left, 'tooltip number before unit').to.be.below(
      renderedBox(tooltip, 'MiB/s').left,
    );
  });
});
