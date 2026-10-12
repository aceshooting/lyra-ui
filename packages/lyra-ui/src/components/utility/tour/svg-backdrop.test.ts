import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './tour.js';
import type { LyraTour } from './tour.js';

/** Rasterize the rendered backdrop, retaining its actual namespaces, geometry and resolved paint. */
async function backdropPixels(backdrop: SVGSVGElement): Promise<CanvasRenderingContext2D> {
  const bounds = backdrop.getBoundingClientRect();
  const copy = backdrop.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(bounds.width));
  copy.setAttribute('height', String(bounds.height));
  const originals = [backdrop, ...backdrop.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const computed = getComputedStyle(node);
    for (const property of ['fill', 'rx', 'mask-type']) {
      (copies[index] as SVGElement).style.setProperty(property, computed.getPropertyValue(property));
    }
  });
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds.width);
    canvas.height = Math.ceil(bounds.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.drawImage(image, 0, 0);
    return context;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function openTour(): Promise<{ tour: LyraTour; target: HTMLElement }> {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="svg-tour-target" style="position:fixed; left:100px; top:100px; width:50px; height:30px;">Target</button>
      <lr-tour style="--lr-tour-backdrop-color:rgba(0,0,0,0.5); --lr-tour-spotlight-radius:0px;"></lr-tour>
    </div>
  `);
  const tour = wrapper.querySelector('lr-tour') as LyraTour;
  const target = wrapper.querySelector('#svg-tour-target') as HTMLElement;
  tour.steps = [
    { stepId: 'anchored', target, heading: 'Target' },
    { stepId: 'missing', target: '#svg-tour-missing', heading: 'Missing target' },
  ];
  tour.start();
  await tour.updateComplete;
  await waitUntil(() => Number(tour.shadowRoot!.querySelector('.cutout')?.getAttribute('width')) > 0);
  return { tour, target };
}

const backdropOf = (tour: LyraTour) => tour.shadowRoot!.querySelector('[part="backdrop"]') as SVGSVGElement;
const alphaAt = (context: CanvasRenderingContext2D, x: number, y: number) => context.getImageData(x, y, 1, 1).data[3];

describe('lr-tour SVG backdrop', () => {
  it('renders native SVG mask geometry and tracks the padded target after resizing', async () => {
    const { tour, target } = await openTour();
    const backdrop = backdropOf(tour);
    expect([...backdrop.querySelectorAll('*')].map(node => node.namespaceURI)).to.deep.equal(
      Array(5).fill('http://www.w3.org/2000/svg'),
    );
    const cutout = backdrop.querySelector('.cutout') as SVGRectElement;
    expect(cutout instanceof SVGRectElement).to.equal(true);
    expect(cutout.x.baseVal.value).to.be.closeTo(96, 0.5);
    expect(cutout.width.baseVal.value).to.be.closeTo(58, 0.5);
    target.style.width = '150px';
    await waitUntil(() => Number(cutout.getAttribute('width')) === 158);
    expect(cutout.width.baseVal.value).to.be.closeTo(158, 0.5);
    const ring = tour.shadowRoot!.querySelector('[part="spotlight"]') as HTMLElement;
    expect(ring.getBoundingClientRect().width).to.be.closeTo(cutout.width.baseVal.value, 0.5);
  });

  it('paints the scrim outside the spotlight and fills the former hole when the target is missing', async () => {
    const { tour } = await openTour();
    const anchored = await backdropPixels(backdropOf(tour));
    expect(alphaAt(anchored, 4, 4)).to.be.within(127, 128);
    expect(alphaAt(anchored, 125, 115)).to.equal(0);
    tour.next();
    await tour.updateComplete;
    await waitUntil(() => tour.shadowRoot!.querySelector('[part="popover"]')?.hasAttribute('data-unanchored') === true);
    const fallback = backdropOf(tour);
    expect(fallback.querySelector('.scrim')?.namespaceURI).to.equal('http://www.w3.org/2000/svg');
    const unanchored = await backdropPixels(fallback);
    expect(alphaAt(unanchored, 4, 4)).to.be.within(127, 128);
    expect(alphaAt(unanchored, 125, 115)).to.be.within(127, 128);
    tour.back();
    await tour.updateComplete;
    await waitUntil(() => Number(tour.shadowRoot!.querySelector('.cutout')?.getAttribute('width')) > 0);
    const returned = await backdropPixels(backdropOf(tour));
    expect(alphaAt(returned, 125, 115)).to.equal(0);
    expect(alphaAt(returned, 4, 4)).to.be.within(127, 128);
  });
});
