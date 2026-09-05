import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './stat.js';
import type { LyraStat } from './stat.js';

for (const attribute of ['caption', 'sub'] as const) {
  it(`removes ${attribute} safely and keeps assigned content visible`, async () => {
    const element = await fixture<LyraStat>(html`<lr-stat caption="Caption" sub="Sub" value="42"></lr-stat>`);
    const part = () => element.shadowRoot!.querySelector<HTMLElement>(`[part="${attribute}"]`)!;
    element.removeAttribute(attribute);
    await element.updateComplete;
    expect(element[attribute] as unknown).to.equal(null);
    expect(getComputedStyle(part()).display).to.equal('none');
    expect(element.shadowRoot!.querySelector('[part="value"]')?.textContent).to.equal('42');
    element.setAttribute(attribute, '');
    await element.updateComplete;
    expect(element[attribute]).to.equal('');
    expect(part().hidden).to.equal(true);
    element.setAttribute(attribute, 'Restored');
    await element.updateComplete;
    expect(part().textContent!.trim()).to.equal('Restored');
    const supplied = document.createElement('span');
    supplied.slot = attribute;
    supplied.textContent = 'Assigned content';
    element.append(supplied);
    await waitUntil(() => !part().hidden);
    element.removeAttribute(attribute);
    await element.updateComplete;
    expect(element[attribute] as unknown).to.equal(null);
    expect(getComputedStyle(part()).display).not.to.equal('none');
    expect(supplied.getBoundingClientRect().height).to.be.greaterThan(0);
  });
}

for (const modifier of ['', 'Control', 'Meta', 'Shift']) {
  it(`preserves ${modifier || 'plain'} native pointer intent from a passive slotted caption to its anchor`, async () => {
    const element = await fixture<LyraStat>(html`<lr-stat href="#stat-target" value="42"><span slot="caption">Passive caption</span><button slot="sub" type="button">Independent button</button></lr-stat>`);
    const anchor = element.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
    const activations: MouseEvent[] = [];
    anchor.addEventListener('click', (event) => { event.preventDefault(); activations.push(event); });
    const caption = element.querySelector<HTMLElement>('[slot="caption"]')!;
    try {
      await hoverUntilMatched(caption, 'caption receives the native pointer');
      const rect = caption.getBoundingClientRect();
      const position: [number, number] = [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
      if (modifier) await sendKeys({ down: modifier });
      await sendMouse({ type: 'click', position });
      await waitUntil(() => activations.length === 1);
      expect(activations[0]!.ctrlKey).to.equal(modifier === 'Control');
      expect(activations[0]!.metaKey).to.equal(modifier === 'Meta');
      expect(activations[0]!.shiftKey).to.equal(modifier === 'Shift');
      expect(activations[0]!.button).to.equal(0);
      expect(activations[0]!.detail).to.equal(1);
      const nested = element.querySelector<HTMLButtonElement>('button')!;
      await hoverUntilMatched(nested, 'nested control receives the native pointer');
      const nestedRect = nested.getBoundingClientRect();
      const nestedPosition: [number, number] = [Math.round(nestedRect.left + nestedRect.width / 2), Math.round(nestedRect.top + nestedRect.height / 2)];
      await sendMouse({ type: 'click', position: nestedPosition });
      expect(activations.length).to.equal(1);
    } finally {
      if (modifier) await sendKeys({ up: modifier });
      await resetMouse();
    }
  });
}

it('provides guarded new-context activation for a modified native click and restores the authored target after veto', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat href="#stat-target" target="_self"><span slot="caption">Open details</span></lr-stat>`);
  const anchor = element.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  const targets: string[] = [];
  const relations: string[] = [];
  anchor.addEventListener('click', (event) => { targets.push(anchor.target); relations.push(anchor.rel); event.preventDefault(); });
  const caption = element.querySelector<HTMLElement>('[slot="caption"]')!;
  try {
    await hoverUntilMatched(caption, 'caption receives pointer');
    const rect = caption.getBoundingClientRect();
    await sendKeys({ down: 'Shift' });
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    await waitUntil(() => targets.length === 1);
    expect(targets).to.deep.equal(['_blank']);
    expect(relations[0]!.split(/\s+/)).to.include.members(['noopener', 'noreferrer']);
    expect(anchor.target).to.equal('_self');
    expect(anchor.rel).to.equal('noopener noreferrer');
    expect(element.target).to.equal('_self');
  } finally { await sendKeys({ up: 'Shift' }); await resetMouse(); }
});

it('leaves synchronous author target and rel changes owned by the click listener', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat href="#stat-target" target="_self"><span slot="caption">Change target</span></lr-stat>`);
  const anchor = element.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    anchor.setAttribute('target', 'author-panel');
    anchor.setAttribute('rel', 'noopener noreferrer external');
  });
  element.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
  expect(anchor.getAttribute('target')).to.equal('author-panel');
  expect(anchor.getAttribute('rel')).to.equal('noopener noreferrer external');
});

it('keeps a named target and its relation unchanged during ordinary delegated activation', async () => {
  const element = await fixture<LyraStat>(html`<lr-stat href="#stat-target" target="details-panel"><span slot="caption">Details</span></lr-stat>`);
  const anchor = element.shadowRoot!.querySelector<HTMLAnchorElement>('[part="base"]')!;
  const targets: string[] = [];
  anchor.addEventListener('click', (event) => { event.preventDefault(); targets.push(anchor.target); });
  const caption = element.querySelector<HTMLElement>('span')!;
  try {
    await hoverUntilMatched(caption, 'caption receives ordinary pointer');
    const rect = caption.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    await waitUntil(() => targets.length === 1);
    expect(targets).to.deep.equal(['details-panel']);
    expect(anchor.target).to.equal('details-panel');
    expect(anchor.rel).to.equal('noopener noreferrer');
  } finally { await resetMouse(); }
});
