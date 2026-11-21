// Text-entry fields expose a font-family knob next to their font-size knob, so a field's own text
// can switch face without restyling the label, hint or counter around it.
import { expect, fixture, html } from '@open-wc/testing';
import '../lr-textarea.js';
import '../lr-input.js';
import '../lr-code-editor.js';

const family = (root: Element, selector: string): string => {
  const node = root.shadowRoot!.querySelector(selector);
  return node ? getComputedStyle(node).fontFamily : 'missing';
};

describe('field font-family tokens', () => {
  it('lr-textarea keeps the host font by default and follows --lr-textarea-font-family', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <lr-textarea label="Notes"></lr-textarea>
      <lr-textarea label="Code" style="--lr-textarea-font-family: monospace"></lr-textarea>
    </div>`);
    const [plain, themed] = Array.from(host.querySelectorAll('lr-textarea')) as [HTMLElementTagNameMap['lr-textarea'], HTMLElementTagNameMap['lr-textarea']];
    await Promise.all([plain.updateComplete, themed.updateComplete]);
    expect(family(plain, '[part="textarea"]')).to.equal(getComputedStyle(plain).fontFamily);
    expect(family(themed, '[part="textarea"]')).to.equal('monospace');
    expect(family(themed, '[part~="label"]')).to.equal(getComputedStyle(themed).fontFamily);
  });

  it('lr-input keeps the host font by default and follows --lr-input-font-family', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <lr-input label="Name"></lr-input>
      <lr-input label="Key" style="--lr-input-font-family: monospace"></lr-input>
    </div>`);
    const [plain, themed] = Array.from(host.querySelectorAll('lr-input')) as [HTMLElementTagNameMap['lr-input'], HTMLElementTagNameMap['lr-input']];
    await Promise.all([plain.updateComplete, themed.updateComplete]);
    expect(family(plain, '[part="input"]')).to.equal(getComputedStyle(plain).fontFamily);
    expect(family(themed, '[part="input"]')).to.equal('monospace');
    expect(family(themed, '[part~="label"]')).to.equal(getComputedStyle(themed).fontFamily);
  });

  it('lr-code-editor applies --lr-code-editor-font-family to the gutter and the textarea together', async () => {
    const el = await fixture<HTMLElement & { updateComplete: Promise<boolean> }>(
      html`<lr-code-editor value="a" style="--lr-code-editor-font-family: serif"></lr-code-editor>`,
    );
    await el.updateComplete;
    expect(family(el, '[part="textarea"]')).to.equal('serif');
    expect(family(el, '[part="gutter"]')).to.equal('serif');
  });
});
