import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './model-settings-panel.js';
import type { LyraModelSettingsPanel, ModelSettingsChangeDetail } from './model-settings-panel.js';
import type { LyraModelSelect } from '../model-select/model-select.js';
import type { LyraSlider } from '../slider/slider.js';

const CATALOG = ['llama3.1', 'mistral', 'qwen2.5-coder'];

function modelSelect(el: LyraModelSettingsPanel): LyraModelSelect {
  return el.shadowRoot!.querySelector('lyra-model-select') as LyraModelSelect;
}
function slider(el: LyraModelSettingsPanel): LyraSlider {
  return el.shadowRoot!.querySelector('lyra-slider') as LyraSlider;
}

// -- Prop forwarding ---------------------------------------------------------

it('forwards provider/catalog/model-value/allow-custom to the internal lyra-model-select', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel
      provider="ollama"
      model-value="mistral"
      allow-custom
      .catalog=${CATALOG}
    ></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const select = modelSelect(el);
  expect(select.provider).to.equal('ollama');
  expect(select.value).to.equal('mistral');
  expect(select.allowCustom).to.be.true;
  expect(select.catalog).to.deep.equal(CATALOG);
});

it('forwards temperature and its min/max/step to the internal lyra-slider', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel
      temperature="0.4"
      temperature-min="0"
      temperature-max="1"
      temperature-step="0.05"
    ></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const s = slider(el);
  expect(s.valueAsNumber).to.equal(0.4);
  expect(s.min).to.equal(0);
  expect(s.max).to.equal(1);
  expect(s.step).to.equal(0.05);
});

it('defaults temperature to 1 (the midpoint of the default [0, 2] range) and range to [0, 2] step 0.1', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.temperature).to.equal(1);
  expect(el.temperatureMin).to.equal(0);
  expect(el.temperatureMax).to.equal(2);
  expect(el.temperatureStep).to.equal(0.1);
  expect(slider(el).valueAsNumber).to.equal(1);
});

it('suppresses the internal slider’s own value readout in favor of the panel’s temperature-value part', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(slider(el).showValue).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('1');
});

it('hides the panel’s own temperature-value readout from the accessibility tree, mirroring the slider’s suppressed value span', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.getAttribute('aria-hidden')).to.equal('true');
});

it('forwards disabled to both the internal lyra-model-select and lyra-slider', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel disabled .catalog=${CATALOG}></lyra-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  expect(el.disabled).to.be.true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(modelSelect(el).disabled).to.be.true;
  expect(slider(el).disabled).to.be.true;
});

it('defaults disabled to false on the panel and both internal controls', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;

  expect(el.disabled).to.be.false;
  expect(modelSelect(el).disabled).to.be.false;
  expect(slider(el).disabled).to.be.false;
});

// -- Layout -------------------------------------------------------------

it('defaults to and reflects the vertical layout', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.layout).to.equal('vertical');
  expect(el.getAttribute('layout')).to.equal('vertical');
});

it('reflects an explicit compact layout', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel layout="compact"></lyra-model-settings-panel>`,
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
    html`<lyra-model-settings-panel layout="compact" .catalog=${CATALOG} model-value="mistral"></lyra-model-settings-panel>`,
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

it('mirrors a live lyra-input from the slider into temperature and the rendered readout, without emitting lyra-change', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel temperature="0.5"></lyra-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  let changeFired = false;
  el.addEventListener('lyra-change', () => {
    changeFired = true;
  });

  slider(el).dispatchEvent(new CustomEvent('lyra-input', { detail: { value: 0.8 }, bubbles: true }));
  await el.updateComplete;

  expect(el.temperature).to.equal(0.8);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('0.8');
  expect(changeFired).to.be.false;
});

it('re-clamps temperature (matching the slider’s own clamp math) when temperatureMax drops below the current temperature', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel temperature="1.5"></lyra-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  el.temperatureMax = 1;
  await el.updateComplete;

  expect(el.temperature).to.equal(1);
  expect(el.temperature).to.equal(slider(el).valueAsNumber);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal('1');
});

it('re-clamps temperature to a narrowed step grid when temperatureStep changes', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel temperature="0.35" temperature-step="0.1"></lyra-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  el.temperatureStep = 0.25;
  await el.updateComplete;

  expect(el.temperature).to.equal(slider(el).valueAsNumber);
  expect(el.shadowRoot!.querySelector('[part="temperature-value"]')!.textContent).to.equal(String(el.temperature));
});

// -- Consolidated lyra-change -------------------------------------------

it('re-emits a consolidated lyra-change with the full settings shape when the model changes', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel temperature="0.6" .catalog=${CATALOG}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lyra-change');
  const select = modelSelect(el);
  select.value = 'mistral';
  select.dispatchEvent(new CustomEvent('lyra-change', { detail: { value: 'mistral', inCatalog: true }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  expect(detail).to.deep.equal({ modelValue: 'mistral', inCatalog: true, temperature: 0.6 });
  expect(el.modelValue).to.equal('mistral');
});

it('re-emits a consolidated lyra-change with the full settings shape when the temperature changes', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel model-value="mistral" .catalog=${CATALOG}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lyra-change');
  const s = slider(el);
  s.dispatchEvent(new CustomEvent('lyra-change', { detail: { value: 1.3 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  expect(detail).to.deep.equal({ modelValue: 'mistral', inCatalog: true, temperature: 1.3 });
  expect(el.temperature).to.equal(1.3);
});

it('computes inCatalog fresh from the current catalog/modelValue rather than trusting a stale child event', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel model-value="ancient-model" .catalog=${CATALOG}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lyra-change');
  const s = slider(el);
  s.dispatchEvent(new CustomEvent('lyra-change', { detail: { value: 0.2 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;

  // modelValue was never in CATALOG, so inCatalog must be false even though
  // the event that triggered this was the temperature slider's, not the
  // model-select's own lyra-change.
  expect(detail.inCatalog).to.be.false;
});

it('reports inCatalog false when catalog is empty/unset', async () => {
  const el = (await fixture(
    html`<lyra-model-settings-panel model-value="anything"></lyra-model-settings-panel>`,
  )) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lyra-change');
  slider(el).dispatchEvent(new CustomEvent('lyra-change', { detail: { value: 0.5 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;
  expect(detail.inCatalog).to.be.false;
});

it('recognizes an object-shaped catalog entry (id/label) for inCatalog', async () => {
  const objectCatalog = [
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'o3', label: 'o3' },
  ];
  const el = (await fixture(html`
    <lyra-model-settings-panel model-value="gpt-4.1" .catalog=${objectCatalog}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;

  const listener = oneEvent(el, 'lyra-change');
  slider(el).dispatchEvent(new CustomEvent('lyra-change', { detail: { value: 0.5 }, bubbles: true }));
  const { detail } = (await listener) as CustomEvent<ModelSettingsChangeDetail>;
  expect(detail.inCatalog).to.be.true;
});

// -- String localization ---------------------------------------------------

it('defaults the temperature caption/slider label and model-select placeholder to English', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  expect(el.shadowRoot!.querySelector('[part="temperature-label"]')!.textContent).to.equal('Temperature');
  expect(slider(el).label).to.equal('Temperature');
  expect(modelSelect(el).placeholder).to.equal('Select a model…');
});

it('honors a strings override for temperature/selectModel', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel .strings=${{ temperature: 'Température', selectModel: 'Choisir un modèle…' }}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  expect(el.shadowRoot!.querySelector('[part="temperature-label"]')!.textContent).to.equal('Température');
  expect(slider(el).label).to.equal('Température');
  expect(modelSelect(el).placeholder).to.equal('Choisir un modèle…');
});

// -- Accessibility -------------------------------------------------------

it('is accessible with default/empty settings', async () => {
  const el = (await fixture(html`<lyra-model-settings-panel></lyra-model-settings-panel>`)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated catalog and non-default temperature', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel
      provider="ollama"
      model-value="mistral"
      .catalog=${CATALOG}
      temperature="1.5"
    ></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});

it('is accessible in compact layout', async () => {
  const el = (await fixture(html`
    <lyra-model-settings-panel layout="compact" .catalog=${CATALOG}></lyra-model-settings-panel>
  `)) as LyraModelSettingsPanel;
  await expect(el).to.be.accessible();
});
