import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './rag-answer.js';
import type { LyraRagAnswer } from './rag-answer.class.js';
import type { LyraSourceCard } from '../source-card/source-card.class.js';
describe('lr-rag-answer', () => {
  it('renders answer evidence and sources', async () => {
    const el = (await fixture(html`<lr-rag-answer .strings=${{ ragAnswerLabel: 'Answer' }} answer="Answer" .citations=${[{ id: 'c1', sourceId: 'd1' }]} .sources=${[{ id: 'd1', name: 'guide.md' }]} .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-markdown')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-grounding-summary')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-citation-badge')).to.exist;
    const sourceList = el.shadowRoot!.querySelector('lr-source-list');
    expect(Boolean(sourceList)).to.be.true;
    const sourceCard = sourceList!.querySelector('lr-source-card') as LyraSourceCard;
    await sourceCard.updateComplete;
    const chrome = getComputedStyle(sourceCard.shadowRoot!.querySelector('[part="base"]') as HTMLElement);
    expect(sourceCard.frame).to.equal('plain');
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
  });

  it('hides the sources section entirely when showSources is false, even with real sources data', async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: 'c1', sourceId: 'd1' }]}
      .sources=${[{ id: 'd1', name: 'guide.md' }]}
      .showSources=${false}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be.false;
  });

  it('renders per-instance strings overrides on every localized answer surface', async () => {
    const strings = {
      ragAnswerLabel: 'Réponse étayée',
      ragAnswerRetry: 'Réessayer la réponse',
      ragAnswerCitations: 'Références',
      ragAnswerSources: 'Documents',
    };
    const el = (await fixture(html`
      <lr-rag-answer
        error="Retrieval failed"
        .citations=${[{ id: 'c1', sourceId: 'd1' }]}
        .sources=${[{ id: 'd1', name: 'guide.md' }]}
        .strings=${strings}
      ></lr-rag-answer>
    `)) as LyraRagAnswer;
    const citations = el.shadowRoot!.querySelector('[part="citations"]') as HTMLElement | null;
    const sources = el.shadowRoot!.querySelector('[part="sources"]') as HTMLElement | null;
    const sourceList = el.shadowRoot!.querySelector('lr-source-list') as
      | (HTMLElement & { label: string; updateComplete: Promise<unknown> })
      | null;
    await sourceList?.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Réponse étayée');
    expect(el.shadowRoot!.querySelector('[part="retry"]')?.textContent?.trim()).to.equal('Réessayer la réponse');
    expect(citations?.getAttribute('aria-label')).to.equal('Références');
    expect(citations?.querySelector('[part="section-heading"]')?.textContent?.trim()).to.equal('Références');
    expect(sources?.getAttribute('aria-label')).to.equal('Documents');
    expect(sources?.querySelector('[part="section-heading"]')?.textContent?.trim()).to.equal('Documents');
    expect(sourceList?.label).to.equal('Documents');

    el.error = '';
    el.loading = true;
    await el.updateComplete;
    const spinnerName = el.shadowRoot!
      .querySelector('lr-spinner')
      ?.shadowRoot?.querySelector('[role="progressbar"]')
      ?.getAttribute('aria-label');
    expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Réponse étayée');
    expect(spinnerName).to.equal('Réponse étayée');
  });

  it('renders a declarative sources slot without requiring a redundant sources property', async () => {
    const el = (await fixture(html`
      <lr-rag-answer answer="Answer">
        <div slot="sources" data-source>Custom source</div>
      </lr-rag-answer>
    `)) as LyraRagAnswer;
    await el.updateComplete;

    const sourceList = el.shadowRoot!.querySelector('lr-source-list');
    expect(Boolean(sourceList)).to.be.true;
    const slot = sourceList!.querySelector('slot[name="sources"]') as HTMLSlotElement;
    expect(slot.assignedElements().map((element) => element.getAttribute('data-source'))).to.deep.equal(['']);
  });

  it('keeps a slotted answer visible while loading even when the answer property is empty', async () => {
    const el = (await fixture(html`
      <lr-rag-answer loading>
        <div slot="answer" data-answer>Partial answer</div>
      </lr-rag-answer>
    `)) as LyraRagAnswer;
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="answer"]'))).to.be.true;
    expect(Boolean(el.shadowRoot!.querySelector('[part="loading"]'))).to.be.false;
    const slot = el.shadowRoot!.querySelector('slot[name="answer"]') as HTMLSlotElement;
    expect(slot.assignedElements().map((element) => element.getAttribute('data-answer'))).to.deep.equal(['']);
  });

  it('detects a sources slot added after the initial render', async () => {
    const el = (await fixture(html`<lr-rag-answer answer="Answer"></lr-rag-answer>`)) as LyraRagAnswer;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be.false;

    const source = document.createElement('div');
    source.slot = 'sources';
    source.textContent = 'Late source';
    el.append(source);
    await aTimeout(0);
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be.true;
  });

  it('settles generated and incremental sources across reconnect without a child change-in-update', async () => {
    const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    globalWarnings?.forEach((warning) => {
      if (warning.includes('scheduled an update')) globalWarnings.delete(warning);
    });
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
    try {
      const el = (await fixture(html`<lr-rag-answer
        answer="Answer"
        .sources=${[
          { id: 'd1', name: 'guide.md' },
          { id: 'd2', name: 'spec.md' },
        ]}
      ></lr-rag-answer>`)) as LyraRagAnswer;
      const sourceList = el.shadowRoot!.querySelector('lr-source-list') as HTMLElement & {
        sourceCount: number;
        updateComplete: Promise<boolean>;
      };
      await sourceList.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(2);

      el.sources = [...el.sources, { id: 'd3', name: 'notes.md' }];
      await el.updateComplete;
      await sourceList.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(3);

      const fixtureParent = el.parentElement!;
      el.remove();
      expect([...sourceList.children].map((child) => child.getAttribute('role'))).to.deep.equal([
        null,
        null,
        null,
      ]);
      fixtureParent.append(el);
      await el.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(3);
      expect([...sourceList.children].map((child) => child.getAttribute('role'))).to.deep.equal([
        'listitem',
        'listitem',
        'listitem',
      ]);
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.some((warning) => warning.includes('scheduled an update'))).to.be.false;
  });
  it('is accessible in loading and populated states', async () => {
    await expect((await fixture(html`<lr-rag-answer loading></lr-rag-answer>`)) as LyraRagAnswer).to.be.accessible();
    await expect((await fixture(html`<lr-rag-answer answer="Answer"></lr-rag-answer>`)) as LyraRagAnswer).to.be.accessible();
  });
  it('announces only new errors through an assertive light-DOM sink', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error="Initial failure"></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const sink = () => document.querySelector('[data-lr-live-region="assertive"]')!;
    const visibleError = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(visibleError.getAttribute('role'), 'the visible error is not a shadow live region').to.be.null;
    expect(sink().children.length, 'initial content is not replayed as an announcement').to.equal(0);

    el.error = 'A newer failure';
    await el.updateComplete;
    expect(sink().lastElementChild?.textContent).to.equal('A newer failure');

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(sink().children.length, 'reconnect does not replay the current error').to.equal(0);
  });
  it('forwards late host aria-label changes and removal to the loading spinner semantic owner', async () => {
    const el = (await fixture(
      html`<lr-rag-answer loading label="Grounded response"></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const spinnerLabel = () =>
      el.shadowRoot!.querySelector('lr-spinner')!.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label');

    expect(spinnerLabel()).to.equal('Grounded response');
    el.setAttribute('aria-label', 'Loading quarterly evidence');
    await el.updateComplete;
    expect(spinnerLabel()).to.equal('Loading quarterly evidence');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(spinnerLabel()).to.equal('Grounded response');
  });
  it('forwards claim-level visibility to its grounding summary', async () => {
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [{ id: 'claim-1', text: 'Supported', status: 'supported' as const, citationIds: [] }],
    };
    const el = (await fixture(
      html`<lr-rag-answer .assessment=${assessment} .showClaims=${false}></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { showClaims: boolean };
    expect(summary.showClaims).to.be.false;
  });
  it('emits lr-retry from the underlying button click contract', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error="Retrieval failed"></lr-rag-answer>`,
    )) as LyraRagAnswer;
    const pending = oneEvent(el, 'lr-retry');
    (el.shadowRoot!.querySelector('[part="retry"]') as HTMLElement).shadowRoot!
      .querySelector('button')!
      .click();
    expect((await pending).type).to.equal('lr-retry');
  });

  it('re-emits an activated citation as lr-citation-select, and swallows the child event', async () => {
    const citations = [
      { id: 'c1', sourceId: 'd1', label: 'First' },
      { id: 'c2', sourceId: 'd2', label: 'Second' },
    ];
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${citations}
      .sources=${[{ id: 'd1', name: 'guide.md' }, { id: 'd2', name: 'spec.md' }]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    const badges = [...el.shadowRoot!.querySelectorAll('lr-citation-badge')];
    expect(badges.length).to.equal(2);

    let leaked = 0;
    el.addEventListener('lr-citation-activate', () => leaked++);
    const pending = oneEvent(el, 'lr-citation-select');
    // The badge's own index is 1-based, so index 2 resolves to citations[1].
    badges[1]!.dispatchEvent(
      new CustomEvent('lr-citation-activate', { detail: { index: 2 }, bubbles: true, composed: true }),
    );
    const event = await pending;
    expect((event.detail as { citation: { id: string } }).citation.id).to.equal('c2');
    expect(leaked, "the child's own event does not escape the host").to.equal(0);
  });

  it('ignores an activation whose index falls outside the citation list', async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: 'c1', sourceId: 'd1' }]}
      .sources=${[{ id: 'd1', name: 'guide.md' }]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    let selected = 0;
    el.addEventListener('lr-citation-select', () => selected++);
    el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
      new CustomEvent('lr-citation-activate', { detail: { index: 99 }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    expect(selected).to.equal(0);
  });

  it('degrades to no slotted-content tracking instead of throwing in a realm without MutationObserver', () => {
    const el = document.createElement('lr-rag-answer') as LyraRagAnswer;
    const OriginalMutationObserver = window.MutationObserver;
    (window as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver = undefined;
    try {
      expect(() => el.connectedCallback()).to.not.throw();
      const observer = (el as unknown as { slotObserver?: MutationObserver }).slotObserver;
      expect(observer === undefined, 'no observer is armed without a constructor to build it from').to.equal(true);
    } finally {
      el.disconnectedCallback();
      window.MutationObserver = OriginalMutationObserver;
    }
  });
});
