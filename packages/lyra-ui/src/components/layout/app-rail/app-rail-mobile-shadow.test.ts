import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraAppRail } from './app-rail.class.js';
import './app-rail.js';

function mobile(rail: LyraAppRail, matches = true): void {
  (rail as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches });
}
function panel(rail: LyraAppRail): HTMLElement { return rail.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!; }
function sliding(element: HTMLElement): boolean {
  return element.getAnimations().some(animation => 'transitionProperty' in animation && animation.transitionProperty === 'transform' && animation.playState === 'running');
}

describe('app rail mobile panel paint', () => {
  for (const direction of ['ltr', 'rtl']) for (const width of ['280px', '280.5px']) it(`parks closed ${direction} ${width} panels past the edge without shadow`, async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail dir=${direction} style=${`--lr-transition-base:0ms;--lr-app-rail-mobile-width:${width}`}><button>One</button></lr-app-rail>`);
    mobile(el); await el.updateComplete; await el.updateComplete;
    const surface = panel(el); expect(getComputedStyle(surface).boxShadow).to.equal('none');
    const rect = surface.getBoundingClientRect();
    if (direction === 'ltr') expect(rect.right).to.be.at.most(-0.5); else expect(rect.left).to.be.at.least(document.documentElement.clientWidth + 0.5);
    expect(surface.getAnimations().length).to.equal(0); expect(surface.hasAttribute('data-sliding')).to.equal(false);
  });

  it('snaps elevation while preserving real opening and closing slides', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail style="--lr-transition-base:300ms linear"><button>One</button></lr-app-rail>`);
    mobile(el); await el.updateComplete; await nextFrame();
    panel(el).getBoundingClientRect(); el.open = true; await el.updateComplete;
    expect(getComputedStyle(panel(el)).boxShadow).not.to.equal('none'); expect(sliding(panel(el))).to.equal(true);
    await waitUntil(() => !panel(el).hasAttribute('data-sliding'));
    el.open = false; await el.updateComplete;
    expect(getComputedStyle(panel(el)).boxShadow).to.equal('none'); expect(sliding(panel(el))).to.equal(true);
    await waitUntil(() => !panel(el).hasAttribute('data-sliding'));
    mobile(el, false); await el.updateComplete;
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!).boxShadow).to.equal('none');
  });

  it('never paints a panel shadow token while closed and supports suppressing open elevation', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail style="--lr-transition-base:0ms;--lr-app-rail-panel-shadow:0 0 0 3px rgb(255, 0, 0)"><button>One</button></lr-app-rail>`);
    mobile(el); await el.updateComplete; expect(getComputedStyle(panel(el)).boxShadow).to.equal('none');
    el.open = true; await el.updateComplete; expect(getComputedStyle(panel(el)).boxShadow).to.contain('rgb(255, 0, 0)');
    el.open = false; await el.updateComplete; expect(getComputedStyle(panel(el)).boxShadow).to.equal('none');
    el.style.setProperty('--lr-app-rail-panel-shadow', 'none'); el.open = true; await el.updateComplete;
    expect(getComputedStyle(panel(el)).boxShadow).to.equal('none');
  });

  it('does not animate closed direction changes or entry into mobile mode', async () => {
    const el = await fixture<LyraAppRail>(html`<lr-app-rail style="--lr-transition-base:300ms linear"></lr-app-rail>`);
    mobile(el); await el.updateComplete; await el.updateComplete;
    expect(panel(el).getAnimations().length).to.equal(0);
    const direction = document.documentElement.dir;
    try {
      document.documentElement.dir = 'rtl'; await nextFrame();
      expect(panel(el).getAnimations().length).to.equal(0); expect(panel(el).hasAttribute('data-sliding')).to.equal(false);
      expect(panel(el).getBoundingClientRect().left).to.be.at.least(document.documentElement.clientWidth + 0.5);
    } finally { document.documentElement.dir = direction; }
  });

  it('keeps closed content outside native focus traversal and is accessible', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><button id="before">Before</button><lr-app-rail><span slot="header">Navigation</span><button id="a">A</button><button id="b">B</button><span slot="footer">Account</span></lr-app-rail><button id="after">After</button></div>`);
    const el = wrapper.querySelector<LyraAppRail>('lr-app-rail')!; mobile(el); await el.updateComplete; await el.updateComplete;
    el.querySelector<HTMLButtonElement>('#a')!.focus(); expect(document.activeElement?.id).not.to.equal('a');
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus(); await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
    await sendKeys({ press: 'Tab' }); expect(document.activeElement?.id).to.equal('after');
    await sendKeys({ press: 'Shift+Tab' }); expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
    await expect(el).to.be.accessible();
    el.open = true; await el.updateComplete; el.querySelector<HTMLButtonElement>('#a')!.focus(); expect(document.activeElement?.id).to.equal('a');
  });

  it('retains slotted initial focus and toggle return under reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      const el = await fixture<LyraAppRail>(html`<lr-app-rail><button id="first">First</button></lr-app-rail>`);
      mobile(el); await el.updateComplete;
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click(); await el.updateComplete;
      expect(document.activeElement?.id).to.equal('first'); expect(panel(el).getAnimations().length).to.equal(0);
      expect(panel(el).hasAttribute('data-sliding')).to.equal(false); expect(getComputedStyle(panel(el)).boxShadow).not.to.equal('none');
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!.click(); await el.updateComplete;
      expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('toggle');
      expect(getComputedStyle(panel(el)).boxShadow).to.equal('none'); expect(panel(el).getAnimations().length).to.equal(0);
      expect(panel(el).hasAttribute('data-sliding')).to.equal(false);
    } finally { await setReducedMotion('no-preference'); }
  });
});
