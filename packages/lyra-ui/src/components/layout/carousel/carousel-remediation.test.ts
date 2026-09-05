import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { settlePointer } from '../../../../test/wtr-mouse.js';
import './carousel.js';
import './carousel-item.js';
import '../../forms/input/input.js';
import type { LyraCarousel } from './carousel.js';

describe('descendant keyboard ownership', () => {
  const editors = [
    ['input', html`<input aria-label="Caption" value="abc">`],
    ['textarea', html`<textarea aria-label="Caption">abc</textarea>`],
    ['contenteditable', html`<div contenteditable="true" role="textbox" aria-label="Caption">abc</div>`],
    ['custom input', html`<lr-input label="Caption" value="abc"></lr-input>`],
  ] as const;
  for (const [name, editorTemplate] of editors) {
    for (const placement of ['wrapped', 'slide root'] as const) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      it(`leaves ${key} in a focused ${name} (${placement})`, async () => {
        const el = await fixture<LyraCarousel>(html`
          <lr-carousel current-slide="1" style="inline-size: 24rem; --lr-transition-normal: 0ms;">
            <lr-carousel-item>First</lr-carousel-item>
            ${placement === 'wrapped' ? html`<lr-carousel-item>${editorTemplate}</lr-carousel-item>` : editorTemplate}
            <lr-carousel-item>Third</lr-carousel-item>
          </lr-carousel>
        `);
        await settlePointer();
        const editor = (placement === 'wrapped' ? el.children[1]!.firstElementChild : el.children[1]) as HTMLElement;
        editor.focus();
        if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) editor.setSelectionRange(1, 1);
        let changes = 0;
        el.addEventListener('lr-slide-change', () => changes++);
        await sendKeys({ press: key });
        await el.updateComplete;
        await settlePointer();
        expect(el.currentSlide).to.equal(1);
        expect(document.activeElement === editor).to.equal(true);
        expect(changes).to.equal(0);
        if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
          expect(editor.selectionStart).to.equal(key === 'ArrowRight' ? 2 : key === 'End' ? 3 : 0);
        }
      });
    }
    }
  }

  for (const direction of ['ltr', 'rtl'] as const) {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      it(`retains ${direction} ${orientation} viewport navigation`, async () => {
        const el = await fixture<LyraCarousel>(html`
          <lr-carousel dir=${direction} orientation=${orientation}
            style="inline-size: 24rem; block-size: 12rem; --lr-transition-normal: 0ms;">
            <div>First</div><div>Second</div><div>Third</div>
          </lr-carousel>
        `);
        const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part~="scroll-container"]')!;
        viewport.focus();
        const forward = orientation === 'vertical' ? 'ArrowDown' : direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        await sendKeys({ press: forward });
        await waitUntil(() => el.currentSlide === 1, 'The viewport advances one slide');
        await sendKeys({ press: 'End' });
        await waitUntil(() => el.currentSlide === 2, 'End selects the last slide');
        await sendKeys({ press: 'Home' });
        await waitUntil(() => el.currentSlide === 0, 'Home selects the first slide');
        expect(el.shadowRoot!.activeElement === viewport).to.equal(true);
      });
    }
  }

  for (const key of ['ArrowUp', 'ArrowDown']) {
    it(`leaves vertical ${key} with a descendant textarea`, async () => {
      const el = await fixture<LyraCarousel>(html`
        <lr-carousel orientation="vertical" current-slide="1" style="inline-size: 24rem; block-size: 12rem;">
          <div>First</div><div><textarea aria-label="Caption">first\nsecond</textarea></div><div>Third</div>
        </lr-carousel>
      `);
      const editor = el.querySelector('textarea')!;
      editor.focus();
      await sendKeys({ press: key });
      await el.updateComplete;
      await settlePointer();
      expect(el.currentSlide).to.equal(1);
      expect(document.activeElement === editor).to.equal(true);
    });
  }
});
