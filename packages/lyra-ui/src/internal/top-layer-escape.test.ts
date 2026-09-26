import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import {
  ancestorZoom,
  needsTopLayerEscape,
  promoteToTopLayer,
  releaseTopLayer,
  stripStaleTopLayer,
  TOP_LAYER_ATTRIBUTE,
} from './top-layer-escape.js';
import { placeAnchoredSurface } from './positioner.js';
import '../components/overlays/overlay/dropdown.js';
import '../components/layout/menu/dropdown-item.js';
import type { LyraDropdown } from '../components/overlays/overlay/dropdown.class.js';

const isOpen = (element: Element): boolean => element.matches(':popover-open');
const microtask = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

async function childOf(style: string): Promise<{ parent: HTMLElement; child: HTMLElement }> {
  const parent = await fixture<HTMLElement>(html`
    <div style=${style}><div id="child" style="inline-size: 40px; block-size: 20px">child</div></div>
  `);
  return { parent, child: parent.querySelector('#child') as HTMLElement };
}

/** Runs `body` with `CSS.supports('selector(:popover-open)')` answering false. */
async function withoutNativePopoverSelector(body: () => Promise<void> | void): Promise<void> {
  const original = CSS.supports;
  CSS.supports = function (this: typeof CSS, ...args: unknown[]) {
    if (args.length === 1 && args[0] === 'selector(:popover-open)') return false;
    return (original as (...a: unknown[]) => boolean).apply(this, args);
  } as typeof CSS.supports;
  try {
    await body();
  } finally {
    CSS.supports = original;
  }
}

describe('needsTopLayerEscape', () => {
  for (const [label, style] of [
    ['transform', 'transform: translateY(1px)'],
    ['will-change: transform', 'will-change: transform'],
    ['will-change: contain', 'will-change: contain'],
    ['will-change: offset-path', 'will-change: offset-path'],
    ['will-change: contain, opacity', 'will-change: contain, opacity'],
    ['contain: paint', 'contain: paint'],
    ['offset-path', "offset-path: path('M0,0 L10,10'); offset-rotate: 0deg"],
    ['content-visibility: auto', 'content-visibility: auto'],
    ['transform-style: preserve-3d', 'transform-style: preserve-3d'],
  ] as const) {
    it(`is true under a ${label} ancestor`, async () => {
      const { child } = await childOf(style);
      expect(needsTopLayerEscape(child)).to.equal(true);
    });
  }

  for (const [label, style] of [
    ['no trapping ancestor', ''],
    ['container-type', 'container-type: inline-size'],
    ['zoom', 'zoom: 2'],
    ['clip-path', 'clip-path: inset(0)'],
    ['will-change: transform-origin', 'will-change: transform-origin'],
    ['will-change: perspective-origin', 'will-change: perspective-origin'],
    ['will-change: content-visibility', 'will-change: content-visibility'],
  ] as const) {
    it(`is false under a ${label} ancestor`, async () => {
      const { child } = await childOf(style);
      expect(needsTopLayerEscape(child)).to.equal(false);
    });
  }

  it('is true under a transformed top-layer ancestor and false under a plain one', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <div id="plain" popover="manual"><div id="a">a</div></div>
        <div id="moved" popover="manual" style="transform: translateY(1px)"><div id="b">b</div></div>
      </div>
    `);
    const plain = wrap.querySelector('#plain') as HTMLElement;
    const moved = wrap.querySelector('#moved') as HTMLElement;
    plain.showPopover();
    moved.showPopover();
    try {
      expect(needsTopLayerEscape(wrap.querySelector('#a') as HTMLElement)).to.equal(false);
      expect(needsTopLayerEscape(wrap.querySelector('#b') as HTMLElement)).to.equal(true);
    } finally {
      plain.hidePopover();
      moved.hidePopover();
    }
  });

  it('is true inside a top-layer ancestor that is itself trapped (nested surfaces)', async () => {
    const outer = await fixture<HTMLElement>(html`
      <div style="transform: translateY(1px); overflow: hidden">
        <div id="layer" popover="manual"><div id="nested">n</div></div>
      </div>
    `);
    const layer = outer.querySelector('#layer') as HTMLElement;
    layer.showPopover();
    try {
      expect(needsTopLayerEscape(outer.querySelector('#nested') as HTMLElement)).to.equal(true);
    } finally {
      layer.hidePopover();
    }
  });
});

describe('promoteToTopLayer / releaseTopLayer', () => {
  it('is idempotent: one beforetoggle across three calls', async () => {
    const { child } = await childOf('transform: translateY(0)');
    let toggles = 0;
    child.addEventListener('beforetoggle', () => toggles++);
    try {
      expect(promoteToTopLayer(child)).to.equal(true);
      expect(promoteToTopLayer(child)).to.equal(true);
      expect(promoteToTopLayer(child)).to.equal(true);
      expect(toggles).to.equal(1);
      expect(isOpen(child)).to.equal(true);
      expect(child.getAttribute('popover')).to.equal('manual');
      expect(child.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(true);
    } finally {
      releaseTopLayer(child);
    }
  });

  it('never moves focus into an autofocus descendant and restores inline visibility exactly', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div style="transform: translateY(0)">
        <button id="outside">outside</button>
        <div id="surface"><input autofocus aria-label="inner" /></div>
      </div>
    `);
    const outside = wrap.querySelector('#outside') as HTMLButtonElement;
    const surface = wrap.querySelector('#surface') as HTMLElement;
    outside.focus();
    surface.style.setProperty('visibility', 'hidden', 'important');
    try {
      expect(promoteToTopLayer(surface)).to.equal(true);
      expect(document.activeElement?.id).to.equal('outside');
      expect(surface.style.getPropertyValue('visibility')).to.equal('hidden');
      expect(surface.style.getPropertyPriority('visibility')).to.equal('important');
    } finally {
      releaseTopLayer(surface);
    }
    const plain = document.createElement('div');
    plain.innerHTML = '<input autofocus aria-label="inner" />';
    wrap.append(plain);
    try {
      expect(promoteToTopLayer(plain)).to.equal(true);
      expect(document.activeElement?.id).to.equal('outside');
      expect(plain.style.getPropertyValue('visibility')).to.equal('');
      expect(plain.style.getPropertyPriority('visibility')).to.equal('');
    } finally {
      releaseTopLayer(plain);
    }
  });

  it('releases when the element gains [hidden], and not when hidden toggles within one task', async () => {
    const { child } = await childOf('transform: translateY(0)');
    child.style.setProperty('zoom', '0.5');
    promoteToTopLayer(child);
    child.hidden = true;
    child.hidden = false;
    await microtask();
    await microtask();
    expect(isOpen(child), 'a same-task close then reopen keeps the promotion').to.equal(true);
    child.hidden = true;
    await waitUntil(() => !child.hasAttribute('popover'));
    expect(isOpen(child)).to.equal(false);
    expect(child.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(false);
    expect(child.style.getPropertyValue('zoom'), 'a zoom the escape never wrote is kept').to.equal('0.5');
  });

  it('removes a written zoom on release', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div style="zoom: 2">
        <div style="transform: translateY(0)">
          <button id="anchor">a</button>
          <div id="popup" style="position: fixed; inline-size: 40px">p</div>
        </div>
      </div>
    `);
    const popup = wrap.querySelector('#popup') as HTMLElement;
    const stop = placeAnchoredSurface(wrap.querySelector('#anchor') as HTMLElement, popup);
    try {
      await waitUntil(() => popup.style.left !== '');
      expect(isOpen(popup)).to.equal(true);
      expect(Number.parseFloat(popup.style.getPropertyValue('zoom'))).to.be.closeTo(0.5, 0.001);
    } finally {
      stop();
    }
    popup.hidden = true;
    await waitUntil(() => !popup.hasAttribute('popover'));
    expect(popup.style.getPropertyValue('zoom')).to.equal('');
  });

  it('releaseTopLayer releases explicitly and is a no-op on an untouched element', async () => {
    const { parent, child } = await childOf('transform: translateY(0)');
    promoteToTopLayer(child);
    releaseTopLayer(child);
    expect(isOpen(child)).to.equal(false);
    expect(child.hasAttribute('popover')).to.equal(false);
    expect(child.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(false);

    const untouched = document.createElement('div');
    untouched.setAttribute('popover', 'auto');
    untouched.style.setProperty('zoom', '2');
    parent.append(untouched);
    releaseTopLayer(untouched);
    expect(untouched.getAttribute('popover')).to.equal('auto');
    expect(untouched.style.getPropertyValue('zoom')).to.equal('2');
  });

  it('never writes, shows, hides or removes a consumer-authored popover', async () => {
    const { child } = await childOf('transform: translateY(0)');
    child.setAttribute('popover', 'auto');
    expect(promoteToTopLayer(child)).to.equal(false);
    expect(child.getAttribute('popover')).to.equal('auto');
    expect(isOpen(child)).to.equal(false);
    child.showPopover();
    stripStaleTopLayer(child);
    releaseTopLayer(child);
    expect(isOpen(child), 'release never hides a consumer popover').to.equal(true);
    expect(child.getAttribute('popover')).to.equal('auto');
    child.hidePopover();
  });

  it('strips or re-promotes after a disconnect, including a moved hover bridge', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <div id="trap" style="transform: translateY(0)">
          <button id="anchor">a</button>
          <span id="bridge" style="position: fixed; inset: 0"></span>
          <div id="popup" style="position: fixed; inline-size: 40px">p</div>
        </div>
        <div id="free"></div>
      </div>
    `);
    const anchor = wrap.querySelector('#anchor') as HTMLElement;
    const bridge = wrap.querySelector('#bridge') as HTMLElement;
    const popup = wrap.querySelector('#popup') as HTMLElement;
    const trap = wrap.querySelector('#trap') as HTMLElement;
    const free = wrap.querySelector('#free') as HTMLElement;
    let stop = placeAnchoredSurface(anchor, popup, { hoverBridge: bridge });
    await waitUntil(() => popup.style.left !== '');
    expect(isOpen(popup)).to.equal(true);
    expect(isOpen(bridge)).to.equal(true);
    stop();

    // A re-append (a keyed reorder) auto-hides; the next run re-promotes.
    trap.append(popup);
    expect(isOpen(popup)).to.equal(false);
    stop = placeAnchoredSurface(anchor, popup, { hoverBridge: bridge });
    await waitUntil(() => isOpen(popup));
    stop();

    // The bridge moves to an untrapped parent: the next run strips it instead of leaving the UA
    // [popover]:not(:popover-open) rule hiding it.
    free.append(bridge);
    expect(isOpen(bridge)).to.equal(false);
    stop = placeAnchoredSurface(anchor, popup, { hoverBridge: bridge });
    await waitUntil(() => popup.style.left !== '');
    expect(bridge.hasAttribute('popover')).to.equal(false);
    expect(getComputedStyle(bridge).display).to.not.equal('none');
    stop();
    releaseTopLayer(popup);
  });

  it('writes nothing and does not throw when showPopover is unavailable on the instance', async () => {
    const { child } = await childOf('transform: translateY(0)');
    Object.defineProperty(child, 'showPopover', { value: undefined, configurable: true });
    expect(() => promoteToTopLayer(child)).to.not.throw();
    expect(promoteToTopLayer(child)).to.equal(false);
    expect(child.hasAttribute('popover')).to.equal(false);
    expect(child.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(false);
  });

  const polyfillShapes: Array<[string, (original: typeof Element.prototype.matches) => typeof Element.prototype.matches]> = [
    [
      'matches throws for :popover-open',
      (original) =>
        function (this: Element, selector: string) {
          if (selector.includes(':popover-open')) throw new SyntaxError('unsupported');
          return original.call(this, selector);
        } as typeof Element.prototype.matches,
    ],
    [
      'matches answers :popover-open from a class',
      (original) =>
        function (this: Element, selector: string) {
          return original.call(this, selector.replace(/:popover-open/g, '.\\:popover-open'));
        } as typeof Element.prototype.matches,
    ],
    ['matches is not patched', (original) => original],
  ];
  for (const [label, patch] of polyfillShapes) {
    it(`does not promote under a polyfill (${label})`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div style="transform: translateY(0)">
          <lr-dropdown hoist style="--lr-transition-fast: 0ms">
            <button slot="trigger">Actions</button>
            <lr-dropdown-item value="a">A</lr-dropdown-item>
          </lr-dropdown>
        </div>
      `);
      const { child } = await childOf('transform: translateY(0)');
      const dropdown = wrapper.querySelector('lr-dropdown') as LyraDropdown;
      const original = Element.prototype.matches;
      await withoutNativePopoverSelector(async () => {
        Element.prototype.matches = patch(original);
        try {
          let result: boolean | undefined;
          expect(() => (result = promoteToTopLayer(child))).to.not.throw();
          expect(result).to.equal(false);
          expect(child.hasAttribute('popover')).to.equal(false);
          expect(child.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(false);
          let shown = false;
          dropdown.addEventListener('lr-after-show', () => (shown = true), { once: true });
          await dropdown.show();
          await waitUntil(() => shown, 'the non-promoted path still opens');
          const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
          expect(popup.hasAttribute('popover')).to.equal(false);
          await dropdown.hide({ focusTrigger: false });
        } finally {
          Element.prototype.matches = original;
        }
      });
    });
  }

  it('promotes a fixed dropdown when a trap appears while it is open', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="block-size: 40px">
        <lr-dropdown hoist style="--lr-transition-fast: 0ms">
          <button slot="trigger">Actions</button>
          <lr-dropdown-item value="a">Alpha</lr-dropdown-item>
          <lr-dropdown-item value="b">Beta</lr-dropdown-item>
        </lr-dropdown>
      </div>
    `);
    const dropdown = wrapper.querySelector('lr-dropdown') as LyraDropdown;
    const popup = dropdown.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    await dropdown.show();
    await waitUntil(() => popup.style.left !== '');
    expect(isOpen(popup), 'an untrapped fixed dropdown stays on z-index').to.equal(false);
    wrapper.style.transform = 'translateY(1px)';
    wrapper.style.overflow = 'hidden';
    await waitUntil(() => isOpen(popup), 'the per-update check promotes the newly trapped popup');
    const beta = dropdown.querySelectorAll('lr-dropdown-item')[1] as HTMLElement;
    await waitUntil(() => beta.getBoundingClientRect().top > wrapper.getBoundingClientRect().bottom);
    const rect = beta.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit?.closest('lr-dropdown-item')?.getAttribute('value')).to.equal('b');
    await dropdown.hide({ focusTrigger: false });
  });
});

describe('ancestorZoom', () => {
  async function withWalkPath(element: HTMLElement, body: () => void): Promise<void> {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'currentCSSZoom');
    if (descriptor) Object.defineProperty(Element.prototype, 'currentCSSZoom', { value: undefined, configurable: true });
    try {
      body();
    } finally {
      if (descriptor) Object.defineProperty(Element.prototype, 'currentCSSZoom', descriptor);
    }
    void element;
  }

  it('multiplies ancestor zoom on both the fast path and the walk', async () => {
    const { child } = await childOf('zoom: 2');
    expect(ancestorZoom(child)).to.be.closeTo(2, 0.001);
    await withWalkPath(child, () => expect(ancestorZoom(child)).to.be.closeTo(2, 0.001));
    const wrap = await fixture<HTMLElement>(html`
      <div style="zoom: 2"><div style="zoom: 0.5"><div id="leaf">x</div></div></div>
    `);
    const leaf = wrap.querySelector('#leaf') as HTMLElement;
    expect(ancestorZoom(leaf)).to.be.closeTo(1, 0.001);
    await withWalkPath(leaf, () => expect(ancestorZoom(leaf)).to.be.closeTo(1, 0.001));
  });

  it('excludes page zoom on <html>', async () => {
    const { child } = await childOf('zoom: 2');
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('zoom');
    root.style.setProperty('zoom', '1.25');
    try {
      expect(ancestorZoom(child)).to.be.closeTo(2, 0.001);
      await withWalkPath(child, () => expect(ancestorZoom(child)).to.be.closeTo(2, 0.001));
    } finally {
      if (previous) root.style.setProperty('zoom', previous);
      else root.style.removeProperty('zoom');
    }
  });

  it('never stops at a top-layer ancestor', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div style="zoom: 2"><div id="layer" popover="manual"><div id="leaf">x</div></div></div>
    `);
    const layer = wrap.querySelector('#layer') as HTMLElement;
    const leaf = wrap.querySelector('#leaf') as HTMLElement;
    layer.showPopover();
    try {
      expect(ancestorZoom(leaf)).to.be.closeTo(2, 0.001);
      await withWalkPath(leaf, () => expect(ancestorZoom(leaf)).to.be.closeTo(2, 0.001));
    } finally {
      layer.hidePopover();
    }
  });
});
