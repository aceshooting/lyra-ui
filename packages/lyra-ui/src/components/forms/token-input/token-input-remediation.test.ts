import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';

function draft(field: LyraTokenInput): HTMLInputElement {
  return field.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
}

function editInput(field: LyraTokenInput): HTMLInputElement | null {
  return field.shadowRoot!.querySelector<HTMLInputElement>('[part="token-editor"]');
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, isComposing: true }));
}

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function descriptions(field: LyraTokenInput): readonly Element[] {
  return draft(field).ariaDescribedByElements ?? [];
}

describe('token input attribute removal', () => {
  for (const [attribute, property, selector] of [
    ['label', 'label', '[part="form-control-label"]'],
    ['hint', 'hint', '[part="hint"]'],
    ['error-text', 'errorText', '[part="error"]'],
  ] as const) {
    it(`renders after removing ${attribute} while preserving null readback and later values`, async () => {
      const field = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
      field.setAttribute(attribute, 'Guidance');
      await field.updateComplete;
      expect(field.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(false);
      field.removeAttribute(attribute);
      const error = await field.updateComplete.then(() => '', (reason: Error) => reason.message);
      expect(error).to.equal('');
      expect(field[property]).to.equal(null);
      expect(field.shadowRoot!.querySelector<HTMLElement>(selector)!.hidden).to.equal(true);
      field.setAttribute(attribute, '');
      await field.updateComplete;
      expect(field[property]).to.equal('');
      field.setAttribute(attribute, 'Restored');
      await field.updateComplete;
      expect(field.shadowRoot!.querySelector(selector)!.textContent).to.include('Restored');
    });
  }
});

describe('token input composing keyboard ownership', () => {
  for (const [mode, init] of [
    ['isComposing', { isComposing: true }],
    ['legacy 229', { keyCode: 229 }],
  ] as const) {
    for (const key of ['Enter', ',', 'Tab', 'Backspace']) {
      it(`leaves draft ${key} with ${mode} unconsumed`, async () => {
        const field = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['Existing']}></lr-token-input>`);
        const input = draft(field);
        const changes: string[] = [];
        for (const name of ['lr-add', 'lr-remove', 'lr-input', 'lr-change', 'input', 'change']) {
          field.addEventListener(name, () => changes.push(name));
        }
        input.focus();
        const text = key === 'Backspace' ? '' : 'にほん';
        type(input, text);
        const event = press(input, key, init);
        await field.updateComplete;
        expect(field.value).to.deep.equal(['Existing']);
        expect(input.value).to.equal(text);
        expect(event.defaultPrevented).to.equal(false);
        expect(changes).to.deep.equal([]);
        press(input, key);
        await field.updateComplete;
        expect(field.value).to.deep.equal(key === 'Backspace' ? [] : ['Existing', 'にほん']);
      });
    }

    for (const key of ['Enter', 'Escape']) {
      it(`leaves inline editor ${key} with ${mode} open and unconsumed`, async () => {
        const field = await fixture<LyraTokenInput>(html`<lr-token-input editable .value=${['Original']}></lr-token-input>`);
        const label = field.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!;
        label.click();
        await field.updateComplete;
        const input = editInput(field)!;
        expect(field.shadowRoot!.activeElement === input).to.equal(true);
        type(input, 'にほん');
        let changes = 0;
        let bubbled = 0;
        field.addEventListener('lr-token-edit', () => changes++);
        field.addEventListener('keydown', () => bubbled++);
        const event = press(input, key, init);
        await field.updateComplete;
        expect(field.value).to.deep.equal(['Original']);
        expect(editInput(field) === input).to.equal(true);
        expect(input.value).to.equal('にほん');
        expect(event.defaultPrevented).to.equal(false);
        expect(bubbled).to.equal(1);
        expect(changes).to.equal(0);
        press(input, key);
        await field.updateComplete;
        expect(editInput(field) === null).to.equal(true);
        expect(field.value).to.deep.equal(key === 'Enter' ? ['にほん'] : ['Original']);
        expect(changes).to.equal(key === 'Enter' ? 1 : 0);
      });
    }
  }
});

describe('token draft external descriptions', () => {
  it('preserves external-first identities and local hints/errors through source changes and reconnect', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div><span id="token-external">External</span>
        <lr-token-input aria-describedby="token-external missing token-external" hint="Hint" error-text="Error"></lr-token-input>
      </div>
    `);
    const field = wrapper.querySelector('lr-token-input')!;
    const source = wrapper.querySelector('span')!;
    const hint = field.shadowRoot!.querySelector<HTMLElement>('[part="hint"]')!;
    const error = field.shadowRoot!.querySelector<HTMLElement>('[part="error"]')!;
    await waitUntil(() => descriptions(field)[0] === source);
    expect(descriptions(field).map((el) => el.id)).to.deep.equal([source.id, hint.id, error.id]);
    source.textContent = 'Changed';
    expect(descriptions(field)[0]?.textContent).to.equal('Changed');
    const replacement = document.createElement('span');
    replacement.id = source.id;
    replacement.textContent = 'Replacement';
    source.replaceWith(replacement);
    await waitUntil(() => descriptions(field)[0] === replacement);
    replacement.remove();
    await waitUntil(() => descriptions(field).length === 2);
    wrapper.prepend(replacement);
    await waitUntil(() => descriptions(field)[0] === replacement);
    replacement.id = 'renamed-token-description';
    await waitUntil(() => descriptions(field).length === 2);
    field.setAttribute('aria-describedby', replacement.id);
    await waitUntil(() => descriptions(field)[0] === replacement);
    field.hint = '';
    await field.updateComplete;
    await waitUntil(() => descriptions(field).length === 2);
    expect(descriptions(field).map((el) => el.id)).to.deep.equal([replacement.id, error.id]);
    field.removeAttribute('aria-describedby');
    await waitUntil(() => descriptions(field).length === 1);
    field.remove();
    field.setAttribute('aria-describedby', replacement.id);
    wrapper.append(field);
    await waitUntil(() => descriptions(field)[0] === replacement);
  });

  it('follows host shadow-root scope and a newly adopted document', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
    const scope = document.createElement('div');
    wrapper.append(scope);
    const root = scope.attachShadow({ mode: 'open' });
    root.innerHTML = '<span id="scoped-token-description">Scoped</span><lr-token-input aria-describedby="scoped-token-description"></lr-token-input>';
    const field = root.querySelector('lr-token-input')!;
    await field.updateComplete;
    await waitUntil(() => descriptions(field)[0] === root.querySelector('span'));
    const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
    const targetDescription = targetDocument.createElement('span');
    targetDescription.id = 'scoped-token-description';
    targetDescription.textContent = 'Adopted';
    targetDocument.body.append(targetDescription, field);
    await waitUntil(() => descriptions(field)[0] === targetDescription);
    expect(descriptions(field).length).to.equal(1);
  });
});

describe('editable token alignment', () => {
  for (const direction of ['ltr', 'rtl']) {
    for (const size of ['s', 'm', 'l']) {
      it(`centers short token text at size ${size} in ${direction}`, async () => {
        const field = await fixture<LyraTokenInput>(html`<lr-token-input editable dir=${direction} size=${size} .value=${['Label']} style="inline-size: 320px"></lr-token-input>`);
        const label = field.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!;
        const remove = field.shadowRoot!.querySelector<HTMLElement>('[part="remove"]')!;
        const range = document.createRange();
        range.selectNodeContents(label);
        const textRect = range.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const removeRect = remove.getBoundingClientRect();
        const textCenter = (textRect.top + textRect.bottom) / 2;
        const labelCenter = (labelRect.top + labelRect.bottom) / 2;
        expect(Math.abs(textCenter - labelCenter)).to.be.lessThan(2);
        expect(labelRect.height).to.be.at.least(parseFloat(getComputedStyle(remove).minBlockSize));
        expect(Math.abs((removeRect.top + removeRect.bottom) / 2 - labelCenter)).to.be.lessThan(1);
      });
    }
  }

  it('retains narrow ellipsis, wrapping, and the noneditable default', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 320px"><lr-token-input editable .value=${['LongUnbrokenToken'.repeat(12), 'Second', 'Third']}></lr-token-input><lr-token-input .value=${['Plain']}></lr-token-input></div>`);
    const field = wrapper.querySelector('lr-token-input')!;
    const label = field.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!;
    expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
    expect(label.scrollWidth).to.be.greaterThan(label.clientWidth);
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    const plain = wrapper.querySelectorAll('lr-token-input')[1]!;
    expect(plain.editable).to.equal(false);
    expect(plain.shadowRoot!.querySelectorAll('[part="token-label"]').length).to.equal(0);
  });
});
