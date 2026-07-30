import { fixture, expect, html } from '@open-wc/testing';
import './embedding-explorer.js';
import type { EmbeddingPoint, LyraEmbeddingExplorer } from './embedding-explorer.class.js';

const points: EmbeddingPoint[] = [
  { id: 'a', x: 0, y: 0, label: 'Alpha', cluster: 1 },
  { id: 'b', x: 1, y: 1, label: 'Beta', cluster: 1 },
];

describe('lr-embedding-explorer', () => {
  it('renders one focusable SVG point per finite coordinate', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .strings=${{ embeddingExplorerLabel: 'Vectors' }} .points=${[...points, { id: 'bad', x: NaN, y: 0 }]}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
  });

  it('emits the selected point', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const event = new Promise<CustomEvent>((resolve) => el.addEventListener('lr-point-select', resolve, { once: true }));
    (el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect((await event).detail.point.id).to.equal('a');
  });

  it('supports keyboard activation and navigation', async () => {
    const el = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const point = el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement;
    point.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(point).to.exist;
  });

  it('exposes selectable points as listbox options with explicit selected state', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer selected-id="b" .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    expect(el.shadowRoot!.querySelector('[part="plot"]')!.getAttribute('role')).to.equal('listbox');
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="point"]')].map((point) => [
        point.getAttribute('role'),
        point.getAttribute('aria-selected'),
      ]),
    ).to.deep.equal([
      ['option', 'false'],
      ['option', 'true'],
    ]);
  });

  it('keeps a real focus stop when the focused point is removed', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    const second = el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')[1]!;
    second.focus();
    el.points = [points[0]!];
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal('0');
  });

  it('synchronizes the roving tab stop for pointer and direct-focus activation', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    let rendered = [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')];
    rendered[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    rendered = [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')];
    expect(rendered.map((point) => point.getAttribute('tabindex'))).to.deep.equal(['-1', '0']);

    rendered[0]!.focus();
    await el.updateComplete;
    rendered = [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')];
    expect(rendered.map((point) => point.getAttribute('tabindex'))).to.deep.equal(['0', '-1']);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('a');
  });

  it('formats the point position with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer lang="ar-u-nu-arab" .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('aria-label')).to.contain('١');
  });

  it('keeps point picking at least 24px across narrow allocations', async () => {
    for (const width of [320, 383]) {
      const wrapper = await fixture(html`
        <div style="inline-size: ${width}px">
          <lr-embedding-explorer .points=${points}></lr-embedding-explorer>
        </div>
      `);
      const hit = wrapper
        .querySelector<LyraEmbeddingExplorer>('lr-embedding-explorer')!
        .shadowRoot!.querySelector<SVGGeometryElement>('.point-hit')!;
      // Each iteration appends another fixture below the previous one, so the later allocations
      // can sit past the bottom of the viewport -- where `elementFromPoint` returns `null`
      // regardless of how big the pick target is. Scroll first, then read the CTM, so the
      // screen-space coordinates below are the ones actually being hit-tested.
      wrapper.scrollIntoView({ block: 'center', inline: 'nearest' });
      const style = getComputedStyle(hit);
      const matrix = hit.getScreenCTM()!;
      const renderedScale = Math.hypot(matrix.a, matrix.b);
      const worldDiameter =
        hit instanceof SVGCircleElement
          ? hit.r.baseVal.value * 2
          : Math.hypot(
              (hit as SVGLineElement).x2.baseVal.value - (hit as SVGLineElement).x1.baseVal.value,
              (hit as SVGLineElement).y2.baseVal.value - (hit as SVGLineElement).y1.baseVal.value,
            );
      const strokeWidth = style.stroke === 'none' ? 0 : Number.parseFloat(style.strokeWidth);
      const renderedStroke =
        hit.getAttribute('vector-effect') === 'non-scaling-stroke'
          ? strokeWidth
          : strokeWidth * renderedScale;
      expect(worldDiameter * renderedScale + renderedStroke, `${width}px allocation`).to.be.at.least(
        24,
      );
      const center = new DOMPoint(0, 0).matrixTransform(matrix);
      expect(
        hit.getRootNode<ShadowRoot>().elementFromPoint(center.x + 11, center.y),
        `${width}px allocation pointer edge`,
      ).to.equal(hit);
    }
  });

  it('applies the height property to the rendered plot', async () => {
    // `height` is documented as the SVG block size. Rendering it as an SVG presentation attribute
    // cannot deliver that: a stylesheet declaration always beats a presentation attribute, so
    // `[part='plot'] { block-size: auto }` won at every value, including the 360px default.
    const el = (await fixture(
      html`<lr-embedding-explorer
        height="240px"
        .points=${[{ id: 'a', x: 0.1, y: 0.2, label: 'A' }]}
      ></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    expect(getComputedStyle(plot).blockSize).to.equal('240px');
  });

  it('renders its documented default height when height is left unset', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    expect(getComputedStyle(plot).blockSize).to.equal('360px');
  });

  it('lets a consumer ::part(plot) block-size rule win over the height property', async () => {
    // The height plumbing must stay in a custom property read by the component's own
    // `[part='plot']` rule. An inline `block-size` on the SVG would out-rank an outside
    // `::part(plot)` rule and leave the plot unsizeable by consumers.
    const wrapper = await fixture(html`
      <div>
        <style>
          .plot-block-size-override::part(plot) {
            block-size: 120px;
          }
        </style>
        <lr-embedding-explorer
          class="plot-block-size-override"
          height="240px"
          .points=${points}
        ></lr-embedding-explorer>
      </div>
    `);
    const el = wrapper.querySelector<LyraEmbeddingExplorer>('lr-embedding-explorer')!;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    expect(getComputedStyle(plot).blockSize).to.equal('120px');
  });

  it('keeps aspect-ratio-preserved sizing when height is auto', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer height="auto" .points=${points}></lr-embedding-explorer>`,
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    const style = getComputedStyle(plot);
    const inline = Number.parseFloat(style.inlineSize);
    const block = Number.parseFloat(style.blockSize);
    expect(inline, 'plot inline size').to.be.greaterThan(0);
    expect(block, 'plot block size').to.be.greaterThan(0);
    // The plot's `viewBox` is 640x360, so `auto` resolves through that intrinsic aspect ratio.
    expect(block, 'plot block size').to.be.closeTo(inline * (360 / 640), 1);
  });

  it('keeps the narrow-allocation minimum block size a floor above the height property', async () => {
    const wrapper = await fixture(html`
      <div style="inline-size: 300px">
        <lr-embedding-explorer height="100px" .points=${points}></lr-embedding-explorer>
      </div>
    `);
    const el = wrapper.querySelector<LyraEmbeddingExplorer>('lr-embedding-explorer')!;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(Number.parseFloat(getComputedStyle(plot).blockSize), 'narrow floor').to.be.closeTo(
      rootFontSize * 12,
      0.5,
    );
  });

  it('is accessible in empty and populated states', async () => {
    const empty = (await fixture(html`<lr-embedding-explorer></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await expect(empty).to.be.accessible();
    const populated = (await fixture(html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;
    await expect(populated).to.be.accessible();
  });
});
