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

it('contains long localized action labels inside a 375px toolbar allocation', async () => {
  const token = 'Supercalifragilisticexpialidocious'.repeat(4);
  const el = (await fixture(html`
    <lr-selection-toolbar
      open
      text="selected"
      .strings=${{
        selectionAsk: token,
        selectionQuote: token,
        selectionCite: token,
        copy: token,
      }}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  toolbar.style.maxInlineSize = '375px';
  await aTimeout(0);

  expect(toolbar.scrollWidth).to.be.at.most(toolbar.clientWidth);
});

it('keeps an otherwise-fitting RTL edge toolbar in one row before collision shifting', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar
      dir="rtl"
      open
      text="selected"
      .rect=${new DOMRect(0, 200, 1, 20)}
    ></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  const tops = [...toolbar.querySelectorAll<HTMLElement>('lr-button')].map(
    (button) => Math.round(button.getBoundingClientRect().top),
  );
  expect(new Set(tops).size).to.equal(1);
});

it('starts positioning when text becomes nonempty while open', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  expect(el.shadowRoot!.querySelector('[part="toolbar"]')).to.not.exist;

  el.text = 'selected';
  await el.updateComplete;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));
  expect(toolbar.hasAttribute('data-positioned')).to.be.true;
});

it('deactivates overlay ownership when live text becomes empty', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await el.updateComplete;
  let dismissed = 0;
  el.addEventListener('lr-dismiss', () => dismissed++);

  el.text = '';
  await el.updateComplete;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  expect(dismissed).to.equal(0);
  expect(el.open).to.be.true;
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
    (action) => action.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement,
  );
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([0, -1, -1, -1]);

  actions[2]!.focus();
  await aTimeout(0);
  controls[2]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
  );
  await aTimeout(0);
  expect(controls.map((control) => control.tabIndex)).to.deep.equal([-1, -1, -1, 0]);
  expect(actions[3]!.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base button');
});

it('restarts positioning after a disconnect/reconnect while open', async () => {
  const rect = new DOMRect(20, 30, 100, 20);
  const el = (await fixture(html`<lr-selection-toolbar
    open
    text="selected"
    .rect=${rect}
  ></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));

  // Simulate a same-instance reparent (e.g. drag-and-drop), which fires
  // disconnectedCallback then connectedCallback synchronously with no Lit
  // update in between -- `updated()`'s `changed.has('open')` branch never
  // reruns to notice `open` is still true.
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);

  // Clear the previously stamped position so a stale value can't pass this
  // assertion by accident -- only a live resize-listener re-running
  // updateToolbarPosition() can restore it.
  toolbar.removeAttribute('data-positioned');
  toolbar.style.removeProperty('--lr-selection-toolbar-inline-start');
  toolbar.style.removeProperty('--lr-selection-toolbar-block-start');

  window.dispatchEvent(new Event('resize'));
  await waitUntil(() => toolbar.hasAttribute('data-positioned'));

  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('70px');
  expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-block-start')).to.equal('30px');
});

it('replaces an inactive overlay handle after a settled detach so Escape still dismisses on reconnect', async () => {
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  const parent = el.parentElement!;
  el.remove();
  await aTimeout(0);
  parent.append(el);
  await el.updateComplete;

  let dismissals = 0;
  el.addEventListener('lr-dismiss', () => dismissals++);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(dismissals).to.equal(1);
});

it('does not re-arm its former document during a detached update and reconnects to its new owner', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const el = (await fixture(html`
      <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
    `)) as LyraSelectionToolbar;
    let dismissals = 0;
    el.addEventListener('lr-dismiss', () => dismissals++);

    el.remove();
    el.text = 'changed while detached';
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.open).to.be.true;
    expect(dismissals).to.equal(0);

    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.open).to.be.true;
    expect(dismissals).to.equal(0);

    frameDocument.dispatchEvent(
      new frameWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(dismissals).to.equal(1);
  } finally {
    frame.remove();
  }
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

it('uses owner-window geometry and observers, and retires an adopted positioning callback', async () => {
  interface ObserverRecord {
    callback: ResizeObserverCallback;
    observed: Element[];
    disconnects: number;
  }

  const recordsFor = (records: ObserverRecord[]): typeof ResizeObserver =>
    class implements ResizeObserver {
      private readonly record: ObserverRecord;

      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }

      observe(target: Element): void {
        this.record.observed.push(target);
      }

      unobserve(): void {}

      disconnect(): void {
        this.record.disconnects++;
      }
    };

  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const mainObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  const frameObserver = Object.getOwnPropertyDescriptor(frameWindow, 'ResizeObserver');
  const frameInnerWidth = Object.getOwnPropertyDescriptor(frameWindow, 'innerWidth');
  const mainRecords: ObserverRecord[] = [];
  const frameRecords: ObserverRecord[] = [];
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: recordsFor(mainRecords),
  });
  Object.defineProperty(frameWindow, 'ResizeObserver', {
    configurable: true,
    value: recordsFor(frameRecords),
  });
  Object.defineProperty(frameWindow, 'innerWidth', { configurable: true, value: 420 });
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  mainRecords.length = 0;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    // Force styleMap to recompute after adoption without creating fresh child custom elements in
    // the destination document (constructed stylesheets intentionally remain document-scoped).
    el.requestUpdate();
    await el.updateComplete;
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;

    expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('210px');
    expect(mainRecords.length).to.equal(0);
    expect(frameRecords.length).to.equal(1);
    expect(frameRecords[0]!.observed.length).to.equal(1);
    expect(frameRecords[0]!.observed[0] === toolbar).to.be.true;

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    expect(frameRecords[0]!.disconnects).to.equal(1);
    expect(mainRecords.length).to.equal(1);

    toolbar.removeAttribute('data-positioned');
    toolbar.style.removeProperty('--lr-selection-toolbar-inline-start');
    frameRecords[0]!.callback([], {} as ResizeObserver);
    expect(toolbar.hasAttribute('data-positioned')).to.be.false;
    expect(toolbar.style.getPropertyValue('--lr-selection-toolbar-inline-start')).to.equal('');

    mainRecords[0]!.callback([], {} as ResizeObserver);
    expect(toolbar.hasAttribute('data-positioned')).to.be.true;
  } finally {
    el.remove();
    if (mainObserver) Object.defineProperty(window, 'ResizeObserver', mainObserver);
    else Reflect.deleteProperty(window, 'ResizeObserver');
    if (frameObserver) Object.defineProperty(frameWindow, 'ResizeObserver', frameObserver);
    else Reflect.deleteProperty(frameWindow, 'ResizeObserver');
    if (frameInnerWidth) Object.defineProperty(frameWindow, 'innerWidth', frameInnerWidth);
    else Reflect.deleteProperty(frameWindow, 'innerWidth');
    frame.remove();
  }
});

it('never lets a non-finite rect reach the styleMap-bound coordinates (CSS injection/NaN hardening)', async () => {
  const el = (await fixture(html`<lr-selection-toolbar open text="selected"></lr-selection-toolbar>`)) as LyraSelectionToolbar;
  // `rect` is typed `DOMRectReadOnly`, but a caller passing a plain object (or a Range computed
  // over a collapsed/detached selection) can hand this a non-finite value at runtime; TS cannot
  // enforce the type across the property boundary.
  el.rect = { left: NaN, top: Infinity, width: -Infinity, height: 0, bottom: NaN } as unknown as DOMRectReadOnly;
  await el.updateComplete;
  const coordinates = (el as unknown as { coordinates(): Record<string, string> }).coordinates();
  expect(coordinates['--lr-selection-toolbar-inline-start']).to.match(/^-?\d+(\.\d+)?px$/);
  expect(coordinates['--lr-selection-toolbar-block-start']).to.match(/^-?\d+(\.\d+)?px$/);
});

it('computes ownerless coordinates without consulting ambient viewport geometry', async () => {
  const inertDocument = document.implementation.createHTMLDocument('ownerless toolbar');
  const innerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;

  try {
    el.remove();
    inertDocument.adoptNode(el);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get(): never {
        throw new Error('ambient viewport consulted');
      },
    });
    const coordinates = (el as unknown as { coordinates(): Record<string, string> }).coordinates();
    expect(coordinates['--lr-selection-toolbar-inline-start']).to.equal('0px');
  } finally {
    if (innerWidth) Object.defineProperty(window, 'innerWidth', innerWidth);
    else Reflect.deleteProperty(window, 'innerWidth');
    el.remove();
  }
});

it('uses the current owner clipboard and suppresses adopted or ownerless async completions', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
  let rejectWrite!: (reason: unknown) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    rejectWrite = reject;
  });
  let mainWrites = 0;
  let frameWrites = 0;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => { mainWrites++; return pending; } },
  });
  Object.defineProperty(frameWindow.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => { frameWrites++; return pending; } },
  });
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  let actions = 0;
  let errors = 0;
  el.addEventListener('lr-selection-action', () => actions++);
  el.addEventListener('lr-copy-error', () => errors++);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    const copy = el.shadowRoot!.querySelector('[data-action="copy"]') as HTMLElement;
    copy.click();
    await Promise.resolve();

    document.body.append(document.adoptNode(el));
    rejectWrite(new frameWindow.DOMException('Denied', 'NotAllowedError'));
    await Promise.resolve();
    await Promise.resolve();
    expect(frameWrites).to.equal(1);
    expect(mainWrites).to.equal(0);
    expect(actions).to.equal(0);
    expect(errors).to.equal(0);

    const inertDocument = document.implementation.createHTMLDocument('ownerless toolbar');
    el.remove();
    inertDocument.adoptNode(el);
    copy.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mainWrites).to.equal(0);
  } finally {
    el.remove();
    if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
    else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
    frame.remove();
  }
});

it('does not mutate or focus stale roving buttons after adoption', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const el = (await fixture(html`
    <lr-selection-toolbar open text="selected"></lr-selection-toolbar>
  `)) as LyraSelectionToolbar;
  await aTimeout(0);
  const actions = [...el.shadowRoot!.querySelectorAll('lr-button[data-action]')] as Array<
    HTMLElement & { updateComplete: Promise<unknown> }
  >;
  await Promise.all(actions.map((action) => action.updateComplete));
  const controls = actions.map(
    (action) => action.shadowRoot!.querySelector('[part~="base"]') as HTMLButtonElement,
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  actions.forEach((action) => {
    Object.defineProperty(action, 'updateComplete', { configurable: true, value: pending });
  });
  let focusCalls = 0;
  actions[1]!.focus = () => {
    focusCalls++;
  };

  try {
    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    frameDocument.body.append(frameDocument.adoptNode(el));
    release();
    await Promise.resolve();
    await Promise.resolve();

    expect(controls.map((control) => control.tabIndex)).to.deep.equal([0, -1, -1, -1]);
    expect(focusCalls).to.equal(0);
  } finally {
    el.remove();
    frame.remove();
  }
});
