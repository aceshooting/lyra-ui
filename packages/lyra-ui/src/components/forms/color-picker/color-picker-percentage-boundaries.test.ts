import { expect, fixture, html } from '@open-wc/testing';
import { formatColor, parseColor } from './color-core.js';
import type { LyraColorPicker } from './color-picker.js';
import './color-picker.js';

const largePercentage = `1${'0'.repeat(308)}%`;

for (const [channel, expected] of [[0, '#ff0000'], [1, '#00ff00'], [2, '#0000ff']] as const) {
  it(`clamps finite overflowing RGB percentage channel ${channel} before conversion`, () => {
    const channels = ['0', '0', '0'];
    channels[channel] = largePercentage;
    const parsed = parseColor(`rgb(${channels.join(' ')})`);
    expect(parsed === null).to.equal(false);
    expect(formatColor(parsed!, 'hex')).to.equal(expected);
  });

  it(`renders the clamped channel ${channel} through the public picker value`, async () => {
    const channels = ['0', '0', '0'];
    channels[channel] = largePercentage;
    const value = `rgb(${channels.join(' ')})`;
    const picker = await fixture<LyraColorPicker>(html`
      <lr-color-picker inline label="Color" .value=${value}></lr-color-picker>
    `);
    expect(picker.getFormattedValue('hex')).to.equal(expected);
    const preview = picker.shadowRoot!.querySelector<HTMLElement>('[part="preview"]')!;
    const expectedChannels = [0, 0, 0];
    expectedChannels[channel] = 255;
    expect(getComputedStyle(preview, '::after').backgroundColor).to.equal(
      `rgb(${expectedChannels.join(', ')})`,
    );
  });
}
