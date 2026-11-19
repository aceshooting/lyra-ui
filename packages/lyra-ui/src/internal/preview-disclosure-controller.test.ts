import { expect, fixture, html as fixtureHtml } from '@open-wc/testing';
import { LitElement, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { createPreviewDisclosure } from './preview-disclosure-controller.js';

class PreviewHost extends LitElement {
  @property({ type: Boolean }) content = true;
  @state() popoverOpen = false;
  @query('[part="base"]') private buttonEl?: HTMLButtonElement;
  @query('[part="popover"]') private popoverEl?: HTMLElement;
  readonly preview = createPreviewDisclosure(this, {
    button: () => this.buttonEl,
    panel: () => this.popoverEl,
    hasContent: () => this.content,
    isOpen: () => this.popoverOpen,
    setOpen: (open) => { this.popoverOpen = open; },
    hideDelayMs: 10,
  });

  protected override render() {
    return html`<button part="base" @pointerenter=${() => this.preview.pointerEnter()} @pointerleave=${() => this.preview.pointerLeave()}
      >Cite</button><div part="popover" ?hidden=${!this.popoverOpen}>Preview</div>`;
  }
}
customElements.define('h3c-preview-host', PreviewHost);

const escape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('createPreviewDisclosure', () => {
  it('registers the anchored overlay once the open state renders and releases it on close', async () => {
    const el = await fixture<PreviewHost>(fixtureHtml`<h3c-preview-host></h3c-preview-host>`);
    el.preview.pointerEnter();
    await el.updateComplete;
    expect(el.popoverOpen).to.equal(true);
    escape();
    await el.updateComplete;
    expect(el.popoverOpen, 'Escape reached the registered overlay').to.equal(false);
    el.requestUpdate();
    await el.updateComplete;
    escape();
    expect(el.popoverOpen).to.equal(false);
  });

  it('closes an open preview whose content emptied before the next render', async () => {
    const el = await fixture<PreviewHost>(fixtureHtml`<h3c-preview-host></h3c-preview-host>`);
    el.preview.pointerEnter();
    await el.updateComplete;
    el.content = false;
    await el.updateComplete;
    expect(el.popoverOpen).to.equal(false);
    el.preview.pointerEnter();
    await el.updateComplete;
    expect(el.popoverOpen, 'no content, no preview').to.equal(false);
  });

  it('closes on disconnect and opens again after reconnect', async () => {
    const el = await fixture<PreviewHost>(fixtureHtml`<h3c-preview-host></h3c-preview-host>`);
    const parent = el.parentElement!;
    el.preview.pointerEnter();
    await el.updateComplete;
    el.remove();
    expect(el.popoverOpen).to.equal(false);
    parent.append(el);
    await el.updateComplete;
    el.preview.pointerEnter();
    await el.updateComplete;
    expect(el.popoverOpen).to.equal(true);
    escape();
    await el.updateComplete;
    expect(el.popoverOpen).to.equal(false);
  });
});
