import { expect, fixture } from '@open-wc/testing';
import './checkbox.js';
import '../checkbox-group/checkbox-group.js';
import '../radio/radio.js';
import '../radio/radio-button.js';
import '../radio/radio-group.js';
import '../color-picker/color-picker.js';

type Host = HTMLElement & { updateComplete: Promise<unknown> };

const cases: ReadonlyArray<readonly [string, string, string]> = [
  ['lr-checkbox', '<lr-checkbox>Streaming enabled</lr-checkbox>', '[part="label"]'],
  ['lr-radio', '<lr-radio value="a">Streaming enabled</lr-radio>', '[part="label"]'],
  ['lr-radio appearance="button"', '<lr-radio appearance="button" value="a">Streaming enabled</lr-radio>', '[part="label"]'],
  ['lr-radio-button', '<lr-radio-button value="a">Streaming enabled</lr-radio-button>', '[part="label"]'],
  ['lr-radio-group label', '<lr-radio-group label="Streaming enabled"><lr-radio value="a">A</lr-radio></lr-radio-group>', '[part~="label"]'],
  ['lr-radio-group hint', '<lr-radio-group label="L" hint="Streaming enabled"><lr-radio value="a">A</lr-radio></lr-radio-group>', '[part~="hint"]'],
  ['lr-checkbox-group label', '<lr-checkbox-group label="Streaming enabled"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>', '[part~="form-control-label"]'],
  ['lr-checkbox-group hint', '<lr-checkbox-group label="L" hint="Streaming enabled"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>', '[part="hint"]'],
  ['lr-color-picker', '<lr-color-picker label="Streaming enabled"></lr-color-picker>', '[part~="form-control-label"]'],
];

const textHeight = async (wrapper: string, part: string): Promise<number> => {
  const el = (await fixture<HTMLElement>(wrapper)).firstElementChild as Host;
  await el.updateComplete;
  return el.shadowRoot!.querySelector<HTMLElement>(part)!.getBoundingClientRect().height;
};

for (const [name, markup, part] of cases) {
  it(`${name} keeps a two-word text whole when a flex row squeezes it`, async () => {
    const single = await textHeight(`<div style="inline-size: 600px">${markup}</div>`, part);
    const squeezed = await textHeight(
      `<div style="display: flex; inline-size: 250px">${markup}<div style="flex: 0 0 190px"></div></div>`,
      part,
    );
    expect(Math.round(squeezed / single), 'wraps at the space, not inside a word').to.equal(2);
  });
}
