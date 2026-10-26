import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import type { LyraConfirmBar } from '@aceshooting/lyra-ui/components/lr-confirm-bar.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenAction, LyraGenView } from '../../src/types.js';
import { connectGeneratedApproval } from '../../examples/approval.js';

const catalog = createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'null' }, confirm: true } } });
const documentFor = (revision = 0): LyraGenView => ({ version: '1', surfaceId: 'approval-example', revision,
  catalog: { id: catalog.id, version: catalog.version }, root: { id: 'save', type: 'button', text: `Save revision ${revision}`, action: { name: 'save', payload: null } } });
type UpdatingElement = HTMLElement & { readonly updateComplete: Promise<unknown> };
async function setup() {
  const root = await fixture<HTMLElement>(html`<section><lr-gen-view .catalog=${catalog} .document=${documentFor()}></lr-gen-view><div data-approval></div></section>`);
  const view = root.querySelector<LyraGenViewElement>('lr-gen-view')!;
  const region = root.querySelector<HTMLElement>('[data-approval]')!;
  const actions: LyraGenAction[] = [];
  view.addEventListener('lr-gen-action', event => actions.push(event.detail));
  const connection = connectGeneratedApproval(view, region, { heading: () => 'Review this save' });
  await waitUntil(() => view.status === 'ready', 'Generated action loaded', { timeout: 5000 });
  const trigger = view.shadowRoot!.querySelector<UpdatingElement>('[data-gen-id="save"]')!;
  await trigger.updateComplete;
  return { root, view, region, actions, connection, trigger };
}
async function request(app: Awaited<ReturnType<typeof setup>>): Promise<LyraConfirmBar> {
  await focusByKeyboard(app.trigger);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => app.connection.pending !== undefined, 'Approval becomes visible');
  const bar = app.connection.pending!;
  await bar.updateComplete;
  await Promise.all([...bar.shadowRoot!.querySelectorAll<UpdatingElement>('[part$="-button"]')].map(button => button.updateComplete));
  return bar;
}
async function activate(bar: LyraConfirmBar, part: 'approve-button' | 'deny-button', key = 'Enter'): Promise<void> {
  const button = bar.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
  await focusByKeyboard(button);
  await sendKeys({ press: key });
}

describe('generated action approval composition', () => {
  it('waits for a keyboard approval on the real localized bar and returns focus before publishing one action', async () => {
    const app = await setup();
    try {
      const bar = await request(app);
      expect(app.actions.length).to.equal(0);
      expect(bar.heading).to.equal('Review this save');
      expect(bar.args).to.deep.equal({ surfaceId: 'approval-example', nodeId: 'save', revision: 0, payload: null });
      expect(bar.shadowRoot!.querySelector('[part="deny-button"]')?.textContent?.trim()).to.equal('Deny');
      await expect(bar).to.be.accessible();
      const dispatched = oneEvent(app.view, 'lr-gen-action');
      await activate(bar, 'approve-button');
      await dispatched;
      expect(bar.decision).to.equal('approved');
      expect(app.actions.map(action => [action.name, action.revision])).to.deep.equal([['save', 0]]);
      expect(app.view.shadowRoot!.activeElement === app.trigger).to.equal(true);
      expect(app.connection.pending === undefined).to.equal(true);
    } finally { app.connection.dispose(); }
  });

  it('denies with the keyboard and leaves no action request', async () => {
    const app = await setup();
    try {
      const bar = await request(app);
      const settled = oneEvent(bar, 'lr-decision-settled');
      await activate(bar, 'deny-button', 'Space');
      await settled;
      expect(bar.decision).to.equal('denied');
      expect(app.actions.length).to.equal(0);
      expect(app.connection.pending === undefined).to.equal(true);
    } finally { app.connection.dispose(); }
  });

  it('treats scoped Escape and explicit host cancellation as denial', async () => {
    const app = await setup();
    try {
      let bar = await request(app);
      const settled = oneEvent(bar, 'lr-decision-settled');
      await activate(bar, 'deny-button', 'Escape');
      await settled;
      expect(app.actions.length).to.equal(0);
      bar = await request(app);
      const previousApprove = bar.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!;
      app.connection.cancel();
      previousApprove.click();
      await bar.updateComplete;
      expect(bar.decision).to.equal('denied');
      expect(app.actions.length).to.equal(0);
      expect(app.connection.pending === undefined).to.equal(true);
    } finally { app.connection.dispose(); }
  });

  it('rejects a stale bar after revision supersession and only approves the new revision', async () => {
    const app = await setup();
    try {
      const oldBar = await request(app);
      const oldApprove = oldBar.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!;
      app.view.document = documentFor(1);
      oldApprove.click();
      await waitUntil(() => app.view.status === 'ready' && app.connection.pending === undefined);
      expect(app.actions.length).to.equal(0);
      const bar = await request(app);
      const dispatched = oneEvent(app.view, 'lr-gen-action');
      await activate(bar, 'approve-button');
      await dispatched;
      expect(app.actions.map(action => action.revision)).to.deep.equal([1]);
    } finally { app.connection.dispose(); }
  });

  it('cancels on renderer disconnection and cannot approve its detached request', async () => {
    const app = await setup();
    try {
      const bar = await request(app);
      const approve = bar.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!;
      app.view.remove();
      approve.click();
      await bar.updateComplete;
      expect(bar.decision).to.equal('denied');
      expect(app.actions.length).to.equal(0);
      expect(app.connection.pending === undefined).to.equal(true);
    } finally { app.connection.dispose(); }
  });

  it('replaces a repeated request without letting the previous bar approve it', async () => {
    const app = await setup();
    try {
      const oldBar = await request(app);
      const oldApprove = oldBar.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!;
      const bar = await request(app);
      expect(bar === oldBar).to.equal(false);
      expect(oldBar.isConnected).to.equal(false);
      oldApprove.click();
      expect(app.actions.length).to.equal(0);
      const dispatched = oneEvent(app.view, 'lr-gen-action');
      await activate(bar, 'approve-button');
      await dispatched;
      expect(app.actions.length).to.equal(1);
    } finally { app.connection.dispose(); }
  });

  it('does not treat an externally painted approved status as a user approval request', async () => {
    const app = await setup();
    try {
      const bar = await request(app);
      const settled = oneEvent(bar, 'lr-decision-settled');
      bar.decision = 'approved';
      await settled;
      expect(app.actions.length).to.equal(0);
      expect(app.connection.pending === undefined).to.equal(true);
    } finally { app.connection.dispose(); }
  });

  it('restores unset and existing callbacks on disposal without overwriting a newer host callback', async () => {
    const app = await setup();
    const bar = await request(app);
    app.connection.dispose();
    expect(app.view.confirmAction === undefined).to.equal(true);
    expect(bar.isConnected).to.equal(false);
    expect(app.actions.length).to.equal(0);
    const previous = () => false;
    app.view.confirmAction = previous;
    const restored = connectGeneratedApproval(app.view, app.region);
    expect(app.view.confirmAction === previous).to.equal(false);
    restored.dispose();
    expect(app.view.confirmAction === previous).to.equal(true);
    const replaced = connectGeneratedApproval(app.view, app.region);
    const newer = () => false;
    app.view.confirmAction = newer;
    replaced.dispose();
    expect(app.view.confirmAction === newer).to.equal(true);
  });
});
