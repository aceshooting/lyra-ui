import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './tool-approval-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog.js';
import type { LyraJsonViewer } from '../json-viewer/json-viewer.js';

const ARGS = { query: 'solar inverters', max_results: 5 };

function denyButton(el: LyraToolApprovalDialog): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="deny-button"]') as HTMLButtonElement;
}
function editButton(el: LyraToolApprovalDialog): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="edit-button"]') as HTMLButtonElement;
}
function approveButton(el: LyraToolApprovalDialog): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="approve-button"]') as HTMLButtonElement;
}
function textarea(el: LyraToolApprovalDialog): HTMLTextAreaElement {
  return el.shadowRoot!.querySelector('[part="args-editor"]') as HTMLTextAreaElement;
}
function setTextareaValue(el: LyraToolApprovalDialog, value: string): void {
  const ta = textarea(el);
  ta.value = value;
  ta.dispatchEvent(new Event('input'));
}

it('renders closed by default, with no role/aria-modal on the panel', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search"></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(panel.hasAttribute('role')).to.be.false;
  expect(panel.hasAttribute('aria-modal')).to.be.false;
});

it('reflects open as an attribute and sets dialog semantics once open', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search"></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  el.open = true;
  await el.updateComplete;

  expect(el.hasAttribute('open')).to.be.true;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('role')).to.equal('dialog');
  expect(panel.getAttribute('aria-modal')).to.equal('true');
  expect(panel.getAttribute('aria-labelledby')).to.equal(el.shadowRoot!.querySelector('h2')!.id);
});

it('renders the tool name in the heading, defaulting to a generic "tool" when unset', async () => {
  const withName = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search"></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  expect(withName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('web_search');
  expect(withName.shadowRoot!.querySelector('h2')!.textContent).to.equal('Approve web_search call?');

  const withoutName = (await fixture(
    html`<lyra-tool-approval-dialog></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  expect(withoutName.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('tool');
});

it('renders args read-only via lyra-json-viewer by default', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as LyraJsonViewer;
  expect(viewer).to.exist;
  expect(viewer.data).to.deep.equal(ARGS);
  expect(el.shadowRoot!.querySelector('[part="args-editor"]')).to.not.exist;
});

it('renders slotted footer content alongside the built-in action buttons', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog><button slot="footer">Remember</button></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  const slot = el.shadowRoot!.querySelector('slot[name="footer"]') as HTMLSlotElement;
  expect(slot.assignedElements().map((n) => n.textContent)).to.deep.equal(['Remember']);
});

describe('editing', () => {
  it('does not render an edit button when editable is false', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="delete_file" .editable=${false}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(editButton(el)).to.not.exist;
  });

  it('swaps to a textarea pre-filled with pretty-printed JSON when Edit is clicked', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="args-view"]')).to.not.exist;
    expect(textarea(el).value).to.equal(JSON.stringify(ARGS, null, 2));
    expect(editButton(el).textContent!.trim()).to.equal('Cancel');
  });

  it('shows an inline error and disables Approve when the textarea content is invalid JSON', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    setTextareaValue(el, '{ not valid json');
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.hasAttribute('hidden')).to.be.false;
    expect(error.textContent!.length).to.be.greaterThan(0);
    expect(approveButton(el).disabled).to.be.true;
    expect(textarea(el).getAttribute('aria-invalid')).to.equal('true');
  });

  it('clears the error and re-enables Approve once the textarea content becomes valid JSON again', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
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
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query": "changed", "max_results": 1}');
    await el.updateComplete;

    editButton(el).click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="args-editor"]')).to.not.exist;
    const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as LyraJsonViewer;
    expect(viewer.data).to.deep.equal(ARGS);
    expect(editButton(el).textContent!.trim()).to.equal('Edit');
  });

  it('disables spellcheck, autocapitalize, and autocorrect on the raw-JSON textarea (JSON is never prose)', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    const ta = textarea(el);
    expect(ta.getAttribute('spellcheck')).to.equal('false');
    expect(ta.getAttribute('autocapitalize')).to.equal('off');
    expect(ta.getAttribute('autocorrect')).to.equal('off');
  });

  it('resets an in-progress edit back to the read-only view every time the dialog re-opens', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{ still typing');
    await el.updateComplete;

    el.close('api');
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="args-editor"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="args-view"]')).to.exist;
    expect(approveButton(el).disabled).to.be.false;
  });
});

describe('approve/deny', () => {
  it('emits lyra-approve with the original args, then lyra-close with reason "approve", when not editing', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const approveListener = oneEvent(el, 'lyra-approve');
    const closeListener = oneEvent(el, 'lyra-close');
    approveButton(el).click();

    const approveEvent = await approveListener;
    const closeEvent = await closeListener;

    expect(approveEvent.detail).to.deep.equal({ args: ARGS });
    expect(closeEvent.detail).to.equal('approve');
    expect(el.open).to.be.false;
  });

  it('emits lyra-approve with the parsed, edited args when approved mid-edit', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    setTextareaValue(el, '{"query": "edited", "max_results": 1}');
    await el.updateComplete;

    const listener = oneEvent(el, 'lyra-approve');
    approveButton(el).click();
    const { detail } = await listener;

    expect(detail).to.deep.equal({ args: { query: 'edited', max_results: 1 } });
  });

  it('emits lyra-deny, then lyra-close with reason "deny"', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const denyListener = oneEvent(el, 'lyra-deny');
    const closeListener = oneEvent(el, 'lyra-close');
    denyButton(el).click();

    const denyEvent = await denyListener;
    const closeEvent = await closeListener;

    // CustomEventInit's `detail` member defaults to `null`, not `undefined`,
    // per the DOM spec -- this.emit('lyra-deny') passes no second argument,
    // which is equivalent to an absent `detail` option.
    expect(denyEvent.detail).to.be.null;
    expect(closeEvent.detail).to.equal('deny');
    expect(el.open).to.be.false;
  });
});

describe('dismissal', () => {
  it('closes on backdrop click and emits lyra-close with reason "backdrop"', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const listener = oneEvent(el, 'lyra-close');
    (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('backdrop');
  });

  it('closes on Escape and emits lyra-close with reason "escape"', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const listener = oneEvent(el, 'lyra-close');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const { detail } = await listener;

    expect(el.open).to.be.false;
    expect(detail).to.equal('escape');
  });

  it('does not respond to Escape while closed', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    let fired = false;
    el.addEventListener('lyra-close', () => (fired = true));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;

    expect(fired).to.be.false;
  });

  it('close() is a no-op when already closed (no duplicate event, no error)', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    let count = 0;
    el.addEventListener('lyra-close', () => count++);

    el.close('api');
    el.close('api');
    await el.updateComplete;

    expect(count).to.equal(0);
  });
});

describe('focus management', () => {
  it('moves focus to the Deny button (not Approve) when opened', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.open = true;
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement).to.equal(denyButton(el));
  });

  it('moves focus into the textarea when Edit is clicked', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement).to.equal(textarea(el));
  });

  it('refocuses the Deny button (keeping the trap engaged) when editable is turned off while the textarea has focus', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(textarea(el));

    el.editable = false;
    await el.updateComplete;

    // Focus lands back on Deny instead of falling through to <body> -- see
    // updated()'s editing-turned-off branch.
    expect(el.shadowRoot!.activeElement).to.equal(denyButton(el));

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
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    el.open = true;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement).to.equal(denyButton(el));

    el.close('api');
    await el.updateComplete;
    expect(document.activeElement).to.equal(trigger);

    trigger.remove();
  });

  it('traps Tab focus inside the panel, wrapping last->first and first->last, excluding a disabled Approve', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
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
    expect(el.shadowRoot!.activeElement).to.equal(textarea(el));

    const tabBackward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement).to.equal(last);
  });

  it('includes the Approve button in the trap once its content is valid JSON again', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
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
    expect(el.shadowRoot!.activeElement).to.equal(textarea(el));
  });

  it('traps Tab/Shift+Tab at the json-viewer body content, whose real focusable target lives in its own shadow root', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const viewer = el.shadowRoot!.querySelector('[part="args-view"]') as HTMLElement;
    const rootToggle = viewer.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;

    rootToggle.focus();
    const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).to.be.true;
    // The json-viewer's own toggle button is the first focusable element in the panel, so Shift+Tab from it wraps to the last (Approve).
    expect(el.shadowRoot!.activeElement).to.equal(approveButton(el));

    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).to.be.true;
    // `el.shadowRoot.activeElement` does not drill into a further-nested shadow
    // root -- per spec it reports the *host* of the nested tree containing the
    // real focus target (`viewer`), not `rootToggle` itself, even though the
    // component's own getActiveElement() (used for the actual Tab-trap logic)
    // does drill all the way down.
    expect(el.shadowRoot!.activeElement).to.equal(viewer);
  });
});

describe('scroll lock', () => {
  it('locks document scroll while open and releases it on close', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog></lyra-tool-approval-dialog>`,
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
      html`<lyra-tool-approval-dialog open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    await el.updateComplete;
    expect(document.documentElement.style.overflow).to.equal('hidden');

    el.remove();

    expect(document.documentElement.style.overflow).to.equal('');
  });

  it('restores the scroll lock and keydown trap when reparented while still open', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog open></lyra-tool-approval-dialog>`,
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
      html`<lyra-tool-approval-dialog .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.shadowRoot!.querySelector('h2')!.textContent!.trim()).to.equal('Approve tool call?');

    editButton(el).click();
    await el.updateComplete;
    expect(textarea(el).getAttribute('aria-label')).to.equal('Tool call arguments (JSON)');
  });

  it('localizes the heading and generic tool-name fallback via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ toolApprovalHeading: 'Approuver l’appel {tool} ?', toolApprovalGenericTool: 'outil' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    const heading = el.shadowRoot!.querySelector('h2')!;
    expect(heading.textContent!.trim()).to.equal('Approuver l’appel outil ?');
    expect(heading.querySelector('[part="tool-name"]')!.textContent).to.equal('outil');
  });

  it('does not use the generic tool-name fallback once tool-name is set', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        tool-name="web_search"
        .args=${ARGS}
        open
        .strings=${{ toolApprovalGenericTool: 'outil' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(el.shadowRoot!.querySelector('[part="tool-name"]')!.textContent).to.equal('web_search');
  });

  it('localizes the args-editor aria-label via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ toolApprovalArgsLabel: 'Arguments de l’appel (JSON)' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;
    expect(textarea(el).getAttribute('aria-label')).to.equal('Arguments de l’appel (JSON)');
  });

  it('defaults the Deny/Edit/Approve button labels to English', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog .args=${ARGS} open></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(denyButton(el).textContent!.trim()).to.equal('Deny');
    expect(editButton(el).textContent!.trim()).to.equal('Edit');
    expect(approveButton(el).textContent!.trim()).to.equal('Approve');
  });

  it('localizes the Deny/Approve button labels via this.localize()', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ deny: 'Refuser', approve: 'Approuver' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(denyButton(el).textContent!.trim()).to.equal('Refuser');
    expect(approveButton(el).textContent!.trim()).to.equal('Approuver');
  });

  it('localizes the Edit/Cancel toggle button label via this.localize(), reusing the shared "cancel" key while editing', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ edit: 'Modifier', cancel: 'Annuler' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    expect(editButton(el).textContent!.trim()).to.equal('Modifier');

    editButton(el).click();
    await el.updateComplete;
    expect(editButton(el).textContent!.trim()).to.equal('Annuler');
  });

  it('localizes the invalid-JSON fallback error message via this.localize() when the caught error has no message', async () => {
    const el = (await fixture(
      html`<lyra-tool-approval-dialog
        .args=${ARGS}
        open
        .strings=${{ invalidJson: 'JSON invalide.' }}
      ></lyra-tool-approval-dialog>`,
    )) as LyraToolApprovalDialog;
    editButton(el).click();
    await el.updateComplete;

    // JSON.parse always throws a real Error with a non-empty message, so the
    // this.localize('invalidJson') fallback branch is otherwise unreachable
    // through normal input -- stub JSON.parse for this one assertion to
    // exercise the `err instanceof Error` false branch directly.
    const originalParse = JSON.parse;
    JSON.parse = () => {
      // eslint-disable-next-line no-throw-literal
      throw 'not an Error instance';
    };
    try {
      setTextareaValue(el, '{ anything }');
      await el.updateComplete;
    } finally {
      JSON.parse = originalParse;
    }

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal('JSON invalide.');
  });
});

it('is accessible while closed', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS}></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  await expect(el).to.be.accessible();
});

it('is accessible while open in the read-only view', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open and editing, including with an invalid-JSON error shown', async () => {
  const el = (await fixture(
    html`<lyra-tool-approval-dialog tool-name="web_search" .args=${ARGS} open></lyra-tool-approval-dialog>`,
  )) as LyraToolApprovalDialog;
  editButton(el).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();

  setTextareaValue(el, '{ not valid json');
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
