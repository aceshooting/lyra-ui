import { expect, fixture, html } from '@open-wc/testing';
import type { LyraTerminal } from './terminal.js';
import './terminal.js';

for (const value of [0, false, null]) {
  it(`coerces ${String(value)} when writing or replacing terminal text without losing the following write`, async () => {
    const element = await fixture<LyraTerminal>(html`<lr-terminal content="prefix:"></lr-terminal>`);
    Reflect.apply(element.write, element, [value]);
    element.write(':suffix');
    await element.updateComplete;
    expect(element.getPlainText()).to.equal(`prefix:${String(value)}:suffix`);
    Reflect.apply(element.replace, element, [value]);
    element.write(':new');
    await element.updateComplete;
    expect(element.getPlainText()).to.equal(`${String(value)}:new`);
    expect(element.content).to.equal(String(value));
  });
}
