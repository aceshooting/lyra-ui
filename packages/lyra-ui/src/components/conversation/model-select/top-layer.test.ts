import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, hitId, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-model-select.js';
import '../../lr-voice-picker.js';

const NO_MOTION = '--lr-transition-fast: 0ms';
type Picker = HTMLElement & { open: boolean; topLayer: boolean; updateComplete: Promise<boolean> };

async function mount(name: 'lr-model-select' | 'lr-voice-picker', topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(name === 'lr-model-select'
    ? html`<lr-model-select data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer} label="Model"
        .catalog=${['alpha', 'beta', 'gamma']}></lr-model-select>`
    : html`<lr-voice-picker data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer} label="Voice"
        .catalog=${['alpha', 'beta', 'gamma']}></lr-voice-picker>`);
  const el = wrapper.querySelector(name) as Picker;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => el.open && listbox.getBoundingClientRect().height > 0 && listbox.style.left !== '', 'the listbox is placed');
  return { el, sibling, listbox };
}

for (const name of ['lr-model-select', 'lr-voice-picker'] as const) {
  describe(`top-layer on ${name}`, () => {
    it('defaults off, beneath a higher sibling', async () => {
      const { el, sibling, listbox } = await mount(name, false);
      expect(el.topLayer).to.equal(false);
      const [x, y] = pointOverSibling(listbox, sibling);
      expect(listbox.matches(':popover-open')).to.equal(false);
      expect(hitId(x, y)).to.equal('sibling');
      el.open = false;
    });

    it('paints above the higher sibling when opted in, and releases when unset', async () => {
      const { el, sibling, listbox } = await mount(name, true);
      await waitUntil(() => listbox.matches(':popover-open'), 'the listbox is promoted');
      const [x, y] = pointOverSibling(listbox, sibling);
      expect(hitBelongsTo(el, x, y), 'the listbox wins the hit test over the sibling').to.equal(true);
      el.topLayer = false;
      await waitUntil(() => !listbox.matches(':popover-open'), 'turning it off releases the top layer');
      expect(el.open).to.equal(true);
      el.open = false;
    });
  });
}
