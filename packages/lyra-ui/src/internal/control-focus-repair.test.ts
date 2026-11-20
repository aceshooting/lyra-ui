import { expect, fixture, html } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { property } from 'lit/decorators.js';
import { sendKeys } from '@web/test-runner-commands';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';
import { repairControlFocusOnUpdate } from './control-focus-repair.js';
import { focusByKeyboard } from '../../test/wtr-focus.js';

class PagerProbe extends LyraElement {
  @property({ type: Number }) page = 0;
  @property({ type: Boolean }) withFallback = false;

  constructor() {
    super();
    repairControlFocusOnUpdate(this, () => [this.renderRoot.querySelector<HTMLElement>('[part="fallback"]')]);
  }

  override render() {
    return litHtml`<div>
        <button part="previous" type="button" ?disabled=${this.page === 0 || this.withFallback} @click=${() => this.page--}>Previous</button>
        <button part="next" type="button" ?disabled=${this.page === 2} @click=${() => this.page++}>Next</button>
      </div>
      <button part="fallback" type="button">Fallback</button>`;
  }
}
defineElement('pager-focus-probe', PagerProbe);

const focusedPart = (el: PagerProbe): string | null => el.shadowRoot!.activeElement?.getAttribute('part') ?? null;

describe('ControlFocusRepairController', () => {
  it('moves focus to a sibling button when the focused one disables itself, else to the extra target', async () => {
    const el = await fixture<PagerProbe>(html`<lr-pager-focus-probe page="1"></lr-pager-focus-probe>`);
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="next"]')!);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect([el.page, focusedPart(el)]).to.deep.equal([2, 'previous']);

    el.page = 1;
    el.withFallback = true;
    await el.updateComplete;
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="next"]')!);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(focusedPart(el)).to.equal('fallback');
  });

  it('leaves focus alone when the focused control stays enabled', async () => {
    const el = await fixture<PagerProbe>(html`<lr-pager-focus-probe></lr-pager-focus-probe>`);
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="next"]')!);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect([el.page, focusedPart(el)]).to.deep.equal([1, 'next']);
  });
});
