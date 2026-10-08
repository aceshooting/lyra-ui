import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './menu.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import './menu-item.js';
import './dropdown-item.js';
import type { LyraMenuItem } from './menu-item.class.js';

describe('mounted menu text follows root text zoom after look changes', function () {
  // A retry would remount the rows and lose the live-change regression.
  this.retries(0);
  let links: HTMLLinkElement[];
  let previousFont: string;
  let previousLook: string | null;

  before(async () => {
    links = await Promise.all(['../../../theme.css', '../../../looks/material.css', '../../../looks/shadcn.css'].map(path => new Promise<HTMLLinkElement>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL(path, import.meta.url).href;
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Missing look fixture: ${path}`));
      document.head.append(link);
    })));
  });
  after(() => { for (const link of links) link.remove(); });

  beforeEach(async () => {
    await setReducedMotion('reduce');
    await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches, 'reduced motion did not apply');
    previousFont = document.documentElement.style.fontSize;
    previousLook = document.documentElement.getAttribute('data-lr-look');
    document.documentElement.style.fontSize = '16px';
  });
  afterEach(async () => {
    await setReducedMotion('no-preference');
    await waitUntil(() => !matchMedia('(prefers-reduced-motion: reduce)').matches, 'reduced motion did not clear');
    document.documentElement.style.fontSize = previousFont;
    if (previousLook === null) document.documentElement.removeAttribute('data-lr-look');
    else document.documentElement.setAttribute('data-lr-look', previousLook);
  });

  it('rescales existing regular, linked, and mapped menu rows through each look', async () => {
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
    const menu = await fixture<HTMLElement>(html`<lr-menu>
      <lr-menu-item>Action</lr-menu-item>
      <lr-menu-item href="#target">Linked action</lr-menu-item>
      <lr-dropdown-item>Mapped action</lr-dropdown-item>
    </lr-menu>`);
    const items = Array.from(menu.children) as LyraMenuItem[];
    await Promise.all(items.map(item => item.updateComplete));
    const bases = items.map(item => item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!);
    for (const look of ['lyra', 'material', 'shadcn']) {
      document.documentElement.setAttribute('data-lr-look', look);
      for (const rootSize of [16, 32, 16, 32]) {
        document.documentElement.style.fontSize = `${rootSize}px`;
        await nextFrame();
        const expected = rootSize * (look === 'shadcn' ? 0.875 : 1);
        expect(bases.map(base => getComputedStyle(base).fontSize), `${look} at ${rootSize}px`).to.deep.equal(bases.map(() => `${expected}px`));
      }
    }
  });

  it('keeps slots static while explicit token transitions still settle and emit transitionend', async () => {
    const menu = await fixture<HTMLElement>(html`<lr-menu><lr-menu-item>Action</lr-menu-item></lr-menu>`);
    const item = menu.querySelector<LyraMenuItem>('lr-menu-item')!;
    await item.updateComplete;
    const base = item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const slot = menu.shadowRoot!.querySelector<HTMLSlotElement>('slot:not([name])')!;
    for (const motion of ['no-preference', 'reduce'] as const) {
      await setReducedMotion(motion);
      await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches === (motion === 'reduce'), 'reduced-motion preference did not apply');
      expect(Number.parseFloat(getComputedStyle(slot).transitionDuration)).to.equal(0);
      base.style.transition = 'none';
      base.style.opacity = '0';
      await nextFrame();
      expect(getComputedStyle(base).opacity).to.equal('0');
      base.style.transition = 'opacity var(--lr-transition-fast)';
      const duration = Number.parseFloat(getComputedStyle(base).transitionDuration);
      expect(duration).to.be.greaterThan(0);
      if (motion === 'reduce') expect(duration).to.be.lessThan(0.001);
      else expect(duration).to.be.greaterThan(0.001);
      let ended = false;
      const onEnd = (event: TransitionEvent) => { if (event.propertyName === 'opacity') ended = true; };
      base.addEventListener('transitionend', onEnd);
      try {
        base.style.opacity = '1';
        await waitUntil(() => ended, `${motion} transition did not settle`);
        expect(getComputedStyle(base).opacity).to.equal('1');
      } finally {
        base.removeEventListener('transitionend', onEnd);
      }
    }
  });

});
