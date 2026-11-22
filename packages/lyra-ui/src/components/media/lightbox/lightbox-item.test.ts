import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-lightbox.js';
import '../../lr-lightbox-item.js';
import type { LyraLightbox } from '../../lr-lightbox.js';
import type { LyraLightboxItem } from '../../lr-lightbox-item.js';
import { chooseSrcsetCandidate } from './lightbox-item.class.js';

const svg = (color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`)}`;

const clip = 'data:video/mp4;base64,AAAA';

const gallery = async (): Promise<LyraLightbox> => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-lightbox label="Trip">
      <lr-lightbox-item src=${svg('red')} alt="Red" caption="A red square"><img src=${svg('red')} alt="Red" /></lr-lightbox-item>
      <lr-lightbox-item src=${svg('green')} alt="Green"><img src=${svg('green')} alt="Green" /></lr-lightbox-item>
      <lr-lightbox-item src=${svg('blue')} alt="Blue"><img src=${svg('blue')} alt="Blue" /></lr-lightbox-item>
    </lr-lightbox>
  </div>`);
  const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
  await el.updateComplete;
  return el;
};

const stage = (el: LyraLightbox): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="stage"]')!;
const panel = (el: LyraLightbox): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;

function touch(target: Element, type: string, x: number, y = 0, id = 7): void {
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, composed: true,
  }));
}

describe('lr-lightbox slotted items', () => {
  it('collects slotted items, keeps the host inline while closed and opens at the clicked item', async () => {
    const el = await gallery();
    expect(el.items).to.have.length(3);
    expect(el.hasAttribute('data-items')).to.equal(true);
    expect(getComputedStyle(el).display).to.equal('contents');
    expect(el.shadowRoot!.querySelector('[part="counter"]')?.textContent ?? '').to.contain('1');

    const second = el.items[1]!;
    await (second as LyraLightboxItem).updateComplete;
    const shown = oneEvent(el, 'lr-after-show');
    second.shadowRoot!.querySelector<HTMLAnchorElement>('[part="trigger"]')!.click();
    await shown;
    expect(el.open).to.equal(true);
    expect(el.index).to.equal(1);
    expect(el.currentItem === second).to.equal(true);
    expect(second.hasAttribute('data-active')).to.equal(true);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="surface"]')!).position).to.equal('fixed');
    expect(el.shadowRoot!.querySelector('[part="counter"]')!.textContent).to.contain('2');
    await el.close();
    expect(second.hasAttribute('data-active')).to.equal(false);
    expect(el.hasAttribute('data-closing')).to.equal(false);
  });

  it('renders a real link per item that works without the lightbox, and a button for unsafe or missing URLs', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox-item id="a" src="photos/a.jpg"><img src=${svg('red')} alt="A" /></lr-lightbox-item>
      <lr-lightbox-item id="b" src="javascript:alert(1)"><img src=${svg('red')} alt="B" /></lr-lightbox-item>
      <lr-lightbox-item id="c"><img src=${svg('red')} alt="C" /></lr-lightbox-item>
    </div>`);
    const trigger = (id: string): HTMLAnchorElement => {
      const item = wrapper.querySelector<LyraLightboxItem>(`#${id}`)!;
      return item.shadowRoot!.querySelector<HTMLAnchorElement>('[part="trigger"]')!;
    };
    await Promise.all([...wrapper.querySelectorAll<LyraLightboxItem>('lr-lightbox-item')].map((item) => item.updateComplete));
    expect(trigger('a').getAttribute('href')).to.equal('photos/a.jpg');
    expect(trigger('a').getAttribute('role')).to.equal(null);
    expect(trigger('b').hasAttribute('href')).to.equal(false);
    expect(trigger('b').getAttribute('role')).to.equal('button');
    expect(trigger('c').getAttribute('role')).to.equal('button');
    expect(trigger('c').getAttribute('tabindex')).to.equal('0');
  });

  it('leaves modified clicks to the browser so a link can still open in a new tab', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox label="x"><lr-lightbox-item src="#one"><img src=${svg('red')} alt="One" /></lr-lightbox-item></lr-lightbox>
    </div>`);
    const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
    const item = el.items[0] as LyraLightboxItem;
    await item.updateComplete;
    let seenPrevented: boolean | undefined;
    wrapper.addEventListener('click', (event) => { seenPrevented = event.defaultPrevented; event.preventDefault(); });
    item.shadowRoot!.querySelector<HTMLAnchorElement>('[part="trigger"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ctrlKey: true, button: 0 }),
    );
    expect(seenPrevented).to.equal(false);
    expect(el.open).to.equal(false);
  });

  it('activates a source-less trigger from the keyboard', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox label="x"><lr-lightbox-item thumbnail=${svg('red')}></lr-lightbox-item></lr-lightbox>
    </div>`);
    const item = wrapper.querySelector<LyraLightboxItem>('lr-lightbox-item')!;
    await item.updateComplete;
    let clicks = 0;
    item.addEventListener('click', () => { clicks++; });
    item.shadowRoot!.querySelector('[part="trigger"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }),
    );
    expect(clicks).to.equal(1);
  });

  it('shows a thumbnail strip that jumps between items and marks the current one', async () => {
    const el = await gallery();
    el.withThumbnails = true;
    el.open = true;
    await el.updateComplete;
    const thumbs = (): HTMLElement[] => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="thumbnail"]')];
    expect(thumbs()).to.have.length(3);
    expect(thumbs()[0]!.getAttribute('part')).to.contain('thumbnail-active');
    expect(thumbs()[0]!.getAttribute('aria-current')).to.equal('true');
    expect(thumbs()[1]!.getAttribute('aria-current')).to.equal('false');
    const changed = oneEvent(el, 'lr-item-change');
    thumbs()[2]!.click();
    const { detail } = await changed;
    expect(detail.index).to.equal(2);
    expect(detail.previousIndex).to.equal(0);
    expect(detail.item === el.items[2]).to.equal(true);
    expect(detail.previousItem === el.items[0]).to.equal(true);
    await el.updateComplete;
    expect(thumbs()[2]!.getAttribute('aria-current')).to.equal('true');
    el.open = false;
  });

  it('hides navigation and zoom controls on request but keeps keyboard navigation', async () => {
    const el = await gallery();
    el.withoutNavigation = true;
    el.withoutZoom = true;
    el.open = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="navigation-button"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="zoom-button"]') === null).to.equal(true);
    panel(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.index).to.equal(1);
    el.zoomIn();
    expect((el.shadowRoot!.querySelector('lr-pan-zoom') as unknown as { zoom: number }).zoom).to.equal(1);
    el.open = false;
  });

  it('zooms the current image with zoomIn(), zoomOut() and the zoom button', async () => {
    const el = await gallery();
    el.open = true;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as unknown as { zoom: number };
    el.zoomIn();
    expect(frame.zoom).to.be.greaterThan(1);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="zoom-button"]')!.getAttribute('aria-label') !== 'Zoom in');
    el.zoomOut();
    expect(frame.zoom).to.equal(1);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="zoom-button"]')!.getAttribute('aria-label') === 'Zoom in');
    el.shadowRoot!.querySelector<HTMLElement>('[part="zoom-button"]')!.click();
    expect(frame.zoom).to.be.greaterThan(1);
    el.next();
    await el.updateComplete;
    await waitUntil(() => frame.zoom === 1);
    el.open = false;
  });

  it('swipes between items by touch, reverses under RTL, ignores a mouse and a pointercancel', async () => {
    const el = await gallery();
    el.open = true;
    await el.updateComplete;
    const target = stage(el);
    touch(target, 'pointerdown', 200);
    touch(target, 'pointerup', 100);
    await el.updateComplete;
    expect(el.index).to.equal(1);

    touch(target, 'pointerdown', 100);
    touch(target, 'pointerup', 200);
    await el.updateComplete;
    expect(el.index).to.equal(0);

    touch(target, 'pointerdown', 200);
    touch(target, 'pointercancel', 100);
    touch(target, 'pointerup', 100);
    expect(el.index).to.equal(0);

    touch(target, 'pointerdown', 200);
    touch(target, 'pointerup', 190);
    expect(el.index).to.equal(0);

    target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, pointerType: 'mouse', isPrimary: true, clientX: 200, bubbles: true }));
    target.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'mouse', isPrimary: true, clientX: 50, bubbles: true }));
    expect(el.index).to.equal(0);
    el.open = false;

    el.dir = 'rtl';
    el.open = true;
    await el.updateComplete;
    touch(target, 'pointerdown', 100);
    touch(target, 'pointerup', 200);
    await el.updateComplete;
    expect(el.index).to.equal(1);
    el.open = false;
  });

  it('follows the physical arrow keys under dir="rtl"', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div dir="rtl">
      <lr-lightbox label="x" dir="rtl">
        <lr-lightbox-item src=${svg('red')}><img src=${svg('red')} alt="1" /></lr-lightbox-item>
        <lr-lightbox-item src=${svg('green')}><img src=${svg('green')} alt="2" /></lr-lightbox-item>
      </lr-lightbox>
    </div>`);
    const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
    el.open = true;
    await el.updateComplete;
    panel(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.index).to.equal(1);
    el.open = false;
  });

  it('plays a video item in a native video and pauses it when the slide changes or the viewer closes', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox label="Clips">
        <lr-lightbox-item type="video" src=${clip} thumbnail=${svg('red')} alt="Clip"></lr-lightbox-item>
        <lr-lightbox-item src=${svg('green')} alt="Green"><img src=${svg('green')} alt="Green" /></lr-lightbox-item>
      </lr-lightbox>
    </div>`);
    const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
    el.open = true;
    await el.updateComplete;
    const video = el.shadowRoot!.querySelector<HTMLVideoElement>('[part="video"]')!;
    expect(video.getAttribute('src')).to.equal(clip);
    expect(el.shadowRoot!.querySelector('[part="zoom-button"]') === null).to.equal(true);
    let paused = 0;
    video.pause = () => { paused++; };
    el.next();
    await el.updateComplete;
    expect(paused).to.be.greaterThan(0);
    expect(el.shadowRoot!.querySelector('[part="video"]') === null).to.equal(true);
    el.previous();
    await el.updateComplete;
    const again = el.shadowRoot!.querySelector<HTMLVideoElement>('[part="video"]')!;
    let closed = 0;
    again.pause = () => { closed++; };
    await el.close();
    expect(closed).to.be.greaterThan(0);
  });

  it('rejects unsafe media URLs instead of loading them', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox label="x">
        <lr-lightbox-item src="javascript:alert(1)" alt="bad"></lr-lightbox-item>
        <lr-lightbox-item src=${svg('red')} alt="ok"></lr-lightbox-item>
      </lr-lightbox>
    </div>`);
    const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
    el.open = true;
    await el.updateComplete;
    expect(el.items).to.have.length(2);
    expect(el.shadowRoot!.querySelector('[part="counter"]')!.textContent).to.match(/1\D+1/);
    expect(el.shadowRoot!.querySelector('[part="frame"]')!.getAttribute('alt')).to.equal('ok');
    el.open = false;
  });

  it('exposes icon slots and the WA-named aliases of its parts', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-lightbox label="Icons">
        <span slot="close-icon" id="x">x</span>
        <span slot="next-icon" id="n">n</span>
        <lr-lightbox-item src=${svg('red')}><img src=${svg('red')} alt="1" /></lr-lightbox-item>
        <lr-lightbox-item src=${svg('green')}><img src=${svg('green')} alt="2" /></lr-lightbox-item>
      </lr-lightbox>
    </div>`);
    const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
    el.open = true;
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector<HTMLSlotElement>('slot[name="close-icon"]')!.assignedElements()[0]!.id).to.equal('x');
    expect(root.querySelector<HTMLSlotElement>('slot[name="next-icon"]')!.assignedElements()[0]!.id).to.equal('n');
    for (const part of ['dialog', 'scroll-container', 'slide', 'navigation-button-previous', 'navigation-button-next', 'zoom-button', 'toolbar', 'backdrop']) {
      expect(root.querySelector(`[part~="${part}"]`), part).to.not.equal(null);
    }
    el.open = false;
  });

  it('names the dialog from label and lets a host aria-label win', async () => {
    const el = await gallery();
    el.open = true;
    await el.updateComplete;
    expect(panel(el).getAttribute('aria-label')).to.equal('Trip');
    el.setAttribute('aria-label', 'Named');
    await el.updateComplete;
    expect(panel(el).getAttribute('aria-label')).to.equal('Named');
    el.open = false;
  });

  it('emits lr-item-change next to lr-index-change in data mode and stays item-free', async () => {
    const el = await fixture<LyraLightbox>(html`<lr-lightbox open .images=${[{ src: svg('red') }, { src: svg('green') }]}></lr-lightbox>`);
    expect(el.hasAttribute('data-items')).to.equal(false);
    const seen: string[] = [];
    el.addEventListener('lr-index-change', () => seen.push('index'));
    el.addEventListener('lr-item-change', (event) => {
      seen.push('item');
      expect((event as CustomEvent).detail.item).to.equal(null);
    });
    el.next();
    await el.updateComplete;
    expect(seen).to.deep.equal(['index', 'item']);
    el.open = false;
  });

  it('clears its closing state after the exit animation and passes axe while open', async () => {
    const el = await gallery();
    el.withThumbnails = true;
    el.open = true;
    await el.updateComplete;
    await expect(el).to.be.accessible();
    const hidden = oneEvent(el, 'lr-after-hide');
    void el.close();
    expect(el.hasAttribute('data-closing')).to.equal(true);
    await hidden;
    expect(el.hasAttribute('data-closing')).to.equal(false);
  });

  it('chooses the srcset candidate that covers the viewer, else the largest', () => {
    const view = { devicePixelRatio: 1, innerWidth: 800 } as Window;
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w, c.jpg 1600w', '', view)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w', '100vw', { devicePixelRatio: 2, innerWidth: 800 } as Window)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w, c.jpg 1600w', '300px', view)).to.equal('a.jpg');
    expect(chooseSrcsetCandidate('a.jpg, b.jpg 2x', '', { devicePixelRatio: 2, innerWidth: 800 } as Window)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('', '', view)).to.equal('');
  });
});
