import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { restoreGenSnapshotElement } from '../../src/ssr.js';
import type { LyraGenViewElement } from '../../src/gen-view.class.js';
import type { LyraGenSnapshot } from '../../src/runtime.js';

const catalog = createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'object', properties: { note: { type: 'string' }, agreed: { type: 'boolean' } }, required: ['note', 'agreed'] } } } });
async function serverFixture(): Promise<HTMLElement> {
  const response = await fetch('/__lyra_gen_ssr_fixture');
  if (!response.ok) throw new Error('Server fixture is unavailable.');
  const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
  const section = parsed.querySelector<HTMLElement>('[data-lyra-gen-snapshot]');
  if (!section) throw new Error('Missing server snapshot.');
  const host = await fixture<HTMLElement>(html`<div></div>`);
  host.append(section);
  return section;
}
function saved(section: HTMLElement): LyraGenSnapshot {
  return (JSON.parse(section.querySelector<HTMLTemplateElement>('template[data-lyra-gen-state]')!.getAttribute('data-lyra-gen-state')!) as { snapshot: LyraGenSnapshot }).snapshot;
}
function viewOf(result: Awaited<ReturnType<typeof restoreGenSnapshotElement>>): LyraGenViewElement {
  expect(result.ok).to.equal(true);
  if (!result.ok) throw new Error('Snapshot restoration failed.');
  return result.value;
}

describe('static server snapshots and explicit client restoration', () => {
  it('preserves actual table/form values, context, plain text and dirty bindings without replaying actions', async () => {
    const section = await serverFixture();
    const snapshot = saved(section);
    expect(section.querySelector('script') === null).to.equal(true);
    expect(section.querySelector('[data-gen-id="literal"]')?.textContent).to.equal('</template><script>globalThis.snapshotExecuted = true</script>');
    expect([...section.querySelectorAll('td')].map(cell => cell.textContent)).to.deep.equal(['January', '0', 'February', '12']);
    expect(section.querySelector<HTMLInputElement>('[data-gen-id="note"] input')?.value).to.equal('Saved user edit');
    expect([...section.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')].every(control => control.disabled)).to.equal(true);
    let actions = 0;
    section.addEventListener('lr-gen-action', () => actions++);
    const element = viewOf(await restoreGenSnapshotElement(section, catalog));
    expect(element.status).to.equal('ready');
    expect(element.enabledActions).to.deep.equal([]);
    expect(actions).to.equal(0);
    expect(section.lang).to.equal('en');
    expect(getComputedStyle(element).direction).to.equal('rtl');
    const input = element.shadowRoot!.querySelector<HTMLElement & { value: string; updateComplete: Promise<boolean> }>('[data-gen-id="note"]')!;
    expect(input.value).to.equal('Saved user edit');
    const table = element.shadowRoot!.querySelector('[data-gen-id="table"]')!;
    expect([...table.shadowRoot!.querySelectorAll('tbody td')].map(cell => cell.textContent?.trim()).filter(Boolean)).to.deep.equal(['January', '0', 'February', '12']);
    const form = element.shadowRoot!.querySelector('form')!;
    form.requestSubmit();
    expect(actions).to.equal(0);
    element.enabledActions = ['save'];
    await element.updateComplete;
    const requested = oneEvent(element, 'lr-gen-action');
    form.requestSubmit();
    const event = await requested as CustomEvent;
    expect(event.detail.payload).to.deep.equal({ note: 'Saved user edit', agreed: true });
    expect(actions).to.equal(1);
    const next = structuredClone(snapshot.view);
    const fields = next.root.children!.find(node => node.id === 'form')!.children!;
    const note = fields.find(node => node.id === 'note')!;
    const root = { ...next.root, children: next.root.children!.map(node => node.id === 'form' ? { ...node, children: fields.map(field => field.id === 'note' ? { ...note, props: { ...note.props, value: 'New model default' } } : field) } : node) };
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = { ...next, revision: 3, root };
    await ready;
    expect(input.value).to.equal('Saved user edit');
  });

  it('leaves the server content intact when identity, catalog, or state is invalid', async () => {
    const section = await serverFixture();
    const original = section.querySelector('table');
    section.dataset['revision'] = '99';
    expect((await restoreGenSnapshotElement(section, catalog)).ok).to.equal(false);
    expect(section.querySelector('table') === original).to.equal(true);
    section.dataset['revision'] = '2';
    expect((await restoreGenSnapshotElement(section, { ...catalog, version: 'other' })).ok).to.equal(false);
    const template = section.querySelector<HTMLTemplateElement>('template[data-lyra-gen-state]')!;
    const envelope = JSON.parse(template.getAttribute('data-lyra-gen-state')!) as { snapshot: { state: { values: Record<string, unknown> } } };
    envelope.snapshot.state.values['unauthorized'] = 'forged';
    template.setAttribute('data-lyra-gen-state', JSON.stringify(envelope));
    expect((await restoreGenSnapshotElement(section, catalog)).ok).to.equal(false);
    expect(section.querySelector('table') === original).to.equal(true);
    expect(section.querySelector('lr-gen-view') === null).to.equal(true);
  });

  it('does not replace or activate an aborted restoration', async () => {
    const section = await serverFixture();
    const controller = new AbortController();
    const original = section.querySelector('table');
    const restoring = restoreGenSnapshotElement(section, catalog, { signal: controller.signal });
    controller.abort();
    expect((await restoring).ok).to.equal(false);
    expect(section.querySelector('table') === original).to.equal(true);
    expect(section.querySelector('lr-gen-view') === null).to.equal(true);
  });

  it('supersedes an in-flight restore and only exposes one client element', async () => {
    const section = await serverFixture();
    const first = restoreGenSnapshotElement(section, catalog);
    const second = restoreGenSnapshotElement(section, catalog);
    expect((await first).ok).to.equal(false);
    const restored = viewOf(await second);
    await waitUntil(() => restored.status === 'ready');
    expect(section.querySelectorAll('lr-gen-view').length).to.equal(1);
    expect(restored.enabledActions).to.deep.equal([]);
  });
});
