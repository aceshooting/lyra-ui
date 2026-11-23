import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-lightbox.js';
import '../../lr-lightbox-item.js';
import type { LyraLightbox } from '../../lr-lightbox.js';
import type { LyraLightboxItem } from '../../lr-lightbox-item.js';
import { chooseSrcsetCandidate } from '../../../internal/srcset.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

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
    await waitUntil(() => !el.hasAttribute('data-closing'));
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

  describe('drag-following swipe', () => {
    const slideOf = (el: LyraLightbox): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="slide"]')!;
    const offset = (slide: HTMLElement): number => {
      const transform = getComputedStyle(slide).transform;
      return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
    };

    it('tracks the pointer, resists past the first item and settles back on a short drag', async () => {
      const el = await gallery();
      el.open = true;
      await el.updateComplete;
      const target = stage(el);
      const slide = slideOf(el);
      touch(target, 'pointerdown', 200, 100);
      touch(target, 'pointermove', 205, 100);
      expect(offset(slide)).to.equal(0);
      touch(target, 'pointermove', 170, 102);
      expect(offset(slide)).to.be.closeTo(-30, 0.5);
      // Toward the previous item, which index 0 does not have without loop: the slide resists.
      touch(target, 'pointermove', 240, 102);
      expect(offset(slide)).to.be.closeTo(12, 0.5);
      touch(target, 'pointerup', 240, 102);
      expect(slide.style.transform).to.equal('');
      await waitUntil(() => offset(slide) === 0, 'settled back');
      expect(el.index).to.equal(0);
      el.open = false;
    });

    it('settles back on pointercancel and on a mostly vertical drag', async () => {
      const el = await gallery();
      el.open = true;
      await el.updateComplete;
      const target = stage(el);
      const slide = slideOf(el);
      let changes = 0;
      el.addEventListener('lr-item-change', () => changes++);
      touch(target, 'pointerdown', 200);
      touch(target, 'pointermove', 100);
      expect(offset(slide)).to.be.closeTo(-100, 0.5);
      touch(target, 'pointercancel', 100);
      touch(target, 'pointerup', 100);
      await waitUntil(() => offset(slide) === 0, 'settled after cancel');
      touch(target, 'pointerdown', 200, 0);
      touch(target, 'pointermove', 140, 200);
      expect(offset(slide)).to.equal(0);
      touch(target, 'pointerup', 140, 200);
      await el.updateComplete;
      expect(el.index).to.equal(0);
      expect(changes).to.equal(0);
      el.open = false;
    });

    it('navigates on a release past the threshold and continues the incoming slide from there, reversed under RTL', async () => {
      const el = await gallery();
      el.open = true;
      await el.updateComplete;
      const target = stage(el);
      const slide = slideOf(el);
      const changed = oneEvent(el, 'lr-item-change');
      touch(target, 'pointerdown', 300);
      touch(target, 'pointermove', 220);
      touch(target, 'pointerup', 220);
      const event = await changed;
      expect(event.detail.index).to.equal(1);
      expect(slide.style.transform).to.equal('');
      const incoming = slide.getAnimations().find((animation) => animation.id === 'lightbox.slide.next');
      expect(incoming !== undefined).to.equal(true);
      expect(String((incoming!.effect as KeyframeEffect).getKeyframes()[0]!['transform'])).to.contain('-80px');
      el.open = false;
      await el.updateComplete;

      el.dir = 'rtl';
      el.index = 0;
      el.open = true;
      await el.updateComplete;
      touch(target, 'pointerdown', 100);
      touch(target, 'pointermove', 160);
      // The slide follows the finger physically; under RTL that drag points to the next item.
      expect(offset(slide)).to.be.closeTo(60, 0.5);
      touch(target, 'pointerup', 160);
      await el.updateComplete;
      expect(el.index).to.equal(1);
      el.open = false;
    });

    it('does not move the slide under reduced motion but still navigates on release', async () => {
      const el = await gallery();
      el.closest('div')!.setAttribute('data-lr-motion', 'reduce');
      el.open = true;
      await el.updateComplete;
      const target = stage(el);
      const slide = slideOf(el);
      touch(target, 'pointerdown', 300);
      touch(target, 'pointermove', 200);
      expect(offset(slide)).to.equal(0);
      expect(slide.style.transform).to.equal('');
      touch(target, 'pointerup', 200);
      await el.updateComplete;
      expect(el.index).to.equal(1);
      expect(slide.getAnimations().every((animation) => animation.playState === 'finished' || animation.effect?.getComputedTiming().duration === 0)).to.equal(true);
      el.open = false;
    });

    it('drops a drag when index changes programmatically mid-gesture', async () => {
      const el = await gallery();
      el.open = true;
      await el.updateComplete;
      const target = stage(el);
      const slide = slideOf(el);
      touch(target, 'pointerdown', 300);
      touch(target, 'pointermove', 250);
      expect(slide.style.transform).to.not.equal('');
      el.index = 2;
      await el.updateComplete;
      expect(slide.style.transform).to.equal('');
      touch(target, 'pointerup', 150);
      await el.updateComplete;
      expect(el.index).to.equal(2);
      el.open = false;
    });
  });

  it('reports navigation with lr-item-change, never a direct index write, open or closed', async () => {
    const el = await gallery();
    const seen: number[] = [];
    el.addEventListener('lr-item-change', (event) => seen.push(event.detail.index));
    el.index = 2;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    el.index = 1;
    await el.updateComplete;
    expect(seen).to.deep.equal([]);
    el.goTo(0);
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="navigation-button-next"]')!.click();
    await el.updateComplete;
    expect(seen).to.deep.equal([0, 1]);
    el.open = false;
  });

  describe('custom <template> slides', () => {
    const mixed = async (): Promise<LyraLightbox> => {
      const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
      wrapper.innerHTML = `
        <style>.embed-copy { color: rgb(1, 2, 3); }</style>
        <lr-lightbox label="Mixed">
          <lr-lightbox-item src="${svg('red')}"><img src="${svg('red')}" alt="Red" /></lr-lightbox-item>
          <lr-lightbox-item width="400" height="200" thumbnail="${svg('blue')}" alt="Embed"><template><p class="embed-copy">Custom <button type="button">Act</button></p></template></lr-lightbox-item>
          <lr-lightbox-item src="${svg('green')}"><img src="${svg('green')}" alt="Green" /></lr-lightbox-item>
        </lr-lightbox>`;
      const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
      await el.updateComplete;
      await Promise.all(el.items.map((item) => item.updateComplete));
      await el.updateComplete;
      return el;
    };
    const copy = (el: LyraLightbox): HTMLElement | null => el.querySelector<HTMLElement>(':scope > [data-lightbox-slide]');

    it('copies the template into a light-DOM slide only while that slide is shown', async () => {
      const el = await mixed();
      expect(el.items).to.have.length(3);
      expect(el.items[1]!.matches(':state(empty)')).to.equal(false);
      expect(copy(el) === null).to.equal(true);
      el.index = 1;
      await el.show();
      const shown = copy(el)!;
      expect(shown.getAttribute('slot')).to.equal('slide-content');
      expect(shown.assignedSlot?.name).to.equal('slide-content');
      expect(getComputedStyle(shown.querySelector('.embed-copy')!).color).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(shown).aspectRatio.replace(/\s/g, '')).to.equal('2/1');
      // WebKit's headless run does not lay out the open panel here; measure where it is laid out.
      const box = shown.getBoundingClientRect();
      if (box.height > 0) expect(box.width / box.height).to.be.closeTo(2, 0.05);
      expect(el.shadowRoot!.querySelector<HTMLElement>('lr-pan-zoom')!.hidden).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="zoom-button"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part="caption"]') === null).to.equal(true);
      // The copied button keeps its own arrow keys.
      shown.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
      await el.updateComplete;
      expect(el.index).to.equal(1);
      el.next();
      await el.updateComplete;
      expect(copy(el) === null).to.equal(true);
      el.previous();
      await el.updateComplete;
      expect(copy(el) !== null && copy(el) !== shown).to.equal(true);
      await el.close();
      await waitUntil(() => !el.hasAttribute('data-closing'), 'exit motion done');
      expect(copy(el) === null).to.equal(true);
    });

    it('uses the item thumbnail in the strip and is not collected from inside its own copy', async () => {
      const el = await mixed();
      el.withThumbnails = true;
      el.index = 1;
      await el.show();
      const thumbs = el.shadowRoot!.querySelectorAll('[part~="thumbnail"]');
      expect(thumbs.length).to.equal(3);
      expect(thumbs[1]!.querySelector('img')!.getAttribute('src')).to.equal(svg('blue'));
      expect(thumbs[1]!.getAttribute('aria-label')).to.equal('Embed');
      expect(el.items).to.have.length(3);
      await el.close();
    });
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
    expect(el.shadowRoot!.querySelector('[part~="frame"]')!.getAttribute('alt')).to.equal('ok');
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
    el.index = 0;
    await el.updateComplete;
    expect(seen, 'a programmatic index write stays silent').to.deep.equal(['index', 'item']);
    el.open = false;
  });

  it('keeps the data-mode chrome and leaves stray children unrendered', async () => {
    const el = await fixture<LyraLightbox>(html`<lr-lightbox open .images=${[{ src: svg('red') }, { src: svg('green') }]}><span id="stray">stray</span></lr-lightbox>`);
    expect(el.shadowRoot!.querySelector('[part="zoom-button"]') === null).to.equal(true);
    expect(el.querySelector('#stray')!.getBoundingClientRect().width).to.equal(0);
    el.open = false;
  });

  it('fires after-show and after-hide only once the open and close motion has finished', async () => {
    const el = await gallery();
    el.style.setProperty('--show-duration', '300ms');
    el.style.setProperty('--hide-duration', '300ms');
    const seen: string[] = [];
    el.addEventListener('lr-after-show', () => seen.push('after-show'));
    el.addEventListener('lr-after-hide', () => seen.push('after-hide'));
    const running = (): number => panel(el).getAnimations().filter((a) => a.playState === 'running').length;

    const shown = el.show();
    await el.updateComplete;
    await Promise.resolve();
    expect(running(), 'the enter animation is running').to.be.greaterThan(0);
    expect(seen, 'no after-show while the enter animation runs').to.deep.equal([]);
    await shown;
    expect(seen).to.deep.equal(['after-show']);
    expect(running(), 'after-show waits for the enter animation').to.equal(0);

    const hidden = el.close();
    await el.updateComplete;
    await Promise.resolve();
    expect(el.hasAttribute('data-closing')).to.equal(true);
    expect(seen, 'no after-hide while the exit animation runs').to.deep.equal(['after-show']);
    await hidden;
    expect(seen).to.deep.equal(['after-show', 'after-hide']);
    expect(el.hasAttribute('data-closing'), 'the exit animation has ended by after-hide').to.equal(false);
  });

  it('suppresses the after-event of a transition the opposite one interrupts', async () => {
    const el = await gallery();
    el.style.setProperty('--show-duration', '300ms');
    el.style.setProperty('--hide-duration', '300ms');
    const seen: string[] = [];
    el.addEventListener('lr-after-show', () => seen.push('after-show'));
    el.addEventListener('lr-after-hide', () => seen.push('after-hide'));
    const shown = el.show();
    await el.updateComplete;
    await el.close();
    await shown;
    expect(seen, 'the interrupted open reports nothing').to.deep.equal(['after-hide']);
  });

  for (const branch of ['reduced motion', 'zero duration'] as const) {
    it(`fires after-show and after-hide straight after the render under ${branch}`, async () => {
      if (branch === 'reduced motion') await setReducedMotion('reduce');
      try {
        const el = await gallery();
        const duration = branch === 'reduced motion' ? '300ms' : '0ms';
        el.style.setProperty('--show-duration', duration);
        el.style.setProperty('--hide-duration', duration);
        const seen: string[] = [];
        el.addEventListener('lr-after-show', () => seen.push('after-show'));
        el.addEventListener('lr-after-hide', () => seen.push('after-hide'));
        const started = performance.now();
        await el.show();
        await el.close();
        expect(seen).to.deep.equal(['after-show', 'after-hide']);
        expect(el.hasAttribute('data-closing')).to.equal(false);
        expect(performance.now() - started, 'neither event waited for a 300ms animation').to.be.lessThan(250);
      } finally {
        if (branch === 'reduced motion') await setReducedMotion('no-preference');
      }
    });
  }

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
    await waitUntil(() => !el.hasAttribute('data-closing'));
  });

  it('chooses the srcset candidate that covers the viewer, else the largest', () => {
    const view = { devicePixelRatio: 1, innerWidth: 800 } as Window;
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w, c.jpg 1600w', '', view)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w', '100vw', { devicePixelRatio: 2, innerWidth: 800 } as Window)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('a.jpg 400w, b.jpg 900w, c.jpg 1600w', '300px', view)).to.equal('a.jpg');
    expect(chooseSrcsetCandidate('a.jpg, b.jpg 2x', '', { devicePixelRatio: 2, innerWidth: 800 } as Window)).to.equal('b.jpg');
    expect(chooseSrcsetCandidate('', '', view)).to.equal('');
  });

  describe('upstream styling hooks', () => {
    const hasState = (element: Element, name: string): boolean => element.matches(`:state(${name})`);

    it('exposes the dialog, scroll-container, image and navigation-button part aliases', async () => {
      const el = await gallery();
      el.id = 'hooks';
      const sheet = document.createElement('style');
      sheet.textContent = [
        '#hooks::part(dialog) { outline: 3px dotted rgb(1, 2, 3); }',
        '#hooks::part(scroll-container) { outline: 3px dotted rgb(4, 5, 6); }',
        '#hooks::part(image) { outline: 3px dotted rgb(7, 8, 9); }',
        '#hooks::part(navigation-button) { outline: 3px dotted rgb(10, 11, 12); }',
        '#hooks::part(navigation-button-next) { outline-color: rgb(13, 14, 15); }',
      ].join('\n');
      document.head.append(sheet);
      try {
        el.index = 1;
        el.open = true;
        await el.updateComplete;
        const root = el.shadowRoot!;
        const outline = (selector: string): string => getComputedStyle(root.querySelector(selector)!).outlineColor;
        expect(outline('[part~="panel"]')).to.equal('rgb(1, 2, 3)');
        expect(outline('[part~="stage"]')).to.equal('rgb(4, 5, 6)');
        expect(outline('[part~="frame"]')).to.equal('rgb(7, 8, 9)');
        expect(outline('[part~="previous-button"]')).to.equal('rgb(10, 11, 12)');
        expect(outline('[part~="next-button"]')).to.equal('rgb(13, 14, 15)');
      } finally {
        sheet.remove();
        el.open = false;
      }
    });

    it('publishes the open and zoomed custom states', async () => {
      const el = await gallery();
      expect(hasState(el, 'open')).to.equal(false);
      el.open = true;
      await el.updateComplete;
      expect(hasState(el, 'open')).to.equal(true);
      expect(hasState(el, 'zoomed')).to.equal(false);
      el.zoomIn();
      await waitUntil(() => hasState(el, 'zoomed'), 'zoomed after zoomIn()');
      el.next();
      await el.updateComplete;
      await waitUntil(() => !hasState(el, 'zoomed'), 'navigation resets the zoom');
      await el.close();
      await el.updateComplete;
      expect(hasState(el, 'open')).to.equal(false);
    });

    it('publishes the item active, empty and morphing states', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <lr-lightbox>
          <lr-lightbox-item src=${svg('red')} alt="Red"><img src=${svg('red')} alt="Red" /></lr-lightbox-item>
          <lr-lightbox-item src=${svg('green')} alt="Green"><img src=${svg('green')} alt="Green" /></lr-lightbox-item>
          <lr-lightbox-item src=${svg('blue')} alt="Blue"> </lr-lightbox-item>
        </lr-lightbox>
      </div>`);
      const el = wrapper.querySelector<LyraLightbox>('lr-lightbox')!;
      await el.updateComplete;
      const [first, second, empty] = el.items as LyraLightboxItem[];
      await empty!.updateComplete;
      await waitUntil(() => hasState(empty!, 'empty'), 'an item with nothing slotted is empty');
      expect(hasState(first!, 'empty')).to.equal(false);
      expect(getComputedStyle(empty!).display).to.equal('none');

      el.style.setProperty('--show-duration', '400ms');
      el.index = 1;
      el.open = true;
      await el.updateComplete;
      expect(hasState(second!, 'active')).to.equal(true);
      expect(hasState(first!, 'active')).to.equal(false);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      expect(hasState(second!, 'morphing'), 'morphing while the open motion runs').to.equal(!reduced);
      expect(hasState(first!, 'morphing')).to.equal(false);
      await waitUntil(() => !hasState(second!, 'morphing'), 'morphing clears once the motion ends');

      el.next();
      await el.updateComplete;
      expect(hasState(second!, 'active')).to.equal(false);
      expect(hasState(empty!, 'active')).to.equal(true);
      await el.close();
      await el.updateComplete;
      expect(hasState(empty!, 'active')).to.equal(false);
      await waitUntil(() => !el.hasAttribute('data-closing'));
      expect(hasState(empty!, 'morphing')).to.equal(false);
    });

    it('maps the backdrop, controls and spacing properties onto the rendered viewer', async () => {
      const el = await gallery();
      el.style.setProperty('--backdrop-color', 'rgb(20, 30, 40)');
      el.style.setProperty('--backdrop-filter', 'blur(4px)');
      el.style.setProperty('--controls-background', 'rgb(50, 60, 70)');
      el.style.setProperty('--controls-color', 'rgb(80, 90, 100)');
      el.style.setProperty('--spacing', '17px');
      el.open = true;
      await el.updateComplete;
      const root = el.shadowRoot!;
      const backdrop = getComputedStyle(root.querySelector('[part="backdrop"]')!);
      expect(backdrop.backgroundColor).to.equal('rgb(20, 30, 40)');
      expect(backdrop.backdropFilter).to.equal('blur(4px)');
      const close = getComputedStyle(root.querySelector('[part="close-button"]')!);
      expect(close.backgroundColor).to.equal('rgb(50, 60, 70)');
      expect(close.color).to.equal('rgb(80, 90, 100)');
      expect(getComputedStyle(root.querySelector('[part="counter"]')!).color).to.equal('rgb(80, 90, 100)');
      expect(getComputedStyle(root.querySelector('[part~="panel"]')!).rowGap).to.equal('17px');
      el.style.setProperty('--lr-lightbox-control-bg', 'rgb(1, 1, 1)');
      // The control transitions its background, so wait for the settled value.
      await waitUntil(
        () => getComputedStyle(root.querySelector('[part="close-button"]')!).backgroundColor === 'rgb(1, 1, 1)',
        'the Lyra token wins over the alias',
      );
      el.open = false;
    });

    it('keeps the default backdrop filter and spacing when the aliases are unset', async () => {
      const el = await gallery();
      el.open = true;
      await el.updateComplete;
      const root = el.shadowRoot!;
      expect(getComputedStyle(root.querySelector('[part="backdrop"]')!).backdropFilter).to.equal('none');
      const probe = document.createElement('div');
      probe.style.rowGap = 'var(--lr-space-s)';
      document.body.append(probe);
      try {
        expect(getComputedStyle(root.querySelector('[part~="panel"]')!).rowGap).to.equal(getComputedStyle(probe).rowGap);
      } finally {
        probe.remove();
        el.open = false;
      }
    });

    it('reflects label but keeps without-counter unreflected, as published', async () => {
      const el = await gallery();
      el.label = 'Holiday';
      el.withoutCounter = true;
      await el.updateComplete;
      expect(el.getAttribute('label')).to.equal('Holiday');
      expect(el.hasAttribute('without-counter')).to.equal(false);
    });
  });
});
