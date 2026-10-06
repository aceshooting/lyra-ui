import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';
import { SlottedOverlayController } from './slotted-overlay-controller.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/option.js';

class SlottedOverlayProbe extends LyraElement {
  readonly overlay = new SlottedOverlayController(this, () => this.renderRoot.querySelector('slot'));

  override render() {
    return litHtml`<slot></slot>`;
  }
}
defineElement('slotted-overlay-probe', SlottedOverlayProbe);

interface OpenableSurface extends HTMLElement {
  show(): void | Promise<void>;
  hide(): void | Promise<void>;
}

for (const [name, markup] of [
  ['lr-color-picker', html`<lr-color-picker></lr-color-picker>`],
  ['lr-date-input', html`<lr-date-input></lr-date-input>`],
  ['lr-select', html`<lr-select><lr-option value="a">Alpha</lr-option></lr-select>`],
] as const) {
  it(`keeps its slot revealed while a slotted ${name} panel is open`, async () => {
    const host = await fixture<SlottedOverlayProbe>(
      html`<lr-slotted-overlay-probe>${markup}</lr-slotted-overlay-probe>`,
    );
    const surface = host.firstElementChild as OpenableSurface;
    await (surface as unknown as LyraElement).updateComplete;
    expect(host.overlay.open).to.equal(false);
    await surface.show();
    await waitUntil(() => host.overlay.open, `an open ${name} is tracked`);
    await surface.hide();
    await waitUntil(() => !host.overlay.open, `a closed ${name} is released`);
  });
}
