import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraTooltip } from './tooltip.class.js';
import './tooltip.js';

interface ContentInspection {
  actionable: boolean;
  text: string;
}

function inspect(tooltip: LyraTooltip): ContentInspection {
  return (tooltip as unknown as { inspectContent(): ContentInspection }).inspectContent();
}

it('reads each content/ancestor visibility once per inspection and refreshes it on the next inspection', async () => {
  const ancestor = await fixture<HTMLDivElement>(html`
    <div style="display: contents">
      <lr-tooltip manual>
        <button slot="trigger">Help</button>
        <span style="display: contents"><button>Content action</button></span>
      </lr-tooltip>
    </div>
  `);
  const tooltip = ancestor.querySelector('lr-tooltip')!;
  await tooltip.updateComplete;
  const content = tooltip.querySelector('span:not([slot])')!;
  const action = content.querySelector('button')!;
  const reads = new Map<Element, number>();
  const original = window.getComputedStyle;
  window.getComputedStyle = function (element, pseudo) {
    reads.set(element, (reads.get(element) ?? 0) + 1);
    return original.call(this, element, pseudo);
  };
  try {
    expect(inspect(tooltip)).to.include({ text: 'Content action', actionable: true });
    expect(reads.get(action), 'action style reads').to.equal(1);
    expect(reads.get(content), 'display:contents wrapper style reads').to.equal(1);
    expect(reads.get(ancestor), 'external ancestor style reads').to.equal(1);

    action.hidden = true;
    expect(inspect(tooltip)).to.include({ text: '', actionable: false });
    action.hidden = false;
    ancestor.style.display = 'none';
    expect(inspect(tooltip)).to.include({ text: '', actionable: false });
    ancestor.style.display = 'contents';
    expect(inspect(tooltip)).to.include({ text: 'Content action', actionable: true });
  } finally {
    window.getComputedStyle = original;
  }
});

it('keeps live slotted visibility, ancestor observation and reconnect actionability', async () => {
  const ancestor = await fixture<HTMLDivElement>(html`
    <div>
      <lr-tooltip manual>
        <button slot="trigger">Help</button>
        <span style="visibility: hidden">Hidden text <button style="visibility: visible">Visible action</button></span>
      </lr-tooltip>
    </div>
  `);
  const tooltip = ancestor.querySelector('lr-tooltip')!;
  const action = tooltip.querySelector('span:not([slot]) button') as HTMLButtonElement;
  const description = () => tooltip.querySelector('[data-lyra-tooltip-description]')?.textContent;
  const role = () => tooltip.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('role');
  await waitUntil(() => description() === 'Visible action' && role() === 'dialog');
  action.style.visibility = 'hidden';
  await waitUntil(() => description() === '' && role() === 'tooltip');
  action.style.visibility = 'visible';
  await waitUntil(() => description() === 'Visible action' && role() === 'dialog');
  ancestor.hidden = true;
  await waitUntil(() => description() === '' && role() === 'tooltip');
  ancestor.hidden = false;
  await waitUntil(() => description() === 'Visible action' && role() === 'dialog');
  tooltip.remove();
  action.hidden = true;
  ancestor.append(tooltip);
  await waitUntil(() => description() === '' && role() === 'tooltip');
  action.hidden = false;
  await waitUntil(() => description() === 'Visible action' && role() === 'dialog');
});

it('retains authored focus stops whose text is omitted from accessible descriptions', async () => {
  const tooltip = await fixture<LyraTooltip>(html`
    <lr-tooltip manual><button slot="trigger">Help</button><span>Explanation</span></lr-tooltip>
  `);
  const stylesheet = document.createElement('style');
  stylesheet.textContent = '/* Editable stylesheet */';
  stylesheet.tabIndex = 0;
  stylesheet.style.display = 'block';
  tooltip.append(stylesheet);
  const role = () => tooltip.shadowRoot!.querySelector('[part~="popup"]')!.getAttribute('role');
  await waitUntil(() => role() === 'dialog');
  expect(getComputedStyle(stylesheet).display).to.equal('block');
  await tooltip.show();
  await focusByKeyboard(stylesheet);
  expect(document.activeElement === stylesheet).to.equal(true);
  expect(inspect(tooltip)).to.include({ text: 'Explanation', actionable: true });
  stylesheet.hidden = true;
  await waitUntil(() => role() === 'tooltip');
  expect(inspect(tooltip)).to.include({ text: 'Explanation', actionable: false });
});

it('preserves image-map actionability when the text walk exhausts its shared lookup budget', async () => {
  const container = await fixture<HTMLDivElement>(html`
    <div><lr-tooltip manual><button slot="trigger">Help</button><map name="bounded-tooltip-map"><area href="#target" alt="Mapped link" shape="rect" coords="0,0,32,32"></map></lr-tooltip></div>
  `);
  const tooltip = container.querySelector('lr-tooltip')!;
  const padding = document.createElement('div');
  for (let index = 0; index < 2100; index++) padding.append(document.createElement('span'));
  const image = document.createElement('img');
  image.useMap = '#bounded-tooltip-map';
  image.width = 32;
  image.height = 32;
  image.alt = 'Image map';
  image.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"></svg>';
  container.append(padding, image);
  await image.decode();
  await tooltip.updateComplete;
  expect(inspect(tooltip)).to.include({ text: '', actionable: true });
  padding.remove();
  expect(inspect(tooltip)).to.include({ text: 'Mapped link', actionable: true });
  const area = tooltip.querySelector('area')!;
  area.alt = 'Updated mapped link';
  const description = () => tooltip.querySelector('[data-lyra-tooltip-description]')?.textContent;
  await waitUntil(() => description() === 'Updated mapped link');
  image.style.display = 'none';
  await waitUntil(() => description() === '');
  image.style.removeProperty('display');
  await waitUntil(() => description() === 'Updated mapped link');
  area.hidden = true;
  await waitUntil(() => description() === '');
  expect(inspect(tooltip)).to.include({ text: '', actionable: false });
});
