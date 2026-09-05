import { expect, fixture, oneEvent, waitUntil, aTimeout, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { CopyFailure } from './copy-button.stories.js';
import type { LyraCopyButton } from './copy-button.js';
import { hoverUntilMatched, sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';

for (const ownership of ['inherited', 'own'] as const) {
  it(`restores ${ownership} clipboard ownership after the actual CopyFailure story action`, async () => {
    const initial = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const clipboard = { writeText: async () => {} };
    try {
      if (ownership === 'own') Object.defineProperty(navigator, 'clipboard', { configurable: true, enumerable: true, writable: false, value: clipboard });
      else Reflect.deleteProperty(navigator, 'clipboard');
      const before = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const root = await fixture<HTMLElement>((CopyFailure.render as () => TemplateResult)());
      const button = root.matches('lr-copy-button') ? root as LyraCopyButton : root.querySelector<LyraCopyButton>('lr-copy-button')!;
      const failed = oneEvent(button, 'lr-copy-error');
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      button.click();
      expect((await failed).detail.reason).to.equal('denied');
      await waitUntil(() => {
        const after = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        return before ? after?.value === before.value : after === undefined;
      }, 'the story did not restore clipboard ownership');
      const after = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      expect(after?.configurable).to.equal(before?.configurable);
      expect(after?.enumerable).to.equal(before?.enumerable);
      expect(after?.writable).to.equal(before?.writable);
      expect(after?.get === before?.get).to.equal(true);
    } finally {
      if (initial) Object.defineProperty(navigator, 'clipboard', initial);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
}


it('keeps the actual refused-write demo effective after a held native pointer press', async () => {
  const initial = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writes: string[] = [];
  const clipboard = { writeText: async (value: string) => { writes.push(value); } };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, enumerable: true, writable: false, value: clipboard });
  try {
    const root = await fixture<HTMLElement>(html`<div>${(CopyFailure.render as () => TemplateResult)()}</div>`);
    const host = root.querySelector<LyraCopyButton>('lr-copy-button')!;
    await host.updateComplete;
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    const outcomes: string[] = [];
    host.addEventListener('lr-copy', () => outcomes.push('success'));
    host.addEventListener('lr-copy-error', (event) => outcomes.push(event.detail.reason));
    await hoverUntilMatched(button, 'copy button is hovered');
    await sendMouse({ type: 'down' });
    await aTimeout(150);
    expect(outcomes).to.deep.equal([]);
    await sendMouse({ type: 'up' });
    await waitUntil(() => outcomes.length > 0, 'copy outcome after held native release');
    expect(outcomes).to.deep.equal(['denied']);
    expect(writes).to.deep.equal([]);
    expect(root.querySelector('#copy-button-error-log')!.textContent).to.equal('lr-copy-error: denied');
    await waitUntil(() => Object.getOwnPropertyDescriptor(navigator, 'clipboard')?.value === clipboard, 'own clipboard restored after held native action');
  } finally {
    await resetMouse();
    if (initial) Object.defineProperty(navigator, 'clipboard', initial);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

for (const cancellation of ['release outside', 'disconnect'] as const) {
  it(`leaves clipboard ownership intact when native press ends by ${cancellation} without a click`, async () => {
    const initial = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const clipboard = { writeText: async () => {} };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, enumerable: true, writable: false, value: clipboard });
    try {
      const root = await fixture<HTMLElement>(html`<div>${(CopyFailure.render as () => TemplateResult)()}<button data-outside>Outside</button></div>`);
      const host = root.querySelector<LyraCopyButton>('lr-copy-button')!;
      await host.updateComplete;
      const button = host.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
      const outcomes: string[] = [];
      host.addEventListener('lr-copy', () => outcomes.push('success'));
      host.addEventListener('lr-copy-error', () => outcomes.push('error'));
      await hoverUntilMatched(button, 'copy button is hovered before cancellation');
      await sendMouse({ type: 'down' });
      if (cancellation === 'disconnect') host.remove();
      const outside = root.querySelector<HTMLElement>('[data-outside]')!;
      const rect = outside.getBoundingClientRect();
      const position: [number, number] = [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)];
      const moved = oneEvent(document, 'mousemove');
      await sendMouse({ type: 'move', position });
      const move = await moved as unknown as MouseEvent;
      expect([move.clientX, move.clientY]).to.deep.equal(position);
      expect(move.buttons).to.equal(1);
      await sendMouse({ type: 'up' });
      await aTimeout(50);
      expect(outcomes).to.deep.equal([]);
      const restored = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      expect(restored?.value === clipboard).to.equal(true);
      expect(restored?.enumerable).to.equal(true);
      expect(restored?.writable).to.equal(false);
    } finally {
      await resetMouse();
      if (initial) Object.defineProperty(navigator, 'clipboard', initial);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
}
