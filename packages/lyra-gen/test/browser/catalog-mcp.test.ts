import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { mcpAppActions, mcpAppComponents, mcpToolCallAction, type LyraGenMcpAppOptions } from '../../src/catalogs/mcp.js';
import type { LyraGenAction, LyraGenNode, LyraGenView } from '../../src/types.js';

const options: LyraGenMcpAppOptions = {
  resources: { stub: { uri: 'ui://tests/stub', title: 'Stub app', html: '<!doctype html><html lang="en"><head><title>Stub</title></head><body><p>Stub app</p></body></html>' } },
  tools: ['refresh'],
};
const catalog = createCatalog({ ...initialCatalog, id: `${initialCatalog.id}+mcp`, components: { ...initialCatalog.components, ...mcpAppComponents(initialCatalog, options) }, actions: { ...initialCatalog.actions, ...mcpAppActions(options) } });
const root: LyraGenNode = { id: 'subject', type: 'mcp-app', props: { app: 'stub', label: 'Stub application' }, action: { name: mcpToolCallAction, payload: { tool: 'refresh', input: { range: 'week' } } } };
const document: LyraGenView = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'mcp-test', revision: 0, root };

describe('mcp-app catalog role', () => {
  it('renders the allowlisted stub resource accessibly with host-owned properties', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view>`);
    await waitUntil(() => host.status === 'ready' || host.status === 'error', 'settled', { timeout: 5000 });
    expect(host.status).to.equal('ready');
    const app = host.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="subject"]')!;
    expect(app.localName).to.equal('lr-mcp-app');
    expect((Reflect.get(app, 'resource') as { uri: string }).uri).to.equal('ui://tests/stub');
    expect(Reflect.get(app, 'label')).to.equal('Stub application');
    await expect(host).to.be.accessible();
  });

  it('turns an app tool request into a confirmed lr-gen-action and never runs it', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${document} .confirmAction=${async () => true}></lr-gen-view>`);
    await waitUntil(() => host.status === 'ready', 'ready', { timeout: 5000 });
    const app = host.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="subject"]')!;
    const pending = oneEvent(host, 'lr-gen-action');
    app.dispatchEvent(new CustomEvent('lr-mcp-tool-call', { detail: { name: 'refresh', args: { range: 'month' }, frameGeneration: 1 } }));
    const action = (await pending).detail as LyraGenAction;
    expect(action.name).to.equal(mcpToolCallAction);
    // The app's own request becomes the payload, admitted by the action schema.
    expect(action.payload).to.deep.equal({ tool: 'refresh', input: { range: 'month' } });
  });

  it('denies an app request for a tool the host did not allowlist', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${document} .confirmAction=${async () => true}></lr-gen-view>`);
    await waitUntil(() => host.status === 'ready', 'ready', { timeout: 5000 });
    let actions = 0;
    host.addEventListener('lr-gen-action', () => actions++);
    const denied = oneEvent(host, 'lr-gen-error');
    host.shadowRoot!.querySelector('[data-gen-id="subject"]')!.dispatchEvent(new CustomEvent('lr-mcp-tool-call', { detail: { name: 'delete-everything', args: {}, frameGeneration: 1 } }));
    await denied;
    expect(actions).to.equal(0);
  });

  it('withholds the action when the host declines confirmation', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${document} .confirmAction=${async () => false}></lr-gen-view>`);
    await waitUntil(() => host.status === 'ready', 'ready', { timeout: 5000 });
    let fired = false;
    host.addEventListener('lr-gen-action', () => { fired = true; });
    host.shadowRoot!.querySelector('[data-gen-id="subject"]')!.dispatchEvent(new CustomEvent('lr-mcp-tool-call', { detail: { name: 'refresh', args: {}, frameGeneration: 1 } }));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(fired).to.equal(false);
  });
});
