import { expect } from '@open-wc/testing';
import { render } from 'lit';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import { renderNativeSearch } from './native-search.js';

describe('renderNativeSearch', () => {
  let container: HTMLElement;
  let host: HTMLElement;
  beforeEach(() => {
    container = document.body.appendChild(document.createElement('div'));
    host = container.appendChild(document.createElement('section'));
  });
  afterEach(() => {
    render(undefined, container);
    container.remove();
  });

  const base = () => ({
    host, part: 'search', value: '', label: 'Search nodes', placeholder: 'Type to filter', clearLabel: 'Clear search',
    onValue: (_value: string) => {},
  });
  const input = (): HTMLInputElement => container.querySelector('input')!;

  it('renders a bare search input with no optional attribute and no clear button for an empty value', () => {
    render(renderNativeSearch(base()), container);
    const field = input();
    expect(field.type).to.equal('search');
    expect(field.getAttribute('part')).to.equal('search');
    expect(field.getAttribute('aria-label')).to.equal('Search nodes');
    expect(field.getAttribute('placeholder')).to.equal('Type to filter');
    for (const attribute of ['aria-controls', 'autocomplete', 'spellcheck', 'autocapitalize', 'autocorrect', 'inputmode', 'enterkeyhint']) {
      expect(field.hasAttribute(attribute), attribute).to.equal(false);
    }
    expect(field.disabled || field.readOnly).to.equal(false);
    expect(container.querySelector('button')).to.equal(null);
  });

  it('forwards every native passthrough option to the input', () => {
    render(renderNativeSearch({
      ...base(), controls: 'results', autocomplete: 'off', spellcheck: false, autocapitalize: 'none',
      autocorrect: 'off', inputmode: 'search', enterkeyhint: 'search', disabled: () => false,
    }), container);
    const field = input();
    expect(field.getAttribute('aria-controls')).to.equal('results');
    expect(field.getAttribute('autocomplete')).to.equal('off');
    expect(field.getAttribute('spellcheck')).to.equal('false');
    expect(field.getAttribute('autocapitalize')).to.equal('none');
    expect(field.getAttribute('autocorrect')).to.equal('off');
    expect(field.getAttribute('inputmode')).to.equal('search');
    expect(field.getAttribute('enterkeyhint')).to.equal('search');
    expect(field.disabled).to.equal(false);
    render(renderNativeSearch({ ...base(), spellcheck: true }), container);
    expect(input().getAttribute('spellcheck')).to.equal('true');
  });

  it('reports typed values and calls the keydown handler only when one is supplied', () => {
    const values: string[] = [];
    const keys: string[] = [];
    render(renderNativeSearch({ ...base(), onValue: (value) => values.push(value), onKeydown: (event) => keys.push(event.key) }), container);
    const field = input();
    field.value = 'abc';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(values).to.deep.equal(['abc']);
    expect(keys).to.deep.equal(['ArrowDown']);
    render(renderNativeSearch({ ...base(), onValue: (value) => values.push(value) }), container);
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(keys, 'no handler was bound this time').to.deep.equal(['ArrowDown']);
  });

  it('keeps a disabled or read-only field from reporting values and hides the clear button for read-only', () => {
    const values: string[] = [];
    render(renderNativeSearch({ ...base(), value: 'abc', disabled: () => true, onValue: (value) => values.push(value) }), container);
    expect(input().disabled).to.equal(true);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    expect(values).to.deep.equal([]);
    expect(container.querySelector('button')!.disabled).to.equal(true);

    render(renderNativeSearch({ ...base(), value: 'abc', readOnly: true, onValue: (value) => values.push(value) }), container);
    expect(input().readOnly).to.equal(true);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    expect(values).to.deep.equal([]);
    expect(container.querySelector('button'), 'a read-only field has nothing to clear').to.equal(null);
  });

  it('clears the field, reports the empty value and returns focus to the input', () => {
    const values: string[] = [];
    render(renderNativeSearch({ ...base(), value: 'abc', onValue: (value) => values.push(value) }), container);
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).to.equal('Clear search');
    expect(button.getAttribute('part')).to.equal('search-clear');
    input().value = 'abc';
    button.click();
    expect(values).to.deep.equal(['']);
    expect(input().value).to.equal('');
    expect(container.contains(document.activeElement) && document.activeElement === input()).to.equal(true);
  });

  it('contains input events inside the field only when asked', () => {
    const seen: string[] = [];
    container.addEventListener('input', () => seen.push('input'));
    render(renderNativeSearch({ ...base(), containInput: true }), container);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen).to.deep.equal([]);
    render(renderNativeSearch({ ...base(), containInput: false }), container);
    input().dispatchEvent(new Event('input', { bubbles: true }));
    expect(seen).to.deep.equal(['input']);
  });

  it('relays focus and blur from the host instead of the inner input', async () => {
    const seen: string[] = [];
    host.addEventListener('focus', () => seen.push('host-focus'));
    host.addEventListener('blur', () => seen.push('host-blur'));
    render(renderNativeSearch(base()), container);
    const sibling = container.appendChild(document.createElement('button'));
    await focusByKeyboard(input());
    expect(seen).to.deep.equal(['host-focus']);
    await focusByKeyboard(sibling);
    expect(seen).to.deep.equal(['host-focus', 'host-blur']);
  });
});
