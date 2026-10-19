import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
import './tooltip.js';

interface Sample {
  position: string;
  overflow: number;
  display: string;
}

async function mount(dir: 'ltr' | 'rtl') {
  const region = await fixture<HTMLDivElement>(html`
    <div
      dir=${dir}
      style="width: 390px; max-width: 100%; overflow: auto; box-sizing: border-box; --lr-positioning-strategy: fixed; --lr-transition-fast: 300ms; --lr-duration-fast: 300ms"
    >
      <label style="display: flex; gap: 4px; padding: 0; width: max-content; margin-right: auto; margin-left: 0">
        Field
        <lr-tooltip manual content="Helpful text for this field that is long enough to need shifting">
          <button slot="trigger" style="margin: 0; padding: 0 2px">i</button>
        </lr-tooltip>
      </label>
    </div>
  `);
  const el = region.querySelector('lr-tooltip') as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  return { region, el, popup };
}

function sampler(region: HTMLElement, popup: HTMLElement) {
  const samples: Sample[] = [];
  let live = true;
  const tick = (): void => {
    if (!live) return;
    const style = getComputedStyle(popup);
    samples.push({
      position: style.position,
      overflow: region.scrollWidth - region.clientWidth,
      display: style.display,
    });
    requestAnimationFrame(tick);
  };
  tick();
  return { samples, stop: () => { live = false; } };
}

for (const dir of ['ltr', 'rtl'] as const) {
  describe(`lr-tooltip placement lifecycle (${dir}, fixed strategy token)`, () => {
    it('never lays out at an unresolved position on the opening frame', async () => {
      const { region, el, popup } = await mount(dir);
      el.open = true;
      await el.updateComplete;
      // The first placement pass has not run yet: the popup must already hold the resolved strategy.
      expect(popup.style.left, 'placement pending').to.equal('');
      expect(getComputedStyle(popup).position).to.equal('fixed');
      expect(region.scrollWidth - region.clientWidth, 'scroll overflow').to.be.at.most(0);
    });

    it('keeps the fixed strategy and never widens the scroll region across open and close', async () => {
      const { region, el, popup } = await mount(dir);
      const recorder = sampler(region, popup);
      void el.show();
      await waitUntil(() => popup.style.left !== '' && popup.getBoundingClientRect().height > 0, 'placed');
      await waitUntil(() => !popup.hasAttribute('data-hidden'), 'painted');
      const hide = el.hide();
      await waitUntil(() => popup.hasAttribute('hidden'), 'settled hidden', { timeout: 3000 });
      await hide;
      recorder.stop();
      const visible = recorder.samples.filter((sample) => sample.display !== 'none');
      expect(visible.length, 'visible frames sampled').to.be.greaterThan(0);
      expect(visible.filter((sample) => sample.position !== 'fixed').length, 'non-fixed frames').to.equal(0);
      expect(Math.max(...recorder.samples.map((sample) => sample.overflow)), 'scroll overflow').to.be.at.most(0);
    });

    it('keeps the fixed strategy when it closes before the first placement ran', async () => {
      const { region, el, popup } = await mount(dir);
      const recorder = sampler(region, popup);
      void el.show();
      await Promise.resolve();
      const hide = el.hide();
      await waitUntil(() => popup.hasAttribute('hidden'), 'settled hidden', { timeout: 3000 });
      await hide;
      recorder.stop();
      const visible = recorder.samples.filter((sample) => sample.display !== 'none');
      expect(visible.filter((sample) => sample.position !== 'fixed').length, 'non-fixed frames').to.equal(0);
      expect(Math.max(...recorder.samples.map((sample) => sample.overflow)), 'scroll overflow').to.be.at.most(0);
    });
  });
}
