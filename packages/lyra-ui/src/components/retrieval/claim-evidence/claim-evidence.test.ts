import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { Citation, GroundedClaim } from '../../../ai/types.js';
import './claim-evidence.js';
import type { LyraClaimEvidence } from './claim-evidence.js';

const claims: GroundedClaim[] = [
  {
    id: 'claim-1',
    text: 'Lyra is built with Lit.',
    status: 'supported',
    citationIds: ['cite-1'],
    confidence: 0.96,
  },
  {
    id: 'claim-2',
    text: 'Every claim is supported.',
    status: 'unsupported',
    citationIds: ['missing'],
    explanation: 'No matching source was found.',
  },
];

const citations: Citation[] = [
  {
    id: 'cite-1',
    sourceId: 'doc-1',
    label: 'Architecture',
    quote: 'Lyra components extend Lit.',
  },
];

it('renders claim status, confidence, and only evidence that resolves', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  expect(el.shadowRoot!.querySelectorAll('[part~="claim"]').length).to.equal(2);
  expect(
    el.shadowRoot!.querySelector('[part="confidence"]')!.textContent
  ).to.contain('96%');
  expect(el.shadowRoot!.querySelectorAll('lr-citation-badge').length).to.equal(
    1
  );
  expect(el.shadowRoot!.textContent).to.contain(
    'No matching source was found.'
  );
});

it('renders distinct localized labels for partially supported and contradicted claims', async () => {
  const el = await fixture<LyraClaimEvidence>(html`
    <lr-claim-evidence
      .claims=${[
        {
          id: 'partial',
          text: 'Partially grounded',
          status: 'partially-supported',
          citationIds: [],
        },
        {
          id: 'contradicted',
          text: 'Contradicted by evidence',
          status: 'contradicted',
          citationIds: [],
        },
      ] as GroundedClaim[]}
      .strings=${{
        claimEvidencePartiallySupported: 'Partial evidence',
        claimEvidenceContradicted: 'Contradicting evidence',
      }}
    ></lr-claim-evidence>
  `);

  expect(
    [...el.shadowRoot!.querySelectorAll('[part="status"]')].map((status) =>
      status.textContent?.trim()
    )
  ).to.deep.equal(['Partial evidence', 'Contradicting evidence']);
});

it('fails an unrecognized claim status closed to the visible unsupported treatment', async () => {
  const el = await fixture<LyraClaimEvidence>(html`
    <lr-claim-evidence
      .claims=${[
        {
          id: 'future-status',
          text: 'Backend status is newer than this client',
          status: 'uncertain',
          citationIds: [],
        },
      ] as unknown as GroundedClaim[]}
    ></lr-claim-evidence>
  `);

  const status = el.shadowRoot!.querySelector(
    'lr-badge[part="status"]'
  ) as HTMLElement & {
    variant: string;
  };
  expect(status.textContent?.trim()).to.equal('Unsupported');
  expect(status.variant).to.equal('danger');
});

it('emits controlled claim and citation selection events with complete records', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  const claimEvent = oneEvent(el, 'lr-claim-select');
  (
    el.shadowRoot!.querySelector('[part="claim-trigger"]') as HTMLButtonElement
  ).click();
  expect((await claimEvent).detail).to.deep.equal({ claim: claims[0] });

  const citationEvent = oneEvent(el, 'lr-citation-select');
  (
    el
      .shadowRoot!.querySelector('lr-citation-badge')!
      .shadowRoot!.querySelector('button') as HTMLButtonElement
  ).click();
  expect((await citationEvent).detail).to.deep.equal({
    citation: citations[0],
  });
});

it('stops the internal lr-citation-badge lr-citation-activate event before re-emitting lr-citation-select', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  let leaked = false;
  el.addEventListener('lr-citation-activate', () => (leaked = true));
  const citationEvent = oneEvent(el, 'lr-citation-select');
  (
    el
      .shadowRoot!.querySelector('lr-citation-badge')!
      .shadowRoot!.querySelector('button') as HTMLButtonElement
  ).click();
  await citationEvent;
  expect(leaked).to.be.false;
});

it('lets a nested citation-open event cross the host unchanged', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  const detail = { index: 1, sourceId: 'doc-1', href: '#evidence' };
  const pending = oneEvent(el, 'lr-citation-open');
  el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
    new CustomEvent('lr-citation-open', {
      detail,
      bubbles: true,
      composed: true,
    })
  );
  expect((await pending).detail).to.deep.equal(detail);
});

it('applies per-instance strings to claim status', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims.slice(0, 1)}
      .strings=${{ claimEvidenceSupported: 'Pris en charge' }}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  expect(
    el.shadowRoot!.querySelector('[part="status"]')?.textContent?.trim()
  ).to.equal('Pris en charge');
});

it('keeps exactly one overall claim owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      aria-label="Evidence audit"
      selected-claim-id="claim-2"
      .claims=${claims}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Evidence audit');
  expect(base().getAttribute('aria-label')).to.equal(null);
  expect(base().getAttribute('role')).to.equal(null);
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(true);
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(base().getAttribute('aria-label')).to.equal('');
  expect(base().getAttribute('role')).to.equal('region');
  el.setAttribute('aria-label', 'Revised audit');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised audit');
  expect(base().getAttribute('aria-label')).to.equal(null);
  expect(base().getAttribute('role')).to.equal(null);
  expect(
    el
      .shadowRoot!.querySelector('[part~="claim-selected"]')!
      .getAttribute('aria-current')
  ).to.equal('true');
  expect(el.selectedClaimId).to.equal('claim-2');
  await expect(el).shadowDom.to.be.accessible();
});

it('renders explicit true and false aria-current values for the stateful claim set', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      selected-claim-id="claim-2"
      .claims=${claims}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  expect(
    [...el.shadowRoot!.querySelectorAll('[part~="claim"]')].map((claim) =>
      claim.getAttribute('aria-current')
    )
  ).to.deep.equal(['false', 'true']);
});

it('applies per-instance strings to the evidence region label', async () => {
  const el = (await fixture(html`<lr-claim-evidence
    .strings=${{ claimEvidenceLabel: 'Localized evidence review' }}
  ></lr-claim-evidence>`)) as LyraClaimEvidence;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Localized evidence review');
});

it('defaults frame to card, keeping the claim row bordered and filled', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  expect(el.frame).to.equal('card');
  const claimRow = el.shadowRoot!.querySelector(
    '[part~="claim"]'
  ) as HTMLElement;
  const style = getComputedStyle(claimRow);
  expect(style.borderTopWidth).to.not.equal('0px');
  expect(style.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
});

it('suppresses the claim row border and background when frame is plain', async () => {
  const el = (await fixture(
    html`<lr-claim-evidence
      frame="plain"
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  const claimRow = el.shadowRoot!.querySelector(
    '[part~="claim"]'
  ) as HTMLElement;
  const style = getComputedStyle(claimRow);
  expect(style.borderTopWidth).to.equal('0px');
  expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  expect(style.borderRadius).to.equal('0px');
});

it('tightens claim-trigger padding and gap when compact', async () => {
  const defaultEl = (await fixture(
    html`<lr-claim-evidence
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  expect(defaultEl.compact).to.be.false;
  const defaultTrigger = defaultEl.shadowRoot!.querySelector(
    '[part="claim-trigger"]'
  ) as HTMLElement;
  const defaultPadding = parseFloat(
    getComputedStyle(defaultTrigger).paddingInlineStart
  );

  const compactEl = (await fixture(
    html`<lr-claim-evidence
      compact
      .claims=${claims}
      .citations=${citations}
    ></lr-claim-evidence>`
  )) as LyraClaimEvidence;
  const compactTrigger = compactEl.shadowRoot!.querySelector(
    '[part="claim-trigger"]'
  ) as HTMLElement;
  const compactPadding = parseFloat(
    getComputedStyle(compactTrigger).paddingInlineStart
  );
  const compactGap = parseFloat(getComputedStyle(compactTrigger).columnGap);

  expect(compactPadding).to.be.lessThan(defaultPadding);
  expect(compactGap).to.be.lessThan(
    parseFloat(getComputedStyle(defaultTrigger).columnGap)
  );
});

it('omits blank and later duplicate claim and citation ids before lookup, render, and events', async () => {
  const claim: GroundedClaim = {
    id: 'claim',
    text: 'First claim',
    status: 'supported',
    citationIds: ['citation'],
  };
  const citation: Citation = {
    id: 'citation',
    sourceId: 'source',
    label: 'First citation',
  };
  const el = (await fixture(html`
    <lr-claim-evidence
      .claims=${[
        { ...claim, id: '' },
        claim,
        { ...claim, text: 'Later claim' },
      ]}
      .citations=${[
        { ...citation, id: '   ' },
        citation,
        { ...citation, label: 'Later citation' },
      ]}
    ></lr-claim-evidence>
  `)) as LyraClaimEvidence;

  expect(el.shadowRoot!.querySelectorAll('[part~="claim"]').length).to.equal(1);
  expect(
    el.shadowRoot!.querySelector('[part="claim-text"]')!.textContent
  ).to.equal('First claim');

  const claimPending = oneEvent(el, 'lr-claim-select');
  (
    el.shadowRoot!.querySelector('[part="claim-trigger"]') as HTMLButtonElement
  ).click();
  expect((await claimPending).detail).to.deep.equal({ claim });

  const citationPending = oneEvent(el, 'lr-citation-select');
  (
    el
      .shadowRoot!.querySelector('lr-citation-badge')!
      .shadowRoot!.querySelector('button') as HTMLButtonElement
  ).click();
  expect((await citationPending).detail).to.deep.equal({ citation });
});
