import { expect, fixture } from '@open-wc/testing';
import { html, type TemplateResult } from 'lit';
import '../components/checkbox/checkbox.js';
import '../components/switch/switch.js';
import '../components/combobox/combobox.js';
import '../components/select/select.js';
import '../components/model-select/model-select.js';
import '../components/tool-param-form/tool-param-form.js';

interface NativeLikeFormSurface extends HTMLElement {
  disabled: boolean;
  form: HTMLFormElement | null;
  labels: NodeList;
  validity: ValidityState;
  validationMessage: string;
  willValidate: boolean;
}

const cases: Array<{ name: string; tagName: string; render(): TemplateResult }> = [
  {
    name: 'checkbox',
    tagName: 'lyra-checkbox',
    render: () => html`<lyra-checkbox id="control" name="value" required>Accept</lyra-checkbox>`,
  },
  {
    name: 'switch',
    tagName: 'lyra-switch',
    render: () => html`<lyra-switch id="control" name="value" required>Enable</lyra-switch>`,
  },
  {
    name: 'combobox',
    tagName: 'lyra-combobox',
    render: () => html`<lyra-combobox id="control" name="value" required></lyra-combobox>`,
  },
  {
    name: 'select',
    tagName: 'lyra-select',
    render: () => html`<lyra-select id="control" name="value" required></lyra-select>`,
  },
  {
    name: 'model-select',
    tagName: 'lyra-model-select',
    render: () => html`<lyra-model-select id="control" name="value" required></lyra-model-select>`,
  },
  {
    name: 'tool-param-form',
    tagName: 'lyra-tool-param-form',
    render: () => html`<lyra-tool-param-form
      id="control"
      name="value"
      .schema=${{ type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }}
    ></lyra-tool-param-form>`,
  },
];

for (const testCase of cases) {
  it(`${testCase.name} exposes the native-like form/labels/validity surface`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form id="owner">
        <label id="caption" for="control">Value</label>
        ${testCase.render()}
      </form>
    `);
    const control = form.querySelector(testCase.tagName) as NativeLikeFormSurface;

    expect(control.form?.id).to.equal('owner');
    expect(control.labels.length).to.equal(1);
    expect((control.labels.item(0) as HTMLElement | null)?.id).to.equal('caption');
    expect(control.validity.valueMissing).to.be.true;
    expect(control.validationMessage.length).to.be.greaterThan(0);
    expect(control.willValidate).to.be.true;

    control.disabled = true;
    expect(control.willValidate).to.be.false;
  });
}

for (const tagName of ['lyra-checkbox', 'lyra-switch'] as const) {
  it(`${tagName} restores checked state independently of its submitted value`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        ${tagName === 'lyra-checkbox'
          ? html`<lyra-checkbox name="toggle" value="yes" required>Toggle</lyra-checkbox>`
          : html`<lyra-switch name="toggle" value="yes" required>Toggle</lyra-switch>`}
      </form>
    `);
    const control = form.querySelector(tagName) as HTMLElement & {
      checked: boolean;
      checkValidity(): boolean;
      formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
    };
    let changes = 0;
    control.addEventListener('lyra-change', () => changes++);

    control.formStateRestoreCallback('checked', 'restore');
    expect(control.checked).to.be.true;
    expect(new FormData(form).get('toggle')).to.equal('yes');
    expect(control.checkValidity()).to.be.true;

    control.formStateRestoreCallback('unchecked', 'restore');
    expect(control.checked).to.be.false;
    expect(new FormData(form).has('toggle')).to.be.false;
    expect(control.checkValidity()).to.be.false;
    expect(changes).to.equal(0);
  });
}

for (const tagName of ['lyra-select', 'lyra-model-select'] as const) {
  it(`${tagName} restores its string value and form entry without a user event`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        ${tagName === 'lyra-select'
          ? html`<lyra-select name="choice"></lyra-select>`
          : html`<lyra-model-select name="choice"></lyra-model-select>`}
      </form>
    `);
    const control = form.querySelector(tagName) as HTMLElement & {
      value: string;
      formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
    };
    let changes = 0;
    control.addEventListener('change', () => changes++);
    control.addEventListener('lyra-change', () => changes++);

    control.value = 'changed';
    control.formStateRestoreCallback('restored', 'restore');

    expect(control.value).to.equal('restored');
    expect(new FormData(form).get('choice')).to.equal('restored');
    expect(changes).to.equal(0);
  });
}

it('combobox restores single and multiple selections from name-independent JSON state', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lyra-combobox id="single" name="single"></lyra-combobox>
      <lyra-combobox id="multiple" name="multiple" multiple></lyra-combobox>
    </form>
  `);
  type RestorableCombobox = HTMLElement & {
    value: string | string[];
    formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  };
  const single = form.querySelector('#single') as RestorableCombobox;
  const multiple = form.querySelector('#multiple') as RestorableCombobox;
  let changes = 0;
  form.addEventListener('change', () => changes++);

  single.formStateRestoreCallback('["restored"]', 'restore');
  multiple.formStateRestoreCallback('["a","b"]', 'restore');

  expect(single.value).to.equal('restored');
  expect(multiple.value).to.deep.equal(['a', 'b']);
  const data = new FormData(form);
  expect(data.get('single')).to.equal('restored');
  expect(data.getAll('multiple')).to.deep.equal(['a', 'b']);
  expect(changes).to.equal(0);

  expect(() => multiple.formStateRestoreCallback('{"not":"an array"}', 'restore')).not.to.throw();
  expect(multiple.value).to.deep.equal([]);
  expect(new FormData(form).has('multiple')).to.be.false;
});

it('tool-param-form restores a safe object snapshot and rejects malformed state without throwing', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lyra-tool-param-form
        name="args"
        .schema=${{ type: 'object', properties: { title: { type: 'string' } } }}
      ></lyra-tool-param-form>
    </form>
  `);
  const control = form.querySelector('lyra-tool-param-form') as HTMLElement & {
    value: Record<string, unknown>;
    formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  };
  let inputs = 0;
  control.addEventListener('lyra-input', () => inputs++);

  control.formStateRestoreCallback('{"title":"Restored"}', 'restore');
  expect(control.value).to.deep.equal({ title: 'Restored' });
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({ title: 'Restored' });

  expect(() => control.formStateRestoreCallback('[]', 'restore')).not.to.throw();
  expect(control.value).to.deep.equal({});
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({});
  expect(inputs).to.equal(0);
});
