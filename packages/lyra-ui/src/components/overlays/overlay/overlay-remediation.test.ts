import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './popover.js';
import './tooltip.js';
import './dropdown.js';
import type { LyraPopover } from './popover.js';
import type { LyraTooltip } from './tooltip.js';

type AnchoredOverlay = LyraPopover | LyraTooltip;

it('safely removes tooltip content and recovers later text', async () => {
  const tooltip = await fixture<LyraTooltip>(html`<lr-tooltip content="Original"><button>Help</button></lr-tooltip>`);
  tooltip.removeAttribute('content');
  await tooltip.updateComplete;
  expect(tooltip.content === null).to.be.true;
  tooltip.content = '';
  await tooltip.updateComplete;
  expect(tooltip.content).to.equal('');
  tooltip.content = 'Restored';
  await tooltip.updateComplete;
  expect(tooltip.shadowRoot!.querySelector('[part~="body"]')!.textContent).to.include('Restored');
});

for (const tag of ['lr-popover', 'lr-tooltip', 'lr-dropdown']) {
  for (const origin of ['host', 'ancestor']) {
    for (const alignment of ['start', 'end']) {
      it(`repositions an open ${tag} ${alignment} when ${origin} direction changes`, async () => {
        const wrapper = await fixture<HTMLDivElement>(`<div dir="ltr">
          <${tag} ${tag === 'lr-tooltip' ? 'manual' : ''} placement="bottom-${alignment}" style="position: fixed; left: 240px; top: 180px; --lr-duration-base: 0ms">
            <button slot="trigger" style="inline-size: 160px">Trigger</button>
            <span style="display: block; inline-size: 64px">Details</span>
          </${tag}>
        </div>`);
        const overlay = wrapper.firstElementChild as AnchoredOverlay;
        const trigger = overlay.querySelector('button')!;
        const popup = () => overlay.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
        const aligned = (rtl: boolean) => {
          const rect = popup().getBoundingClientRect();
          const anchor = trigger.getBoundingClientRect();
          const useRight = (alignment === 'start') === rtl;
          return !popup().hasAttribute('data-hidden') && rect.width > 0 && Math.abs((useRight ? rect.right - anchor.right : rect.left - anchor.left)) < 2;
        };
        try {
          await overlay.show();
          await waitUntil(() => aligned(false), 'the overlay initially follows LTR alignment');
          let transitions = 0;
          for (const event of ['lr-show', 'lr-hide', 'lr-after-show', 'lr-after-hide']) overlay.addEventListener(event, () => transitions++);
          const directionOwner = origin === 'host' ? overlay : wrapper;
          directionOwner.setAttribute('dir', 'rtl');
          await waitUntil(() => aligned(true), 'the open overlay follows the new RTL edge');
          directionOwner.setAttribute('dir', 'ltr');
          await waitUntil(() => aligned(false), 'the open overlay recovers its LTR edge');
          expect(overlay.open).to.be.true;
          expect(transitions).to.equal(0);
        } finally {
          await overlay.hide();
        }
      });
    }
  }
}
