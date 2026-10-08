import { expect, fixture } from '@open-wc/testing';
import './input/input.js';
import './input/number-input.js';
import './textarea/textarea.js';
import './slider/slider.js';
import './color-picker/color-picker.js';

type Host = HTMLElement & { updateComplete: Promise<unknown>; checkValidity(): boolean; required?: boolean };

const cases: ReadonlyArray<readonly [string, string]> = [
  ['lr-input', '<lr-input required></lr-input>'],
  ['lr-number-input', '<lr-number-input required></lr-number-input>'],
  ['lr-textarea', '<lr-textarea required></lr-textarea>'],
  ['lr-slider', '<lr-slider aria-label="Level"></lr-slider>'],
  ['lr-color-picker', '<lr-color-picker label="Color"></lr-color-picker>'],
];

for (const [name, markup] of cases) {
  it(`${name} still renders and validates when the engine rejects every custom state`, async () => {
    const statesPrototype = (window as unknown as { CustomStateSet?: { prototype: CustomStateSet } }).CustomStateSet?.prototype;
    if (!statesPrototype) return;
    const originalAdd = statesPrototype.add;
    const originalDelete = statesPrototype.delete;
    statesPrototype.add = () => { throw new DOMException('rejected', 'SyntaxError'); };
    statesPrototype.delete = () => { throw new DOMException('rejected', 'SyntaxError'); };
    try {
      const el = (await fixture<HTMLElement>(markup)) as Host;
      await el.updateComplete;
      expect(el.shadowRoot !== null && el.shadowRoot.childElementCount > 0, 'the control rendered').to.equal(true);
      expect(typeof el.checkValidity()).to.equal('boolean');
    } finally {
      statesPrototype.add = originalAdd;
      statesPrototype.delete = originalDelete;
    }
  });
}
