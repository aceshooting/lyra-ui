import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './reorder-item.js';
import './reorder-list.js';
import type { LyraReorderItem } from './reorder-item.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function movePart(el: LyraReorderItem, part: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
}

function nativeControl(el: LyraReorderItem, part: string): HTMLButtonElement {
  return movePart(el, part).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-reorder-item: composed move lr-icon-buttons', () => {
  it('composes real lr-icon-buttons for both move controls', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    await el.updateComplete;
    expect(movePart(el, 'move-up-button').localName).to.equal('lr-icon-button');
    expect(movePart(el, 'move-down-button').localName).to.equal('lr-icon-button');
    expect(movePart(el, 'move-up-button').getAttribute('exportparts')).to.contain(
      'button:move-up-button__control'
    );
    expect(movePart(el, 'move-down-button').getAttribute('exportparts')).to.contain(
      'button:move-down-button__control'
    );
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}><lr-reorder-item value="a">Row</lr-reorder-item></div>
    `);
    const el = host.querySelector<LyraReorderItem>('lr-reorder-item')!;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el, 'move-up-button'));
    expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(style.borderTopLeftRadius).to.equal('11px');
    // Border is reachable through the same public token as the other paint properties. This
    // component sets no border default of its own, so the ancestor value is what paints -- the
    // composed control reads the public token ahead of any contextual default.
    expect(style.borderTopWidth, 'the ancestor border token reaches the control').to.equal('2px');
    expect(style.borderTopColor).to.equal('rgb(9, 8, 7)');
  });

  it('keeps the composed accessible name that names the verb and the row', async () => {
    const el = (await fixture(
      html`<lr-reorder-item value="a" accessible-label="Second row">Row</lr-reorder-item>`
    )) as LyraReorderItem;
    await el.updateComplete;
    const control = nativeControl(el, 'move-up-button') as HTMLButtonElement & {
      ariaLabelledByElements?: readonly Element[] | null;
    };
    // No engine fallback branch. The projection is the whole point of the composition: an idref
    // cannot cross a shadow boundary, so ariaLabelledByElements is the ONLY channel that names the
    // composed control. A branch that fell back to reading `aria-labelledby` off the host would
    // assert an attribute the template writes one line away, i.e. it could never fail -- and the
    // thing this test exists to cover would go unverified on whichever engine took it.
    expect(
      'ariaLabelledByElements' in control,
      'the engine reflects element references; without it the composed control has no name at all'
    ).to.equal(true);
    const resolved = control.ariaLabelledByElements ?? [];
    expect(resolved.map((node) => (node.textContent ?? '').trim())).to.deep.equal([
      'Move up',
      'Second row',
    ]);
  });

  it('requests a move on Enter from the actually focused control', async () => {
    const el = (await fixture(html`<lr-reorder-item value="a">Row</lr-reorder-item>`)) as LyraReorderItem;
    await el.updateComplete;
    movePart(el, 'move-down-button').focus();
    await el.updateComplete;
    expect(
      movePart(el, 'move-down-button').shadowRoot!.activeElement ===
        nativeControl(el, 'move-down-button'),
      'focus landed on the composed native control'
    ).to.equal(true);
    const moved = oneEvent(el, 'lr-move-request');
    await sendKeys({ press: 'Enter' });
    const event = await moved;
    expect((event as CustomEvent<{ direction: string }>).detail.direction).to.equal('down');
  });

  it('disables the composed control when the move is unavailable', async () => {
    const enabled = (await fixture(
      html`<lr-reorder-item value="a">Row</lr-reorder-item>`
    )) as LyraReorderItem;
    await enabled.updateComplete;
    expect(nativeControl(enabled, 'move-up-button').disabled, 'enabled baseline').to.equal(false);

    const el = (await fixture(
      html`<lr-reorder-item value="a" disabled>Row</lr-reorder-item>`
    )) as LyraReorderItem;
    await el.updateComplete;
    for (const part of ['move-up-button', 'move-down-button']) {
      const composed = movePart(el, part) as HTMLElement & { disabled?: boolean };
      expect(composed.disabled, `${part} composed icon button is disabled`).to.equal(true);
      expect(nativeControl(el, part).disabled, `${part} native control is disabled`).to.equal(true);
    }
  });

  it('is accessible as a populated row inside its list', async () => {
    const list = await fixture(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">First row</lr-reorder-item>
        <lr-reorder-item value="b">Second row</lr-reorder-item>
      </lr-reorder-list>
    `);
    for (const item of Array.from(list.querySelectorAll<LyraReorderItem>('lr-reorder-item'))) {
      await item.updateComplete;
    }
    await expect(list).to.be.accessible();
  });
});
