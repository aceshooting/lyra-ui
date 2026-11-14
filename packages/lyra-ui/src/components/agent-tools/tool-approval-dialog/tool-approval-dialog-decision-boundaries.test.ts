import { expect, fixture, fixtureCleanup, html, nextFrame } from '@open-wc/testing';
import './tool-approval-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog.js';

const control = (element: LyraToolApprovalDialog, action: string): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part="${action}-button"]`)!;
const editor = (element: LyraToolApprovalDialog): HTMLTextAreaElement =>
  element.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="args-editor"]')!;
const mount = () => fixture<LyraToolApprovalDialog>(html`
  <lr-tool-approval-dialog open tool-name="search" .args=${{ query: 'original' }}></lr-tool-approval-dialog>
`);

describe('tool approval decision boundaries', () => {
  afterEach(() => fixtureCleanup());

  for (const action of ['approve', 'deny'] as const) {
    it(`ignores nested decision clicks during the ${action} request`, async () => {
      const element = await mount();
      const requests: string[] = [], closes: string[] = [];
      element.addEventListener('lr-close', event => { closes.push(event.detail.reason); });
      for (const name of ['approve', 'deny'] as const) {
        element.addEventListener(`lr-${name}-request`, () => {
          requests.push(name);
          if (requests.length === 1) {
            control(element, 'approve').click();
            control(element, 'deny').click();
          }
        });
      }
      control(element, action).click();
      await element.updateComplete;
      expect(requests).to.deep.equal([action]);
      expect(closes).to.deep.equal([action]);
      expect(element.open).to.equal(false);
    });

    it(`keeps the editor and decisions frozen before a pending ${action} update renders`, async () => {
      const element = await mount();
      control(element, 'edit').click();
      await element.updateComplete;
      const draft = editor(element), requests: string[] = [];
      element.addEventListener('lr-approve-request', () => { requests.push('approve'); });
      element.addEventListener('lr-deny-request', () => { requests.push('deny'); });
      element.pendingAction = action;
      control(element, 'edit').click();
      control(element, 'approve').click();
      control(element, 'deny').click();
      draft.value = '{"query":"ignored"}';
      draft.dispatchEvent(new Event('input', { bubbles: true }));
      await element.updateComplete;
      expect(requests).to.deep.equal([]);
      expect(element.open).to.equal(true);
      expect(editor(element) === draft).to.equal(true);
      expect(draft.readOnly).to.equal(true);

      element.pendingAction = null;
      await element.updateComplete;
      let approved: unknown;
      element.addEventListener('lr-approve-request', event => { approved = event.detail.args; });
      control(element, 'approve').click();
      expect(approved).to.deep.equal({ query: 'original' });
      expect(requests).to.deep.equal(['approve']);
      expect(element.open).to.equal(false);
    });

    for (const rejected of [false, true]) {
      it(`absorbs a ${rejected ? 'rejected' : 'resolved'} ${action} deferral after the listener settles and opens a new proposal`, async () => {
        const element = await mount();
        let resolve!: () => void, reject!: (reason: Error) => void;
        const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
        const decisions: string[] = [];
        element.addEventListener('lr-decision-settled', event => { decisions.push(event.detail.decision); });
        element.addEventListener(`lr-${action}-request`, event => {
          event.detail.waitUntil(pending);
          element.close(action);
          element.proposalKey = 'next';
          element.show();
        }, { once: true });
        control(element, action).click();
        await element.updateComplete;
        expect(element.open).to.equal(true);
        expect(element.pendingAction).to.equal(null);
        if (rejected) reject(new Error('Retired proposal failed')); else resolve();
        await nextFrame();
        await element.updateComplete;
        expect(element.open).to.equal(true);
        expect(element.proposalKey).to.equal('next');
        expect(element.pendingAction).to.equal(null);
        expect(decisions).to.deep.equal([action === 'approve' ? 'approved' : 'denied']);
        control(element, 'deny').click();
        expect(element.open).to.equal(false);
        expect(decisions).to.have.length(2);
      });
    }
  }

  it('rejects invalid JSON before its disabled approval button renders and accepts a corrected draft', async () => {
    const element = await mount();
    element.strings = { invalidJson: 'Correct the draft' };
    control(element, 'edit').click();
    await element.updateComplete;
    const requests: unknown[] = [];
    element.addEventListener('lr-approve-request', event => { requests.push(event.detail.args); });
    editor(element).value = '{';
    editor(element).dispatchEvent(new Event('input', { bubbles: true }));
    control(element, 'approve').click();
    expect(requests).to.deep.equal([]);
    expect(element.open).to.equal(true);
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.include('Correct the draft');
    editor(element).value = '{"query":"corrected"}';
    editor(element).dispatchEvent(new Event('input', { bubbles: true }));
    await element.updateComplete;
    control(element, 'approve').click();
    expect(requests).to.deep.equal([{ query: 'corrected' }]);
    expect(element.open).to.equal(false);
  });

  it('edits arguments without a JSON serialization as null and supports empty native assistance attributes', async () => {
    const element = await mount();
    element.args = undefined;
    element.autocomplete = '';
    element.autocapitalize = '';
    element.autoCorrect = '';
    element.show();
    await element.updateComplete;
    control(element, 'edit').click();
    await element.updateComplete;
    expect(editor(element).value).to.equal('null');
    for (const name of ['autocomplete', 'autocapitalize', 'autocorrect']) {
      expect(editor(element).hasAttribute(name), name).to.equal(false);
    }
    let approved: unknown = 'unset';
    element.addEventListener('lr-approve-request', event => { approved = event.detail.args; });
    control(element, 'approve').click();
    expect(approved).to.equal(null);
    expect(element.open).to.equal(false);
  });
});
