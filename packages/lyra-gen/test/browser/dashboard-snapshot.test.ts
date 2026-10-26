import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenAction } from '../../src/types.js';
import { currentSnapshotCatalog, legacyPrivateSnapshot, migrateSharedSnapshot, redactSharedSnapshot, snapshotValue } from '../fixtures/dashboard-snapshot.js';

async function restored() {
  const migrated = snapshotValue(migrateSharedSnapshot(redactSharedSnapshot(legacyPrivateSnapshot())));
  const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${currentSnapshotCatalog} .enabledActions=${[]}></lr-gen-view>`);
  const actions: LyraGenAction[] = [];
  element.addEventListener('lr-gen-action', event => { actions.push(event.detail); });
  const result = element.restoreSnapshot(migrated.snapshot);
  expect(result.ok).to.equal(true);
  await waitUntil(() => element.status === 'ready', 'Migrated shared snapshot ready', { timeout: 5000 });
  return { element, actions, migrated };
}
function control<T extends HTMLElement>(element: LyraGenViewElement, id: string): T {
  const result = element.shadowRoot!.querySelector<T>(`[data-gen-id="${id}"]`);
  if (!result) throw new Error(`Missing shared snapshot control ${id}`);
  return result;
}

describe('cross-version shared dashboard snapshots', () => {
  it('restores permitted presentation and edited state without replaying actions or private cached values', async () => {
    const { element, actions } = await restored();
    expect(control(element, 'heading').textContent).to.equal('Permitted inventory overview');
    expect(control<HTMLInputElement>(element, 'filter').value).to.equal('Notebooks');
    expect(control<HTMLInputElement>(element, 'note').value).to.equal('');
    expect(control(element, 'summary').textContent).to.equal('Load inventory for the current viewer.');
    expect(element.shadowRoot!.textContent).not.to.contain('Author-only');
    expect(element.shadowRoot!.textContent).not.to.contain('98765');
    expect(actions.length).to.equal(0);
    const button = control<HTMLButtonElement>(element, 'inspect');
    button.click();
    expect(actions.length).to.equal(0);
    element.enabledActions = ['inspect'];
    await element.updateComplete;
    expect(actions.length).to.equal(0);
    await focusByKeyboard(button);
    const requested = oneEvent(element, 'lr-gen-action');
    await sendKeys({ press: 'Enter' });
    const event = await requested as CustomEvent<LyraGenAction>;
    expect(event.detail).to.deep.equal({ surfaceId: 'inventory', revision: 7, nodeId: 'inspect', name: 'inspect', payload: null });
    expect(actions.length).to.equal(1);
    await expect(element).to.be.accessible();
  });

  it('rejects a tampered shared state atomically and keeps the permitted restored controls', async () => {
    const { element, actions, migrated } = await restored();
    const original = control<HTMLInputElement>(element, 'filter');
    const document = element.document;
    const tampered = {
      ...migrated.snapshot,
      view: { ...migrated.snapshot.view, root: { ...migrated.snapshot.view.root, children: migrated.snapshot.view.root.children!.map(node => node.id === 'heading' ? { ...node, text: 'Unapproved replacement' } : node) } },
      state: { ...migrated.snapshot.state, values: { filter: 'Notebooks', note: '', credential: 'forged disclosure' } },
    };
    const rejected = element.restoreSnapshot(tampered);
    expect(rejected.ok).to.equal(false);
    expect(rejected.diagnostics[0]?.code).to.equal('state.unauthorized');
    await element.updateComplete;
    expect(element.document === document).to.equal(true);
    expect(control<HTMLInputElement>(element, 'filter') === original).to.equal(true);
    expect(original.value).to.equal('Notebooks');
    expect(control(element, 'heading').textContent).to.equal('Permitted inventory overview');
    expect(element.shadowRoot!.textContent).not.to.contain('Unapproved replacement');
    expect(actions.length).to.equal(0);
  });
});
