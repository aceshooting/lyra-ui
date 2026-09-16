import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './dialog.js';
import type { LyraDialog } from './dialog.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function closeButton(el: LyraDialog): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part~="close-button"]')!;
}

function nativeControl(el: LyraDialog): HTMLButtonElement {
  return closeButton(el).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-dialog: composed close lr-icon-button', () => {
  it('composes a real lr-icon-button as the close control', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Edit user" open>body</lr-dialog>`
    )) as LyraDialog;
    await el.updateComplete;
    expect(closeButton(el).localName).to.equal('lr-icon-button');
    expect(closeButton(el).getAttribute('exportparts')).to.contain('button:close-button__control');
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}>
        <lr-dialog label="Edit user" open>body</lr-dialog>
      </div>
    `);
    const el = host.querySelector<LyraDialog>('lr-dialog')!;
    await el.updateComplete;
    const style = getComputedStyle(nativeControl(el));
    expect(style.backgroundColor, 'the ancestor background token reaches the control').to.equal(
      'rgb(1, 2, 3)'
    );
    expect(style.borderTopLeftRadius, 'the ancestor radius token reaches the control').to.equal(
      '11px'
    );
    expect(style.borderTopWidth, 'the ancestor border token reaches the control').to.equal('2px');
  });

  it('inherits the composed control\'s non-zero paint transition, since dialog.styles.ts declares none of its own', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Edit user" open>body</lr-dialog>`
    )) as LyraDialog;
    await el.updateComplete;
    const computed = getComputedStyle(nativeControl(el));
    expect(computed.transitionDuration).to.not.equal('0s');
    expect(computed.transitionProperty).to.include('background-color');
  });

  it('closes on Enter from the actually focused control, with the close-button reason', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Edit user" open>body</lr-dialog>`
    )) as LyraDialog;
    await el.updateComplete;
    closeButton(el).focus();
    await el.updateComplete;
    expect(
      closeButton(el).shadowRoot!.activeElement === nativeControl(el),
      'focus landed on the composed native control'
    ).to.equal(true);
    const reasons: string[] = [];
    el.addEventListener('lr-request-close', (event) => {
      reasons.push((event as CustomEvent<{ source: string }>).detail.source);
    });
    const hidden = oneEvent(el, 'lr-hide');
    await sendKeys({ press: 'Enter' });
    const event = await hidden;
    // The detail carries the requesting ELEMENT; compare its part tokens, never the node itself.
    const source = (event as CustomEvent<{ source: Element }>).detail.source;
    expect(source.getAttribute('part')).to.equal('close-button close-button__base');
    expect(reasons).to.deep.equal(['close-button']);
    expect(el.open, 'the dialog closed').to.equal(false);
  });

  it('is accessible while open with the composed close control', async () => {
    const el = (await fixture(
      html`<lr-dialog label="Edit user" open>body</lr-dialog>`
    )) as LyraDialog;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
