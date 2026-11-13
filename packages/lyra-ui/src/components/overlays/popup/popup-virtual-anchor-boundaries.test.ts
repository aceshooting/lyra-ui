import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraPopup } from './popup.class.js';
import './popup.js';

async function mount(): Promise<LyraPopup> {
  return fixture<LyraPopup>(html`<lr-popup strategy="fixed" placement="bottom"
    style="--show-duration:0s;--hide-duration:0s"><div style="width:60px;height:20px">Content</div></lr-popup>`);
}
async function placed(popup: LyraPopup): Promise<void> {
  await waitUntil(() => popup.popup.hasAttribute('data-active'));
}

describe('popup public virtual-anchor boundaries', () => {
  for (const property of ['anchor', 'virtualAnchor'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      it(`tracks a moving ${property} reader in ${direction}`, async () => {
        const popup = await mount();
        let x = 100;
        const anchor = { getBoundingClientRect: () => new DOMRect(x, 80, 80, 30) };
        popup.dir = direction;
        popup[property] = anchor;
        popup.active = true;
        await placed(popup);
        expect(popup.popup.getBoundingClientRect().left).to.be.closeTo(110, 1);
        expect(popup.popup.getBoundingClientRect().top).to.be.closeTo(110, 1);
        x = 260;
        const changed = oneEvent(popup, 'lr-reposition');
        popup.reposition();
        const event = await changed;
        expect(event.bubbles).to.equal(true);
        expect(event.composed).to.equal(true);
        expect(event.cancelable).to.equal(false);
        expect((event as CustomEvent).detail).to.deep.equal({ placement: 'bottom' });
        expect(popup.popup.getBoundingClientRect().left).to.be.closeTo(270, 1);
        expect(popup.popup.getBoundingClientRect().top).to.be.closeTo(110, 1);
        expect(getComputedStyle(popup.popup).visibility).to.equal('visible');
      });
    }
  }

  for (const value of [null, ' ', 'unknown, top-unknown nowhere']) {
    it(`uses the default flip when fallback placements are ${String(value)}`, async () => {
      const popup = await mount();
      Reflect.set(popup, 'flipFallbackPlacements', value);
      popup.virtualAnchor = { x: 160, y: 2, width: 40, height: 20 };
      popup.placement = 'top';
      popup.flip = true;
      popup.active = true;
      await placed(popup);
      expect(popup.popup.getAttribute('part')!.split(' ')).to.include('bottom');
      expect(popup.popup.getBoundingClientRect().top).to.be.closeTo(22, 1);
    });
  }

  it('falls back to the live slot when the direct element belongs to a document without a window', async () => {
    const foreign = document.implementation.createHTMLDocument('Detached document');
    const anchor = foreign.createElement('button');
    const popup = await fixture<LyraPopup>(html`<lr-popup active strategy="fixed" placement="bottom" .anchor=${anchor}
      style="--show-duration:0s;--hide-duration:0s">
      <button slot="anchor" style="position:fixed;left:120px;top:100px;width:80px;height:30px">Anchor</button>
      <div style="width:60px;height:20px">Content</div></lr-popup>`);
    await placed(popup);
    const live = popup.querySelector('button')!.getBoundingClientRect();
    expect(foreign.defaultView === null).to.equal(true);
    expect(popup.popup.getBoundingClientRect().top).to.be.closeTo(live.bottom, 1);
    expect(popup.popup.getBoundingClientRect().left).to.be.closeTo(live.left + (live.width - 60) / 2, 1);
    await expect(popup).to.be.accessible();
  });

  for (const action of ['deactivate', 'disconnect', 'replace anchor'] as const) {
    it(`discards a measurement whose reader requests ${action}`, async () => {
      const popup = await mount();
      let armed = false, changed = false;
      popup.virtualAnchor = { getBoundingClientRect: () => {
        if (armed) {
          armed = false;
          changed = true;
          if (action === 'deactivate') popup.active = false;
          else if (action === 'disconnect') popup.remove();
          else popup.virtualAnchor = { x: 400, y: 200, width: 80, height: 30 };
        }
        return new DOMRect(100, 80, 80, 30);
      } };
      popup.active = true;
      await placed(popup);
      const reported: number[] = [];
      popup.addEventListener('lr-reposition', () => { if (changed) reported.push(popup.popup.getBoundingClientRect().left); });
      armed = true;
      popup.reposition();
      await waitUntil(() => changed);
      await popup.updateComplete;
      if (action === 'replace anchor') {
        await waitUntil(() => popup.popup.hasAttribute('data-active') && Math.abs(popup.popup.getBoundingClientRect().left - 410) < 1);
        expect(reported.length).to.be.greaterThan(0);
        expect(reported.every(left => Math.abs(left - 410) < 1)).to.equal(true);
        expect(popup.popup.getBoundingClientRect().top).to.be.closeTo(230, 1);
      } else {
        await waitUntil(() => !popup.popup.hasAttribute('data-active'));
        expect(reported).to.deep.equal([]);
        if (action === 'deactivate') expect(getComputedStyle(popup.popup).pointerEvents).to.equal('none');
        else expect(popup.isConnected).to.equal(false);
      }
    });
  }
});
