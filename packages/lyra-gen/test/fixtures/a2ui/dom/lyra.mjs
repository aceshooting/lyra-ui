import { A2uiProcessor } from '../../../../src/adapters/a2ui.ts';
import { createCatalog } from '../../../../src/catalog.ts';
import { LyraGenViewElement } from '../../../../src/gen-view.class.ts';
import { defineElement, tag } from '@aceshooting/lyra-ui/utilities/prefix.js';
defineElement('gen-view', LyraGenViewElement);

const literal = { schema: { type: 'string' } };
const owner = { ownerId: 'reference-agent' };
// Test-only rendering projection of six basic roles; never advertised as the basic catalog.
const viewCatalog = createCatalog({ id: 'dom-cohort', version: '1', components: {
  text: { tag: 'p', properties: {}, text: true },
  'heading-one': { tag: 'h1', properties: {}, text: true },
  'heading-three': { tag: 'h3', properties: {}, text: true },
  stack: { tag: 'div', properties: {}, children: true },
  row: { tag: 'div', properties: {}, children: true },
  card: { tag: 'section', properties: {}, children: true },
  button: { tag: 'button', properties: {}, text: true, interactive: true, events: ['click'], accessibleName: { required: true, text: true } },
}, actions: { button_clicked: { payload: { type: 'object', properties: {}, additionalProperties: false } } } });
const node = (source, type, children) => ({ id: source.id, type, ...(children ? { children } : {}) });
const layout = type => ({ properties: { align: literal, justify: literal }, required: ['children'], children: 'children', toNode: (source, children) => node(source, type, children) });
const catalog = { id: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json', version: 'v0.9.1', viewCatalog: { id: 'dom-cohort', version: '1' }, components: {
  Text: { properties: { text: { schema: { type: 'string' }, dynamic: true }, variant: literal }, required: ['text'], toNode: source => ({ ...node(source, source.props.variant === 'h1' ? 'heading-one' : source.props.variant === 'h3' ? 'heading-three' : 'text'), text: source.props.text }) },
  Column: layout('stack'), Row: layout('row'), List: layout('stack'),
  Card: { properties: {}, child: 'child', required: ['child'], toNode: (source, children) => node(source, 'card', children) },
  Button: { properties: { variant: literal }, child: 'child', action: 'action', required: ['child', 'action'], toNode: (source, children) => ({ ...node(source, 'button'), text: children.map(child => child.text ?? '').join(''), action: source.action }) },
} };
const accept = result => { if (!result.ok) throw new Error(JSON.stringify(result.diagnostics)); return result.value; };
let processor;
let host;
let surfaceId;
const actions = [];
async function render() {
  host.document = processor.getSurface(surfaceId) ? accept(processor.toView(surfaceId)) : undefined;
  await host.updateComplete;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (processor.getSurface(surfaceId) && host.status !== 'ready') throw new Error(`Render status: ${host.status}`);
}
window.fixture = {
  actions,
  async mount(messages) {
    processor = new A2uiProcessor({ catalogs: [catalog] });
    surfaceId = messages[0].createSurface.surfaceId;
    for (const message of messages) accept(processor.process(message, owner));
    host = document.createElement(tag('gen-view')); host.catalog = viewCatalog;
    host.addEventListener('lr-gen-action', event => {
      const detail = event.detail;
      const action = accept(processor.createAction(surfaceId, detail.nodeId, { ...owner, expectedRevision: detail.revision }));
      actions.push(action.message.action);
    });
    document.querySelector('main').append(host); await render();
  },
  async update(messages) { for (const message of messages) accept(processor.process(message, owner)); await render(); },
};
