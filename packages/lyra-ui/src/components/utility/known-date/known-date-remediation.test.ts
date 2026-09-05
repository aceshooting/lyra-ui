import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './known-date.js';
import type { LyraKnownDate } from './known-date.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function descriptionIds(owner: HTMLElement): string[] {
  return Reflect.has(owner, 'ariaDescribedByElements')
    ? Array.from(owner.ariaDescribedByElements ?? [], (element) => element.id)
    : owner.getAttribute('aria-describedby')?.match(/\S+/g) ?? [];
}

for (const attribute of ['label', 'hint'] as const) {
  it(`treats removed ${attribute} as absent without changing null or explicit empty readback`, async () => {
    const viewer = await fixture<LyraKnownDate>(html`<lr-known-date></lr-known-date>`);
    viewer.setAttribute(attribute, 'Supplied copy');
    await viewer.updateComplete;
    viewer.removeAttribute(attribute);
    await viewer.updateComplete;
    expect(viewer[attribute]).to.equal(null);
    const chrome = viewer.shadowRoot!.querySelector<HTMLElement>(attribute === 'label' ? '[part="legend"]' : '[part="hint"]')!;
    expect(chrome.hidden).to.equal(true);
    viewer.setAttribute(attribute, '');
    await viewer.updateComplete;
    expect(viewer[attribute]).to.equal('');
    viewer.setAttribute(attribute, 'Restored copy');
    await viewer.updateComplete;
    expect(chrome.textContent).to.include('Restored copy');
  });
}

for (const field of ['day', 'month', 'year'] as const) {
  it(`restores the localized omitted ${field} label on removal while retaining explicit empty labels`, async () => {
    const viewer = await fixture<LyraKnownDate>(html`<lr-known-date .strings=${{ knownDateDay: 'Localized day', knownDateMonth: 'Localized month', knownDateYear: 'Localized year' }}></lr-known-date>`);
    const label = viewer.shadowRoot!.querySelector(`[part~="field"][data-field="${field}"] [part="field-label"]`)!;
    expect(label.textContent).to.equal(`Localized ${field}`);
    viewer.setAttribute(`${field}-label`, 'Custom field');
    await viewer.updateComplete;
    expect(label.textContent).to.equal('Custom field');
    viewer.removeAttribute(`${field}-label`);
    await viewer.updateComplete;
    expect(viewer[`${field}Label`]).to.equal(null);
    expect(label.textContent).to.equal(`Localized ${field}`);
    viewer.setAttribute(`${field}-label`, '');
    await viewer.updateComplete;
    expect(label.textContent).to.equal('');
    viewer.setAttribute(`${field}-label`, 'Recovered field');
    await viewer.updateComplete;
    expect(label.textContent).to.equal('Recovered field');
  });
}

it('resolves external guidance at the aggregate fieldset while retaining local descriptions on each native field', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><p id="date-guide">External guidance</p>
    <lr-known-date aria-describedby="date-guide late-date-guide" hint="Local hint" error-text="Local error"></lr-known-date>
  </div>`);
  const viewer = root.querySelector<LyraKnownDate>('lr-known-date')!;
  const owner = viewer.shadowRoot!.querySelector<HTMLElement>('[part="fieldset"]')!;
  const inputs = [...viewer.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="field-input"]')];
  const localIds = ['hint', 'error'].map((part) => viewer.shadowRoot!.querySelector(`[part="${part}"]`)!.id);
  await waitUntil(() => descriptionIds(owner).join(' ') === 'date-guide');
  for (const input of inputs) expect(descriptionIds(input)).to.deep.equal(localIds);
  const replacement = document.createElement('p');
  replacement.id = 'date-guide';
  replacement.textContent = 'Replacement guidance';
  root.querySelector('#date-guide')!.replaceWith(replacement);
  const late = document.createElement('p');
  late.id = 'late-date-guide';
  root.append(late);
  await waitUntil(() => descriptionIds(owner).join(' ') === 'date-guide late-date-guide');
  if (Reflect.has(owner, 'ariaDescribedByElements')) expect(owner.ariaDescribedByElements?.[0] === replacement).to.equal(true);
  replacement.remove();
  await waitUntil(() => descriptionIds(owner).join(' ') === 'late-date-guide');
  root.append(replacement);
  await waitUntil(() => descriptionIds(owner).join(' ') === 'date-guide late-date-guide');
  viewer.hint = 'Queued hint';
  viewer.remove();
  await viewer.updateComplete;
  expect(descriptionIds(owner)).to.deep.equal([]);
  root.append(viewer);
  await waitUntil(() => descriptionIds(owner).join(' ') === 'date-guide late-date-guide');
  viewer.removeAttribute('aria-describedby');
  await waitUntil(() => descriptionIds(owner).length === 0);
  for (const input of inputs) expect(descriptionIds(input)).to.deep.equal(localIds);
});

it('rebinds aggregate guidance after adoption into a different document', async () => {
  const root = await fixture<HTMLDivElement>(html`<div><p id="date-realm-guide">First root</p><lr-known-date aria-describedby="date-realm-guide"></lr-known-date></div>`);
  const viewer = root.querySelector<LyraKnownDate>('lr-known-date')!;
  const owner = viewer.shadowRoot!.querySelector<HTMLElement>('[part="fieldset"]')!;
  await waitUntil(() => descriptionIds(owner).join(' ') === 'date-realm-guide');
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const foreign = frame.contentDocument!;
  const guide = foreign.createElement('p');
  guide.id = 'date-realm-guide';
  foreign.body.append(guide);
  try {
    foreign.body.append(foreign.adoptNode(viewer));
    await waitUntil(() => descriptionIds(owner).join(' ') === 'date-realm-guide');
    if (Reflect.has(owner, 'ariaDescribedByElements')) expect(owner.ariaDescribedByElements?.[0] === guide).to.equal(true);
    guide.remove();
    await waitUntil(() => descriptionIds(owner).length === 0);
    foreign.body.append(guide);
    await waitUntil(() => descriptionIds(owner).length === 1);
  } finally { root.append(document.adoptNode(viewer)); frame.remove(); }
});

for (const mode of ['own', 'fieldset'] as const) {
  for (const field of ['day', 'month', 'year']) {
    it(`retains disabled ${field} resting paint for ${mode} disablement while enabled hover remains visible`, async () => {
      const root = await fixture<HTMLFieldSetElement>(html`<fieldset ?disabled=${mode === 'fieldset'}>
        <lr-known-date ?disabled=${mode === 'own'} style="--lr-color-border:rgb(80,90,100);--lr-color-brand:rgb(1,130,40);--lr-transition-fast:0s"></lr-known-date>
      </fieldset>`);
      const viewer = root.querySelector<LyraKnownDate>('lr-known-date')!;
      const input = viewer.shadowRoot!.querySelector<HTMLInputElement>(`[part="field-input"][data-field="${field}"]`)!;
      await waitUntil(() => input.disabled);
      const rest = getComputedStyle(input).borderColor;
      try {
        await hoverUntilMatched(input, 'disabled date field did not receive hover');
        expect(getComputedStyle(input).borderColor).to.equal(rest);
        await sendMouse({ type: 'down' });
        await aTimeout(20);
        expect(getComputedStyle(input).borderColor).to.equal(rest);
        await resetMouse();
        root.disabled = false;
        viewer.disabled = false;
        await waitUntil(() => !input.disabled);
        await hoverUntilMatched(input, 'enabled date field did not receive hover');
        await waitUntil(() => getComputedStyle(input).borderColor !== rest);
      } finally { await resetMouse(); }
    });
  }
}
