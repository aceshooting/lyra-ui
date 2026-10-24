import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './graph.js';
import type { LyraGraph } from './graph.js';
import { loadD3 } from './graph-loader.js';

before(async function () {
  // Cold optional-peer imports are setup; the assertions below time graph rendering itself.
  this.timeout(120_000);
  expect(await loadD3()).not.to.equal(null);
});

const nodes = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];
const edges = [{ id: 'ab', source: 'a', target: 'b' }];

async function svgOf(el: LyraGraph): Promise<SVGSVGElement> {
  await waitUntil(() => el.shadowRoot!.querySelector('svg') !== null, 'the svg renderer replaced the skeleton', {
    timeout: 5000,
  });
  return el.shadowRoot!.querySelector('svg')!;
}

describe('graph drawing-space boundaries', () => {
  it('keeps the numeric drawing space while a container-fitted host has no box to measure', async () => {
    const holder = await fixture<HTMLElement>(html`
      <div style="display: none">
        <lr-graph fit-to="container" .nodes=${nodes} .edges=${edges}></lr-graph>
      </div>
    `);
    const el = holder.querySelector('lr-graph') as LyraGraph;

    const svg = await svgOf(el);

    expect(svg.getAttribute('viewBox')).to.equal('0 0 800 600');
    expect(el.fitTo).to.equal('container');
  });

  it('falls back to the default drawing space for a width or height that cannot be resolved', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} .edges=${edges}></lr-graph>`);
    const writable = el as unknown as { width: unknown; height: unknown };
    writable.width = 'not-a-length';
    writable.height = 'calc(nonsense)';
    await el.updateComplete;

    const svg = await svgOf(el);
    await waitUntil(() => svg.getAttribute('viewBox') === '0 0 800 600', 'the unresolvable lengths use the defaults');
  });

  it('resolves a CSS math width against the host and treats a reset to a plain number as pixels', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} .edges=${edges}></lr-graph>`);
    const writable = el as unknown as { width: unknown; height: unknown };
    writable.width = 'calc(100px + 20px)';
    writable.height = 'calc(50px + 10px)';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox') === '0 0 120 60');

    writable.width = 300;
    writable.height = 200;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox') === '0 0 300 200');
  });
});

describe('graph update after removal', () => {
  it('finishes a queued update on a removed host and keeps the link operable once it returns', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph .nodes=${nodes} .edges=${edges}></lr-graph>`);
    await svgOf(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="link"]').length === 1);
    const parent = el.parentElement!;

    el.fitTo = 'container';
    el.edges = [{ id: 'fresh', source: 'a', target: 'b', color: 'rgb(9, 8, 7)', label: 'Fresh paint' }];
    el.remove();
    await el.updateComplete;
    expect(el.isConnected).to.equal(false);

    parent.append(el);
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="link"][role="button"]') !== null,
      'the link is operable again after the host returns'
    );
    expect(el.shadowRoot!.querySelectorAll('[part="link"]')).to.have.lengthOf(1);
  });
});

describe('graph focusNode while the spatial view is replaced', () => {
  it('reports a failed focus when the host leaves the document before the 3d view is ready', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${nodes} .edges=${edges}></lr-graph>`);

    const pending = el.focusNode('a');
    el.remove();

    expect(await pending).to.equal(false);
  });

  it('reports a failed focus when the view returns to 2d before the 3d view is ready', async () => {
    const el = await fixture<LyraGraph>(html`<lr-graph view="3d" .nodes=${nodes} .edges=${edges}></lr-graph>`);

    const pending = el.focusNode('a');
    el.view = '2d';

    expect(await pending).to.equal(false);
  });
});

describe('graph link paint probe', () => {
  it('keeps a link with an unfamiliar color operable when no canvas context can probe it', async () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      // The 1x1 paint probe is the only canvas this graph creates while rendering SVG.
      if (this.width === 1 && this.height === 1) return null;
      return (original as (...rest: unknown[]) => unknown).apply(this, args);
    } as typeof HTMLCanvasElement.prototype.getContext;
    try {
      const el = await fixture<LyraGraph>(html`<lr-graph></lr-graph>`);
      el.nodes = nodes;
      el.edges = [{ id: 'unfamiliar', source: 'a', target: 'b', color: 'oklch(0.7 0.1 200)', label: 'Unfamiliar paint' }];
      await el.updateComplete;
      await svgOf(el);
      await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="link"]').length === 1);

      expect(el.shadowRoot!.querySelector('[part="link"]')!.getAttribute('role')).to.equal('button');
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
