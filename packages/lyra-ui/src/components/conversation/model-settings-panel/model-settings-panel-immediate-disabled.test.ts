import { expect, fixture, html } from '@open-wc/testing';
import type { LyraModelSettingsPanel } from './model-settings-panel.class.js';
import './model-settings-panel.js';

for (const [control, detail, result] of [
  ['lr-model-select', { value: 'second', inCatalog: true }, { model: 'second', temperature: 1, inCatalog: true }],
  ['lr-slider', { value: 0.5 }, { model: 'first', temperature: 0.5, inCatalog: true }],
] as const) {
  it(`ignores the ${control} commit when disabled during capture and accepts the next enabled commit`, async () => {
    const host = await fixture<LyraModelSettingsPanel>(html`<lr-model-settings-panel model="first" .catalog=${['first', 'second']}></lr-model-settings-panel>`);
    const child = host.shadowRoot!.querySelector(control)!;
    const requests: unknown[] = [];
    host.addEventListener('lr-change', event => requests.push((event as CustomEvent).detail));
    host.addEventListener('lr-change', () => { host.disabled = true; }, { capture: true, once: true });
    const commit = (): void => { child.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail })); };
    commit();
    expect(requests).to.deep.equal([]);
    expect(host.model).to.equal('first');
    expect(host.temperature).to.equal(1);
    await host.updateComplete;
    host.disabled = false;
    await host.updateComplete;
    commit();
    expect(requests).to.deep.equal([result]);
    expect(host.model).to.equal(result.model);
    expect(host.temperature).to.equal(result.temperature);
  });
}
