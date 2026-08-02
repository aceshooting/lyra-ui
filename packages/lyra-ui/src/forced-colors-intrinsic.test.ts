import { fixture, expect, html } from '@open-wc/testing';
import './components/forms/color-picker/color-picker.js';
import './components/forms/swatch-picker/swatch-picker.js';
import type { LyraColorPicker } from './components/forms/color-picker/color-picker.js';
import type { LyraSwatchPicker } from './components/forms/swatch-picker/swatch-picker.js';

function part(root: ShadowRoot, name: string): HTMLElement {
  return root.querySelector(`[part~="${name}"]`) as HTMLElement;
}

describe('intrinsic color surfaces in forced colors', () => {
  it('preserves color-picker pixels without opting surrounding chrome out of system colors', async () => {
    const el = await fixture<LyraColorPicker>(html`
      <lr-color-picker
        inline
        opacity
        .swatches=${['#0969da', '#1a7f37', '#cf222e']}
      ></lr-color-picker>
    `);
    const root = el.shadowRoot!;
    const intrinsic = [
      part(root, 'grid'),
      part(root, 'hue-slider'),
      part(root, 'opacity-slider'),
      part(root, 'preview'),
      part(root, 'swatch'),
      part(root, 'hue-slider-handle'),
    ];
    expect(intrinsic.map((node) => getComputedStyle(node).forcedColorAdjust)).to.deep.equal(
      intrinsic.map(() => 'none'),
    );

    const chrome = [part(root, 'panel'), part(root, 'input'), part(root, 'format-button')];
    expect(chrome.map((node) => getComputedStyle(node).forcedColorAdjust)).to.deep.equal(
      chrome.map(() => 'auto'),
    );
  });

  it('preserves swatch fills while its interactive button remains system-controlled', async () => {
    const el = await fixture<LyraSwatchPicker>(html`
      <lr-swatch-picker
        .options=${[
          { value: 'blue', color: '#0969da', label: 'Blue' },
          { value: 'green', color: '#1a7f37', label: 'Green' },
        ]}
      ></lr-swatch-picker>
    `);
    const swatch = part(el.shadowRoot!, 'swatch');
    const fill = part(el.shadowRoot!, 'swatch-fill');
    expect(getComputedStyle(fill).forcedColorAdjust).to.equal('none');
    expect(getComputedStyle(swatch).forcedColorAdjust).to.equal('auto');
  });
});
