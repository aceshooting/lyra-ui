import { expect, fixture } from '@open-wc/testing';
import type { LyraTextarea } from './textarea.js';
import './textarea.js';

for (const attribute of ['label', 'hint', 'help-text', 'error-text']) {
  it(`lr-textarea safely removes ${attribute} with null readback and later recovery`, async () => {
    const el = await fixture<LyraTextarea>('<lr-textarea></lr-textarea>');
    const property = attribute === 'help-text' ? 'helpText' : attribute === 'error-text' ? 'errorText' : attribute;
    el.setAttribute(attribute, 'Guidance');
    await el.updateComplete;
    el.removeAttribute(attribute);
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal(null);
    expect(el.shadowRoot!.textContent?.includes('Guidance')).to.equal(false);
    el.setAttribute(attribute, '');
    await el.updateComplete;
    expect(Reflect.get(el, property)).to.equal('');
    el.setAttribute(attribute, 'Recovered');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent?.includes('Recovered')).to.equal(true);
  });
}

it('lr-textarea keeps updating when the engine rejects a custom state name', async () => {
  const el = await fixture<LyraTextarea>('<lr-textarea></lr-textarea>');
  const states = (el as unknown as { internals: ElementInternals }).internals.states;
  const reject = (): never => {
    throw new DOMException('The state name is not a valid custom state.', 'SyntaxError');
  };
  Object.defineProperty(states, 'add', { configurable: true, value: reject });
  Object.defineProperty(states, 'delete', { configurable: true, value: reject });
  try {
    el.value = 'typed';
    await el.updateComplete;
    el.value = '';
    await el.updateComplete;
  } finally {
    delete (states as unknown as Record<string, unknown>)['add'];
    delete (states as unknown as Record<string, unknown>)['delete'];
  }
  expect(el.value).to.equal('');
});
