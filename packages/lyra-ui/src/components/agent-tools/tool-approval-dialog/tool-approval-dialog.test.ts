import { fixture, expect, oneEvent, html, waitUntil } from '@open-wc/testing';
import './tool-approval-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog.js';
import type { LyraJsonViewer } from '../../utility/json-viewer/json-viewer.js';
import type { LyraButton } from '../../forms/button/button.class.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const ARGS = { query: 'solar inverters', max_results: 5 };

function denyButton(el: LyraToolApprovalDialog): LyraButton {
  return el.shadowRoot!.querySelector('[part="deny-button"]') as LyraButton;
}
function editButton(el: LyraToolApprovalDialog): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="edit-button"]') as HTMLButtonElement;
}
function approveButton(el: LyraToolApprovalDialog): LyraButton {
  return el.shadowRoot!.querySelector('[part="approve-button"]') as LyraButton;
}
function textarea(el: LyraToolApprovalDialog): HTMLTextAreaElement {
  return el.shadowRoot!.querySelector('[part="args-editor"]') as HTMLTextAreaElement;
}
function setTextareaValue(el: LyraToolApprovalDialog, value: string): void {
  const ta = textarea(el);
  ta.value = value;
  ta.dispatchEvent(new Event('input'));
}
function assertiveSinkTexts(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > div`),
    (node) => node.textContent ?? '',
  );
}

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search"></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search"></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('h2')!.id);
});

it('keeps a host aria-label on the host while the dialog panel remains heading-labelled', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog open tool-name="web_search" aria-label="Custom approval name"></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;

  expect(el.getAttribute('aria-label')).to.equal('Custom approval name');
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('h2')!.id);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('h2')!.id);
});

it('falls back to aria-labelledby when no host aria-label is set', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog open tool-name="web_search"></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]')!;

  expect(panel.hasAttribute('aria-label')).to.equal(false);
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('h2')!.id);
});

it('renders the tool name in the heading, defaulting to a generic "tool" when unset', async () => {
  const withName = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search"></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  expect(withName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('web_search');
  expect(withName.shadowRoot!.querySelector('h2')!.textContent).to.equal('Approve web_search call?');
  // dir="auto" bidi-isolates only the arbitrary, consumer-supplied tool name (mirrors
  // file-input's [part="file-name"] and conversation-item's [part="label"] scoping this same
  // way) -- the heading element itself must NOT carry its own dir="auto", or its resolved
  // direction would be auto-detected from this locale's (English) chrome text and permanently
  // override the ambient RTL/LTR direction it should inherit; see the RTL test below.
  expect(withName.shadowRoot!.querySelector('h2')!.hasAttribute('dir')).to.be.false;
  expect(withName.shadowRoot!.querySelector('[part="tool-name"]')!.getAttribute('dir')).to.equal('auto');

  const withoutName = (await fixture(
    html`<lr-tool-approval-dialog></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  expect(withoutName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('tool');
});

it('mirrors the heading direction under RTL instead of freezing it to the auto-detected (English) content direction', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog dir="rtl" tool-name="web_search" open></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const heading = el.shadowRoot!.querySelector('h2') as HTMLElement;
  // The rest of the panel (footer/body) already mirrors correctly by inheriting `direction`
  // from the host's dir="rtl" -- the heading must do the same rather than resolving its own
  // direction from an unrelated dir="auto" scan of its (English) text content.
  expect(getComputedStyle(heading).direction).to.equal('rtl');
});

it('renders args read-only via lr-json-viewer by default', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as LyraJsonViewer;
  expect(viewer).to.exist;
  expect(viewer.data).to.deep.equal(ARGS);
  expect((el.shadowRoot!.querySelector('[part="args-editor"]')) == null).to.be.true;
});

it('renders slotted footer content alongside the built-in action buttons', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog><button slot="footer">Remember</button></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const slot = el.shadowRoot!.querySelector('slot[name="footer"]') as HTMLSlotElement;
  expect(slot.assignedElements().map((n) => n.textContent)).to.deep.equal(['Remember']);
});

describe('editing', () => {
  it('does not render an edit button when editable is false', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="delete_file" .editable=${false}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.shadowRoot!.querySelectorAll('[part="edit-button"]').length).to.equal(0);
  });

  it('honors the plain HTML attribute form editable="false" (not just a JS property binding)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="delete_file" editable="false"></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.editable).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="edit-button"]').length).to.equal(0);
  });

  it('defaults editable to true when the attribute is entirely absent', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="delete_file"></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.editable).to.be.true;
    expect(editButton(el).tagName).to.equal('BUTTON');
  });

  it('swaps to a textarea pre-filled with pretty-printed JSON when Edit is clicked', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="args-view"]')) == null).to.be.true;
    expect(textarea(el).value).to.equal(JSON.stringify(ARGS, null, 2));
    expect(editButton(el).textContent!.trim()).to.equal('Cancel');
  });

  it('falls back to editable JSON null when the proposed args are circular', async () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog tool-name="unsafe_args" .args=${circular}></lr-tool-approval-dialog>
    `);

    expect(() => editButton(el).click()).to.not.throw();
    await el.updateComplete;
    expect(textarea(el).value).to.equal('null');

    const approved = oneEvent(el, 'lr-approve');
    approveButton(el).click();
    expect((await approved).detail).to.deep.equal({ args: null });
  });

  it('shows an inline error and disables Approve when the textarea content is invalid JSON', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.hasAttribute('hidden')).to.be.false;
    expect(error.textContent!.length).to.be.greaterThan(0);
    expect(error.getAttribute('role')).to.equal(null);
    expect(approveButton(el).disabled).to.be.true;
    expect(textarea(el).getAttribute('aria-invalid')).to.equal('true');
  });

  it('retints only the invalid raw-JSON editor border through its component CSS property and restores the resting border', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.style.setProperty('--lr-tool-approval-dialog-invalid-border-color', 'rgb(10, 20, 30)');
    el.style.setProperty('--lr-color-border', 'rgb(40, 50, 60)');
    editButton(el).click();
    await el.updateComplete;

    expect(getComputedStyle(textarea(el)).borderColor).to.equal('rgb(40, 50, 60)');

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;
    expect(getComputedStyle(textarea(el)).borderColor).to.equal('rgb(10, 20, 30)');

    setTextareaValue(el, '{"query":"fixed"}');
    await el.updateComplete;
    expect(getComputedStyle(textarea(el)).borderColor).to.equal('rgb(40, 50, 60)');
  });

  it('themes the args-editor hover border through a component hook when no decision is pending', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        open
        tool-name="web_search"
        .args=${ARGS}
        style="--lr-tool-approval-dialog-hover-border-color: rgb(1, 2, 3)"
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    const ta = textarea(el);
    const rect = ta.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => ta.matches(':hover') && getComputedStyle(ta).borderTopColor === 'rgb(1, 2, 3)',
        'the args editor never painted its hovered border',
      );
      expect(getComputedStyle(ta).borderTopColor).to.equal('rgb(1, 2, 3)');
    } finally {
      await resetMouse();
    }
  });

  it('keeps the invalid editor border semantic tone while the real pointer hovers it', async () => {
    const el = (await fixture(html`
      <lr-tool-approval-dialog
        open
        tool-name="web_search"
        .args=${ARGS}
        style="
          --lr-tool-approval-dialog-hover-border-color: rgb(1, 2, 3);
          --lr-tool-approval-dialog-invalid-border-color: rgb(10, 20, 30);
        "
      ></lr-tool-approval-dialog>
    `)) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;

    const ta = textarea(el);
    const rect = ta.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => ta.matches(':hover') && getComputedStyle(ta).borderTopColor === 'rgb(10, 20, 30)',
        'the hovered invalid editor never retained its semantic border',
      );
      expect(getComputedStyle(ta).borderTopColor).to.equal('rgb(10, 20, 30)');
    } finally {
      await resetMouse();
    }
  });

  it('keeps the disabled Edit button visually disabled during pending hover and active pointer states', async () => {
    const el = (await fixture(html`
      <lr-tool-approval-dialog
        open
        tool-name="web_search"
        .args=${ARGS}
        style="--lr-color-surface: rgb(40, 50, 60); --lr-color-brand-quiet: rgb(1, 2, 3)"
      ></lr-tool-approval-dialog>
    `)) as LyraToolApprovalDialog;
    el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
    approveButton(el).click();
    await el.updateComplete;
    const edit = editButton(el);
    expect(edit.disabled).to.be.true;
    const rect = edit.getBoundingClientRect();

    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(edit).backgroundColor).to.equal('rgb(40, 50, 60)');
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(edit).backgroundColor === 'rgb(40, 50, 60)', 'edit background color never reached rgb(40, 50, 60)');
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('does not apply the args-editor hover border tint while a decision is pending (gated on pending, not disabled)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        open
        tool-name="web_search"
        .args=${ARGS}
        style="--lr-tool-approval-dialog-hover-border-color: rgb(1, 2, 3); --lr-color-border: rgb(40, 50, 60)"
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
    approveButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approve');

    const ta = textarea(el);
    const rect = ta.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(ta).borderTopColor).to.equal('rgb(40, 50, 60)');
    } finally {
      await resetMouse();
    }
  });

  it('announces each newly invalid edit once through the shared assertive light-DOM sink', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(assertiveSinkTexts(), 'mounting does not announce an error').to.deep.equal([]);
    editButton(el).click();
    await el.updateComplete;

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;
    expect(assertiveSinkTexts()).to.deep.equal(['Invalid JSON.']);

    setTextareaValue(el, '{ still invalid');
    await el.updateComplete;
    expect(assertiveSinkTexts(), 'typing within one invalid spell stays quiet').to.deep.equal(['Invalid JSON.']);

    setTextareaValue(el, '{"valid":true}');
    await el.updateComplete;
    setTextareaValue(el, '{ invalid again');
    await el.updateComplete;
    expect(assertiveSinkTexts()).to.deep.equal(['Invalid JSON.', 'Invalid JSON.']);

    el.remove();
    expect(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`).length).to.equal(0);
  });

  it('treats an invalid edit queued while detached as a silent reconnect baseline', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    const parent = el.parentNode!;

    el.remove();
    setTextareaValue(el, '{ invalid while detached');
    parent.appendChild(el);
    await el.updateComplete;
    expect(assertiveSinkTexts(), 'the detached error is resting content on reconnect').to.deep.equal([]);

    setTextareaValue(el, '{"valid":true}');
    await el.updateComplete;
    setTextareaValue(el, '{ invalid after reconnect');
    await el.updateComplete;
    expect(assertiveSinkTexts(), 'the next connected invalid transition still announces').to.deep.equal([
      'Invalid JSON.',
    ]);
  });

  it('clears the error and re-enables Approve once the textarea content becomes valid JSON again', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;
    expect(approveButton(el).disabled).to.be.true;

    setTextareaValue(el, '{"query": "fixed"}');
    await el.updateComplete;

    expect(approveButton(el).disabled).to.be.false;
    expect((el.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
  });

  it('reverts to the original args and the read-only view when Cancel is clicked', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query": "changed", "max_results": 1}');
    await el.updateComplete;

    editButton(el).click();
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="args-editor"]')) == null).to.be.true;
    const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as LyraJsonViewer;
    expect(viewer.data).to.deep.equal(ARGS);
    expect(editButton(el).textContent!.trim()).to.equal('Edit');
  });

  it('disables spellcheck, autocapitalize, and autocorrect on the raw-JSON textarea (JSON is never prose)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    const ta = textarea(el);
    expect(ta.getAttribute('spellcheck')).to.equal('false');
    expect(ta.getAttribute('autocapitalize')).to.equal('off');
    expect(ta.getAttribute('autocorrect')).to.equal('off');
  });

  it('forwards configurable native editing properties to the raw-JSON textarea', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        .spellcheck=${true}
        autocapitalize="sentences"
        autocorrect="on"
        autocomplete="off"
        wrap="hard"
        inputmode="text"
        enterkeyhint="done"
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    const ta = textarea(el);
    expect(ta.getAttribute('spellcheck')).to.equal('true');
    expect(ta.getAttribute('autocapitalize')).to.equal('sentences');
    expect(ta.getAttribute('autocorrect')).to.equal('on');
    expect(ta.getAttribute('autocomplete')).to.equal('off');
    expect(ta.getAttribute('wrap')).to.equal('hard');
    expect(ta.getAttribute('inputmode')).to.equal('text');
    expect(ta.getAttribute('enterkeyhint')).to.equal('done');
  });

  it('resets an in-progress edit back to the read-only view every time the dialog re-opens', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{ still typing');
    await el.updateComplete;

    el.close('api');
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="args-editor"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="args-view"]')).to.exist;
    expect(approveButton(el).disabled).to.be.false;
  });

  it('resets a stale draft and pending action when an open proposal is replaced', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog
        open
        proposal-key="run-a:call-1"
        tool-name="web_search"
        .args=${ARGS}
      ></lr-tool-approval-dialog>
    `);
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query":"stale edit"}');
    el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
    approveButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approve');

    el.toolName = 'read_file';
    el.args = { path: 'replacement.md' };
    await el.updateComplete;

    expect(el.pending).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="args-editor"]') === null).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="args-view"]') as LyraJsonViewer).data).to.deep.equal({
      path: 'replacement.md',
    });
  });

  it('uses proposal-key to reset open state even when the visible proposal fields are reused', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog
        open
        proposal-key="run-a:call-1"
        tool-name="web_search"
        .args=${ARGS}
      ></lr-tool-approval-dialog>
    `);
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query":"stale edit"}');

    el.proposalKey = 'run-b:call-1';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="args-editor"]') === null).to.be.true;
    expect(el.pending).to.equal(null);
  });
});

describe('approve/deny', () => {
  it('emits lr-approve with the original args, then lr-close with reason "approve", when not editing', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const approveListener = oneEvent(el, 'lr-approve');
    const closeListener = oneEvent(el, 'lr-close');
    approveButton(el).click();

    const approveEvent = await approveListener;
    const closeEvent = await closeListener;

    expect(approveEvent.detail).to.deep.equal({ args: ARGS });
    expect(closeEvent.detail).to.equal('approve');
    expect(el.open).to.be.false;
  });

  it('emits lr-approve with the parsed, edited args when approved mid-edit', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query": "edited", "max_results": 1}');
    await el.updateComplete;

    const listener = oneEvent(el, 'lr-approve');
    approveButton(el).click();
    const { detail } = await listener;

    expect(detail).to.deep.equal({ args: { query: 'edited', max_results: 1 } });
  });

  it('emits lr-deny, then lr-close with reason "deny"', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const denyListener = oneEvent(el, 'lr-deny');
    const closeListener = oneEvent(el, 'lr-close');
    denyButton(el).click();

    const denyEvent = await denyListener;
    const closeEvent = await closeListener;

    // CustomEventInit's `detail` member defaults to `null`, not `undefined`,
    // per the DOM spec -- this.emit('lr-deny') passes no second argument,
    // which is equivalent to an absent `detail` option.
    expect(denyEvent.detail).to.be.null;
    expect(closeEvent.detail).to.equal('deny');
    expect(el.open).to.be.false;
  });
});

describe('dismissal', () => {
  it('offers consistent show() and hide() lifecycle methods', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog></lr-tool-approval-dialog>
    `);
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;

    const closed = oneEvent(el, 'lr-close');
    el.hide();
    expect((await closed).detail).to.equal('api');
    expect(el.open).to.be.false;
  });

  it('does not light-dismiss on a backdrop click unless explicitly enabled', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog open></lr-tool-approval-dialog>
    `);
    const reasons: string[] = [];
    el.addEventListener('lr-close', (event) => reasons.push(event.detail));
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    await el.updateComplete;

    expect(el.lightDismiss).to.be.false;
    expect(el.open).to.be.true;
    expect(reasons).to.deep.equal([]);
  });

  it('closes on backdrop click with reason "backdrop" when light dismissal is enabled', async () => {
    const el = await fixture<LyraToolApprovalDialog>(html`
      <lr-tool-approval-dialog open light-dismiss></lr-tool-approval-dialog>
    `);
    const listener = oneEvent(el, 'lr-close');
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('backdrop');
  });

  it('closes on Escape and emits lr-close with reason "escape"', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const listener = oneEvent(el, 'lr-close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('escape');
  });

  it('does not respond to Escape while closed', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    let fired = false;
    el.addEventListener('lr-close', () => (fired = true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;

    expect(fired).to.be.false;
  });

  it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    let count = 0;
    el.addEventListener('lr-close', () => count++);

    el.close('api');
    el.close('api');
    await el.updateComplete;

    expect(count).to.equal(0);
  });
});

describe('focus management', () => {
  it('moves focus to the Deny button (not Approve) when opened', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.open = true;
    await el.updateComplete;

    expect((el.shadowRoot!.activeElement) === (denyButton(el))).to.equal(true);
  });

  it('moves focus into the textarea when Edit is clicked', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    expect((el.shadowRoot!.activeElement) === (textarea(el))).to.equal(true);
  });

  it('bridges editor focus and blur as bubbling, composed host events', async () => {
    const el = (await fixture(html`
      <lr-tool-approval-dialog open tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>
    `)) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    const editor = textarea(el);
    editor.blur();

    const focusPromise = oneEvent(el, 'focus');
    editor.focus();
    const focusEvent = await focusPromise;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurPromise = oneEvent(el, 'blur');
    editor.blur();
    const blurEvent = await blurPromise;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;
  });

  it('refocuses the Deny button (keeping the trap engaged) when editable is turned off while the textarea has focus', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement) === (textarea(el))).to.equal(true);

    el.editable = false;
    await el.updateComplete;

    // Focus lands back on Deny instead of falling through to <body> -- see
    // updated()'s editing-turned-off branch.
    expect((el.shadowRoot!.activeElement) === (denyButton(el))).to.equal(true);

    // And the trap as a whole is still fully engaged afterwards: Tab from
    // the last focusable element still wraps back to the first. That would
    // not hold if focus had silently fallen through to <body> instead --
    // <body> matches neither the trap's first nor last element, so the
    // keydown handler would never call preventDefault at all and a real Tab
    // press would escape the panel entirely.
    approveButton(el).focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
  });

  it('returns focus to the element that was focused before the dialog opened', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open';
    document.body.appendChild(trigger);
    trigger.focus();

    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.open = true;
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement) === (denyButton(el))).to.equal(true);

    el.close('api');
    await el.updateComplete;
    expect((document.activeElement) === (trigger)).to.equal(true);

    trigger.remove();
  });

  it('traps Tab focus inside the panel, wrapping last->first and first->last, excluding a disabled Approve', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;
    expect(approveButton(el).disabled).to.be.true;

    const last = editButton(el); // Approve is disabled and therefore excluded from the trap
    last.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    expect((el.shadowRoot!.activeElement) === (textarea(el))).to.equal(true);

    const tabBackward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect((el.shadowRoot!.activeElement) === (last)).to.equal(true);
  });

  it('includes the Approve button in the trap once its content is valid JSON again', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    // The freshly-stringified original args are always valid JSON, so Approve starts enabled.
    expect(approveButton(el).disabled).to.be.false;

    approveButton(el).focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    // Approve is the last focusable element while editing, so forward-Tab from it wraps to the first (the textarea).
    expect((el.shadowRoot!.activeElement) === (textarea(el))).to.equal(true);
  });

  it('traps Tab/Shift+Tab at the json-viewer body content, whose real focusable target lives in its own shadow root', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as HTMLElement;
    const rootToggle = viewer.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;

    rootToggle.focus();
    const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    // The json-viewer's own toggle button is the first focusable element in the panel, so Shift+Tab from it wraps to the last (Approve).
    expect((el.shadowRoot!.activeElement) === (approveButton(el))).to.equal(true);

    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    // `el.shadowRoot.activeElement` does not drill into a further-nested shadow
    // root -- per spec it reports the *host* of the nested tree containing the
    // real focus target (`viewer`), not `rootToggle` itself, even though the
    // component's own getActiveElement() (used for the actual Tab-trap logic)
    // does drill all the way down.
    expect((el.shadowRoot!.activeElement) === (viewer)).to.equal(true);
  });
});

describe('scroll lock', () => {
  it('locks document scroll while open and releases it on close', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.open = true;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.close('api');
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('releases the scroll lock on disconnect while open', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.remove();

    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('restores the scroll lock and keydown trap when reparented while still open', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    const otherContainer = document.createElement('div');
    document.body.appendChild(otherContainer);
    otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously
    expect(el.open).to.be.true;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(document.documentElement.style.overflow).to.equal('');

    otherContainer.remove();
  });
});

describe('localization', () => {
  it('defaults the heading, generic tool-name fallback, and args-editor label to English', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.shadowRoot!.querySelector('h2')!.textContent!.trim()).to.equal('Approve tool call?');

    editButton(el).click();
    await el.updateComplete;
    expect(textarea(el).getAttribute('aria-label')).to.equal('Tool call arguments (JSON)');
  });

  it('localizes the heading and generic tool-name fallback via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ toolApprovalHeading: 'Approuver l’appel {tool} ?', toolApprovalGenericTool: 'outil' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const heading = el.shadowRoot!.querySelector('h2')!;
    expect(heading.textContent!.trim()).to.equal('Approuver l’appel outil ?');
    expect(heading.querySelector('[part="tool-name"]')!.textContent).to.equal('outil');
  });

  it('renders repeated heading placeholders and does not append a tool omitted by the translation', async () => {
    const repeated = (await fixture(html`
      <lr-tool-approval-dialog
        tool-name="search"
        .strings=${{ toolApprovalHeading: '{tool} then {tool}?' }}
      ></lr-tool-approval-dialog>
    `)) as LyraToolApprovalDialog;
    const repeatedHeading = repeated.shadowRoot!.querySelector('h2')!;
    expect(repeatedHeading.textContent!.trim()).to.equal('search then search?');
    expect(repeatedHeading.querySelectorAll('[part="tool-name"]')).to.have.length(2);

    const omitted = (await fixture(html`
      <lr-tool-approval-dialog
        tool-name="search"
        .strings=${{ toolApprovalHeading: 'Proceed?' }}
      ></lr-tool-approval-dialog>
    `)) as LyraToolApprovalDialog;
    const omittedHeading = omitted.shadowRoot!.querySelector('h2')!;
    expect(omittedHeading.textContent!.trim()).to.equal('Proceed?');
    expect(omittedHeading.querySelector('[part="tool-name"]') === null).to.be.true;
  });

  it('does not use the generic tool-name fallback once tool-name is set', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        tool-name="web_search"
        .args=${ARGS}
        open
        .strings=${{ toolApprovalGenericTool: 'outil' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('web_search');
  });

  it('localizes the args-editor aria-label via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ toolApprovalArgsLabel: 'Arguments de l’appel (JSON)' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    expect(textarea(el).getAttribute('aria-label')).to.equal('Arguments de l’appel (JSON)');
  });

  it('defaults the Deny/Edit/Approve button labels to English', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(denyButton(el).textContent!.trim()).to.equal('Deny');
    expect(editButton(el).textContent!.trim()).to.equal('Edit');
    expect(approveButton(el).textContent!.trim()).to.equal('Approve');
  });

  it('localizes the Deny/Approve button labels via this.localize()', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ deny: 'Refuser', approve: 'Approuver' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(denyButton(el).textContent!.trim()).to.equal('Refuser');
    expect(approveButton(el).textContent!.trim()).to.equal('Approuver');
  });

  it('localizes the Edit/Cancel toggle button label via this.localize(), reusing the shared "cancel" key while editing', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ edit: 'Modifier', cancel: 'Annuler' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(editButton(el).textContent!.trim()).to.equal('Modifier');

    editButton(el).click();
    await el.updateComplete;
    expect(editButton(el).textContent!.trim()).to.equal('Annuler');
  });

  it('localizes the invalid-JSON error message via this.localize() instead of rendering the raw engine SyntaxError', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ invalidJson: 'JSON invalide.' }}
      ></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    // A real, ordinary invalid-JSON edit -- JSON.parse always throws a real
    // SyntaxError for this, and the browser-engine-specific raw message
    // (e.g. V8's "Unexpected token } in JSON at position 42") must never
    // reach the DOM; only the localized string should.
    setTextareaValue(el, '{ anything }');
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal('JSON invalide.');
  });

  it('shows the default English localized invalid-JSON message (not a raw engine SyntaxError) when no locale is registered', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal('Invalid JSON.');
  });
});

describe('deny/approve as lr-button', () => {
  it('renders Deny/Approve as lr-button with variant="neutral"/"brand" (no tone property on this component)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const deny = denyButton(el);
    const approve = approveButton(el);
    expect(deny.tagName.toLowerCase()).to.equal('lr-button');
    expect(approve.tagName.toLowerCase()).to.equal('lr-button');
    expect(deny.variant).to.equal('neutral');
    expect(approve.variant).to.equal('brand');
  });

  it('matches the pre-swap Deny/Approve colors via lr-button computed styles (visual-parity regression guard)', async () => {
    const toRgb = (color: string) => {
      const probe = document.createElement('span');
      probe.style.color = color;
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const resolve = (token: string) => getComputedStyle(el).getPropertyValue(token).trim();
    const denyBase = denyButton(el).shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const approveBase = approveButton(el).shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    // Deny is variant="neutral" appearance="outlined": no fill, so it recedes against the dialog
    // panel, with --lr-color-text for the label. Declared on the button, not inherited -- when
    // lr-button's default appearance became "accent" in 8.0.0, inheriting it would have turned the
    // SAFE action into the loud one.
    expect(getComputedStyle(denyBase).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(denyBase).color).to.equal(toRgb(resolve('--lr-color-text')));
    expect(getComputedStyle(approveBase).backgroundColor).to.equal(toRgb(resolve('--lr-color-brand')));
    expect(getComputedStyle(approveBase).color).to.equal(toRgb(resolve('--lr-color-on-brand')));
  });

  it('exposes the internal lr-button parts to a consumer through exportparts', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-tool-approval-dialog.consumer-probe::part(deny-button-base) { letter-spacing: 3px; }
      lr-tool-approval-dialog.consumer-probe::part(approve-button-base) { letter-spacing: 5px; }
    `;
    document.head.append(sheet);
    try {
      const el = (await fixture(
        html`<lr-tool-approval-dialog class="consumer-probe" tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
      )) as LyraToolApprovalDialog;
      const deny = denyButton(el);
      const approve = approveButton(el);
      expect(deny.getAttribute('exportparts')).to.include('button:deny-button-base');
      expect(approve.getAttribute('exportparts')).to.include('button:approve-button-base');
      deny.setAttribute('exportparts', 'button:deny-button-base');
      approve.setAttribute('exportparts', 'button:approve-button-base');
      const denyBase = deny.shadowRoot!.querySelector('[part~="button"]') as HTMLElement;
      const approveBase = approve.shadowRoot!.querySelector('[part~="button"]') as HTMLElement;
      expect(getComputedStyle(denyBase).letterSpacing).to.equal('3px');
      expect(getComputedStyle(approveBase).letterSpacing).to.equal('5px');
    } finally {
      sheet.remove();
    }
  });
});

describe('async pending decisions', () => {
  it('freezes the editor and Edit/Cancel affordance while a decision is pending', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog open tool-name="search" .args=${{ q: 'one' }}></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    el.addEventListener('lr-approve', (event) => event.preventDefault(), { once: true });
    approveButton(el).click();
    await el.updateComplete;
    expect(textarea(el).readOnly).to.be.true;
    expect(editButton(el).disabled).to.be.true;
  });
  it('lr-approve/lr-deny are cancelable; preventDefault() sets pending instead of closing', async () => {
    const approveEl = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    approveEl.addEventListener('lr-approve', (e) => e.preventDefault());
    let approveClosed = false;
    approveEl.addEventListener('lr-close', () => (approveClosed = true));
    approveButton(approveEl).click();
    await approveEl.updateComplete;
    expect(approveEl.pending).to.equal('approve');
    expect(approveEl.hasAttribute('pending')).to.be.true;
    expect(approveEl.open).to.be.true;
    expect(approveClosed).to.be.false;

    const denyEl = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" open light-dismiss></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    denyEl.addEventListener('lr-deny', (e) => e.preventDefault());
    let denyClosed = false;
    denyEl.addEventListener('lr-close', () => (denyClosed = true));
    denyButton(denyEl).click();
    await denyEl.updateComplete;
    expect(denyEl.pending).to.equal('deny');
    expect(denyEl.open).to.be.true;
    expect(denyClosed).to.be.false;
  });

  it('shows loading on the pending button and disables the other one', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    approveButton(el).click();
    await el.updateComplete;
    expect(approveButton(el).loading).to.be.true;
    expect(approveButton(el).disabled).to.be.false;
    expect(denyButton(el).loading).to.be.false;
    expect(denyButton(el).disabled).to.be.true;
  });

  it('finalizes normally when the host calls close("approve") after preventDefault()', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    approveButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('approve');

    const closeListener = oneEvent(el, 'lr-close');
    el.close('approve');
    const { detail } = await closeListener;
    expect(detail).to.equal('approve');
    expect(el.open).to.be.false;
  });

  it('bounces back to the undecided, both-buttons-enabled state when pending is reset to null', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-deny', (e) => e.preventDefault());
    denyButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('deny');

    el.pending = null;
    await el.updateComplete;
    expect(denyButton(el).loading).to.be.false;
    expect(denyButton(el).disabled).to.be.false;
    expect(approveButton(el).loading).to.be.false;
    expect(approveButton(el).disabled).to.be.false;
    expect(el.open).to.be.true;
  });

  it('suppresses Escape/backdrop dismissal while pending, and restores it once pending clears', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-deny', (e) => e.preventDefault());
    denyButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('deny');

    let closed = false;
    el.addEventListener('lr-close', () => (closed = true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(closed).to.be.false;
    expect(el.open).to.be.true;

    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    await el.updateComplete;
    expect(closed).to.be.false;
    expect(el.open).to.be.true;

    el.pending = null;
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(closed).to.be.true;
    expect(el.open).to.be.false;
  });

  it('resets a stuck pending state back to null every time the dialog re-opens', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-deny', (e) => e.preventDefault());
    denyButton(el).click();
    await el.updateComplete;
    expect(el.pending).to.equal('deny');

    el.close('api'); // host abandons without ever resolving the pending decision
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    expect(el.pending).to.equal(null);
    expect(denyButton(el).loading).to.be.false;
  });

  it('defaults pending to null and leaves the synchronous approve/deny path unchanged when never touched', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.pending).to.equal(null);
    expect(el.hasAttribute('pending')).to.be.false;
    const approveListener = oneEvent(el, 'lr-approve');
    const closeListener = oneEvent(el, 'lr-close');
    approveButton(el).click();
    await approveListener;
    const { detail } = await closeListener;
    expect(detail).to.equal('approve');
    expect(el.pending).to.equal(null);
  });

  it('is accessible while a decision is pending (loading + disabled lr-button still expose a valid name/state)', async () => {
    const el = (await fixture(
      html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.addEventListener('lr-approve', (e) => e.preventDefault());
    approveButton(el).click();
    await el.updateComplete;
    // Prove the pending state actually landed before checking accessibility -- otherwise this
    // would pass vacuously against the ordinary undecided render.
    expect(el.pending).to.equal('approve');
    expect(approveButton(el).loading).to.be.true;
    await expect(el).to.be.accessible();
  });
});

it('is accessible while closed', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open in the read-only view', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open and editing, including with an invalid-JSON error shown', async () => {
  const el = (await fixture(
    html`<lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  editButton(el).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();

  setTextareaValue(el, '{ not valid json');
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders the disabled edit action with the shared disabled opacity token', async () => {
  const el = (await fixture(html`
    <lr-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lr-tool-approval-dialog>
  `)) as LyraToolApprovalDialog;
  const edit = editButton(el);
  edit.disabled = true;
  await el.updateComplete;
  const expected = getComputedStyle(el).getPropertyValue('--lr-opacity-disabled').trim();
  expect(getComputedStyle(edit).opacity).to.equal(expected);
  expect(getComputedStyle(edit).opacity).not.to.equal('1');
});
