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

  it('uses the host label for the semantic owner and supports localized strings', async () => {
    const el = await fixture<LyraResearchProgress>(html`
      <lr-research-progress aria-label="Evidence gathering" .steps=${steps}
        .strings=${{ researchProgressLabel: 'Source review', researchProgressStatusRunning: 'Working' }}></lr-research-progress>
    `);
    expect(el.shadowRoot!.querySelector('[part="progress"]')?.getAttribute('aria-label')).to.equal('Evidence gathering');
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Source review');
    expect(el.shadowRoot!.textContent).to.contain('Working');
  });

  it('restores the localized visible label when the label attribute is removed', async () => {
    const el = await fixture<LyraResearchProgress>(html`<lr-research-progress label="Custom progress"></lr-research-progress>`);
    el.removeAttribute('label');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Research progress');
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
