import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './callout.js';
import type { LyraCallout } from './callout.class.js';

const ANCESTOR_TOKENS =
  '--lr-icon-button-background: rgb(1, 2, 3); --lr-icon-button-radius: 11px; --lr-icon-button-border: 2px solid rgb(9, 8, 7);';

function closeButton(el: LyraCallout): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
}

function nativeControl(el: LyraCallout): HTMLButtonElement {
  return closeButton(el).shadowRoot!.querySelector<HTMLButtonElement>('[part~="button"]')!;
}

describe('lr-callout: composed close lr-icon-button', () => {
  it('composes a real lr-icon-button as the close control', async () => {
    const el = (await fixture(
      html`<lr-callout closable>Message</lr-callout>`
    )) as LyraCallout;
    await el.updateComplete;
    expect(closeButton(el).localName).to.equal('lr-icon-button');
    expect(closeButton(el).getAttribute('exportparts')).to.contain('button:close-button__control');
  });

  it('takes its paint from the shared --lr-icon-button-* contract on an ancestor', async () => {
    const host = await fixture(html`
      <div style=${ANCESTOR_TOKENS}>
        <lr-callout closable>Message</lr-callout>
      </div>
    `);
    const el = host.querySelector<LyraCallout>('lr-callout')!;
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

  it('keeps the callout-specific hover fill winning over lr-icon-button own default', async () => {
    const el = (await fixture(
      html`<lr-callout closable style="--lr-callout-close-hover-bg: rgb(4, 5, 6)"
        >Message</lr-callout
      >`
    )) as LyraCallout;
    await el.updateComplete;
    // The component-scoped hook is captured into --lr-icon-button-background-hover, which is the
    // only channel the composed control reads. Asserting the resolved custom property proves the
    // wiring without depending on a synthesized pointer landing.
    expect(
      getComputedStyle(nativeControl(el))
        .getPropertyValue('--lr-icon-button-background-hover')
        .trim()
    ).to.equal('rgb(4, 5, 6)');
  });

  it('closes on Enter from the actually focused control', async () => {
    const el = (await fixture(
      html`<lr-callout closable>Message</lr-callout>`
    )) as LyraCallout;
    await el.updateComplete;
    closeButton(el).focus();
    await el.updateComplete;
    expect(
      closeButton(el).shadowRoot!.activeElement === nativeControl(el),
      'focus landed on the composed native control'
    ).to.equal(true);
    const closed = oneEvent(el, 'lr-close');
    await sendKeys({ press: 'Enter' });
    await closed;
    expect(el.open, 'the callout closed').to.equal(false);
  });

  it('still collapses the close control when closable is unset', async () => {
    const el = (await fixture(html`<lr-callout>Message</lr-callout>`)) as LyraCallout;
    await el.updateComplete;
    const host = closeButton(el);
    expect(host.hasAttribute('hidden')).to.equal(true);
    // An outer-tree rule has to beat lr-icon-button's own `:host { display: inline-flex }`, which
    // would otherwise out-rank the UA [hidden] rule and leave a dead 40px box in the grid.
    expect(getComputedStyle(host).display).to.equal('none');
  });

  it('is accessible with the composed close control', async () => {
    const el = (await fixture(
      html`<lr-callout closable>Message</lr-callout>`
    )) as LyraCallout;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
