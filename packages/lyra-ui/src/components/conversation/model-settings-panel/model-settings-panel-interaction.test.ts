import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-model-settings-panel.js';

it('lets the enclosing layout theme its base surface', async () => {
  const el = await fixture(html`<lr-model-settings-panel
    style="--lr-model-settings-panel-radius: 9px; --lr-model-settings-panel-bg: rgb(1, 2, 3); --lr-model-settings-panel-border-color: rgb(3, 4, 5); --lr-model-settings-panel-padding: 7px"></lr-model-settings-panel>`);
  const style = getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!);
  expect(style.borderTopLeftRadius).to.equal('9px');
  expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(style.borderTopColor).to.equal('rgb(3, 4, 5)');
  expect(style.paddingInlineStart).to.equal('7px');
});

it('reports a domain clamp after rendering the corrected slider value', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-settings-panel']>(html`<lr-model-settings-panel temperature="1.5"></lr-model-settings-panel>`);
  const values: number[][] = [];
  el.addEventListener('lr-change', e => values.push([(e as CustomEvent<{ temperature: number }>).detail.temperature,
    el.shadowRoot!.querySelector('lr-slider')!.valueAsNumber]));
  el.temperatureMax = 1;
  await el.updateComplete;
  await Promise.resolve();
  expect(values).to.deep.equal([[1, 1]]);
});

it('restores its default for blank temperature-max and honors explicit numbers', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-settings-panel']>(html`<lr-model-settings-panel temperature-max=" "></lr-model-settings-panel>`);
  expect(el.temperatureMax).to.equal(2);
  el.setAttribute('temperature-max', '3');
  await el.updateComplete;
  expect(el.temperatureMax).to.equal(3);
  el.removeAttribute('temperature-max');
  await el.updateComplete;
  expect(el.temperatureMax).to.equal(2);
});

it('forwards size and readonly to the model and temperature controls', async () => {
  const panel = await fixture<HTMLElementTagNameMap['lr-model-settings-panel']>(html`<lr-model-settings-panel></lr-model-settings-panel>`);
  const model = panel.shadowRoot!.querySelector('lr-model-select')!;
  const slider = panel.shadowRoot!.querySelector('lr-slider')!;
  expect([model.readonly, model.size, slider.readonly, slider.size]).to.deep.equal([false, 'm', false, 'm']);
  panel.setAttribute('size', 's');
  panel.setAttribute('readonly', '');
  await panel.updateComplete;
  expect([model.readonly, model.size, slider.readonly, slider.size]).to.deep.equal([true, 's', true, 's']);
  const initial = panel.temperature;
  for (const [target, type] of [[model, 'lr-change'], [slider, 'lr-input'], [slider, 'lr-change']] as const) {
    target.dispatchEvent(new CustomEvent(type, { detail: { value: target === slider ? 0 : 'new' }, bubbles: true, composed: true }));
  }
  expect(panel.temperature).to.equal(initial);
  expect(panel.model).to.equal('');
});

it('keeps the internal model picker request and popup lifecycle inside the panel', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-settings-panel']>(html`<lr-model-settings-panel
    .catalog=${['m']}></lr-model-settings-panel>`);
  const picker = el.shadowRoot!.querySelector('lr-model-select')!;
  const names = ['lr-change-request', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide'];
  const leaked: string[] = [];
  for (const name of names) el.addEventListener(name, () => leaked.push(name));
  for (const name of names) picker.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  expect(leaked).to.deep.equal([]);
});

it('rolls the model picker back when an lr-change listener reassigns the held model', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-settings-panel']>(html`<lr-model-settings-panel model="a" .catalog=${['a', 'b']}
    @lr-change=${(event: Event) => { (event.currentTarget as HTMLElementTagNameMap['lr-model-settings-panel']).model = 'a'; }}></lr-model-settings-panel>`);
  const picker = el.shadowRoot!.querySelector('lr-model-select')!;
  picker.value = 'b';
  picker.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'b', inCatalog: true } }));
  await el.updateComplete;
  expect([el.model, picker.value]).to.deep.equal(['a', 'a']);
});
