import { expect, fixture } from '@open-wc/testing';
import { html, type TemplateResult } from 'lit';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/switch/switch.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/select/select.js';
import '../components/conversation/model-select/model-select.js';
import '../components/agent-tools/tool-param-form/tool-param-form.js';

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
    tagName: 'lr-checkbox',
    render: () => html`<lr-checkbox id="control" name="value" required>Accept</lr-checkbox>`,
  },
  {
    name: 'switch',
    tagName: 'lr-switch',
    render: () => html`<lr-switch id="control" name="value" required>Enable</lr-switch>`,
  },
  {
    name: 'combobox',
    tagName: 'lr-combobox',
    render: () => html`<lr-combobox id="control" name="value" required></lr-combobox>`,
  },
  {
    name: 'select',
    tagName: 'lr-select',
    render: () => html`<lr-select id="control" name="value" required></lr-select>`,
  },
  {
    name: 'model-select',
    tagName: 'lr-model-select',
    render: () => html`<lr-model-select id="control" name="value" required></lr-model-select>`,
  },
  {
    name: 'tool-param-form',
    tagName: 'lr-tool-param-form',
    render: () => html`<lr-tool-param-form
      id="control"
      name="value"
      .schema=${{ type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }}
    ></lr-tool-param-form>`,
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
    // Reads the native ElementInternals.labels accessor -- confirmed safe with this fixture (wrapped
    // in a <form>, a real <label for>) across all cases above. A *different* fixture shape (no
    // wrapping <form>, no labels) hung headless Chromium indefinitely reading the very same accessor
    // on <lr-rubric-form>; see
    // docs/superpowers/feature_requests/2026-07-19-latent-bugs-found-during-coverage-push.md item 3
    // before assuming a change here is automatically safe.
    expect(control.labels.length).to.equal(1);
    expect((control.labels.item(0) as HTMLElement | null)?.id).to.equal('caption');
    expect(control.validity.valueMissing).to.be.true;
    expect(control.validationMessage.length).to.be.greaterThan(0);
    expect(control.willValidate).to.be.true;

    control.disabled = true;
    expect(control.willValidate).to.be.false;
  });
}

for (const tagName of ['lr-checkbox', 'lr-switch'] as const) {
  it(`${tagName} restores checked state independently of its submitted value`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        ${tagName === 'lr-checkbox'
          ? html`<lr-checkbox name="toggle" value="yes" required>Toggle</lr-checkbox>`
          : html`<lr-switch name="toggle" value="yes" required>Toggle</lr-switch>`}
      </form>
    `);
    const control = form.querySelector(tagName) as HTMLElement & {
      checked: boolean;
      checkValidity(): boolean;
      formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
    };
    let changes = 0;
    control.addEventListener('lr-change', () => changes++);

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

it('checkbox restores all checked/indeterminate combinations', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-checkbox name="toggle" value="yes">Toggle</lr-checkbox></form>
  `);
  const control = form.querySelector('lr-checkbox') as HTMLElement & {
    checked: boolean;
    indeterminate: boolean;
    formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  };

  control.formStateRestoreCallback('checked/indeterminate', 'restore');
  expect(control.checked).to.be.true;
  expect(control.indeterminate).to.be.true;
  expect(new FormData(form).get('toggle')).to.equal('yes');

  control.formStateRestoreCallback('unchecked/indeterminate', 'restore');
  expect(control.checked).to.be.false;
  expect(control.indeterminate).to.be.true;
  expect(new FormData(form).has('toggle')).to.be.false;

  control.formStateRestoreCallback('checked', 'restore');
  expect(control.checked).to.be.true;
  expect(control.indeterminate).to.be.false;
});

for (const tagName of ['lr-select', 'lr-model-select'] as const) {
  it(`${tagName} restores its string value and form entry without a user event`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        ${tagName === 'lr-select'
          ? html`<lr-select name="choice"></lr-select>`
          : html`<lr-model-select name="choice"></lr-model-select>`}
      </form>
    `);
    const control = form.querySelector(tagName) as HTMLElement & {
      value: string;
      formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
    };
    let changes = 0;
    control.addEventListener('change', () => changes++);
    control.addEventListener('lr-change', () => changes++);

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
      <lr-combobox id="single" name="single"></lr-combobox>
      <lr-combobox id="multiple" name="multiple" multiple></lr-combobox>
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

  for (const malformed of ['legacy scalar', 'null', '123']) {
    multiple.value = ['stale'];
    multiple.formStateRestoreCallback(malformed, 'restore');
    expect(multiple.value).to.deep.equal([]);
  }
});

for (const tagName of ['lr-select', 'lr-combobox'] as const) {
  it(`${tagName} does not let initial selected-option collection overwrite restored state`, async () => {
    const form = document.createElement('form');
    const control = document.createElement(tagName) as HTMLElement & {
      name: string;
      value: string | string[];
      updateComplete: Promise<unknown>;
      formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
    };
    control.name = 'choice';
    const option = document.createElement('lr-option') as HTMLElement & { value: string; selected: boolean };
    option.value = 'declared';
    option.selected = true;
    option.textContent = 'Declared default';
    control.append(option);
    form.append(control);
    document.body.append(form);

    control.formStateRestoreCallback(tagName === 'lr-select' ? 'restored' : '["restored"]', 'restore');
    await control.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await control.updateComplete;

    expect(control.value).to.deep.equal('restored');
    expect(new FormData(form).get('choice')).to.equal('restored');

    form.reset();
    expect(control.value).to.deep.equal('declared');
    form.remove();
  });
}

it('tool-param-form restores a safe object snapshot and rejects malformed state without throwing', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-tool-param-form
        name="args"
        .schema=${{ type: 'object', properties: { title: { type: 'string' } } }}
      ></lr-tool-param-form>
    </form>
  `);
  const control = form.querySelector('lr-tool-param-form') as HTMLElement & {
    value: Record<string, unknown>;
    formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  };
  let inputs = 0;
  control.addEventListener('lr-input', () => inputs++);

  control.formStateRestoreCallback('{"title":"Restored"}', 'restore');
  expect(control.value).to.deep.equal({ title: 'Restored' });
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({ title: 'Restored' });

  expect(() => control.formStateRestoreCallback('[]', 'restore')).not.to.throw();
  expect(control.value).to.deep.equal({});
  expect(JSON.parse(new FormData(form).get('args') as string)).to.deep.equal({});
  expect(inputs).to.equal(0);
});
