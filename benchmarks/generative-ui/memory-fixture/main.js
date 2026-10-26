import '@aceshooting/lyra-ui/theme.css';
import { createCatalog, initialCatalog, subsetCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createChatStream } from '@aceshooting/lyra-gen/chat.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { createSnapshot, createSurfaceState } from '@aceshooting/lyra-gen/runtime.js';
import { parseJson } from '@aceshooting/lyra-gen/schema.js';
import { memorySource, expectedData, expectedNote, MAX_ARCHIVE_BYTES } from '../memory-workload.mjs';

const selected = subsetCatalog(initialCatalog, ['stack', 'heading', 'text', 'input', 'button']);
if (!selected.ok) throw new Error('Memory catalog unavailable.');
const catalog = createCatalog({ ...selected.value, id: 'memory-session', actions: { inspect: { payload: { type: 'null' } } } });
const host = document.querySelector('#host');
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
let active, actionCount = 0, baseActions = 0;
const require = (condition, message) => { if (!condition) throw new Error(message); };
const input = () => active.view.shadowRoot.querySelector('[data-gen-id="note"]').shadowRoot.querySelector('input');
const onState = event => { if (active?.view === event.currentTarget) active.state = { values: event.detail.values, dirty: event.detail.dirty }; };
const onAction = event => {
  require(event.detail.name === 'inspect' && event.detail.payload === null, 'Unexpected action request.');
  actionCount++;
};
async function ready(view) {
  const deadline = performance.now() + 10000;
  while (view.status !== 'ready' && performance.now() < deadline) { await view.updateComplete; await frame(); }
  require(view.status === 'ready', 'Generated memory view did not settle.');
  await frame();
}
async function digest(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function connect(view) {
  view.catalog = catalog; view.enabledActions = ['inspect'];
  view.addEventListener('lr-gen-state-change', onState); view.addEventListener('lr-gen-action', onAction);
}
function prose() { return [...host.querySelectorAll('[data-memory-prose]')].map(node => node.textContent).join(''); }
function textNode(text) { const node = document.createElement('p'); node.dataset.memoryProse = ''; node.textContent = text; return node; }

async function mount(cycle) {
  require(!active, 'Dispose the previous presentation first.');
  baseActions = actionCount;
  const controller = createChatStream({ messageId: 'memory-answer', surfaceId: 'memory-surface', catalog,
    strings: { loading: 'Loading', invalid: 'Invalid', incomplete: 'Incomplete', sourceUnavailable: 'Unavailable' } });
  // This transport and its slices leave scope before any post-GC observation.
  const source = memorySource(cycle);
  for (let offset = 0; offset < source.length; offset += 1024) controller.push(source.slice(offset, offset + 1024));
  controller.finish();
  require(controller.snapshot.islands.length === 1 && controller.snapshot.islands[0].status === 'ready', 'Source did not produce one admitted island.');
  const view = new LyraGenViewElement(); connect(view); view.document = controller.snapshot.islands[0].document;
  active = { controller, view, cycle };
  for (const part of controller.snapshot.parts) host.append(part.type === 'text' ? textNode(part.text) : view);
  await ready(view);
  require(view.shadowRoot.querySelector('[data-gen-id="data"]').textContent === expectedData(cycle), 'Source data changed.');
  require(actionCount === baseActions, 'Mount replayed an action.');
}
async function save() {
  require(active?.controller && active.state?.dirty.includes('/note') && input().value === expectedNote(active.cycle), 'Expected a real dirty edit.');
  const state = createSurfaceState(active.view.document, active.state.values);
  const snapshot = createSnapshot(active.view.document, { ...state, dirty: active.state.dirty });
  const presentation = active.controller.snapshot.parts.map(part => part.type === 'text' ? { type: 'text', text: part.text } : { type: 'view', snapshot });
  const text = JSON.stringify({ version: 1, presentation });
  const bytes = new TextEncoder().encode(text).byteLength;
  require(bytes <= MAX_ARCHIVE_BYTES, 'Saved presentation exceeds its bound.');
  require(actionCount === baseActions + 1, 'Saving replayed an action.');
  return { text, bytes, proseHash: await digest(prose()), sourceCharacters: active.controller.retainedSourceCharacters,
    savedData: snapshot.state.dirty.includes('/note') && snapshot.state.values.note === expectedNote(active.cycle) && snapshot.view.root.children.find(node => node.id === 'data').text === expectedData(active.cycle) };
}
function release() {
  const accepted = active.view.document;
  active.controller.releaseSource();
  const retained = active.controller.snapshot.islands[0]?.document === accepted && input().value === expectedNote(active.cycle);
  require(retained && active.controller.retainedSourceCharacters === 0 && !active.controller.sourceAvailable, 'Source release changed accepted presentation.');
  require(actionCount === baseActions + 1, 'Source release replayed an action.');
  return { retainedAfterRelease: retained, sourceCharacters: active.controller.retainedSourceCharacters };
}
function dispose() {
  const current = active;
  current.controller?.dispose(); current.view.remove();
  current.view.removeEventListener('lr-gen-state-change', onState); current.view.removeEventListener('lr-gen-action', onAction);
  host.replaceChildren(); active = undefined;
  const cleared = !current.controller || current.controller.snapshot.parts.length === 0 && current.controller.snapshot.islands.length === 0 && current.controller.retainedSourceCharacters === 0;
  require(!current.view.isConnected && cleared, 'Disposal retained an active controller or view.');
  return { controllerCleared: cleared };
}
async function restore(text, cycle) {
  require(!active, 'Dispose the source before restoring.');
  const parsed = parseJson(text, { maxBytes: MAX_ARCHIVE_BYTES, maxStringLength: 65536 });
  require(parsed.ok && parsed.value?.version === 1 && Object.keys(parsed.value).length === 2 && Array.isArray(parsed.value.presentation), 'Invalid host presentation envelope.');
  let view;
  for (const part of parsed.value.presentation) {
    if (part.type === 'text' && typeof part.text === 'string' && Object.keys(part).length === 2) host.append(textNode(part.text));
    else {
      require(part.type === 'view' && Object.keys(part).length === 2 && !view, 'Expected exactly one saved view.');
      view = new LyraGenViewElement(); connect(view);
      require(view.restoreSnapshot(part.snapshot).ok, 'Stored snapshot was rejected.'); host.append(view);
    }
  }
  require(view, 'Stored view is missing.'); active = { view, cycle };
  await ready(view);
  const restoredData = view.shadowRoot.querySelector('[data-gen-id="data"]').textContent === expectedData(cycle);
  const restoredEdit = input().value === expectedNote(cycle);
  require(restoredData && restoredEdit && actionCount === baseActions + 1, 'Restore lost content or replayed an action.');
  const acceptedDocument = view.document;
  view.document = { ...acceptedDocument, revision: acceptedDocument.revision + 1, root: { ...acceptedDocument.root, children: acceptedDocument.root.children.map(node => node.id === 'note' ? { ...node, props: { ...node.props, value: 'Changed generated default' } } : node) } };
  await ready(view);
  const dirtySurvivedRevision = input().value === expectedNote(cycle);
  require(dirtySurvivedRevision && actionCount === baseActions + 1, 'Dirty ownership was lost or reconciliation replayed an action.');
  return { restoredData, restoredEdit, dirtySurvivedRevision, noActionReplay: true, proseHash: await digest(prose()) };
}
function metrics() {
  let nodes = 0, elements = 0;
  const walk = root => { for (const node of root.childNodes) { nodes++; if (node.nodeType === 1) elements++; walk(node); if (node.shadowRoot) walk(node.shadowRoot); } };
  walk(host);
  return { connectedFixtureNodes: nodes, connectedFixtureElements: elements, actions: actionCount - baseActions };
}
window.__memoryCohort = { mount, save, release, dispose, restore, metrics, settle: async () => { await frame(); await frame(); } };
