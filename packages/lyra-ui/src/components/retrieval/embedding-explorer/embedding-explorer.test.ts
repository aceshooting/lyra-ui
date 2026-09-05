import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './embedding-explorer.js';
import type {
  EmbeddingPoint,
  LyraEmbeddingExplorer,
} from './embedding-explorer.class.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const points: EmbeddingPoint[] = [
  { id: 'a', x: 0, y: 0, label: 'Alpha', cluster: 1 },
  { id: 'b', x: 1, y: 1, label: 'Beta', cluster: 1 },
];

// This build of WebKit hangs the whole test file indefinitely (not just this test -- the entire
// browser session stops responding) partway through this specific test, reproducibly, in complete
// isolation from every other file. Individually replaying each statement here (fixture, a second
// fixture in the same loop iteration, scrollIntoView, getScreenCTM, matrixTransform,
// getRootNode().elementFromPoint) against a freshly authored minimal reproduction never hangs --
// only the full test body run from this exact file does, which rules out plain resource
// contention and rules out any single API call as the sole trigger, but stops short of a
// confirmed root cause. Skip on WebKit rather than guess further fixes with no diagnosis to test
// them against; investigate with real WebKit devtools/native debugging before removing this.
const isWebKit =
  /Safari\//.test(navigator.userAgent) &&
  !/Chrome|Chromium|Edg\//.test(navigator.userAgent);

describe('lr-embedding-explorer', () => {
  it('renders one focusable SVG point per finite coordinate', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer
        .strings=${{ embeddingExplorerLabel: 'Vectors' }}
        .points=${[...points, { id: 'bad', x: NaN, y: 0 }]}
      ></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(
      2
    );
  });

  it('applies strings overrides to populated and empty accessible labels', async () => {
    const strings = {
      embeddingExplorerLabel: 'Vectors',
      embeddingExplorerEmpty: 'No vectors',
    };
    const empty = (await fixture(
      html`<lr-embedding-explorer .strings=${strings}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    const emptyBase =
      empty.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(emptyBase.getAttribute('aria-label')).to.equal('Vectors');
    expect(emptyBase.querySelector('[part="empty"]')?.textContent).to.equal(
      'No vectors'
    );

    const populated = (await fixture(
      html`<lr-embedding-explorer
        .strings=${strings}
        .points=${points}
      ></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    const populatedBase =
      populated.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const plot =
      populated.shadowRoot!.querySelector<SVGElement>('[part="plot"]')!;
    expect(populatedBase.getAttribute('aria-label')).to.equal(null);
    expect(plot.getAttribute('aria-label')).to.equal('Vectors');
  });

  it('lets the host aria-label govern the plot across explicit-empty and dynamic changes', async () => {
    const el = (await fixture(html`
      <lr-embedding-explorer
        aria-label="Author vectors"
        .points=${points}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const plot = () => el.shadowRoot!.querySelector('[part="plot"]')!;
    expect(el.getAttribute('aria-label')).to.equal('Author vectors');
    expect(plot().getAttribute('aria-label')).to.equal('Author vectors');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('');
    expect(plot().getAttribute('aria-label')).to.equal('');
    el.setAttribute('aria-label', 'Revised vectors');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Revised vectors');
    expect(plot().getAttribute('aria-label')).to.equal('Revised vectors');
  });

  it('renders cluster membership as text and exposes it on each matching option', async () => {
    const el = (await fixture(html`
      <lr-embedding-explorer
        .points=${[
          { id: 'a', x: 0, y: 0, label: 'Alpha', cluster: 'Research' },
          { id: 'b', x: 1, y: 1, label: 'Beta', cluster: 'Operations' },
        ]}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const legend = el.shadowRoot!.querySelector('[part="legend"]')!;
    expect(legend.getAttribute('role')).to.equal('list');
    expect(
      [...legend.querySelectorAll('[part="legend-item"]')].map((item) => ({
        role: item.getAttribute('role'),
        text: item.textContent?.trim(),
      }))
    ).to.deep.equal([
      { role: 'listitem', text: 'Operations' },
      { role: 'listitem', text: 'Research' },
    ]);
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="point"]')].map((point) =>
        point.getAttribute('aria-description')
      )
    ).to.deep.equal(['Research', 'Operations']);
  });

  it('resolves distinct clusters through the canonical chart palette tokens', async () => {
    const el = (await fixture(html`
      <lr-embedding-explorer
        style="--lr-color-chart-1: rgb(1, 2, 3); --lr-color-chart-2: rgb(4, 5, 6)"
        .points=${[
          { ...points[0]!, cluster: 'first' },
          { ...points[1]!, cluster: 'second' },
        ]}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const markers = [
      ...el.shadowRoot!.querySelectorAll<SVGCircleElement>('.point-marker'),
    ];
    expect(markers.map((marker) => marker.getAttribute('fill'))).to.deep.equal([
      'var(--lr-color-chart-1)',
      'var(--lr-color-chart-2)',
    ]);
    expect(
      markers.map((marker) => getComputedStyle(marker).fill)
    ).to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)']);
  });

  it('ships reachable light, dark, and forced-color values for all eight canonical slots', async () => {
    const palettePoints: EmbeddingPoint[] = Array.from(
      { length: 8 },
      (_, index) => ({
        id: `cluster-${index}`,
        x: index,
        y: index,
        cluster: index,
      })
    );
    const fills = (el: LyraEmbeddingExplorer) =>
      [
        ...el.shadowRoot!.querySelectorAll<SVGCircleElement>('.point-marker'),
      ].map((marker) => getComputedStyle(marker).fill);
    const light = (await fixture(html`
      <lr-embedding-explorer
        data-lr-theme="light"
        .points=${palettePoints}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const dark = (await fixture(html`
      <lr-embedding-explorer
        data-lr-theme="dark"
        .points=${palettePoints}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const lightFills = fills(light);
    const darkFills = fills(dark);
    expect(new Set(lightFills).size).to.equal(8);
    expect(new Set(darkFills).size).to.equal(8);
    expect(darkFills).to.not.deep.equal(lightFills);

    try {
      await setForcedColors('active');
      const forcedFills = fills(light);
      expect(new Set(forcedFills).size).to.be.at.least(2);
      expect(
        forcedFills.every(
          (fill) => fill !== 'none' && fill !== 'rgba(0, 0, 0, 0)'
        )
      ).to.equal(true);
    } finally {
      await setForcedColors('none');
    }
  });

  it('emits the selected point', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const event = new Promise<CustomEvent>((resolve) =>
      el.addEventListener('lr-point-select', resolve, { once: true })
    );
    (
      el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement
    ).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect((await event).detail.point.id).to.equal('a');
  });

  it('supports keyboard activation and navigation', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;
    const rendered = () => [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];

    const selectEvent = oneEvent(el, 'lr-point-select');
    rendered()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    expect((await selectEvent).detail.point.id).to.equal('a');

    rendered()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(
      rendered().map((point) => point.getAttribute('tabindex'))
    ).to.deep.equal(['-1', '0']);
  });

  it('supports bounded vertical arrow aliases', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    const rendered = () => [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];

    rendered()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    );
    await el.updateComplete;
    expect(rendered()[0]!.getAttribute('tabindex')).to.equal('0');

    rendered()[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    await el.updateComplete;
    expect(rendered()[1]!.getAttribute('tabindex')).to.equal('0');

    rendered()[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    await el.updateComplete;
    expect(rendered()[1]!.getAttribute('tabindex')).to.equal('0');
  });

  it('exposes selectable points as listbox options with explicit selected state', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer
        selected-point-id="b"
        .points=${points}
      ></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    expect(
      el.shadowRoot!.querySelector('[part="plot"]')!.getAttribute('role')
    ).to.equal('listbox');
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="point"]')].map((point) => [
        point.getAttribute('role'),
        point.getAttribute('aria-selected'),
      ])
    ).to.deep.equal([
      ['option', 'false'],
      ['option', 'true'],
    ]);
  });

  it('keeps a real focus stop when the focused point is removed', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    const second =
      el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]')[1]!;
    second.focus();
    el.points = [points[0]!];
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal(
      '0'
    );
  });

  it('synchronizes the roving tab stop for pointer and direct-focus activation', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    let rendered = [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];
    rendered[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    rendered = [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];
    expect(
      rendered.map((point) => point.getAttribute('tabindex'))
    ).to.deep.equal(['-1', '0']);

    rendered[0]!.focus();
    await el.updateComplete;
    rendered = [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];
    expect(
      rendered.map((point) => point.getAttribute('tabindex'))
    ).to.deep.equal(['0', '-1']);
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('a');
  });

  it('formats the point position with the effective locale', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer
        lang="ar-u-nu-arab"
        .points=${points}
      ></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    expect(
      el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('aria-label')
    ).to.contain('١');
  });

  it('keeps point picking at least 24px across narrow allocations', async function () {
    if (isWebKit) this.skip();
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
              (hit as SVGLineElement).x2.baseVal.value -
                (hit as SVGLineElement).x1.baseVal.value,
              (hit as SVGLineElement).y2.baseVal.value -
                (hit as SVGLineElement).y1.baseVal.value
            );
      const strokeWidth =
        style.stroke === 'none' ? 0 : Number.parseFloat(style.strokeWidth);
      const renderedStroke =
        hit.getAttribute('vector-effect') === 'non-scaling-stroke'
          ? strokeWidth
          : strokeWidth * renderedScale;
      expect(
        worldDiameter * renderedScale + renderedStroke,
        `${width}px allocation`
      ).to.be.at.least(24);
      const center = new DOMPoint(0, 0).matrixTransform(matrix);
      const root = hit.getRootNode();
      expect(
        root instanceof ShadowRoot &&
          root.elementFromPoint(center.x + 11, center.y) === hit,
        `${width}px allocation pointer edge`
      ).to.equal(true);
    }
  });

  it('keeps a dense, long-label point set from overflowing a 320px allocation', async () => {
    const dense: EmbeddingPoint[] = Array.from({ length: 18 }, (_, index) => ({
      id: `point-${index}`,
      x: Math.cos((index / 18) * Math.PI * 2),
      y: Math.sin((index / 18) * Math.PI * 2),
      label: `Deployment guide for the unbroken-long-label-region-${index}-service-cluster-rollout`,
      cluster: index % 4,
    }));
    const wrapper = await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-embedding-explorer .points=${dense}></lr-embedding-explorer>
      </div>
    `);
    const el = wrapper.querySelector<LyraEmbeddingExplorer>(
      'lr-embedding-explorer'
    )!;
    await el.updateComplete;
    expect(
      el.scrollWidth,
      `host ${el.scrollWidth}/${el.clientWidth}`
    ).to.be.at.most(el.clientWidth + 1);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(
      base.scrollWidth,
      `base ${base.scrollWidth}/${el.clientWidth}`
    ).to.be.at.most(el.clientWidth + 1);
  });

  it('applies the height property to the rendered plot', async () => {
    // `height` is documented as the SVG block size. Rendering it as an SVG presentation attribute
    // cannot deliver that: a stylesheet declaration always beats a presentation attribute, so
    // `[part='plot'] { block-size: auto }` won at every value, including the 360px default.
    const el = (await fixture(
      html`<lr-embedding-explorer
        height="240px"
        .points=${[{ id: 'a', x: 0.1, y: 0.2, label: 'A' }]}
      ></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    expect(getComputedStyle(plot).blockSize).to.equal('240px');
  });

  it('renders its documented default height when height is left unset', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
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
    const el = wrapper.querySelector<LyraEmbeddingExplorer>(
      'lr-embedding-explorer'
    )!;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    expect(getComputedStyle(plot).blockSize).to.equal('120px');
  });

  it('keeps aspect-ratio-preserved sizing when height is auto', async () => {
    const el = (await fixture(
      html`<lr-embedding-explorer
        height="auto"
        .points=${points}
      ></lr-embedding-explorer>`
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
        <lr-embedding-explorer
          height="100px"
          .points=${points}
        ></lr-embedding-explorer>
      </div>
    `);
    const el = wrapper.querySelector<LyraEmbeddingExplorer>(
      'lr-embedding-explorer'
    )!;
    await el.updateComplete;

    const plot = el.shadowRoot!.querySelector('[part="plot"]') as SVGElement;
    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );
    expect(
      Number.parseFloat(getComputedStyle(plot).blockSize),
      'narrow floor'
    ).to.be.closeTo(rootFontSize * 12, 0.5);
  });

  it('is accessible in empty and populated states', async () => {
    const empty = (await fixture(
      html`<lr-embedding-explorer></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await expect(empty).to.be.accessible();
    const populated = (await fixture(
      html`<lr-embedding-explorer .points=${points}></lr-embedding-explorer>`
    )) as LyraEmbeddingExplorer;
    await expect(populated).to.be.accessible();
  });

  it('omits blank and later duplicate point ids after coordinate validation before selection and actions', async () => {
    const first = { id: 'same', x: 1, y: 1, label: 'First valid' };
    const el = (await fixture(html`
      <lr-embedding-explorer
        selected-point-id="same"
        .points=${[
          { id: '', x: 0, y: 0, label: 'Blank' },
          { id: 'same', x: Number.NaN, y: 0, label: 'Invalid coordinates' },
          first,
          { ...first, x: 2, label: 'Later duplicate' },
        ]}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;

    const rendered = el.shadowRoot!.querySelectorAll('[part="point"]');
    expect(rendered.length).to.equal(1);
    expect(rendered[0]!.getAttribute('data-selected')).to.equal('true');
    expect(rendered[0]!.getAttribute('aria-label')).to.contain('First valid');

    const selected = oneEvent(el, 'lr-point-select');
    rendered[0]!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true })
    );
    expect((await selected).detail).to.deep.equal({ point: first });
  });

  it('normalizes invalid collection and height inputs without retaining stale output', async () => {
    const el = (await fixture(html`
      <lr-embedding-explorer .points=${points}></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(
      2
    );

    el.points = null as unknown as readonly EmbeddingPoint[];
    el.height = 'definitely-not-a-css-length';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(
      0
    );
    expect(
      el.style.getPropertyValue('--lr-embedding-explorer-height')
    ).to.equal('');
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  });

  it('keeps the focused identity and logical RTL navigation across an unsorted replacement', async () => {
    const el = (await fixture(html`
      <lr-embedding-explorer
        dir="rtl"
        .points=${points}
      ></lr-embedding-explorer>
    `)) as LyraEmbeddingExplorer;
    const rendered = () => [
      ...el.shadowRoot!.querySelectorAll<SVGGElement>('[part="point"]'),
    ];
    rendered()[1]!.focus();

    el.points = [
      { ...points[1]!, x: -4, y: 8 },
      { ...points[0]!, x: 9, y: -2 },
    ];
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('b');

    const focused = el.shadowRoot!.activeElement as SVGGElement;
    focused.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
    );
    await el.updateComplete;
    expect(
      rendered().map((point) => point.getAttribute('tabindex'))
    ).to.deep.equal(['-1', '0']);

    rendered()[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    await el.updateComplete;
    expect(
      rendered().map((point) => point.getAttribute('tabindex'))
    ).to.deep.equal(['0', '-1']);
  });
});

// Regression: [part='point'][data-selected='true'] .point-marker is (0,3,0), exactly like the
// generic :hover/:focus-visible and :active marker rules above it, and sits last -- so on a
// SELECTED point it won both contests. Two consequences, one of them an accessibility defect:
// the press feedback was dead, and because [part='point'] and its :hover/:focus-visible rules all
// declare `outline: none`, the marker's stroke IS the entire focus indicator, which made a focused
// selected point pixel-for-pixel identical to a resting selected one. Focus arrives by real Tab:
// Firefox declines :focus-visible for a programmatic focus with no keyboard interaction behind it.
describe('selected point pointer/focus feedback', () => {
  async function selectedFixture(): Promise<{
    el: LyraEmbeddingExplorer;
    before: HTMLElement;
  }> {
    const wrapper = (await fixture(html`
      <div>
        <button type="button">before</button>
        <lr-embedding-explorer
          selected-point-id="a"
          .points=${points}
        ></lr-embedding-explorer>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector(
      'lr-embedding-explorer'
    ) as LyraEmbeddingExplorer;
    await el.updateComplete;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    return { el, before: wrapper.querySelector('button') as HTMLElement };
  }

  const markerOf = (el: LyraEmbeddingExplorer, index: number): SVGElement =>
    el.shadowRoot!.querySelector(
      `[part="point"][data-index="${index}"] .point-marker`
    ) as SVGElement;

  it("thickens a SELECTED point's ring once it is keyboard-focused", async () => {
    const { el, before } = await selectedFixture();
    const point = el.shadowRoot!.querySelector(
      '[part="point"][data-index="0"]'
    ) as SVGGElement;
    expect(
      point.getAttribute('data-selected'),
      'sanity: point 0 must be the selected one'
    ).to.equal('true');
    const marker = markerOf(el, 0);
    const resting = getComputedStyle(marker).strokeWidth;

    before.focus();
    let guard = 0;
    while (guard++ < 8 && el.shadowRoot!.activeElement !== point) {
      await sendKeys({ press: 'Tab' });
    }
    expect(
      el.shadowRoot!.activeElement === point,
      'Tab must reach the selected point'
    ).to.equal(true);
    expect(
      getComputedStyle(marker).strokeWidth,
      'a focused selected point must not look identical to a resting selected one'
    ).to.not.equal(resting);
    // The selection colour survives -- focus escalates the width channel, it does not repaint the
    // ring in some other colour and drop the "this one is selected" signal.
    expect(getComputedStyle(marker).stroke).to.equal(
      getComputedStyle(markerOf(el, 0)).stroke
    );
  });

  it("thickens a SELECTED point's ring further while it is held", async () => {
    const { el } = await selectedFixture();
    const marker = markerOf(el, 0);
    const resting = getComputedStyle(marker).strokeWidth;
    const rect = marker.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: 'move', position });
      await waitUntil(
        () => getComputedStyle(marker).strokeWidth !== resting,
        'a hovered selected point kept its resting ring'
      );
      const hovered = getComputedStyle(marker).strokeWidth;

      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(marker).strokeWidth !== hovered,
        'a held selected point produced no press feedback at all'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  // Contrast case: the unselected escalation is untouched, so the fix cannot be "every marker is
  // thick now".
  it("leaves an UNSELECTED point's own hover/press escalation unchanged", async () => {
    const { el } = await selectedFixture();
    const marker = markerOf(el, 1);
    expect(
      (
        el.shadowRoot!.querySelector(
          '[part="point"][data-index="1"]'
        ) as SVGGElement
      ).getAttribute('data-selected'),
      'sanity: point 1 must be unselected'
    ).to.equal('false');
    const resting = getComputedStyle(marker).strokeWidth;
    const rect = marker.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    try {
      await sendMouse({ type: 'move', position });
      await waitUntil(
        () => getComputedStyle(marker).strokeWidth !== resting,
        'a hovered unselected point drew no ring'
      );
      const hovered = getComputedStyle(marker).strokeWidth;
      // The unselected hovered ring is the medium step -- the same width a SELECTED point carries
      // at rest, which is precisely why the selected point needed an escalation of its own.
      expect(getComputedStyle(markerOf(el, 0)).strokeWidth).to.equal(hovered);

      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(marker).strokeWidth !== hovered,
        'a held unselected point produced no press feedback'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
});

it('preserves literal native point tooltip text and label updates', async () => {
  const text = 'Literal </title><script>throw 42</script> &amp; < > \r\n العربية 😀';
  const el = (await fixture(html`<lr-embedding-explorer
    .points=${[{ id: 'p', x: 1, y: 2, label: text }]}
  ></lr-embedding-explorer>`)) as LyraEmbeddingExplorer;

  const assertTitle = (expected: string) => {
    const title = el.shadowRoot!.querySelector('title')!;
    expect(title.textContent).to.equal(expected);
    expect(title.namespaceURI).to.equal('http://www.w3.org/2000/svg');
    expect(title.childElementCount).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('script').length).to.equal(0);
  };
  assertTitle(`${text}, embedding point 1`);
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('aria-label')).to.contain(text);
  el.points = [{ id: 'p', x: 1, y: 2, label: `Updated ${text}` }];
  await el.updateComplete;
  assertTitle(`Updated ${text}, embedding point 1`);
});
