import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './message-actions.js';
import type { LyraMessageActions } from './message-actions.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px;';

const CONTROLS = ['copy', 'regenerate', 'edit'] as const;

function part(el: LyraMessageActions, name: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
}

function nativeControl(el: LyraMessageActions, name: string): HTMLButtonElement {
  return part(el, name).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-message-actions: composed lr-icon-buttons', () => {
  it('composes real lr-icon-buttons for regenerate and edit', async () => {
    const el = (await fixture(html`
      <lr-message-actions .controls=${CONTROLS} copy-text="hello"></lr-message-actions>
    `)) as LyraMessageActions;
    await el.updateComplete;
    expect(part(el, 'regenerate-button').localName).to.equal('lr-icon-button');
    expect(part(el, 'edit-button').localName).to.equal('lr-icon-button');
    expect(part(el, 'regenerate-button').getAttribute('exportparts')).to.contain(
      'button:regenerate-button__control'
    );
    expect(part(el, 'edit-button').getAttribute('exportparts')).to.contain(
      'button:edit-button__control'
    );
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}>
        <lr-message-actions .controls=${CONTROLS} copy-text="hello"></lr-message-actions>
      </div>
    `);
    const el = host.querySelector<LyraMessageActions>('lr-message-actions')!;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el, 'regenerate-button'));
    expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(style.borderTopLeftRadius).to.equal('11px');
  });

  it('emits lr-regenerate on Enter from the actually focused control', async () => {
    const el = (await fixture(html`
      <lr-message-actions .controls=${CONTROLS} copy-text="hello"></lr-message-actions>
    `)) as LyraMessageActions;
    await el.updateComplete;
    part(el, 'regenerate-button').focus();
    await el.updateComplete;
    expect(
      part(el, 'regenerate-button').shadowRoot!.activeElement ===
        nativeControl(el, 'regenerate-button'),
      'focus landed on the composed native control'
    ).to.equal(true);
    const regenerated = oneEvent(el, 'lr-regenerate');
    await sendKeys({ press: 'Enter' });
    await regenerated;
  });

  it('keeps the composed controls in the roving tab order with exactly one tab stop', async () => {
    const el = (await fixture(html`
      <lr-message-actions .controls=${CONTROLS} copy-text="hello"></lr-message-actions>
    `)) as LyraMessageActions;
    await el.updateComplete;
    // The toolbar leases the tab stop of the NATIVE control inside each composed icon button;
    // a lease on the custom-element host would neither add nor remove a real stop.
    const tabIndexes = ['regenerate-button', 'edit-button'].map((name) =>
      nativeControl(el, name).getAttribute('tabindex')
    );
    expect(tabIndexes.every((value) => value === '0' || value === '-1'), 'both are leased').to.equal(
      true
    );
    expect(tabIndexes.filter((value) => value === '0').length, 'at most one active stop').to.be.at.most(
      1
    );
    for (const name of ['regenerate-button', 'edit-button']) {
      expect(part(el, name).hasAttribute('tabindex'), `${name} host takes no tab stop`).to.equal(
        false
      );
    }
  });

  it('moves the roving stop with ArrowRight onto the composed control', async () => {
    const el = (await fixture(html`
      <lr-message-actions .controls=${['regenerate', 'edit'] as const}></lr-message-actions>
    `)) as LyraMessageActions;
    await el.updateComplete;
    part(el, 'regenerate-button').focus();
    await el.updateComplete;
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(
      part(el, 'edit-button').shadowRoot!.activeElement === nativeControl(el, 'edit-button'),
      'ArrowRight moved focus to the next composed control'
    ).to.equal(true);
    expect(nativeControl(el, 'edit-button').getAttribute('tabindex')).to.equal('0');
    expect(nativeControl(el, 'regenerate-button').getAttribute('tabindex')).to.equal('-1');
  });

  it('is accessible as a populated toolbar', async () => {
    const el = (await fixture(html`
      <lr-message-actions .controls=${CONTROLS} copy-text="hello"></lr-message-actions>
    `)) as LyraMessageActions;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
