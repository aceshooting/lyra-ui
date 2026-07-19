import { fixture, expect, html } from '@open-wc/testing';
import './policy-summary.js';
import type { LyraPolicySummary, PolicyDecision } from './policy-summary.js';

const decisions: PolicyDecision[] = [
  {
    id: 'd1',
    category: 'guardrail',
    label: 'Self-harm content',
    state: 'allow',
    explanation: 'No self-harm content was detected in this response.',
  },
  {
    id: 'd2',
    category: 'permission',
    label: 'Read customer records',
    state: 'deny',
    explanation: 'This agent is not permitted to read customer PII in this workspace.',
    detail: 'Matched rule "no-pii-read" (policy v3). Evidence: field "ssn" requested on table "customers".',
  },
  {
    id: 'd3',
    category: 'privacy',
    label: 'Share location data',
    state: 'needs-review',
    explanation: 'Sharing precise location requires a human reviewer before this can proceed.',
  },
  {
    id: 'd4',
    category: 'tool',
    label: 'run_shell',
    state: 'deny',
    explanation: 'Shell execution is disabled for this session.',
  },
];

describe('lr-policy-summary', () => {
  it('renders lr-empty when decisions is empty', async () => {
    const el = (await fixture(html`<lr-policy-summary></lr-policy-summary>`)) as LyraPolicySummary;
    expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.not.exist;
  });

  it('renders visible localized allow/deny/needs-review counts, never color-only', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    const allow = el.shadowRoot!.querySelector('[part="count"][data-state="allow"]')!;
    const deny = el.shadowRoot!.querySelector('[part="count"][data-state="deny"]')!;
    const review = el.shadowRoot!.querySelector('[part="count"][data-state="needs-review"]')!;
    expect(allow.textContent).to.include('1');
    expect(deny.textContent).to.include('2');
    expect(review.textContent).to.include('1');
  });

  it('renders one listitem per decision inside a role="list" wrapper', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('[part="list"]')!;
    expect(list.getAttribute('role')).to.equal('list');
    const rows = el.shadowRoot!.querySelectorAll('[part="decision"]');
    expect(rows.length).to.equal(4);
    expect(rows[0].getAttribute('role')).to.equal('listitem');
    expect(rows[0].getAttribute('data-state')).to.equal('allow');
    expect(rows[0].getAttribute('data-category')).to.equal('guardrail');
  });

  it('renders the category text, decision label, and a state badge with the mapped variant and localized text', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="decision"]')];
    const denyRow = rows.find((r) => r.getAttribute('data-state') === 'deny' && r.getAttribute('data-category') === 'permission')!;
    expect(denyRow.querySelector('[part="category"]')!.textContent).to.equal('Permission');
    expect(denyRow.querySelector('[part="label"]')!.textContent).to.equal('Read customer records');
    const badge = denyRow.querySelector('[part="state-badge"]') as HTMLElement & { variant: string };
    expect(badge.variant).to.equal('danger');
    expect(badge.textContent!.trim()).to.equal('Deny');

    const allowRow = rows.find((r) => r.getAttribute('data-state') === 'allow')!;
    const allowBadge = allowRow.querySelector('[part="state-badge"]') as HTMLElement & { variant: string };
    expect(allowBadge.variant).to.equal('success');
    expect(allowBadge.textContent!.trim()).to.equal('Allow');

    const reviewRow = rows.find((r) => r.getAttribute('data-state') === 'needs-review')!;
    const reviewBadge = reviewRow.querySelector('[part="state-badge"]') as HTMLElement & { variant: string };
    expect(reviewBadge.variant).to.equal('warning');
    expect(reviewBadge.textContent!.trim()).to.equal('Needs review');
  });

  it('renders the always-visible explanation inside an inline lr-callout with the mapped variant', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="decision"]')];
    const denyRow = rows.find((r) => r.getAttribute('data-state') === 'deny' && r.getAttribute('data-category') === 'permission')!;
    const callout = denyRow.querySelector('[part="explanation"]') as HTMLElement & {
      variant: string;
      inline: boolean;
    };
    expect(callout.tagName.toLowerCase()).to.equal('lr-callout');
    expect(callout.inline).to.be.true;
    expect(callout.variant).to.equal('danger');
    expect(callout.textContent!.trim()).to.equal(
      'This agent is not permitted to read customer PII in this workspace.',
    );
  });

  it('only renders a collapsed lr-details progressive-disclosure panel when detail is defined', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('[part="decision"]')];

    const denyRow = rows.find((r) => r.getAttribute('data-state') === 'deny' && r.getAttribute('data-category') === 'permission')!;
    const detailsEl = denyRow.querySelector('[part="detail"]') as HTMLElement & { open: boolean };
    expect(detailsEl).to.exist;
    expect(detailsEl.tagName.toLowerCase()).to.equal('lr-details');
    expect(detailsEl.open).to.be.false;
    expect(detailsEl.textContent).to.include('Matched rule "no-pii-read"');

    const allowRow = rows.find((r) => r.getAttribute('data-state') === 'allow')!;
    expect(allowRow.querySelector('[part="detail"]')).to.not.exist;
  });

  it('shrinks to a 320px allocation with a long label and explanation without horizontal overflow', async () => {
    const longDecisions: PolicyDecision[] = [
      {
        id: 'long',
        category: 'guardrail',
        label: 'ExtremelyLongUnbrokenGuardrailPolicyRuleIdentifierForTesting',
        state: 'needs-review',
        explanation:
          'This is an intentionally long, unbroken explanation of why this particular decision needs a human reviewer before it can proceed any further in the pipeline.',
      },
    ];
    const el = (await fixture(html`
      <lr-policy-summary style="inline-size: 320px; max-inline-size: 100%;" .decisions=${longDecisions}></lr-policy-summary>
    `)) as LyraPolicySummary;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('renders correctly under dir="rtl" and stays accessible', async () => {
    const el = (await fixture(html`
      <div dir="rtl"><lr-policy-summary .decisions=${decisions}></lr-policy-summary></div>
    `)) as HTMLElement;
    const summary = el.querySelector('lr-policy-summary') as LyraPolicySummary;
    await summary.updateComplete;
    expect(summary.shadowRoot!.querySelectorAll('[part="decision"]').length).to.equal(4);
    await expect(summary).to.be.accessible();
  });

  it('is accessible with a populated, mixed-state list', async () => {
    const el = (await fixture(
      html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
    )) as LyraPolicySummary;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('is accessible in the empty state', async () => {
    const el = (await fixture(html`<lr-policy-summary></lr-policy-summary>`)) as LyraPolicySummary;
    await expect(el).to.be.accessible();
  });

  describe('localization', () => {
    it('localizes state-badge, category, and count text via this.localize()', async () => {
      const el = (await fixture(
        html`<lr-policy-summary
          .decisions=${decisions}
          .strings=${{
            policySummaryStateAllow: 'Autorisé',
            policySummaryStateDeny: 'Refusé',
            policySummaryStateNeedsReview: 'Révision requise',
            policySummaryCategoryGuardrail: 'Garde-fou',
            policySummaryAllowCount: '{count} autorisé',
          }}
        ></lr-policy-summary>`,
      )) as LyraPolicySummary;
      await el.updateComplete;
      const rows = [...el.shadowRoot!.querySelectorAll('[part="decision"]')];
      const allowRow = rows.find((r) => r.getAttribute('data-state') === 'allow')!;
      expect(allowRow.querySelector('[part="state-badge"]')!.textContent!.trim()).to.equal('Autorisé');
      expect(allowRow.querySelector('[part="category"]')!.textContent).to.equal('Garde-fou');
      const allowCount = el.shadowRoot!.querySelector('[part="count"][data-state="allow"]')!;
      expect(allowCount.textContent).to.equal('1 autorisé');
    });

    it('renders the built-in English fallback with no locale registered', async () => {
      const el = (await fixture(
        html`<lr-policy-summary .decisions=${decisions}></lr-policy-summary>`,
      )) as LyraPolicySummary;
      await el.updateComplete;
      const list = el.shadowRoot!.querySelector('[part="list"]')!;
      expect(list.getAttribute('aria-label')).to.equal('Policy decisions');
    });
  });
});
