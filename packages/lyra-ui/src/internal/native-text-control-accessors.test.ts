import { expect, fixture, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import {
  AutocorrectState,
  installNativeInputModeAliases,
  installNativeSelectionAccessors,
} from './native-text-control.js';

class Host extends LitElement {
  declare selectionStart: number | null;
  declare selectionEnd: number | null;
  declare selectionDirection: 'forward' | 'backward' | 'none' | null;
  declare setSelectionRange: (start: number | null, end: number | null, direction?: 'forward' | 'backward' | 'none') => void;
  declare select: () => void;
  override inputMode = '';
  override enterKeyHint = '';
  declare inputmode: string;
  declare enterkeyhint: string;
  field: HTMLInputElement | null = null;
  readonly autocorrectState = new AutocorrectState(this, true);
}
installNativeSelectionAccessors(Host.prototype, (host) => host.field);
installNativeInputModeAliases(Host.prototype);
customElements.define('h3-native-text-host', Host);

describe('native text accessors', () => {
  it('reports null and ignores writes before a field exists, forwards after', async () => {
    const host = await fixture<Host>(html`<h3-native-text-host></h3-native-text-host>`);
    expect(host.selectionStart).to.equal(null);
    expect(host.selectionDirection).to.equal(null);
    host.selectionStart = 2;
    host.setSelectionRange(0, 1);
    host.select();
    const input = document.createElement('input');
    input.value = 'abcdef';
    document.body.append(input);
    host.field = input;
    host.setSelectionRange(1, 4, 'backward');
    expect([host.selectionStart, host.selectionEnd, host.selectionDirection]).to.deep.equal([1, 4, 'backward']);
    host.selectionStart = 2;
    host.selectionEnd = 5;
    host.selectionDirection = 'forward';
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).to.deep.equal([2, 5, 'forward']);
    host.selectionStart = null;
    expect(input.selectionStart).to.equal(0);
    host.select();
    expect([input.selectionStart, input.selectionEnd]).to.deep.equal([0, 6]);
    input.remove();
  });

  it('aliases lowercase inputmode/enterkeyhint and normalizes autocorrect writes', async () => {
    const host = await fixture<Host>(html`<h3-native-text-host></h3-native-text-host>`);
    host.inputmode = 'numeric';
    host.enterkeyhint = 'go';
    expect([host.inputMode, host.enterKeyHint]).to.deep.equal(['numeric', 'go']);
    host.inputmode = null as never;
    expect(host.inputMode).to.equal('');
    expect(host.autocorrectState.value).to.equal(true);
    host.autocorrectState.set('off');
    expect(host.autocorrectState.value).to.equal(false);
    host.autocorrectState.set(true);
    expect(host.autocorrectState.value).to.equal(true);
  });
});
