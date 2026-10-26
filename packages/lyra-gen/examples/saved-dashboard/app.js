import '@aceshooting/lyra-ui/components/lr-button.js';
import '@aceshooting/lyra-ui/components/lr-input.js';
import '@aceshooting/lyra-gen/gen-view.js';
import { diffDashboardDefinitions } from '@aceshooting/lyra-gen/persistence.js';
import { catalog, createDefinition } from './model.js';

const element = id => document.getElementById(id);
const workspace = element('workspace');
let view = element('view');
view.catalog = catalog;
const title = element('title');
const session = element('session');
const mode = element('mode');
const params = new URLSearchParams(location.search);
session.value = ['author', 'editor', 'viewer', 'other-tenant'].includes(params.get('session')) ? params.get('session') : 'author';
mode.value = params.get('mode') === 'published' || session.value.includes('viewer') || session.value === 'other-tenant' ? 'published' : 'draft';
let id = params.get('id');
let current;
let busy = false;
let pendingChange;
const changeReview = document.createElement('section');
changeReview.id = 'change-review';
changeReview.hidden = true;
changeReview.setAttribute('aria-labelledby', 'change-heading');
const changeHeading = document.createElement('h2');
changeHeading.id = 'change-heading';
changeHeading.tabIndex = -1;
const changeSummary = document.createElement('p');
changeSummary.id = 'change-summary';
const changeDifferences = document.createElement('pre');
changeDifferences.id = 'change-differences';
const changeActions = document.createElement('div');
changeActions.className = 'actions';
const confirmChange = document.createElement('lr-button');
confirmChange.id = 'confirm-change';
confirmChange.variant = 'brand';
const cancelChange = document.createElement('lr-button');
cancelChange.id = 'cancel-change';
cancelChange.textContent = 'Cancel review';
changeActions.append(confirmChange, cancelChange);
changeReview.append(changeHeading, changeSummary, changeDifferences, changeActions);
element('conflict').before(changeReview);

function clearReview() {
  pendingChange = undefined;
  changeReview.hidden = true;
}
function readableDiff(before, after) {
  const differences = diffDashboardDefinitions(before, after);
  return differences.length ? differences.map(change => `${change.path}\nBefore: ${JSON.stringify(change.before)}\nAfter: ${JSON.stringify(change.after)}`).join('\n\n') : 'No content differences.';
}
async function previewChange(operation) {
  if (!current || mode.value !== 'draft') return status('Open a draft first.', 'missing');
  const base = current;
  const scope = { id, session: session.value, mode: mode.value };
  const titleAtPreview = title.value;
  const definition = operation === 'update' ? createDefinition(titleAtPreview) : structuredClone(base.definition);
  if (operation === 'update') {
    definition.view.surfaceId = base.definition.view.surfaceId;
    definition.view.revision = base.definition.view.revision + 1;
  }
  let before = base.definition;
  if (operation === 'publish' && base.metadata.publishedRevision) before = (await request('resolve')).definition;
  if (current !== base || id !== scope.id || session.value !== scope.session || mode.value !== scope.mode) return status('The review was superseded. Open the current draft again.', 'missing');
  pendingChange = { operation, base, scope, definition, titleAtPreview, expectedRevision: base.metadata.revision };
  changeHeading.textContent = operation === 'update' ? 'Review draft changes' : 'Review publication';
  changeSummary.textContent = operation === 'update'
    ? `Save the reviewed proposal “${definition.title}” against storage revision ${base.metadata.revision}. Later title edits stay unsaved.`
    : `Publish the saved draft “${definition.title}” from storage revision ${base.metadata.revision}. Unsaved title edits are kept and are not included.`;
  changeDifferences.textContent = operation === 'publish' && !base.metadata.publishedRevision
    ? `First publication of this saved draft:\n${JSON.stringify(definition, null, 2)}` : readableDiff(before, definition);
  confirmChange.textContent = operation === 'update' ? 'Approve and save draft' : 'Approve and publish draft';
  changeReview.hidden = false;
  status('Review the exact change, then approve or cancel.', 'review');
  changeHeading.focus();
}

function status(message, state = 'ready') {
  element('status').textContent = message;
  workspace.dataset.state = state;
}
function route() {
  const url = new URL(location.href);
  url.search = new URLSearchParams({ session: session.value, mode: mode.value, ...(id ? { id } : {}) });
  history.replaceState(null, '', url);
}
function show(record) {
  clearReview();
  current = record;
  id = record.metadata.id;
  workspace.dataset.documentId = id;
  workspace.dataset.surfaceId = record.definition.view.surfaceId;
  workspace.dataset.revision = String(record.metadata.revision);
  title.value = record.definition.title;
  replaceView(record.definition.view);
  element('identity').textContent = `Document ${id} · storage revision ${record.metadata.revision} · ${record.selectedRevision ? `published revision ${record.selectedRevision}` : 'draft'}`;
  route();
}
function replaceView(document) {
  // Historical snapshots start a new renderer lifecycle. Removing the previous host also
  // removes revoked content synchronously, independently of a queued rendering frame.
  const replacement = window.document.createElement('lr-gen-view');
  replacement.id = 'view';
  replacement.catalog = catalog;
  replacement.document = document;
  view.replaceWith(replacement);
  view = replacement;
}
async function request(operation, values = {}) {
  const response = await fetch('/api', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer fixture-${session.value}` },
    body: JSON.stringify({ operation, ...(id ? { id } : {}), ...values }),
  });
  const body = await response.json();
  if (!response.ok) throw body;
  return body;
}
async function run(work) {
  if (busy) return;
  busy = true;
  workspace.dataset.state = 'loading';
  for (const button of document.querySelectorAll('lr-button')) button.disabled = true;
  session.disabled = true; mode.disabled = true;
  let focusAfter;
  try { focusAfter = await work(); }
  catch (error) {
    if (error?.error === 'conflict') {
      element('conflict').hidden = false;
      element('differences').textContent = error.differences.map(change => `${change.path}\nCurrent: ${JSON.stringify(change.before)}\nYour proposal: ${JSON.stringify(change.after)}`).join('\n\n');
      status('Conflict: your proposal has been preserved. Review both changes.', 'conflict');
    } else {
      if (error?.error === 'denied') { replaceView(undefined); current = undefined; }
      status(error?.error === 'denied' ? 'Access denied by the host.' : 'The requested operation is unavailable.', error?.error ?? 'error');
    }
  } finally {
    busy = false;
    for (const button of document.querySelectorAll('lr-button')) button.disabled = false;
    session.disabled = false; mode.disabled = false;
    if (focusAfter?.isConnected) {
      await focusAfter.updateComplete;
      if (focusAfter.isConnected) focusAfter.focus();
    }
  }
}
async function load() {
  clearReview();
  replaceView(undefined);
  if (!id) { status('Create a dashboard to begin.'); return; }
  const record = await request(mode.value === 'published' ? 'resolve' : 'read');
  show(record);
  status(mode.value === 'published' ? 'Published dashboard loaded from storage.' : 'Draft loaded from storage.');
}
function on(id, work) { element(id).addEventListener('click', () => {
  if (busy) return;
  if (!['confirm-change', 'cancel-change'].includes(id)) clearReview();
  void run(work);
}); }
on('create', async () => {
  const record = await request('create', { definition: createDefinition(title.value) });
  mode.value = 'draft'; show(record); status('Independent draft created.');
});
on('save', () => previewChange('update'));
on('publish', () => previewChange('publish'));
on('cancel-change', async () => {
  const operation = pendingChange?.operation;
  clearReview();
  status('Review cancelled. Your title edits are retained; nothing was saved or published.');
  return element(operation === 'publish' ? 'publish' : 'save');
});
on('confirm-change', async () => {
  const approved = pendingChange;
  clearReview();
  if (!approved || current !== approved.base || id !== approved.scope.id || session.value !== approved.scope.session || mode.value !== approved.scope.mode) return status('The review is no longer current. Preview the change again.', 'missing');
  const record = await request(approved.operation, {
    expectedRevision: approved.expectedRevision,
    ...(approved.operation === 'update' ? { definition: approved.definition } : {}),
  });
  const retainedTitle = title.value;
  show(record);
  if (approved.operation === 'publish' || retainedTitle !== approved.titleAtPreview) title.value = retainedTitle;
  element('conflict').hidden = true;
  status(approved.operation === 'update' ? 'Reviewed draft saved. The published revision is unchanged.' : 'Reviewed draft published. Following viewers can refresh.');
  return element(approved.operation === 'update' ? 'save' : 'publish');
});
on('refresh', load);
on('fork', async () => {
  show(await request('fork'));
  mode.value = 'draft'; route();
  status('Independent copy created with new document and surface identities.');
});
on('review', async () => {
  const proposal = title.value;
  show(await request('read'));
  title.value = proposal;
  status('Latest draft loaded. Your proposal is retained; save only after reviewing both.');
});
on('history', async () => {
  const revisions = await request('history');
  element('revisions').replaceChildren();
  for (const revision of revisions) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `Revision ${revision.revision}: ${revision.definition.title} `;
    const restore = document.createElement('lr-button');
    restore.textContent = `Restore revision ${revision.revision}`;
    restore.dataset.revision = String(revision.revision);
    restore.addEventListener('click', () => { void run(async () => {
      show(await request('undo', { expectedRevision: current.metadata.revision, targetRevision: revision.revision }));
      mode.value = 'draft'; route(); status('Historical revision restored as a new draft.');
    }); });
    item.append(label, restore); element('revisions').append(item);
  }
  element('history-panel').hidden = false;
  status('Revision history loaded. Restoring creates a new draft.');
});
on('revoke', async () => { await request('revoke'); status('Viewer session revoked. Subsequent reads and writes are denied.'); });
session.addEventListener('change', () => { mode.value = session.value === 'author' || session.value === 'editor' ? 'draft' : 'published'; route(); location.reload(); });
mode.addEventListener('change', () => { route(); void run(load); });
element('session-description').textContent = `Selected fixture session: ${session.selectedOptions[0].textContent}. Permissions are checked by the server.`;
void run(load);
