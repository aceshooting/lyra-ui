import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './message-actions.js';
import '../branch-picker/branch-picker.js';
import type { LyraMessageActions } from './message-actions.js';

it('renders no built-ins by default and no copy button without copyText', async () => {
  const el = (await fixture(html`<lr-message-actions></lr-message-actions>`)) as LyraMessageActions;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.children.length).to.equal(1); // just the <slot>

  const withCopyControlOnly = (await fixture(
    html`<lr-message-actions .controls=${['copy']}></lr-message-actions>`,
  )) as LyraMessageActions;
  expect(withCopyControlOnly.shadowRoot!.querySelector('lr-copy-button')).to.not.exist;
});

it('renders built-ins in the order controls lists them', async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hello"
      .controls=${['feedback', 'copy', 'regenerate']}
    ></lr-message-actions>`,
  )) as LyraMessageActions;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const order = [...base.children].map((c) => c.tagName.toLowerCase());
  expect(order).to.deep.equal(['lr-message-feedback', 'lr-copy-button', 'button', 'slot']);
});

it('lr-copy bubbles from the embedded copy button, exactly once', async () => {
  const el = (await fixture(
    html`<lr-message-actions copy-text="hi there" .controls=${['copy']}></lr-message-actions>`,
  )) as LyraMessageActions;
  let count = 0;
  let detail: { text: string } | undefined;
  el.addEventListener('lr-copy', (e) => {
    count++;
    detail = (e as CustomEvent).detail;
  });
  (el.shadowRoot!.querySelector('lr-copy-button') as HTMLElement).shadowRoot!
    .querySelector('button')!
    .click();
  expect(count).to.equal(1);
  expect(detail).to.deep.equal({ text: 'hi there' });
});

it('fires lr-regenerate and lr-edit with no detail', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['regenerate', 'edit']}></lr-message-actions>`,
  )) as LyraMessageActions;
  const regeneratePromise = oneEvent(el, 'lr-regenerate');
  (el.shadowRoot!.querySelector('[part~="regenerate-button"]') as HTMLButtonElement).click();
  // CustomEventInit's `detail` defaults to null; passing `detail: undefined` through to the
  // constructor (this.emit()'s call site here passes no detail argument at all) is normalized to
  // that same default by the platform -- matches this codebase's existing no-detail-event
  // assertions (e.g. attachment-trigger.test.ts, menu-item.test.ts) rather than `undefined`.
  expect((await regeneratePromise).detail).to.be.null;

  const editPromise = oneEvent(el, 'lr-edit');
  (el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement).click();
  expect((await editPromise).detail).to.be.null;
});

it('the feedback built-in is thumbs-only: reasons/commentable/detailFor are never forwarded', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['feedback']}></lr-message-actions>`,
  )) as LyraMessageActions;
  const feedback = el.shadowRoot!.querySelector('lr-message-feedback') as HTMLElement & {
    reasons: unknown[];
    commentable: boolean;
  };
  expect(feedback.reasons).to.deep.equal([]);
  expect(feedback.commentable).to.be.false;
  expect(feedback.shadowRoot!.querySelector('[part="panel"]')).to.not.exist;
});

it('forwards feedbackValue to the embedded feedback built-in', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['feedback']} feedback-value="up"></lr-message-actions>`,
  )) as LyraMessageActions;
  const feedback = el.shadowRoot!.querySelector('lr-message-feedback') as HTMLElement & { value: string };
  expect(feedback.value).to.equal('up');
});

it('lr-change and lr-submit bubble unchanged from the embedded feedback built-in', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['feedback']}></lr-message-actions>`,
  )) as LyraMessageActions;
  const changePromise = oneEvent(el, 'lr-change');
  // `[part="down-button"]` lives inside the embedded lr-message-feedback's own shadow root, one
  // level deeper than lr-message-actions' -- a shadow-piercing part selector needs the extra hop.
  const feedback = el.shadowRoot!.querySelector('lr-message-feedback') as HTMLElement;
  (feedback.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement).click();
  expect((await changePromise).detail).to.deep.equal({ value: 'down' });
});

it('is role="toolbar" with a localized default label, or a custom label override', async () => {
  const el = (await fixture(html`<lr-message-actions></lr-message-actions>`)) as LyraMessageActions;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute('role')).to.equal('toolbar');
  expect(base.getAttribute('aria-label')).to.equal('Message actions');

  const labeled = (await fixture(
    html`<lr-message-actions label="Assistant reply actions"></lr-message-actions>`,
  )) as LyraMessageActions;
  expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Assistant reply actions',
  );
});

it('forwards a host aria-label to the toolbar, winning over label', async () => {
  const el = (await fixture(
    html`<lr-message-actions aria-label="Reply toolbar" label="Assistant reply actions"></lr-message-actions>`,
  )) as LyraMessageActions;
  expect(el.accessibleLabel).to.equal('Reply toolbar');
  expect(el.shadowRoot!.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).to.equal('Reply toolbar');

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="toolbar"]')!.getAttribute('aria-label')).to.equal(
    'Assistant reply actions',
  );
});

it('roving tabindex: only the active plain-button stop is tabbable, and ArrowRight/ArrowLeft move it', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['regenerate', 'edit']}></lr-message-actions>`,
  )) as LyraMessageActions;
  await el.updateComplete;
  const regenerate = el.shadowRoot!.querySelector('[part~="regenerate-button"]') as HTMLButtonElement;
  const edit = el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement;
  expect(regenerate.tabIndex).to.equal(0);
  expect(edit.tabIndex).to.equal(-1);

  el.shadowRoot!
    .querySelector('[part="base"]')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(regenerate.tabIndex).to.equal(-1);
  expect(edit.tabIndex).to.equal(0);
  expect(el.shadowRoot!.activeElement).to.equal(edit);
});

it('ArrowLeft/ArrowRight swap under RTL', async () => {
  const el = (await fixture(
    html`<lr-message-actions dir="rtl" .controls=${['regenerate', 'edit']}></lr-message-actions>`,
  )) as LyraMessageActions;
  await el.updateComplete;
  const regenerate = el.shadowRoot!.querySelector('[part~="regenerate-button"]') as HTMLButtonElement;
  const edit = el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement;
  el.shadowRoot!
    .querySelector('[part="base"]')!
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(regenerate.tabIndex).to.equal(-1);
  expect(edit.tabIndex).to.equal(0);
});

it('Home/End jump roving tabindex to the first/last stop', async () => {
  const el = (await fixture(
    html`<lr-message-actions copy-text="x" .controls=${['copy', 'regenerate', 'edit']}></lr-message-actions>`,
  )) as LyraMessageActions;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement).tabIndex).to.equal(0);

  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true }));
  await el.updateComplete;
  // lr-copy-button is a custom element, not a <button> -- roving tabindex bookkeeping only
  // toggles tabindex on this component's own plain buttons (see the class doc's Known limitation),
  // so it is never assigned tabindex 0 here even though Home moved the *logical* active stop to it.
  expect((el.shadowRoot!.querySelector('lr-copy-button') as HTMLElement).tabIndex).to.equal(-1);
  expect((el.shadowRoot!.querySelector('[part~="regenerate-button"]') as HTMLButtonElement).tabIndex).to.equal(-1);
});

it('slotted controls participate in arrow-key navigation', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['regenerate']}
      ><lr-branch-picker index="0" count="3"></lr-branch-picker
    ></lr-message-actions>`,
  )) as LyraMessageActions;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  const branchPicker = el.querySelector('lr-branch-picker')!;
  expect(branchPicker.shadowRoot!.activeElement).to.exist;
});

it('reveal-on-hover binds to the closest lr-chat-message ancestor', async () => {
  const host = document.createElement('div');
  host.innerHTML = '<lr-chat-message><lr-message-actions reveal-on-hover></lr-message-actions></lr-chat-message>';
  document.body.appendChild(host);
  try {
    const message = host.querySelector('lr-chat-message')!;
    const actions = host.querySelector('lr-message-actions') as LyraMessageActions;
    await actions.updateComplete;
    expect(actions.hasAttribute('data-revealed')).to.be.false;
    expect(getComputedStyle(actions).opacity).to.equal('0');
    message.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, composed: true }));
    await actions.updateComplete;
    expect(actions.hasAttribute('data-revealed')).to.be.true;
    // The opacity change is driven by a CSS transition (--lr-transition-fast); reading
    // getComputedStyle() immediately after the triggering DOM mutation observes a mid-transition
    // value rather than the settled end value (the same class of race app-rail.test.ts documents
    // for its own transitioned transform), so wait past the transition duration first.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(actions).opacity).to.equal('1');
    message.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, composed: true }));
    await actions.updateComplete;
    expect(actions.hasAttribute('data-revealed')).to.be.false;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(actions).opacity).to.equal('0');
  } finally {
    host.remove();
  }
});

it('gives the regenerate/edit built-in buttons the shared minimum hit area', async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${['regenerate', 'edit']}></lr-message-actions>`,
  )) as LyraMessageActions;
  const regenerate = el.shadowRoot!.querySelector('[part~="regenerate-button"]') as HTMLElement;
  const edit = el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLElement;

  expect(getComputedStyle(regenerate).minInlineSize).to.equal('40px');
  expect(getComputedStyle(regenerate).minBlockSize).to.equal('40px');
  expect(getComputedStyle(edit).minInlineSize).to.equal('40px');
  expect(getComputedStyle(edit).minBlockSize).to.equal('40px');
});

it('is accessible with every built-in enabled', async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hello"
      .controls=${['copy', 'regenerate', 'edit', 'feedback']}
    ></lr-message-actions>`,
  )) as LyraMessageActions;
  await expect(el).to.be.accessible();
});
