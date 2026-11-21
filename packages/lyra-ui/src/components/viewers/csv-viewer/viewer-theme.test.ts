import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-email-viewer.js';
import '../../lr-model-viewer.js';
import '../../lr-svg-viewer.js';
import '../../lr-xml-viewer.js';
import '../../lr-csv-viewer.js';
import '../../lr-dataset-viewer.js';
import '../../lr-spreadsheet-viewer.js';

const regions = [0, 1].map(x => ({ id: String(x), anchor: { kind: 'region', rect: { x, y: 0, width: 1, height: 1 } } }));
const actions: readonly [string, TemplateResult, string, string][] = [
  ['xml', html`<lr-xml-viewer .xml=${'<root><row/></root>'}></lr-xml-viewer>`, '[part="toggle"]', ''],
  ['email', html`<lr-email-viewer fold-quotes></lr-email-viewer>`, '[part="quote-toggle"]', 'Subject: Test\r\n\r\nReply\r\n> one\r\n> two\r\n> three'],
  ['svg', html`<lr-svg-viewer src="/image.svg" .highlights=${regions}></lr-svg-viewer>`, '[part="region-highlight-action"]', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
  ['model', html`<lr-model-viewer src="/shape.unknown"></lr-model-viewer>`, 'button:not(:disabled)', ''],
];

for (const [name, content, selector, response] of actions) {
  it(`paints the ${name} action from its resting, hover and pressed colors`, async () => {
    const previous = window.fetch;
    window.fetch = () => Promise.resolve(new Response(response));
    try {
      const el = await fixture<HTMLElement>(content);
      if (name === 'email') {
        const loaded = oneEvent(el, 'lr-load');
        el.setAttribute('src', '/message.eml');
        await loaded;
      }
      await waitUntil(() => !!el.shadowRoot!.querySelector(selector));
      const button = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
      el.style.setProperty('--lr-transition-fast', '0s');
      el.style.setProperty('--lr-transition-interactive', 'none');
      for (const [state, color] of [['bg', 'red'], ['hover-bg', 'blue'], ['active-bg', 'green']] as const) {
        el.style.setProperty(`--lr-${name}-viewer-action-${state}`, color);
      }
      await resetMouse();
      const color = () => getComputedStyle(button).backgroundColor;
      await waitUntil(() => color() === 'rgb(255, 0, 0)', 'resting color');
      await hoverUntilMatched(button, 'the action is hovered');
      await waitUntil(() => color() === 'rgb(0, 0, 255)', 'hover color');
      await sendMouse({ type: 'down', button: 'left' });
      await waitUntil(() => color() === 'rgb(0, 128, 0)', 'pressed color');
    } finally { await resetMouse(); window.fetch = previous; }
  });
}

for (const [name, content] of [
  ['csv', html`<lr-csv-viewer .rows=${[['Name'], ['Ada']]}></lr-csv-viewer>`],
  ['dataset', html`<lr-dataset-viewer .table=${{ fields: ['Name'], rows: [{ Name: 'Ada' }] }}></lr-dataset-viewer>`],
  ['spreadsheet', html`<lr-spreadsheet-viewer .workbook=${{ sheets: [{ name: 'People', rows: [['Name'], ['Ada']] }] }}></lr-spreadsheet-viewer>`],
] as const) {
  it(`themes the ${name} frame and header independently`, async () => {
    const el = await fixture<HTMLElement>(content);
    const prefix = `--lr-${name}-viewer-`;
    el.style.setProperty(prefix + 'bg', 'red');
    el.style.setProperty(prefix + 'border', '2px solid green');
    el.style.setProperty(prefix + 'border-radius', '11px');
    el.style.setProperty(prefix + 'header-row-bg', 'blue');
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="header-row"]'));
    const base = getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);
    expect(base.backgroundColor).to.equal('rgb(255, 0, 0)');
    expect(base.borderTopWidth).to.equal('2px');
    expect(base.borderTopColor).to.equal('rgb(0, 128, 0)');
    expect(base.borderTopLeftRadius).to.equal('11px');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="header-row"]')!).backgroundColor).to.equal('rgb(0, 0, 255)');
  });
}
