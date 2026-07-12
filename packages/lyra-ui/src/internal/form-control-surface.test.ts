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
