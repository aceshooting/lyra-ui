import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './selection-toolbar.js';
import type {
  LyraSelectionToolbar,
  SelectionActionDetail,
} from './selection-toolbar.class.js';

it('renders a named toolbar at a supplied selection rectangle', async () => {
  const rect = new DOMRect(20, 30, 100, 20);
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected passage"
    .anchor=${{ kind: 'page', page: 4 }}
    .rect=${rect}
    .strings=${{ selectionToolbarLabel: 'Actions de sélection' }}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  expect(toolbar.getAttribute('role')).to.equal('toolbar');
  expect(toolbar.getAttribute('aria-label')).to.equal('Actions de sélection');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('70px');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-block-start')).to.equal('30px');
  expect(el.shadowRoot!.querySelectorAll('[part~="action"]')).to.have.lengthOf(4);
});

it('emits the selected text and document anchor for an action', async () => {
  const anchor = { kind: 'text-quote' as const, quote: 'selected passage' };
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected passage"
    .anchor=${anchor}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const activated = oneEvent(el, 'lr-selection-action');
  (el.shadowRoot!.querySelector('[data-action="ask"]') as HTMLElement).click();
  const event = await activated as CustomEvent<SelectionActionDetail>;
  expect(event.detail.action).to.equal('ask');
  expect(event.detail.text).to.equal('selected passage');
  expect(event.detail.anchor).to.deep.equal(anchor);
});

it('dismisses on Escape through the shared overlay manager', async () => {
  const el = (await fixture(html`<lr-selection-toolbar open text="selected"></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  await el.updateComplete;
  const dismissed = oneEvent(el, 'lr-dismiss');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await dismissed;
  expect(el.open).to.be.false;
});

it('is accessible in its open populated state', async () => {
  const el = await fixture(html`<lr-selection-toolbar open text="selected passage"></lr-selection-toolbar>`);
  expect(el.shadowRoot!.querySelectorAll('[part~="action"]')).to.have.lengthOf(4);
  await expect(el).to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected"
    .strings=${{ selectionToolbarLabel: 'Localized selection actions' }}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  expect(el.shadowRoot!.querySelector('[part="toolbar"]')!.getAttribute('aria-label')).to.equal('Localized selection actions');
});
