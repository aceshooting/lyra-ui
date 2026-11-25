import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { createCatalog, dashboardCatalog } from '../../src/catalog.js';
import { answerMediaRoles, mediaComponents } from '../../src/catalogs/answers-media.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }
const base = dashboardCatalog();
const roles = { ...answerMediaRoles, ...mediaComponents(base, { origins: ['https://cdn.example.com'] }) };
const catalog: LyraGenCatalog = createCatalog({ ...base, id: `${base.id}+media`, components: { ...base.components, ...roles } });
const scenarios: Readonly<Record<string, LyraGenNode>> = {
  calendar: { id: 'subject', type: 'calendar', props: { name: 'Team calendar', events: [{ id: 'a', title: 'Planning', start: '2026-12-01T09:00:00Z', end: '2026-12-01T10:00:00Z', location: 'Room 4' }, { id: 'b', title: 'Holiday', start: '2026-12-25', allDay: true }] } },
  geojson: { id: 'subject', type: 'geojson', props: { name: 'Sites', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Zurich' }, geometry: { type: 'Point', coordinates: [8.54, 47.37] } }] } } },
  'media-card': { id: 'subject', type: 'media-card', props: { src: 'https://cdn.example.com/files/report.pdf', kind: 'file', alt: 'Quarterly report', filename: 'report.pdf' } },
  'entity-card': { id: 'subject', type: 'entity-card', props: { entity: { id: 'acme', label: 'Acme Corp', description: 'Primary supplier.', properties: { Region: 'EU', Contracts: 4 }, degree: 12, communityId: 'suppliers' }, communityLabel: 'Suppliers', headingLevel: '3' } },
};

async function mount(root: LyraGenNode, dir: 'ltr' | 'rtl'): Promise<{ host: LyraGenViewElement; subject: UpdatingElement }> {
  const document: LyraGenView = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'media-qualification', revision: 0, root };
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir}><lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view></div>`);
  const host = wrapper.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => host.status === 'ready' || host.status === 'error', 'Media role settled', { timeout: 5000 });
  const subject = host.shadowRoot!.querySelector<UpdatingElement>('[data-gen-id="subject"]');
  return { host, subject: subject as UpdatingElement };
}

describe('media answer roles rendered qualification', () => {
  it('keeps a scenario for every media role', () => {
    expect(Object.keys(scenarios).sort()).to.deep.equal(Object.keys(roles).sort());
  });

  for (const [role, root] of Object.entries(scenarios)) {
    it(`renders ${role} with its trusted tag and no accessibility violations in LTR and RTL`, async () => {
      for (const dir of ['ltr', 'rtl'] as const) {
        const { host, subject } = await mount(root, dir);
        expect(host.status).to.equal('ready');
        expect(subject.localName).to.equal(roles[role]!.tag);
        await subject.updateComplete;
        await expect(host).to.be.accessible();
      }
    });
  }

  it('shows the entity dossier without a focus button', async () => {
    const { subject } = await mount(scenarios['entity-card']!, 'ltr');
    await subject.updateComplete;
    expect(Reflect.get(subject, 'withoutFocusButton')).to.equal(true);
    expect(subject.shadowRoot!.textContent).to.include('Acme Corp');
    expect(subject.shadowRoot!.querySelector('button')).to.equal(null);
  });

  it('refuses media outside the approved origin before mounting anything', async () => {
    const { host } = await mount({ id: 'subject', type: 'media-card', props: { src: 'https://evil.example.net/a.png', kind: 'image', alt: 'Chart' } }, 'ltr');
    expect(host.status).to.equal('error');
    expect(host.shadowRoot!.querySelector('lr-media-card')).to.equal(null);
  });
});
