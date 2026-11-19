import { expect, fixture, html } from '@open-wc/testing';
import { css, LitElement, type CSSResult } from 'lit';
import {
  mapOverlayCloseButton, mapOverlayCloseButtonActive, mapOverlayCloseButtonHover, mapOverlayPanel, mapOverlayPanelLayer,
} from './map-overlay-panel.styles.js';

class TestMapOverlay extends LitElement {
  static override styles: CSSResult[] = [css`
    :host { --lr-border-width-thin: 1px; --lr-shadow-m: 0 1px 2px rgb(0 0 0 / 50%); --lr-layer-content: 3; --lr-color-border-subtle: gray; display: block; position: relative; inline-size: 400px; block-size: 300px; }
    [part='panel'] { ${mapOverlayPanelLayer} ${mapOverlayPanel} overflow: auto; }
    button { ${mapOverlayCloseButton} }
    button:where(:hover) { ${mapOverlayCloseButtonHover} }
    button:where(:active) { ${mapOverlayCloseButtonActive} }
  `];
  override render() { return html`<div part="panel"><button type="button">x</button></div>`; }
}
customElements.define('lr-test-map-overlay-panel', TestMapOverlay);

describe('map overlay panel styles', () => {
  it('renders the shared surface chrome, layer and close-button chrome', async () => {
    const el = await fixture<TestMapOverlay>(html`<lr-test-map-overlay-panel></lr-test-map-overlay-panel>`);
    const panel = el.shadowRoot!.querySelector('[part="panel"]')!;
    const style = getComputedStyle(panel);
    expect(style.position).to.equal('absolute');
    expect(style.boxSizing).to.equal('border-box');
    expect(style.overflowWrap).to.equal('anywhere');
    expect(style.borderTopStyle).to.equal('solid');
    expect(style.boxShadow).to.not.equal('none');
    expect(style.zIndex).to.not.equal('auto');
    const button = getComputedStyle(el.shadowRoot!.querySelector('button')!);
    expect(button.cursor).to.equal('pointer');
    expect(button.borderTopWidth).to.equal('0px');
  });
});
