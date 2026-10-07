import { expect } from '@open-wc/testing';
import { nothing } from 'lit';
import { nativeAutocorrectAttribute, setNativeRangeText } from './native-text-control.js';

for (const name of ['input', 'textarea'] as const) {
  it(`preserves ${name} selected-range edits, explicit selection and silent native semantics`, () => {
    const target = document.createElement(name);
    target.value = 'abcdef';
    target.setSelectionRange(1, 3);
    let events = 0;
    target.addEventListener('input', () => events++);
    target.addEventListener('change', () => events++);
    setNativeRangeText(target, 'X');
    expect(target.value).to.equal('aXdef');
    setNativeRangeText(target, 'YZ', 1, 2, 'select');
    expect(target.value).to.equal('aYZdef');
    expect(target.selectionStart).to.equal(1);
    expect(target.selectionEnd).to.equal(3);
    expect(events).to.equal(0);
  });
}

it('preserves native range-edit errors without mutating the target', () => {
  const input = document.createElement('input');
  input.value = 'abc';
  expect(() => setNativeRangeText(input, 'x', 2, 1)).to.throw();
  expect(input.value).to.equal('abc');
});

it('omits an unset autocorrect hint while retaining explicit on and off choices', () => {
  const host = document.createElement('div');
  expect(nativeAutocorrectAttribute(host, true)).to.equal(nothing);
  expect(nativeAutocorrectAttribute(host, false)).to.equal('off');
  host.setAttribute('autocorrect', '');
  expect(nativeAutocorrectAttribute(host, true)).to.equal('on');
  expect(nativeAutocorrectAttribute(host, false)).to.equal('off');
});
