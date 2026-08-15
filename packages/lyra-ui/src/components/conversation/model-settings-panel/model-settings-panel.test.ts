import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './model-settings-panel.js';
import type { LyraModelSettingsPanel, ModelSettingsChangeDetail } from './model-settings-panel.js';
import type { LyraModelSelect } from '../model-select/model-select.js';
import type { LyraSlider } from '../../forms/slider/slider.js';

const CATALOG = ['llama3.1', 'mistral', 'qwen2.5-coder'];

function modelSelect(el: LyraModelSettingsPanel): LyraModelSelect {
  return el.shadowRoot!.querySelector('lr-model-select') as LyraModelSelect;
}
function slider(el: LyraModelSettingsPanel): LyraSlider {
  return el.shadowRoot!.querySelector('lr-slider') as LyraSlider;
}

// -- Prop forwarding ---------------------------------------------------------

it('forwards provider/catalog/model/allow-custom to the internal lr-model-select', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      provider="ollama"
      model="mistral"
      allow-custom
      .catalog=${CATALOG}
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const select = modelSelect(el);
  expect(select.provider).to.equal('ollama');
  expect(select.value).to.equal('mistral');
  expect(select.allowCustom).to.be.true;
  expect(select.catalog).to.deep.equal(CATALOG);
  expect(el.model).to.equal('mistral');
  expect(el.hasAttribute('model-value')).to.be.false;
});

it('forwards temperature and its min/max/step to the internal lr-slider', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      temperature="0.4"
      temperature-min="0"
      temperature-max="1"
      temperature-step="0.05"
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const s = slider(el);
  expect(s.valueAsNumber).to.equal(0.4);
  expect(s.min).to.equal(0);
  expect(s.max).to.equal(1);
  expect(s.step).to.equal(0.05);
});

it('defaults temperature to 1 (the midpoint of the default [0, 2] range) and range to [0, 2] step 0.1', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.temperature).to.equal(1);
  expect(el.temperatureMin).to.equal(0);
  expect(el.temperatureMax).to.equal(2);
  expect(el.temperatureStep).to.equal(0.1);
  expect(slider(el).valueAsNumber).to.equal(1);
});

it('suppresses the internal slider’s own value readout in favor of the panel’s temperature-value part', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(slider(el).showValue).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('1');
});

it('formats the visible temperature readout through its effective locale', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel locale="de-DE" .temperature=${0.7}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  const expected = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 20 }).format(0.7);

  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal(expected);
});

it('hides the panel’s own temperature-value readout from the accessibility tree, mirroring the slider’s suppressed value span', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('forwards disabled to both the internal lr-model-select and lr-slider', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel disabled .catalog=${CATALOG}></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  expect(el.disabled).to.be.true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(modelSelect(el).disabled).to.be.true;
  expect(slider(el).disabled).to.be.true;
});

it('defaults disabled to false on the panel and both internal controls', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;

  expect(el.disabled).to.be.false;
  expect(modelSelect(el).disabled).to.be.false;
  expect(slider(el).disabled).to.be.false;
});

// -- Layout -------------------------------------------------------------

it('defaults to and reflects the vertical layout', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.layout).to.equal('vertical');
  expect(el.getAttribute('layout')).to.equal('vertical');
});

it('reflects an explicit compact layout', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel layout="compact"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;
  expect(el.layout).to.equal('compact');
  expect(el.getAttribute('layout')).to.equal('compact');
});

it('wraps the compact layout rows onto separate lines rather than overflowing a 320px sidebar', async () => {
  // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
  // `document.body` itself and the global afterEach fixtureCleanup removes it, so this
  // test must not append/remove it manually.
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-model-settings-panel layout="compact" .catalog=${CATALOG} model="mistral"></lr-model-settings-panel>`,
    { parentNode: container },
  )) as LyraModelSettingsPanel;
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).flexWrap).to.equal('wrap');

  // The row parts' combined min-inline-size (2 * 10rem + gap) exceeds 320px, so they can
  // only both fit without clipping if they actually wrap onto separate lines rather than
  // staying side by side on one row.
  const modelRow = el.shadowRoot!.querySelector('[part="model-row"]') as HTMLElement;
  const temperatureRow = el.shadowRoot!.querySelector('[part="temperature-row"]') as HTMLElement;
  expect(temperatureRow.getBoundingClientRect().top, 'rows must stack, not sit side by side').to.be.greaterThan(
    modelRow.getBoundingClientRect().top,
  );
  const containerRight = container.getBoundingClientRect().right;
  expect(modelRow.getBoundingClientRect().right).to.be.at.most(containerRight + 1);
  expect(temperatureRow.getBoundingClientRect().right).to.be.at.most(containerRight + 1);
});

// -- Live temperature mirroring ------------------------------------------

it('mirrors a live lr-input from the slider into temperature and the rendered readout, without emitting lr-change', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel temperature="0.5"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  let changeFired = false;
  el.addEventListener('lr-change', () => {
    changeFired = true;
  });

  slider(el).dispatchEvent(new CustomEvent('lr-input', { detail: { value: 0.8 }, bubbles: true }));
  await el.updateComplete;

  expect(el.temperature).to.equal(0.8);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('0.8');
  expect(changeFired).to.be.false;
});

it('contains the internal slider lr-input while mirroring its live value', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel temperature="0.5"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;
  let leakedInputs = 0;
  el.addEventListener('lr-input', () => leakedInputs++);

  slider(el).dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 0.8 },
      bubbles: true,
      composed: true,
    }),
  );
  await el.updateComplete;

  expect(el.temperature).to.equal(0.8);
  expect(leakedInputs).to.equal(0);
});

it('re-clamps temperature (matching the slider’s own clamp math) when temperatureMax drops below the current temperature', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel temperature="1.5"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  el.temperatureMax = 1;
  await el.updateComplete;

  expect(el.temperature).to.equal(1);
  expect(el.temperature).to.equal(slider(el).valueAsNumber);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('1');
});

it('re-clamps temperature to a narrowed step grid when temperatureStep changes', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel temperature="0.35" temperature-step="0.1"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  el.temperatureStep = 0.25;
  await el.updateComplete;

  expect(el.temperature).to.equal(slider(el).valueAsNumber);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal(String(el.temperature));
});

it('normalizes direct out-of-range and non-finite temperature assignments to the rendered slider value', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel temperature-min="0" temperature-max="2"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  el.temperature = 5;
  await el.updateComplete;
  expect(el.temperature).to.equal(2);
  expect(slider(el).valueAsNumber).to.equal(2);

  el.temperature = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  expect(el.temperature).to.equal(0);
  expect(slider(el).valueAsNumber).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('0');
});

it('does not derive NaN from a finite subnormal temperature step', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      .temperature=${1}
      .temperatureMin=${0}
      .temperatureMax=${2}
      .temperatureStep=${Number.MIN_VALUE}
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  expect(Number.isFinite(el.temperature)).to.be.true;
  expect(el.temperature).to.equal(1);
  expect(Number.isFinite(slider(el).valueAsNumber)).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('1');
});

it('derives one finite domain for the panel and slider and clamps child events before emission', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      .temperature=${1}
      .temperatureMin=${Number.POSITIVE_INFINITY}
      .temperatureMax=${Number.NaN}
      .temperatureStep=${Number.POSITIVE_INFINITY}
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  const child = slider(el);
  expect(child.min).to.equal(0);
  expect(child.max).to.equal(2);
  expect(child.step).to.equal(0);

  const changed = oneEvent(el, 'lr-change');
  child.dispatchEvent(new CustomEvent('lr-change', {
    bubbles: true,
    composed: true,
    detail: { value: Number.POSITIVE_INFINITY },
  }));
  const event = await changed as CustomEvent<ModelSettingsChangeDetail>;
  expect(event.detail.temperature).to.equal(0);
  expect(el.temperature).to.equal(0);
  await el.updateComplete;
  await child.updateComplete;
  expect(child.valueAsNumber).to.equal(0);
});

it('bounds huge finite visible values while retaining the exact accessible value', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      style="inline-size: 319px"
      .temperature=${1e308}
      .temperatureMin=${0}
      .temperatureMax=${1e308}
      .temperatureStep=${0}
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  const readout = el.shadowRoot!.querySelector('[part="temperature-value"]') as HTMLElement;
  const child = slider(el);
  await child.updateComplete;
  const thumb = child.shadowRoot!.querySelector('[part~="thumb"]')!;

  expect(readout.textContent!.length).to.be.lessThan(24);
  expect(readout.textContent).to.match(/E|e/);
  expect(thumb.getAttribute('aria-valuenow')).to.equal(String(1e308));
  expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
});

it('contains a long localized temperature label in a 320px allocation', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-model-settings-panel
      style="inline-size:100%"
      .strings=${{
        temperature: 'AnExtremelyLongLocalizedTemperatureLabelWithoutNaturalBreaks',
        selectModel: 'AnExtremelyLongLocalizedModelPlaceholderWithoutNaturalBreaks',
      }}
    ></lr-model-settings-panel>`,
    { parentNode: container },
  )) as LyraModelSettingsPanel;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
});

// -- Consolidated lr-change -------------------------------------------

it('re-emits a consolidated lr-change with the full settings shape when the model changes', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel temperature="0.6" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  const select = modelSelect(el);
  select.value = 'mistral';
  select.dispatchEvent(new CustomEvent('lr-change', { detail: { value: 'mistral', inCatalog: true }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  expect(detail).to.deep.equal({ model: 'mistral', inCatalog: true, temperature: 0.6 });
  expect(el.model).to.equal('mistral');
});

it('re-emits a consolidated lr-change with the full settings shape when the temperature changes', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel model="mistral" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  const s = slider(el);
  s.dispatchEvent(new CustomEvent('lr-change', { detail: { value: 1.3 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  expect(detail).to.deep.equal({ model: 'mistral', inCatalog: true, temperature: 1.3 });
  expect(el.temperature).to.equal(1.3);
});

it('emits one consolidated lr-change for one bubbling model-select lr-change', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel model="llama3.1" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  let count = 0;
  el.addEventListener('lr-change', () => count++);

  modelSelect(el).dispatchEvent(
    new CustomEvent('lr-change', {
      detail: { value: 'mistral', inCatalog: true },
      bubbles: true,
      composed: true,
    }),
  );
  await el.updateComplete;

  expect(count).to.equal(1);
});

it('emits one consolidated lr-change for one bubbling slider lr-change', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel model="mistral" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  let count = 0;
  el.addEventListener('lr-change', () => count++);

  slider(el).dispatchEvent(
    new CustomEvent('lr-change', {
      detail: { value: 1.3 },
      bubbles: true,
      composed: true,
    }),
  );
  await el.updateComplete;

  expect(count).to.equal(1);
});

it('computes inCatalog fresh from the current catalog/model rather than trusting a stale child event', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel model="ancient-model" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  const s = slider(el);
  s.dispatchEvent(new CustomEvent('lr-change', { detail: { value: 0.2 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  // model was never in CATALOG, so inCatalog must be false even though
  // the event that triggered this was the temperature slider's, not the
  // model-select's own lr-change.
  expect(detail.inCatalog).to.be.false;
});

it('reports inCatalog false when catalog is empty/unset', async () => {
  const el = (await fixture(
    html`<lr-model-settings-panel model="anything"></lr-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  slider(el).dispatchEvent(new CustomEvent('lr-change', { detail: { value: 0.5 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;
  expect(detail.inCatalog).to.be.false;
});

it('reports inCatalog from the normalized nonempty catalog projection', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel model="" .catalog=${['', '   ']}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  slider(el).dispatchEvent(new CustomEvent('lr-change', { detail: { value: 0.5 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;
  expect(detail.inCatalog).to.be.false;
});

it('recognizes an object-shaped catalog entry (id/label) for inCatalog', async () => {
  const objectCatalog = [
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'o3', label: 'o3' },
  ];
  const el = (await fixture(html`
    <lr-model-settings-panel model="gpt-4.1" .catalog=${objectCatalog}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lr-change');
  slider(el).dispatchEvent(new CustomEvent('lr-change', { detail: { value: 0.5 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;
  expect(detail.inCatalog).to.be.true;
});

// -- String localization ---------------------------------------------------

it('renders localized visible model/temperature labels and keeps the model prompt as a placeholder', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  const select = modelSelect(el);
  await select.updateComplete;
  expect(select.label).to.equal('Model');
  expect(select.shadowRoot!.querySelector('[part="form-control-label"]')?.textContent?.trim()).to.equal('Model');
  expect(el.shadowRoot!.querySelector('[part="temperature-label"]')!.textContent).to.equal('Temperature');
  const temperatureSlider = slider(el);
  await temperatureSlider.updateComplete;
  expect(temperatureSlider.label).to.equal('');
  expect(temperatureSlider.shadowRoot!.querySelector('[part~="thumb"]')!.getAttribute('aria-label')).to.equal(
    'Temperature',
  );
  expect(modelSelect(el).placeholder).to.equal('Select a model…');
});

it('honors a strings override for model/temperature/selectModel', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel .strings=${{
      model: 'Modèle',
      temperature: 'Température',
      selectModel: 'Choisir un modèle…',
    }}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  expect(modelSelect(el).label).to.equal('Modèle');
  expect(el.shadowRoot!.querySelector('[part="temperature-label"]')!.textContent).to.equal('Température');
  const temperatureSlider = slider(el);
  await temperatureSlider.updateComplete;
  expect(temperatureSlider.label).to.equal('');
  expect(temperatureSlider.shadowRoot!.querySelector('[part~="thumb"]')!.getAttribute('aria-label')).to.equal(
    'Température',
  );
  expect(modelSelect(el).placeholder).to.equal('Choisir un modèle…');
});

it('contains auxiliary native input/change events from both composed controls', async () => {
  const wrapper = await fixture(html`<div>
    <lr-model-settings-panel .catalog=${CATALOG}></lr-model-settings-panel>
  </div>`);
  const el = wrapper.querySelector('lr-model-settings-panel') as LyraModelSettingsPanel;
  let inputs = 0;
  let changes = 0;
  wrapper.addEventListener('input', () => inputs++);
  wrapper.addEventListener('change', () => changes++);

  modelSelect(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  modelSelect(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  slider(el).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  slider(el).dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);
});

it('blocks genuine child changes when capture disables the panel in the same dispatch', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  let changes = 0;
  el.addEventListener('lr-change', () => changes++);
  el.addEventListener('lr-input', () => {
    el.disabled = true;
  }, { capture: true, once: true });

  slider(el).dispatchEvent(new CustomEvent('lr-input', {
    bubbles: true,
    composed: true,
    detail: { value: 1.7 },
  }));

  expect(el.disabled).to.be.true;
  expect(el.temperature).to.equal(1);
  expect(changes).to.equal(0);
});

// -- Accessibility -------------------------------------------------------

it('is accessible with default/empty settings', async () => {
  const el = (await fixture(html`<lr-model-settings-panel></lr-model-settings-panel>`)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated catalog and non-default temperature', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel
      provider="ollama"
      model="mistral"
      .catalog=${CATALOG}
      temperature="1.5"
    ></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});

it('is accessible in compact layout', async () => {
  const el = (await fixture(html`
    <lr-model-settings-panel layout="compact" .catalog=${CATALOG}></lr-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});
