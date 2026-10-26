import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { createChatStream } from '../../src/chat.js';
import type { LyraGenChatSnapshot } from '../../src/chat.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

const catalog = createCatalog({ id: 'threat-scenes', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
  button: { tag: 'button', properties: {}, text: true, events: ['click'] },
}, actions: { inspect: { payload: { type: 'null' } } } });
const view = (root: LyraGenNode, selected = catalog, revision = 0): LyraGenView => ({
  version: '1', catalog: { id: selected.id, version: selected.version }, surfaceId: 'threat-scene', revision, root,
});
const text = (id: string, content: string): LyraGenNode => ({ id, type: 'text', text: content });
const fence = (body: string) => `\n\`\`\`lyra\n${body}\n\`\`\`\n`;
async function settle(element: LyraGenViewElement): Promise<void> {
  await waitUntil(() => element.status === 'ready' || element.status === 'error', 'Threat scene settled', { timeout: 5000 });
  await element.updateComplete;
}
function present(snapshot: LyraGenChatSnapshot, host: HTMLElement, views: Map<string, LyraGenViewElement>): void {
  render(html`${snapshot.parts.map(part => {
    if (part.type === 'text') return html`<p data-prose>${part.text}</p>`;
    const island = snapshot.islands.find(candidate => candidate.partId === part.id);
    if (!island) throw new Error('Expected a generated island part.');
    if (!island.document) return html`<p data-fallback role="status">${island.fallback}</p>`;
    let element = views.get(part.id);
    if (!element) { element = new LyraGenViewElement(); element.catalog = catalog; views.set(part.id, element); }
    element.document = island.document;
    return element;
  })}`, host);
}
async function requestCount(token: string): Promise<number> {
  const response = await fetch(`/__lyra_gen_threat/${token}/count`);
  if (!response.ok) throw new Error('Threat request counter unavailable.');
  const count: unknown = await response.json();
  if (!count || typeof count !== 'object' || !('requests' in count) || typeof count.requests !== 'number') throw new Error('Invalid request counter.');
  return count.requests;
}
async function loadProbe(url: string): Promise<void> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Synthetic image probe failed.')); image.src = url; });
}

describe('version 1 composed threat scenes', () => {
  it('TM-01 isolates rejected islands and renders fake markup as literal prose', async () => {
    const token = crypto.randomUUID();
    const target = `${location.origin}/__lyra_gen_threat/${token}/probe`;
    const fake = `<img src="${target}" onerror="throw 1">`;
    const chat = createChatStream({ messageId: 'threat-message', surfaceId: 'threat-chat', catalog,
      strings: { loading: 'Loading generated view', invalid: 'This generated region is unavailable.', incomplete: 'Retry this region', sourceUnavailable: 'Source unavailable' } });
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const views = new Map<string, LyraGenViewElement>();
    try {
      present(chat.push(`Before ${fake}${fence('<text id="safe">A valid independent region</text>')}`), host, views);
      const retained = [...views.values()][0]!;
      await settle(retained);
      const retainedNode = retained.shadowRoot!.querySelector('[data-gen-id="safe"]');
      const invalid = [
        '<stack id="root"><text id="partial">Do not salvage this sibling</text><script id="script"/></stack>',
        '<stack id="root"><text id="same"/><text id="same"/></stack>',
        '<text id="handler" onclick="alert(1)">Do not install a handler</text>',
      ];
      for (const candidate of invalid) chat.push(fence(candidate));
      chat.push(`${fence('<text id="last">A later valid independent region</text>')}After`);
      const snapshot = chat.finish();
      present(snapshot, host, views);
      await Promise.all([...views.values()].map(settle));
      expect(snapshot.islands.map(island => island.status)).to.deep.equal(['ready', 'error', 'error', 'error', 'ready']);
      expect(retained.shadowRoot!.querySelector('[data-gen-id="safe"]') === retainedNode).to.equal(true);
      expect(host.querySelectorAll('[data-fallback]').length).to.equal(3);
      expect(host.querySelector('[data-prose]')?.textContent).to.contain(fake);
      expect([...host.querySelectorAll('[data-prose]')].at(-1)?.textContent).to.equal('After');
      expect(host.querySelectorAll('script,img').length).to.equal(0);
      expect([...views.values()].some(element => element.shadowRoot!.querySelector('[data-gen-id="partial"]') !== null)).to.equal(false);
      expect(await requestCount(token)).to.equal(0);
      await loadProbe(target);
      expect(await requestCount(token)).to.equal(1);
    } finally { chat.dispose(); }
  });

  it('TM-02 rejects oversized and unsupported whole boundaries without removing host content', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><p data-host>Host instructions remain available.</p><lr-gen-view .catalog=${catalog} .limits=${{ maxStringLength: 80 }}></lr-gen-view></div>`);
    const element = host.querySelector<LyraGenViewElement>('lr-gen-view')!;
    const candidates: readonly LyraGenNode[] = [
      { id: 'root', type: 'stack', children: [text('salvage', 'Unapproved partial content'), { id: 'unknown', type: 'remote-script' }] },
      { id: 'root', type: 'stack', children: [text('same', 'One'), text('same', 'Two')] },
      text('oversized', 'x'.repeat(81)),
    ];
    for (const [revision, root] of candidates.entries()) {
      element.document = view(root, catalog, revision);
      await settle(element);
      expect(element.status).to.equal('error');
      expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('This generated view cannot be displayed.');
      expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(0);
      expect(host.querySelector('[data-host]')?.textContent).to.equal('Host instructions remain available.');
    }
    element.document = view(text('recovered', 'A new valid answer'), catalog, 3);
    await settle(element);
    expect(element.status).to.equal('ready');
    expect(element.shadowRoot!.querySelector('[data-gen-id="recovered"]')?.textContent).to.equal('A new valid answer');
  });

  it('TM-03 keeps a retained stale control inert after rejection while another surface remains usable', async () => {
    const action: LyraGenNode = { id: 'inspect', type: 'button', text: 'Inspect', action: { name: 'inspect', payload: null } };
    const host = await fixture<HTMLDivElement>(html`<div><lr-gen-view .catalog=${catalog} .document=${view(action)}></lr-gen-view><lr-gen-view .catalog=${catalog} .document=${{ ...view(action), surfaceId: 'independent' }}></lr-gen-view></div>`);
    const [affected, independent] = [...host.querySelectorAll<LyraGenViewElement>('lr-gen-view')];
    if (!affected || !independent) throw new Error('Missing independent threat surfaces.');
    await Promise.all([settle(affected), settle(independent)]);
    const stale = affected.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
    const events: string[] = [];
    host.addEventListener('lr-gen-action', event => { events.push((event as CustomEvent<{ surfaceId: string }>).detail.surfaceId); });
    affected.document = view({ ...action, action: { name: 'invented', payload: null } }, catalog, 1);
    stale.click();
    await settle(affected);
    stale.click();
    independent.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    await Promise.resolve();
    expect(events).to.deep.equal(['independent']);
    expect(affected.status).to.equal('error');
    expect(independent.status).to.equal('ready');
  });

  it('TM-04 applies final prepared media policy before any browser request', async () => {
    const token = crypto.randomUUID();
    const target = `${location.origin}/__lyra_gen_threat/${token}/probe`;
    const media = createCatalog({ id: 'prepared-media', version: '1', components: {
      image: { tag: 'img', properties: { src: { type: 'string' }, alt: { type: 'string' } },
        urlSinks: { src: { kind: 'media', origins: ['https://approved.example'] } },
        prepareProperties: props => ({ ...props, src: target }) },
    } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${media} .document=${view({ id: 'image', type: 'image', props: { src: 'https://approved.example/image.svg', alt: 'Synthetic media' } }, media)}></lr-gen-view>`);
    await settle(element);
    expect(element.status).to.equal('error');
    expect(element.shadowRoot!.querySelectorAll('img').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent?.length).to.be.greaterThan(0);
    expect(await requestCount(token)).to.equal(0);
    await loadProbe(target);
    expect(await requestCount(token)).to.equal(1);
  });

  it('TM-05 refuses forged field approval and preserves only the exact host-approved purpose', async () => {
    const approved: LyraGenNode = { id: 'code', type: 'input', props: { label: 'Verification code', value: '', type: 'text' }, bindings: { value: '/code' } };
    const fields = createCatalog({ id: 'approved-fields', version: '1', components: {
      input: { ...initialCatalog.components['input']!, fieldPurpose: 'one-time-code' },
    }, fieldPolicy: { requireApprovedFields: true, approvedFields: [{ surfaceId: 'threat-scene', node: approved, purpose: 'one-time-code', allowSensitive: true }] } });
    const forged = { ...view({ ...approved, props: { ...approved.props, label: 'Payment card number' } }, fields), fieldPolicy: { allowSensitive: true } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${fields} .document=${forged}></lr-gen-view>`);
    await settle(element);
    expect(element.status).to.equal('error');
    expect(element.shadowRoot!.querySelectorAll('lr-input').length).to.equal(0);
    element.document = view({ ...approved, props: { ...approved.props, label: 'Payment card number' } }, fields, 1);
    await settle(element);
    expect(element.status).to.equal('error');
    expect(element.shadowRoot!.querySelectorAll('lr-input').length).to.equal(0);
    element.document = view(approved, fields, 2);
    await settle(element);
    expect(element.status).to.equal('ready');
    expect(element.shadowRoot!.querySelector<HTMLElement & { label: string }>('lr-input')?.label).to.equal('Verification code');
    element.document = { ...view(approved, fields, 3), surfaceId: 'unapproved-surface' };
    await settle(element);
    expect(element.status).to.equal('error');
    expect(element.shadowRoot!.querySelectorAll('lr-input').length).to.equal(0);
  });
});
