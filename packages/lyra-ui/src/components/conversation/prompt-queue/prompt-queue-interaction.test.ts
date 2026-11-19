import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './prompt-queue.js';

it('lets the enclosing layout theme its item surface', async () => {
  const el = await fixture(html`<lr-prompt-queue .items=${[{ id: 'x', value: 'Hello' }]}
    style="--lr-prompt-queue-radius: 9px; --lr-prompt-queue-bg: rgb(1, 2, 3); --lr-prompt-queue-border-color: rgb(3, 4, 5); --lr-prompt-queue-padding: 7px"></lr-prompt-queue>`);
  const style = getComputedStyle(el.shadowRoot!.querySelector('[part~="item"]')!);
  expect(style.borderTopLeftRadius).to.equal('9px');
  expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(style.borderTopColor).to.equal('rgb(3, 4, 5)');
  expect(style.paddingInlineStart).to.equal('7px');
});

it('projects the host description onto the region and follows text edits', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="help">Description</p>
    <lr-prompt-queue aria-describedby="help"></lr-prompt-queue></div>`);
  const el = wrapper.querySelector('lr-prompt-queue')!;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const description = wrapper.querySelector('p')!;
  const text = () => (base.ariaDescribedByElements ?? (base.getAttribute('aria-describedby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  await waitUntil(() => text() === 'Description');
  description.textContent = 'Changed';
  await waitUntil(() => text() === 'Changed');
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  frame.contentDocument!.body.append(wrapper);
  description.textContent = 'Adopted';
  await waitUntil(() => text() === 'Adopted');
});

it('uses the shared button for pagination and retains disabled and page-change behavior', async () => {
  const items = Array.from({ length: 22 }, (_, id) => ({ id: String(id), value: 'draft' }));
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-queue']>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
  const next = el.shadowRoot!.querySelector<HTMLElementTagNameMap['lr-button']>('[data-page-action="next"]')!;
  expect(next.localName).to.equal('lr-button');
  expect(next.disabled).to.equal(false);
  next.click();
  await el.updateComplete;
  expect(next.disabled).to.equal(true);
  expect(el.shadowRoot!.querySelector('[data-id="20"]') !== null).to.equal(true);
});

it('falls back to a localized name for whitespace-only overrides', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-queue']>(html`<lr-prompt-queue
    aria-label="  " label="   " .strings=${{ promptQueueLabel: 'Localized name' }}></lr-prompt-queue>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized name');
  expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent).to.equal('Localized name');
  el.setAttribute('aria-label', '  Named control  ');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')?.trim()).to.equal('Named control');
});

it('projects authored label references onto the inner region through reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="region-name">Region name</p>
    <lr-prompt-queue aria-labelledby="region-name"></lr-prompt-queue></div>`);
  const el = wrapper.querySelector('lr-prompt-queue')!;
  await el.updateComplete;
  const region = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const name = () => (region.ariaLabelledByElements ?? (region.getAttribute('aria-labelledby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  expect(name()).to.equal('Region name');
  el.remove();
  expect(name()).to.equal('');
  wrapper.append(el);
  await waitUntil(() => name() === 'Region name');
  el.removeAttribute('aria-labelledby');
  await waitUntil(() => name() === '');
});

it('leaves editing space for translated actions at intermediate widths', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-prompt-queue']>(html`<lr-prompt-queue
    .items=${[{ id: 'x', value: 'Edit me' }]} .strings=${{ moveUp: 'Déplacer vers le haut', moveDown: 'Déplacer vers le bas' }}>
  </lr-prompt-queue>`);
  const item = el.shadowRoot!.querySelector<HTMLElement>('[part~="item"]')!;
  const editor = item.querySelector<HTMLElement>('[part="editor"]')!;
  for (const width of ['24rem', '32rem']) {
    el.style.inlineSize = width;
    expect(editor.getBoundingClientRect().width).to.be.at.least(item.clientWidth / 2);
    expect(item.scrollWidth).to.be.at.most(item.clientWidth + 1);
  }
});
