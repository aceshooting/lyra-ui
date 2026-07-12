import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './attachment-trigger.js';
import '../menu/menu.js';
import '../menu/menu-item.js';
import type { LyraAttachmentTrigger, AttachmentPickDetail } from './attachment-trigger.js';
import type { LyraMenu } from '../menu/menu.js';
import type { LyraMenuItem } from '../menu/menu-item.js';

function trigger(el: LyraAttachmentTrigger): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function menuEl(el: LyraAttachmentTrigger): LyraMenu {
  return el.shadowRoot!.querySelector('lyra-menu') as LyraMenu;
}

function menuTriggerButton(el: LyraAttachmentTrigger): HTMLButtonElement {
  return menuEl(el).querySelector('button[slot="trigger"]') as HTMLButtonElement;
}

function menuItems(el: LyraAttachmentTrigger): LyraMenuItem[] {
  return [...menuEl(el).querySelectorAll('lyra-menu-item')] as LyraMenuItem[];
}

// The item's real click listener lives on its own inner [part="base"] shadow
// element, not the host -- calling .click() on the LyraMenuItem host itself
// does nothing (see menu-item.ts's own render()/select() wiring).
function clickItem(item: LyraMenuItem): void {
  (item.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click();
}

function hiddenInput(el: LyraAttachmentTrigger): HTMLInputElement | null {
  return el.shadowRoot!.querySelector('input[type="file"]');
}

function makeFile(name: string, type = 'text/plain'): File {
  return new File(['x'], name, { type });
}

function selectFiles(input: HTMLInputElement, files: File[]): void {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// --- single-capability shape ---

it('defaults to capabilities=["files"], rendering a single trigger button and no menu', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  expect(el.capabilities).to.deep.equal(['files']);
  expect(el.multiple).to.be.true;
  expect(el.disabled).to.be.false;
  const btn = trigger(el);
  expect(btn.getAttribute('aria-label')).to.equal('Attach files');
  expect(el.shadowRoot!.querySelector('lyra-menu')).to.be.null;
});

it('uses an image-specific aria-label for a single image capability', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['image'];
  await el.updateComplete;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Attach an image');
});

it('uses a camera-specific aria-label and renders no hidden file input for a single camera capability', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['camera'];
  await el.updateComplete;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Use camera');
  expect(hiddenInput(el)).to.be.null;
});

it('clicking the single camera trigger fires lyra-camera-request with null detail', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['camera'];
  await el.updateComplete;

  setTimeout(() => trigger(el).click());
  const ev = await oneEvent(el, 'lyra-camera-request');
  // emit() forwards `detail` verbatim to the CustomEvent constructor; an
  // omitted detail resolves to `null` there, not `undefined`.
  expect(ev.detail).to.be.null;
});

it('clicking the single files trigger clicks the hidden native input with the configured accept', async () => {
  const el = (await fixture(
    html`<lyra-attachment-trigger accept=".pdf,.docx"></lyra-attachment-trigger>`,
  )) as LyraAttachmentTrigger;
  const input = hiddenInput(el)!;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));

  trigger(el).click();

  expect(clicked).to.be.true;
  expect(input.accept).to.equal('.pdf,.docx');
});

it('defaults the hidden input accept to image/* for the image capability when accept is unset', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['image'];
  await el.updateComplete;
  const input = hiddenInput(el)!;

  trigger(el).click();

  expect(input.accept).to.equal('image/*');
});

it('an explicit accept prop overrides the image capability default', async () => {
  const el = (await fixture(
    html`<lyra-attachment-trigger accept="image/png"></lyra-attachment-trigger>`,
  )) as LyraAttachmentTrigger;
  el.capabilities = ['image'];
  await el.updateComplete;
  const input = hiddenInput(el)!;

  trigger(el).click();

  expect(input.accept).to.equal('image/png');
});

it('emits lyra-pick with the capability and a FileList that survives the input being reset', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  const input = hiddenInput(el)!;
  trigger(el).click();

  setTimeout(() => selectFiles(input, [makeFile('a.txt'), makeFile('b.txt')]));
  const ev = await oneEvent(el, 'lyra-pick');
  const detail = ev.detail as AttachmentPickDetail;

  // `oneEvent()` resolves via a microtask, so by the time this line runs
  // the component's own onInputChange has already reset `input.value` --
  // `input.files` is a *live* view, so a naively-forwarded reference would
  // already read back empty here. This is the regression case for that.
  expect(detail.capability).to.equal('files');
  expect(detail.files.length).to.equal(2);
  expect(detail.files[0].name).to.equal('a.txt');
  expect(detail.files[1].name).to.equal('b.txt');
  // The input resets after reading the selection so re-picking the same
  // file still fires another 'change' event next time.
  expect(input.value).to.equal('');
});

it('does not emit lyra-pick for an empty selection (e.g. the native picker was cancelled)', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  const input = hiddenInput(el)!;
  let fired = false;
  el.addEventListener('lyra-pick', () => (fired = true));

  input.dispatchEvent(new Event('change', { bubbles: true }));

  expect(fired).to.be.false;
});

it('forwards multiple to the hidden input, defaulting to true', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  expect(hiddenInput(el)!.multiple).to.be.true;

  el.multiple = false;
  await el.updateComplete;
  expect(hiddenInput(el)!.multiple).to.be.false;
});

it('disables the trigger button and the hidden input, and ignores click activation, while disabled', async () => {
  const el = (await fixture(
    html`<lyra-attachment-trigger disabled></lyra-attachment-trigger>`,
  )) as LyraAttachmentTrigger;
  const btn = trigger(el);
  const input = hiddenInput(el)!;
  expect(btn.disabled).to.be.true;
  expect(input.disabled).to.be.true;

  let clicked = false;
  input.addEventListener('click', () => (clicked = true));
  btn.click();
  expect(clicked).to.be.false;
});

// --- multi-capability menu shape ---

it('renders a lyra-menu with one item per capability, in order, once more than one is configured', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'image', 'camera'];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="trigger"]'), 'no single-capability trigger part while multi').to.be
    .null;
  const menu = el.shadowRoot!.querySelector('[part="menu"]');
  expect(menu).to.exist;
  expect(menu!.tagName.toLowerCase()).to.equal('lyra-menu');

  const items = menuItems(el);
  expect(items.map((i) => i.value)).to.deep.equal(['files', 'image', 'camera']);
  expect(menuTriggerButton(el).getAttribute('aria-label')).to.equal('Add attachment');
});

it('selecting the files menu item clicks the hidden native input', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'camera'];
  await el.updateComplete;
  const input = hiddenInput(el)!;
  let clicked = false;
  input.addEventListener('click', () => (clicked = true));

  clickItem(menuItems(el).find((i) => i.value === 'files')!);

  expect(clicked).to.be.true;
});

it('selecting the camera menu item fires lyra-camera-request', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'camera'];
  await el.updateComplete;
  const cameraItem = menuItems(el).find((i) => i.value === 'camera')!;

  setTimeout(() => clickItem(cameraItem));
  await oneEvent(el, 'lyra-camera-request');
});

it('selecting the image menu item primes the picker with accept="image/*" and tags the resulting pick as image', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'image'];
  await el.updateComplete;
  const input = hiddenInput(el)!;

  clickItem(menuItems(el).find((i) => i.value === 'image')!);
  expect(input.accept).to.equal('image/*');

  setTimeout(() => selectFiles(input, [makeFile('cat.png', 'image/png')]));
  const ev = await oneEvent(el, 'lyra-pick');
  expect((ev.detail as AttachmentPickDetail).capability).to.equal('image');
});

it('ignores capability activation from a menu item while disabled', async () => {
  const el = (await fixture(
    html`<lyra-attachment-trigger disabled></lyra-attachment-trigger>`,
  )) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'camera'];
  await el.updateComplete;
  expect(menuTriggerButton(el).disabled, 'the menu trigger itself is unreachable while disabled').to.be.true;

  let cameraFired = false;
  el.addEventListener('lyra-camera-request', () => (cameraFired = true));
  const input = hiddenInput(el)!;
  let inputClicked = false;
  input.addEventListener('click', () => (inputClicked = true));

  // Exercises the internal disabled guard directly, independent of the
  // native-disabled trigger button that would normally make these
  // unreachable in the first place.
  clickItem(menuItems(el).find((i) => i.value === 'camera')!);
  clickItem(menuItems(el).find((i) => i.value === 'files')!);

  expect(cameraFired).to.be.false;
  expect(inputClicked).to.be.false;
});

// --- accessibility ---

it('is accessible in the default single-capability state', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated multi-capability menu', async () => {
  const el = (await fixture(html`<lyra-attachment-trigger></lyra-attachment-trigger>`)) as LyraAttachmentTrigger;
  el.capabilities = ['files', 'image', 'camera'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
