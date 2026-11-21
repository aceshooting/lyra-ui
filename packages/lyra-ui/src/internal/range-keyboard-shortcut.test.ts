import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { preserveRangeKeyboardShortcut } from './range-keyboard-shortcut.js';

describe('preserveRangeKeyboardShortcut', () => {
  it('ignores synthetic and already handled key events', async () => {
    const range = await fixture<HTMLInputElement>(html`<input type="range" min="0" max="10" value="5" />`);
    let inputs = 0;
    range.addEventListener('input', () => { inputs++; });
    const synthetic = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true });
    range.addEventListener('keydown', preserveRangeKeyboardShortcut);
    range.dispatchEvent(synthetic);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    expect(inputs).to.equal(0);
    expect(range.value).to.equal('5');
  });

  it('keeps the value when a modified arrow key would step a native range', async () => {
    const range = await fixture<HTMLInputElement>(html`<input type="range" min="0" max="10" value="5" />`);
    range.addEventListener('keydown', preserveRangeKeyboardShortcut);
    const outer: string[] = [];
    range.parentElement!.addEventListener('input', () => outer.push('input'));
    await focusByKeyboard(range);
    await sendKeys({ press: 'Shift+ArrowRight' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(range.value).to.equal('5');
    expect(outer).to.deep.equal([]);
  });
});
