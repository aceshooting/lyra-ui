import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './provenance-panel.js';
import type {
  LyraProvenancePanel,
  LyraProvenance,
} from './provenance-panel.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const provenance: LyraProvenance = {
  entities: [{ id: 'e1', label: 'Marie Curie', type: 'person' }],
  relationships: [
    {
      path: [
        { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
        { kind: 'edge', relation: 'discovered' },
        { kind: 'node', node: { id: 'e2', label: 'Polonium' } },
      ],
    },
  ],
  communities: [{ id: 'c1', label: 'Nobel laureates', memberCount: 3 }],
  chunks: [{ id: 'ch1', text: 'chunk text', score: 0.8, sourceId: 's1' }],
};

it('renders the provenanceEmpty state when provenance is null (the default)', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  expect(el.provenance).to.equal(null);
  expect(el.label).to.be.undefined;
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('keeps an explicitly empty label genuinely empty instead of falling back to the localized default', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel
      label=""
      .provenance=${provenance}
    ></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  await el.updateComplete;
  expect(el.label).to.equal('');
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('');
});

it('keeps exactly one stable owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel
      label="Evidence trail"
      aria-label=""
    ></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  const shell = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect([
    shell().getAttribute('role'),
    shell().getAttribute('aria-label'),
  ]).to.deep.equal(['group', '']);
  expect(el.getAttribute('aria-label')).to.equal('');

  el.provenance = { entities: provenance.entities };
  await el.updateComplete;
  expect([
    shell().getAttribute('role'),
    shell().getAttribute('aria-label'),
  ]).to.deep.equal(['group', '']);

  el.setAttribute('aria-label', 'Author provenance');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Author provenance');
  expect(shell().getAttribute('aria-label')).to.equal(null);
  expect(shell().getAttribute('role')).to.equal(null);

  el.provenance = null;
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect([
    shell().getAttribute('role'),
    shell().getAttribute('aria-label'),
  ]).to.deep.equal(['group', 'Evidence trail']);
});

it('renders one section per non-empty provenance key, in fixed order, and omits empty ones', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = { entities: provenance.entities };
  await el.updateComplete;
  const sections = el.shadowRoot!.querySelectorAll('[part="section"]');
  expect(sections.length).to.equal(1);
  expect(sections[0]!.textContent).to.include('Entities');
});

it('renders all four sections with counts when every key is present', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  const headers = [...el.shadowRoot!.querySelectorAll('[part="header"]')].map(
    (h) => h.textContent
  );
  expect(headers.some((h) => h!.includes('Entities') && h!.includes('1'))).to.be
    .true;
  expect(headers.some((h) => h!.includes('Relationships'))).to.be.true;
  expect(headers.some((h) => h!.includes('Communities'))).to.be.true;
  expect(headers.some((h) => h!.includes('Text chunks'))).to.be.true;
});

it('renders entities as lr-entity-chip with resolved typeLabel from types', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = { entities: provenance.entities };
  el.types = [{ id: 'person', label: 'Person' }];
  await el.updateComplete;
  const chip = el.shadowRoot!.querySelector('lr-entity-chip')!;
  expect(chip.getAttribute('type-label')).to.equal('Person');
  await (chip as unknown as { updateComplete: Promise<unknown> })
    .updateComplete;
  expect(
    chip.shadowRoot!.querySelector('[part="label"]')!.textContent
  ).to.equal('Marie Curie');
});

it('renders relationships as lr-path-strip, communities as compact lr-community-card, chunks as compact lr-chunk-inspector', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-path-strip')).to.exist;
  const communityCard = el.shadowRoot!.querySelector('lr-community-card')!;
  expect(communityCard.hasAttribute('compact')).to.be.true;
  const inspector = el.shadowRoot!.querySelector('lr-chunk-inspector')!;
  expect(inspector.hasAttribute('compact')).to.be.true;
});

it('all four sections start expanded, and toggling one emits lr-toggle without collapsing the others', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  const headers = el.shadowRoot!.querySelectorAll('[part="header"]');
  expect([...headers].every((h) => h.getAttribute('aria-expanded') === 'true'))
    .to.be.true;

  const listener = oneEvent(el, 'lr-toggle');
  (headers[0] as HTMLButtonElement).click();
  const event = await listener;
  expect(event.detail.expanded).to.be.false;
  await el.updateComplete;
  expect(headers[0]!.getAttribute('aria-expanded')).to.equal('false');
  expect(headers[1]!.getAttribute('aria-expanded')).to.equal('true');
});

it('re-emits child events unmodified (lr-chunk-open bubbles through)', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = { chunks: provenance.chunks };
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-chunk-open');
  (
    el
      .shadowRoot!.querySelector('lr-chunk-inspector')!
      .shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement
  ).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ chunkId: 'ch1', sourceId: 's1' });
});

describe('localization', () => {
  it('localizes a section title, the group aria-label, and the empty-state heading via .strings', async () => {
    const empty = (await fixture(
      html`<lr-provenance-panel
        .strings=${{ provenanceEmpty: 'Aucune donnée' }}
      ></lr-provenance-panel>`
    )) as LyraProvenancePanel;
    await empty.updateComplete;
    expect(
      empty.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading')
    ).to.equal('Aucune donnée');

    const populated = (await fixture(
      html`<lr-provenance-panel
        .strings=${{
          provenanceEntities: 'Entités',
          provenancePanelLabel: 'Justification',
        }}
        .provenance=${{ entities: provenance.entities }}
      ></lr-provenance-panel>`
    )) as LyraProvenancePanel;
    await populated.updateComplete;
    expect(
      populated.shadowRoot!.querySelector('[part="header"]')!.textContent
    ).to.include('Entités');
    expect(
      populated
        .shadowRoot!.querySelector('[part="base"]')!
        .getAttribute('aria-label')
    ).to.equal('Justification');
  });
});

it('is accessible with full provenance', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = provenance;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('treats non-array provenance sections as empty and omits malformed nested rows', async () => {
  const el = await fixture<LyraProvenancePanel>(html`
    <lr-provenance-panel
      .provenance=${{
        entities: { id: 'collapsed-object' },
        relationships: [null, { path: 'not-an-array' }],
        communities: [null, { id: 'community', label: 'Valid community' }],
        chunks: [
          null,
          { id: 'chunk', text: 'Valid chunk', score: 0.5, sourceId: 'source' },
        ],
      } as unknown as LyraProvenancePanel['provenance']}
    ></lr-provenance-panel>
  `);

  expect(el.shadowRoot!.querySelectorAll('lr-entity-chip').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('lr-path-strip').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('lr-community-card').length).to.equal(
    1
  );
  expect(el.shadowRoot!.querySelectorAll('lr-chunk-inspector').length).to.equal(
    1
  );
  await expect(el).shadowDom.to.be.accessible();
});

it('renders the disclosure header hover/focus-visible feedback', async () => {
  const el = await fixture<LyraProvenancePanel>(html`
    <lr-provenance-panel
      style="--lr-color-brand-quiet: rgb(1, 2, 3); --lr-focus-ring-width: 6px; --lr-focus-ring-color: rgb(4, 5, 6)"
      .provenance=${provenance}
    ></lr-provenance-panel>
  `);
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  target.scrollIntoView({ block: 'center' });
  const rect = target.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    await waitUntil(
      () => getComputedStyle(target).backgroundColor === 'rgb(1, 2, 3)',
      'the provenance disclosure hover background never painted'
    );
  } finally {
    await resetMouse();
  }

  await sendKeys({ press: 'Tab' });
  target.focus();
  await waitUntil(() => {
    const computed = getComputedStyle(target);
    return computed.outlineWidth === '6px' && computed.outlineColor === 'rgb(4, 5, 6)';
  }, 'the provenance disclosure keyboard focus ring never painted');
});

it('formats section counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-provenance-panel lang="ar-u-nu-arab"></lr-provenance-panel>`
  )) as LyraProvenancePanel;
  el.provenance = {
    entities: Array.from({ length: 12 }, (_, index) => ({
      id: `entity-${index}`,
      label: `Entity ${index}`,
    })),
  };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="count"]')!.textContent).to.equal(
    '١٢'
  );
});

describe('part="entity-row" / --lr-provenance-panel-entity-justify', () => {
  const entityRow = async (style = '') => {
    const el = (await fixture(
      html`<lr-provenance-panel style=${style}></lr-provenance-panel>`
    )) as LyraProvenancePanel;
    el.provenance = { entities: provenance.entities };
    await el.updateComplete;
    return el.shadowRoot!.querySelector<HTMLElement>('[part~="entity-row"]');
  };

  it('exposes the wrapping entity-chip row as a part', async () => {
    expect((await entityRow())?.tagName).to.equal('DIV');
  });

  it('packs entity chips to the start when the property is unset (unset regression)', async () => {
    expect(getComputedStyle((await entityRow())!).justifyContent).to.equal(
      'flex-start'
    );
  });

  it('centers the entity chips when --lr-provenance-panel-entity-justify is set', async () => {
    const row = await entityRow(
      '--lr-provenance-panel-entity-justify: center;'
    );
    expect(getComputedStyle(row!).justifyContent).to.equal('center');
  });
});
