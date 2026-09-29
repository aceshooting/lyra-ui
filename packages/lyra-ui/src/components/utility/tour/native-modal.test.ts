import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './tour.js';
import type { LyraTour } from './tour.js';

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

describe('tour native modal interoperability', () => {
  for (const nativeOpen of [false, true]) {
    it(`accepts pointer, focus and Escape ${nativeOpen ? 'above a native modal' : 'on the ordinary path'}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Open</button></dialog><lr-tour></lr-tour></div>`);
      const native = wrapper.querySelector('dialog')!;
      const opener = native.querySelector('button')!;
      const overlay = wrapper.querySelector('lr-tour') as LyraTour;
      overlay.steps = [{ stepId: 'intro', target: '#missing', heading: 'Welcome', content: 'Introduction' }];
      let clicks = 0;
      try {
        if (nativeOpen) native.showModal();
        overlay.start();
        await overlay.updateComplete;
        const action = overlay.shadowRoot!.querySelector<HTMLElement>('[part="skip-button"]')!;
        action.addEventListener('click', (event) => { event.stopImmediatePropagation(); clicks++; }, { capture: true });
        await click(action);
        expect(clicks, 'the visible control receives the real pointer').to.equal(1);
        expect(deepActiveElement(document) === action, 'the control receives focus').to.equal(true);
        expect(overlay.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(nativeOpen ? 1 : 0);
        expect(overlay.parentNode === wrapper).to.equal(true);
        const veto = (event: Event) => event.preventDefault();
        overlay.addEventListener('lr-tour-end-request', veto);
        await sendKeys({ press: 'Escape' });
        expect(overlay.open, 'the close veto preserves the surface').to.equal(true);
        expect(native.open).to.equal(nativeOpen);
        overlay.removeEventListener('lr-tour-end-request', veto);
        if (nativeOpen) {
          overlay.remove();
          wrapper.append(overlay);
          await overlay.updateComplete;
          await waitUntil(() => overlay.shadowRoot!.querySelectorAll('dialog:modal').length === 1);
          await click(action);
          expect(clicks, 'reconnecting restores pointer interaction').to.equal(2);
        }
        await sendKeys({ press: 'Escape' });
        await waitUntil(() => !overlay.open, 'Escape dismisses the Lyra surface');
        expect(native.open).to.equal(nativeOpen);
        if (nativeOpen) await waitUntil(() => deepActiveElement(document) === opener, 'focus returns to the native opener');
      } finally {
        overlay.remove();
        native.close();
      }
    });
  }
});

describe('tour modal step transitions', () => {
  it('releases native modality before an interactive target step', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Target</button></dialog><lr-tour></lr-tour></div>`);
    const native = wrapper.querySelector('dialog')!;
    const target = native.querySelector('button')!;
    const tour = wrapper.querySelector('lr-tour') as LyraTour;
    tour.steps = [
      { stepId: 'modal', target, heading: 'Read this' },
      { stepId: 'interactive', target, heading: 'Try this', interactiveTarget: true },
    ];
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    try {
      native.showModal();
      tour.start();
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(1);
      tour.goToStep(1);
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(0);
      expect(tour.shadowRoot!.querySelector('[part="popover"]')!.getAttribute('aria-modal')).to.equal('false');
      await click(target);
      expect(clicks).to.equal(1);
      expect(deepActiveElement(document) === target).to.equal(true);
      tour.goToStep(0);
      await tour.updateComplete;
      expect(tour.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(1);
    } finally {
      tour.remove();
      native.close();
    }
  });
});

describe('interactive tour inside a native modal', () => {
  it('keeps the target, Next and Skip actionable in the same native modal subtree', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Target</button><lr-tour></lr-tour></dialog></div>`);
    const native = wrapper.querySelector('dialog')!;
    const target = native.querySelector('button')!;
    const tour = wrapper.querySelector('lr-tour') as LyraTour;
    tour.steps = [
      { stepId: 'first', target, heading: 'Try this', interactiveTarget: true },
      { stepId: 'second', target, heading: 'Continue', interactiveTarget: true },
    ];
    let clicks = 0;
    target.addEventListener('click', () => clicks++);
    try {
      native.showModal();
      tour.start();
      await tour.updateComplete;
      await waitUntil(() => tour.shadowRoot!.querySelector<HTMLElement>('[part="popover"]')!.style.left !== '');
      expect(tour.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(0);
      await click(target);
      expect(clicks).to.equal(1);
      await click(tour.shadowRoot!.querySelector<HTMLElement>('[part="next-button"]')!);
      await waitUntil(() => tour.activeIndex === 1);
      await tour.updateComplete;
      await waitUntil(() => tour.shadowRoot!.querySelector<HTMLElement>('[part="popover"]')!.style.left !== '');
      await click(tour.shadowRoot!.querySelector<HTMLElement>('[part="skip-button"]')!);
      await waitUntil(() => !tour.open);
      expect(native.open).to.equal(true);
    } finally {
      tour.remove();
      native.close();
    }
  });
});
