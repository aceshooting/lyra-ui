import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './page.js';
import '../responsive-panel/responsive-panel.js';

for (const name of ['lr-page', 'lr-responsive-panel'] as const) {
  it(`${name} measures its initial allocation once and reconnects with the current width`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const element = document.createElement(name);
    element.style.inlineSize = '320px';
    const read = element.getBoundingClientRect.bind(element);
    let reads = 0;
    element.getBoundingClientRect = () => {
      reads += 1;
      return read();
    };
    wrapper.append(element);
    await element.updateComplete;
    await element.updateComplete;
    const presentation = (): string => name === 'lr-page'
      ? Reflect.get(element, 'view') as string : Reflect.get(element, 'effectiveMode') as string;
    expect(presentation()).to.equal(name === 'lr-page' ? 'mobile' : 'overlay');
    expect(reads, 'initial connection and rendering share one allocation measurement').to.equal(1);
    await nextFrame();
    await nextFrame();
    expect(reads, 'observer delivery consumes the entry without a layout read').to.equal(1);
    element.remove();
    element.style.inlineSize = '1000px';
    wrapper.append(element);
    await element.updateComplete;
    expect(presentation()).to.equal(name === 'lr-page' ? 'desktop' : 'inline');
    expect(reads, 'reconnect synchronously reconciles the new allocation').to.equal(2);
  });
}

for (const mode of ['inline', 'overlay'] as const) {
  it(`does not measure a forced ${mode} panel until auto presentation is requested`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const panel = document.createElement('lr-responsive-panel');
    panel.mode = mode;
    panel.style.inlineSize = '320px';
    const read = panel.getBoundingClientRect.bind(panel);
    let reads = 0;
    panel.getBoundingClientRect = () => {
      reads += 1;
      return read();
    };
    wrapper.append(panel);
    await panel.updateComplete;
    expect(panel.effectiveMode).to.equal(mode);
    expect(reads, 'forced presentation does not depend on layout').to.equal(0);
    panel.mode = 'auto';
    await panel.updateComplete;
    expect(panel.effectiveMode).to.equal('overlay');
    expect(reads, 'auto resolves the current allocation before rendering').to.equal(1);
  });
}

it('retries a zero-width page allocation after its shrink-to-fit content renders', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="display:grid;place-items:center;inline-size:1400px"></div>`);
  const page = document.createElement('lr-page');
  const content = document.createElement('div');
  content.style.inlineSize = '1000px';
  content.textContent = 'Wide content';
  page.append(content);
  const read = page.getBoundingClientRect.bind(page);
  const widths: number[] = [];
  page.getBoundingClientRect = () => {
    const rect = read();
    widths.push(rect.width);
    return rect;
  };
  wrapper.append(page);
  await page.updateComplete;
  await page.updateComplete;
  expect(widths[0], 'unrendered slots do not supply an intrinsic width').to.equal(0);
  expect(widths.at(-1), 'rendered content supplies the authoritative allocation').to.be.at.least(1000);
  expect(page.view).to.equal('desktop');
});

for (const name of ['lr-page', 'lr-responsive-panel'] as const) {
  it(`${name} measures once in its new owner when adopted while connected`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><iframe style="inline-size:1400px"></iframe></div>`);
    const frameDocument = wrapper.querySelector('iframe')!.contentDocument!;
    const element = document.createElement(name);
    element.style.inlineSize = '320px';
    const read = element.getBoundingClientRect.bind(element);
    let reads = 0;
    element.getBoundingClientRect = () => {
      reads += 1;
      return read();
    };
    try {
      wrapper.append(element);
      await element.updateComplete;
      await element.updateComplete;
      reads = 0;
      element.style.inlineSize = '1000px';
      frameDocument.body.append(element);
      await element.updateComplete;
      const presentation = name === 'lr-page' ? Reflect.get(element, 'view') : Reflect.get(element, 'effectiveMode');
      expect(presentation).to.equal(name === 'lr-page' ? 'desktop' : 'inline');
      expect(reads, 'adoption and connection share one new-owner measurement').to.equal(1);
    } finally {
      element.remove();
    }
  });
}
