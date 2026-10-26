import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { sinkTexts } from '../../../lyra-ui/test/announcements.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenAction, LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

type Field = 'input' | 'textarea' | 'select' | 'checkbox';
type UpdatingElement = HTMLElement & { readonly updateComplete: Promise<unknown> };
const selectors: Record<Field, string> = { input: 'input', textarea: 'textarea', select: '[part="trigger"]', checkbox: '[role="checkbox"]' };
function query<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const result = root.querySelector<T>(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
function activeElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
function fieldFor(type: Field, errorText?: string): LyraGenNode {
  return { id: 'field', type, ...(type === 'checkbox' ? { text: 'Agree to the review' } : {}),
    props: { name: 'answer', required: true, hint: 'Provide the required response.',
      ...(type === 'checkbox' ? { checked: false } : { label: 'Response', value: '', ...(errorText ? { errorText } : {}) }) },
    bindings: type === 'checkbox' ? { checked: '/answer' } : { value: '/answer' },
    ...(type === 'select' ? { children: [{ id: 'choice', type: 'option', props: { value: 'accepted' }, text: 'Accepted' }] } : {}),
  };
}
async function mount(type: Field, errorText?: string, selected?: LyraGenCatalog) {
  const catalog = selected ?? createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'object',
    properties: { answer: type === 'checkbox' ? { type: 'boolean' } : { type: 'string' } }, required: ['answer'], additionalProperties: false } } } });
  const field = fieldFor(type, errorText);
  const document: LyraGenView = { version: '1', surfaceId: 'form-accessibility', revision: 0,
    catalog: { id: catalog.id, version: catalog.version }, root: { id: 'form', type: 'form', props: { ariaLabel: 'Review response' },
      action: { name: 'save' }, children: [
        { id: 'disabled', type: 'input', props: { label: 'Unavailable field', required: true, disabled: true, value: '' } },
        field, { id: 'submit', type: 'button', props: { type: 'submit' }, text: 'Save response' },
      ] } };
  const root = await fixture<HTMLElement>(html`<section><button data-before>Before generated form</button><lr-gen-view .catalog=${catalog}></lr-gen-view><button data-after>After generated form</button></section>`);
  const view = query<LyraGenViewElement>(root, 'lr-gen-view');
  const before = query(root, '[data-before]');
  await focusByKeyboard(before);
  view.document = document;
  await waitUntil(() => view.status === 'ready', 'Generated form is ready', { timeout: 5000 });
  expect(activeElement() === before, 'Readiness keeps focus outside the arriving form').to.equal(true);
  const control = query<UpdatingElement>(view.shadowRoot!, '[data-gen-id="field"]');
  const target = query(control.shadowRoot!, selectors[type]);
  const submit = query(query(view.shadowRoot!, '[data-gen-id="submit"]').shadowRoot!, 'button');
  return { root, view, control, target, submit, before, after: query(root, '[data-after]') };
}
function descriptionText(target: HTMLElement): string {
  const root = target.getRootNode() as ShadowRoot;
  const ids = target.getAttribute('aria-describedby')?.split(/\s+/u).filter(Boolean) ?? [];
  expect(ids.length, 'The control has accessible descriptions').to.be.greaterThan(0);
  return ids.map(id => {
    const node = root.getElementById(id);
    expect(node !== null, `Description ${id} resolves inside the control root`).to.equal(true);
    return node?.textContent ?? '';
  }).join(' ');
}

for (const type of ['input', 'textarea', 'select', 'checkbox'] as const) {
  it(`keeps ${type} keyboard order and returns invalid submission focus before a corrected single action`, async () => {
    const app = await mount(type);
    const actions: LyraGenAction[] = [];
    app.view.addEventListener('lr-gen-action', event => actions.push(event.detail));
    let invalid = 0;
    app.control.addEventListener('lr-invalid', () => invalid++);
    await sendKeys({ press: 'Tab' });
    expect(activeElement() === app.target, 'Tab skips the disabled required control').to.equal(true);
    await sendKeys({ press: 'Tab' });
    expect(activeElement() === app.submit, 'Submit follows the field').to.equal(true);
    await sendKeys({ press: 'Enter' });
    await app.control.updateComplete;
    expect(actions.length).to.equal(0);
    expect(invalid).to.equal(1);
    expect(activeElement() === app.target, 'Invalid submit focuses the first enabled invalid field').to.equal(true);
    expect(app.target.getAttribute('aria-invalid')).to.equal('true');
    expect(descriptionText(app.target)).to.contain('Provide the required response.');
    if (type === 'checkbox') await sendKeys({ press: 'Space' });
    else if (type === 'select') {
      await sendKeys({ press: 'ArrowDown' });
      await waitUntil(() => app.target.getAttribute('aria-expanded') === 'true');
      await sendKeys({ press: 'Home' });
      const hidden = oneEvent(app.control, 'lr-after-hide');
      await sendKeys({ press: 'Enter' });
      await hidden;
      expect(app.target.getAttribute('aria-expanded')).to.equal('false');
    } else await sendKeys({ type: 'accepted' });
    await app.view.updateComplete;
    await app.control.updateComplete;
    expect(app.target.getAttribute('aria-invalid')).to.equal('false');
    await sendKeys({ press: 'Tab' });
    expect(activeElement() === app.submit, 'Correction preserves keyboard reachability').to.equal(true);
    const action = oneEvent(app.view, 'lr-gen-action');
    await sendKeys({ press: 'Enter' });
    await action;
    expect(actions.length).to.equal(1);
    expect(actions[0]?.payload).to.deep.equal({ answer: type === 'checkbox' ? true : 'accepted' });
    await sendKeys({ press: 'Tab' });
    expect(activeElement() === app.after, 'The form does not trap keyboard focus').to.equal(true);
    await expect(app.view).to.be.accessible();
  });
}

for (const type of ['input', 'textarea', 'select'] as const) {
  it(`makes an authored ${type} error visibly reachable through the focused control description`, async () => {
    const message = 'Review this response before saving.';
    const app = await mount(type, message);
    await focusByKeyboard(app.submit);
    await sendKeys({ press: 'Enter' });
    await app.control.updateComplete;
    expect(activeElement() === app.target).to.equal(true);
    expect(descriptionText(app.target)).to.contain(message);
    const error = query(app.control.shadowRoot!, '[part="error"]');
    expect(error.hidden).to.equal(false);
    expect(getComputedStyle(error).display).not.to.equal('none');
    expect(error.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(app.target.getAttribute('aria-invalid')).to.equal('true');
    await expect(app.view).to.be.accessible();
  });
}

it('announces one rejected bound edit, retains focus and does not repeat the message on harmless renders', async () => {
  const catalog = createCatalog({ ...initialCatalog,
    components: { ...initialCatalog.components, input: { ...initialCatalog.components['input']!,
      properties: { ...initialCatalog.components['input']!.properties, value: { type: 'string', maxLength: 3 } } } },
    actions: { save: { payload: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } } },
  });
  const app = await mount('input', undefined, catalog);
  const message = 'This field value cannot be used.';
  const count = () => sinkTexts().filter(text => text === message).length;
  const before = count();
  await focusByKeyboard(app.target);
  await sendKeys({ type: 'abc' });
  await app.view.updateComplete;
  const failed = oneEvent(app.view, 'lr-gen-error');
  await sendKeys({ type: 'd' });
  await failed;
  await app.view.updateComplete;
  expect((app.target as HTMLInputElement).value).to.equal('abc');
  expect(activeElement() === app.target).to.equal(true);
  expect(count()).to.equal(before + 1);
  for (let cycle = 0; cycle < 3; cycle++) { app.view.requestUpdate(); await app.view.updateComplete; }
  expect(count()).to.equal(before + 1);
  expect(activeElement() === app.target).to.equal(true);
});
