import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
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

it('keeps every viewport-edge placement inside the visible viewport', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  for (const rect of [
    new DOMRect(0, 0, 1, 1),
    new DOMRect(window.innerWidth - 1, 0, 1, 1),
    new DOMRect(0, window.innerHeight - 1, 1, 1),
    new DOMRect(window.innerWidth - 1, window.innerHeight - 1, 1, 1),
  ]) {
    el.rect = rect;
    await el.updateComplete;
    await waitUntil(() => toolbar.hasAttribute('data-positioned'));
    await aTimeout(0);
    const positioned = toolbar.getBoundingClientRect();
    expect(positioned.left).to.be.at.least(0);
    expect(positioned.top).to.be.at.least(0);
    expect(positioned.right).to.be.at.most(window.innerWidth);
    expect(positioned.bottom).to.be.at.most(window.innerHeight);
  }
});

it('maintains one roving toolbar stop and moves it from the directly focused action', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const actions = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(actions.map((action) => action.updateComplete));
  const controls = actions.map(
    (action) => action.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement,
  );
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([0, -1, -1, -1]);

  actions[2]!.focus();
  await aTimeout(0);
  controls[2]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
  );
  await aTimeout(0);
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  expect(actions[3]!.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('snapshots selection detail before awaiting clipboard writes', async () => {
  const originalWriteText = navigator.clipboard.writeText;
  let release: (() => void) | undefined;
  navigator.clipboard.writeText = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  try {
    const oldAnchor = { kind: 'text-quote' as const, quote: 'old text' };
    const el = (await fixture(html`
      <lr-selection-toolbar open text="old text" .anchor=${oldAnchor}></lr-selection-toolbar>
    `)) as LyraSelectionToolbar;
    const activated = oneEvent(el, 'lr-selection-action');
    (el.shadowRoot!.querySelector('[data-action="copy"]') as HTMLElement).click();
    await waitUntil(() => release !== undefined);
    el.text = 'new text';
    el.anchor = { kind: 'text-quote', quote: 'new text' };
    release!();

    const event = (await activated) as CustomEvent<SelectionActionDetail>;
    expect(event.detail.text).to.equal('old text');
    expect(event.detail.anchor).to.deep.equal(oldAnchor);
  } finally {
    navigator.clipboard.writeText = originalWriteText;
  }
});
