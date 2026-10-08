import { fixture, expect, html } from '@open-wc/testing';
import './research-progress.js';
import type { LyraResearchProgress, ResearchStep } from './research-progress.class.js';

const steps: ResearchStep[] = [
  { id: 'query', label: 'Search the library', status: 'completed', sources: 4 },
  { id: 'read', label: 'Read selected sources', description: 'Compare the evidence.', status: 'running', sources: -2 },
  { id: 'answer', label: 'Write answer', status: 'pending', sources: Number.NaN },
  { id: 'verify', label: 'Verify citations', status: 'failed', sources: 1.5 },
];

describe('lr-research-progress', () => {
  it('renders ordered steps, aggregate completion, statuses, and normalized source counts', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${steps}></lr-research-progress>`);
    expect(el.shadowRoot!.querySelectorAll('[part="step"]')).to.have.lengthOf(4);
    expect([...el.shadowRoot!.querySelectorAll('[part="step"]')].map((step) => step.getAttribute('data-step-id')))
      .to.deep.equal(['query', 'read', 'answer', 'verify']);
    expect(el.shadowRoot!.querySelector('[part="progress"]')?.getAttribute('aria-valuenow')).to.equal('25');
    const progress = el.shadowRoot!.querySelector<HTMLElement>('[part="progress"]')!;
    expect(parseFloat(getComputedStyle(progress, '::before').width))
      .to.be.closeTo(progress.getBoundingClientRect().width * 0.25, 1);
    expect(el.shadowRoot!.querySelector('[data-step-id="query"] [part="sources"]')?.textContent).to.contain('4');
    expect(Boolean(el.shadowRoot!.querySelector('[data-step-id="read"] [part="sources"]'))).to.be.false;
    expect(el.shadowRoot!.textContent).to.contain('In progress');
    expect(el.shadowRoot!.textContent).to.contain('Failed');
  });

  it('renders an incomplete step as Incomplete with its own state and never inflates progress', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress
      .steps=${[
        { id: 'a', label: 'A', status: 'completed' },
        { id: 'b', label: 'B', status: 'incomplete' },
        { id: 'c', label: 'C', status: 'pending' },
        { id: 'd', label: 'D', status: 'pending' },
      ] as ResearchStep[]}
    ></lr-research-progress>`);
    const step = el.shadowRoot!.querySelector('[data-step-id="b"]') as HTMLElement;
    expect(step.getAttribute('data-status')).to.equal('incomplete');
    expect(step.querySelector('[part="status"]')!.textContent).to.equal('Incomplete');
    expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-valuenow')).to.equal('25');
    el.strings = { statusIncomplete: 'Inachevé' };
    await el.updateComplete;
    expect(step.querySelector('[part="status"]')!.textContent).to.equal('Inachevé');
  });

  it('keeps a step with an unrecognised status, shown as localized unknown, instead of dropping it', async () => {
    (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.delete('lr-research-progress:unknown-status');
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
    let el: LyraResearchProgress;
    try {
      el = await fixture<LyraResearchProgress>(html`<lr-research-progress
      .steps=${[
        { id: 'a', label: 'A', status: 'completed' },
        { id: 'b', label: 'B', status: 'provider-specific' },
      ] as unknown as ResearchStep[]}
      ></lr-research-progress>`);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.some((warning) => warning.includes('provider-specific'))).to.equal(true);
    const step = el.shadowRoot!.querySelector('[data-step-id="b"]') as HTMLElement;
    expect(step.getAttribute('data-status')).to.equal('unknown');
    expect(step.querySelector('[part="status"]')?.textContent).to.equal('Unknown');
    expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-valuenow')).to.equal('50');
    el.strings = { statusUnknown: 'Inconnu' };
    await el.updateComplete;
    expect(step.querySelector('[part="status"]')?.textContent).to.equal('Inconnu');
  });

  it('accepts shared terminal spellings while preserving research-specific labels and counts', async () => {
    const aliases: ResearchStep[] = [
      { id: 'a', label: 'A', status: 'success' },
      { id: 'b', label: 'B', status: 'done' },
      { id: 'c', label: 'C', status: 'complete' },
      { id: 'd', label: 'D', status: 'error' },
      { id: 'e', label: 'E', status: 'cancelled' },
    ];
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${aliases}></lr-research-progress>`);
    const rows = [...el.shadowRoot!.querySelectorAll('[part="step"]')];
    expect(rows.map((row) => row.getAttribute('data-status'))).to.deep.equal(['completed', 'completed', 'completed', 'failed', 'incomplete']);
    expect(el.shadowRoot!.querySelector('[part="progress"]')?.getAttribute('aria-valuenow')).to.equal('60');
    el.strings = { researchProgressStatusCompleted: 'Fini' };
    await el.updateComplete;
    expect(rows[0]?.querySelector('[part="status"]')?.textContent).to.equal('Fini');
  });

  it('keeps first valid identities, caps mounted rows, owns the assigned snapshot, and updates on replacement', async () => {
    const many: ResearchStep[] = Array.from({ length: 102 }, (_, index) => ({
      id: `step-${index}`,
      label: `Step ${index}`,
      status: index === 0 ? 'completed' : 'pending',
    }));
    const source = [steps[0]!, { ...steps[0]!, label: 'Duplicate should not win' }, { ...steps[1]!, id: '  ' }, ...many];
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${source}></lr-research-progress>`);
    source[0]!.label = 'Changed outside';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="step"]')).to.have.lengthOf(100);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('100');
    expect(el.shadowRoot!.textContent).to.contain('Search the library');
    expect(el.shadowRoot!.textContent).not.to.contain('Duplicate should not win');
    el.steps = [{ id: 'replacement', label: 'Replacement', status: 'completed' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="step"]')).to.have.lengthOf(1);
    expect(el.shadowRoot!.textContent).to.contain('Replacement');
    expect(el.shadowRoot!.textContent).not.to.contain('Search the library');
    const progress = el.shadowRoot!.querySelector<HTMLElement>('[part="progress"]')!;
    expect(parseFloat(getComputedStyle(progress, '::before').width))
      .to.be.closeTo(progress.getBoundingClientRect().width, 1);
  });

  it('lets a host label own the group, names the progressbar from its own purpose, and supports localized strings', async () => {
    const el = await fixture<LyraResearchProgress>(html`
      <lr-research-progress aria-label="Evidence gathering" .steps=${steps}
        .strings=${{ researchProgressLabel: 'Source review', researchProgressStatusRunning: 'Working' }}></lr-research-progress>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal(null);
    expect(base.getAttribute('aria-label')).to.equal(null);
    expect(el.shadowRoot!.querySelector('[part="progress"]')?.getAttribute('aria-label')).to.equal('Source review');
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Source review');
    expect(el.shadowRoot!.textContent).to.contain('Working');
  });

  it('names its own group from the label when the host carries no name', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress label="Literature review" .steps=${steps}></lr-research-progress>`);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Literature review');
  });

  it('never leaves the progressbar unnamed, even for an explicitly empty label', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress label="" .steps=${steps}></lr-research-progress>`);
    expect(el.shadowRoot!.querySelector('[part="progress"]')!.getAttribute('aria-label')).to.equal('Research progress');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress label="Custom progress"></lr-research-progress>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Research progress');
  });

  it('renders the shared empty state when there are no steps', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress></lr-research-progress>`);
    const empty = el.shadowRoot!.querySelector('[part="empty"]')!;
    expect(empty.localName).to.equal('lr-empty');
    expect(empty.getAttribute('heading')).to.equal('No research steps are available.');
  });

  it('is accessible empty and fits long data inside a narrow RTL allocation', async () => {
    const empty = await fixture<LyraResearchProgress>(html`<lr-research-progress></lr-research-progress>`);
    await expect(empty).to.be.accessible();
    const populated = await fixture<LyraResearchProgress>(html`
      <lr-research-progress dir="rtl" style="inline-size: 320px" .steps=${[
        { id: 'long', label: 'مراجعة المصادر طويلة للغاية '.repeat(9), description: 'تفاصيل '.repeat(40), status: 'running' as const, sources: 1200 },
      ]}></lr-research-progress>
    `);
    await expect(populated).to.be.accessible();
    const host = populated.getBoundingClientRect();
    const list = populated.shadowRoot!.querySelector('[part="list"]')!.getBoundingClientRect();
    const step = populated.shadowRoot!.querySelector('[part="step"]')!.getBoundingClientRect();
    expect(populated.scrollWidth).to.be.at.most(populated.clientWidth);
    expect(list.left).to.be.at.least(host.left - 1);
    expect(list.right).to.be.at.most(host.right + 1);
    expect(step.left).to.be.at.least(host.left - 1);
    expect(step.right).to.be.at.most(host.right + 1);
    expect(getComputedStyle(populated.shadowRoot!.querySelector('[part="step-label"]')!).direction).to.equal('rtl');
  });
});

describe('lr-research-progress heading level', () => {
  it('keeps level 2 by default, takes heading-level, and drops heading semantics for none', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${steps}></lr-research-progress>`);
    const heading = (): Element => el.shadowRoot!.querySelector('[part="label"]')!;
    expect([heading().getAttribute('role'), heading().getAttribute('aria-level')]).to.deep.equal(['heading', '2']);
    el.setAttribute('heading-level', '4');
    await el.updateComplete;
    expect(heading().getAttribute('aria-level')).to.equal('4');
    el.setAttribute('heading-level', 'none');
    await el.updateComplete;
    expect([heading().getAttribute('role'), heading().getAttribute('aria-level')]).to.deep.equal([null, null]);
  });
});


it('shares progress paint hooks and the locale-formatted accessible percentage', async () => {
  const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${steps}></lr-research-progress>`);
  el.style.setProperty('--lr-progress-track-color', 'rgb(12, 34, 56)');
  el.style.setProperty('--lr-progress-indicator-color', 'rgb(65, 43, 21)');
  el.style.setProperty('--lr-progress-track-radius', '9px');
  const progress = el.shadowRoot!.querySelector<HTMLElement>('[part="progress"]')!;
  expect(getComputedStyle(progress).backgroundColor).to.equal('rgb(12, 34, 56)');
  expect(getComputedStyle(progress, '::before').backgroundColor).to.equal('rgb(65, 43, 21)');
  expect(getComputedStyle(progress).borderStartStartRadius).to.equal('9px');
  expect(progress.getAttribute('aria-valuetext')).to.equal(
    el.shadowRoot!.querySelector('[part="progress-label"]')!.textContent
  );
  expect(progress.getAttribute('aria-valuenow')).to.equal('25');
});

it('lr-research-progress drops its card chrome under frame="plain" and tightens padding under a dense size', async () => {
  const el = await fixture<LyraResearchProgress>(html`<lr-research-progress .steps=${steps}></lr-research-progress>`);
  await el.updateComplete;
  const target = () => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(el.frame).to.equal('card');
  expect(getComputedStyle(target()).borderTopWidth).to.not.equal('0px');
  const padding = getComputedStyle(target()).paddingTop;
  el.size = 's';
  await el.updateComplete;
  expect(getComputedStyle(target()).paddingTop).to.not.equal(padding);
  el.frame = 'plain';
  await el.updateComplete;
  expect(getComputedStyle(target()).borderTopWidth).to.equal('0px');
});
