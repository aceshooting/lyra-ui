import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './rag-answer.js';
import type { LyraRagAnswer } from './rag-answer.class.js';
import type { LyraSourceCard } from '../source-card/source-card.class.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

function assertiveSink(): HTMLElement {
  return document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`
  )!;
}

// The opt-in mount announcement is deliberately deferred past the first paint, so the shared
// region is mounted in an earlier task than the text that lands in it.
async function settleInitialAnnouncement(
  el: LyraRagAnswer
): Promise<void> {
  await el.updateComplete;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  await el.updateComplete;
}

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-rag-answer', 'error');
describe('lr-rag-answer', () => {
  it('shows a localized idle message only when no answer or evidence is present', async () => {
    const el = (await fixture(html`<lr-rag-answer .strings=${{ ragAnswerEmpty: 'Waiting for an answer' }}></lr-rag-answer>`)) as LyraRagAnswer;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.getAttribute('heading')).to.equal('Waiting for an answer');
    el.answer = 'Ready';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]') === null).to.equal(true);
  });
  it('renders answer evidence and sources', async () => {
    const el = (await fixture(
      html`<lr-rag-answer
        .strings=${{ ragAnswerLabel: 'Answer' }}
        answer="Answer"
        .citations=${[{ id: 'c1', sourceId: 'd1' }]}
        .sources=${[{ id: 'd1', name: 'guide.md', mimeType: 'text/markdown' }]}
        .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-markdown')).to.exist;
    const grounding = el.shadowRoot!.querySelector(
      'lr-grounding-summary'
    ) as HTMLElement & {
      updateComplete: Promise<unknown>;
      shadowRoot: ShadowRoot;
    };
    await grounding.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll(':scope > article > lr-citation-badge')
        .length
    ).to.equal(0);
    expect(
      grounding.shadowRoot.querySelectorAll('lr-citation-badge').length
    ).to.equal(1);
    const sourceList = el.shadowRoot!.querySelector('lr-source-list');
    expect(Boolean(sourceList)).to.be.true;
    const sourceCard = sourceList!.querySelector(
      'lr-source-card'
    ) as LyraSourceCard;
    await sourceCard.updateComplete;
    const chrome = getComputedStyle(
      sourceCard.shadowRoot!.querySelector('[part="base"]') as HTMLElement
    );
    expect(sourceCard.frame).to.equal('plain');
    expect(sourceCard.textContent).to.contain('text/markdown');
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
  });

  it('does not expose composed events from its owned Markdown renderer', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer answer="**Grounded answer**"></lr-rag-answer>
    `);
    const markdown = el.shadowRoot!.querySelector('lr-markdown')!;
    const leaked: string[] = [];
    for (const name of [
      'lr-render-error',
      'lr-link-activate',
      'lr-highlight-activate',
      'lr-text-select',
      'lr-anchor-result',
    ]) {
      const listener = () => {
        leaked.push(name);
      };
      el.addEventListener(name, listener);
      markdown.dispatchEvent(
        new CustomEvent(name, {
          bubbles: true,
          composed: true,
          detail: {},
        })
      );
      el.removeEventListener(name, listener);
    }
    expect(leaked).to.deep.equal([]);
  });

  it('does not expose retired link-click from a real rendered Markdown link', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer .answer=${'[source](https://example.com/source)'}></lr-rag-answer>
    `);
    const markdown = el.shadowRoot!.querySelector('lr-markdown')!;
    await waitUntil(() => markdown.shadowRoot!.querySelector('a') !== null);
    const link = markdown.shadowRoot!.querySelector('a')!;
    let retiredEvents = 0;
    let canonicalEvents = 0;
    el.addEventListener('lr-link-click', () => retiredEvents++);
    el.addEventListener('lr-link-activate', () => canonicalEvents++);
    link.addEventListener('click', (event) => event.preventDefault());
    link.click();
    expect(retiredEvents).to.equal(0);
    expect(canonicalEvents).to.equal(0);
  });

  it('hides the sources section entirely when withoutSources is set, even with real sources data', async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: 'c1', sourceId: 'd1' }]}
      .sources=${[{ id: 'd1', name: 'guide.md' }]}
      .withoutSources=${true}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .false;
  });

  it('parses the without-sources attribute', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer
        answer="Answer"
        without-sources
        .sources=${[{ id: 'd1', name: 'guide.md' }]}
      ></lr-rag-answer>
    `);
    expect(el.withoutSources).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="sources"]') === null).to.equal(
      true
    );
  });

  it('restores the default for withoutSources/withoutClaims once their attribute is removed', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer
        answer="Answer"
        without-sources
        without-claims
      ></lr-rag-answer>
    `);
    expect(el.withoutSources).to.equal(true);
    expect(el.withoutClaims).to.equal(true);

    el.removeAttribute('without-sources');
    el.removeAttribute('without-claims');
    await el.updateComplete;

    expect(el.withoutSources).to.equal(false);
    expect(el.withoutClaims).to.equal(false);
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
        error-text="Retrieval failed"
        .citations=${[{ id: 'c1', sourceId: 'd1' }]}
        .sources=${[{ id: 'd1', name: 'guide.md' }]}
        .strings=${strings}
      ></lr-rag-answer>
    `)) as LyraRagAnswer;
    const citations = el.shadowRoot!.querySelector(
      '[part="citations"]'
    ) as HTMLElement | null;
    const sources = el.shadowRoot!.querySelector(
      '[part="sources"]'
    ) as HTMLElement | null;
    const sourceList = el.shadowRoot!.querySelector('lr-source-list') as
      | (HTMLElement & { label: string; updateComplete: Promise<unknown> })
      | null;
    await sourceList?.updateComplete;

    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')
    ).to.equal('Réponse étayée');
    expect(
      el.shadowRoot!.querySelector('[part="retry"]')?.textContent?.trim()
    ).to.equal('Réessayer la réponse');
    expect(citations?.getAttribute('aria-label')).to.equal('Références');
    expect(
      citations?.querySelector('[part="section-heading"]')?.textContent?.trim()
    ).to.equal('Références');
    expect(sources?.getAttribute('aria-label')).to.equal('Documents');
    expect(
      sources?.querySelector('[part="section-heading"]')?.textContent?.trim()
    ).to.equal('Documents');
    expect(sourceList?.label).to.equal('Documents');

    el.errorText = '';
    el.loading = true;
    await el.updateComplete;
    const spinnerName = el
      .shadowRoot!.querySelector('lr-spinner')
      ?.shadowRoot?.querySelector('[role="progressbar"]')
      ?.getAttribute('aria-label');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')
    ).to.equal('Réponse étayée');
    expect(spinnerName).to.equal('Loading…');
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
    const slot = sourceList!.querySelector(
      'slot[name="sources"]'
    ) as HTMLSlotElement;
    expect(
      slot
        .assignedElements()
        .map((element) => element.getAttribute('data-source'))
    ).to.deep.equal(['']);
  });

  it('keeps a slotted answer visible while loading even when the answer property is empty', async () => {
    const el = (await fixture(html`
      <lr-rag-answer loading>
        <div slot="answer" data-answer>Partial answer</div>
      </lr-rag-answer>
    `)) as LyraRagAnswer;
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="answer"]'))).to.be.true;
    expect(Boolean(el.shadowRoot!.querySelector('[part="loading"]'))).to.be
      .true;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-busy')
    ).to.equal('true');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('data-state')
    ).to.equal('loading');
    const slot = el.shadowRoot!.querySelector(
      'slot[name="answer"]'
    ) as HTMLSlotElement;
    expect(
      slot
        .assignedElements()
        .map((element) => element.getAttribute('data-answer'))
    ).to.deep.equal(['']);
  });

  it('keeps a property answer, spinner, and truthful busy state together while streaming', async () => {
    const el = (await fixture(
      html`<lr-rag-answer
        loading
        answer="A partial property answer"
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const article = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(article.getAttribute('data-state')).to.equal('loading');
    expect(article.getAttribute('aria-busy')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[part="loading"]')).to.exist;
    expect(
      (
        el.shadowRoot!.querySelector('lr-markdown') as HTMLElement & {
          content: string;
        }
      ).content
    ).to.equal('A partial property answer');

    el.loading = false;
    await el.updateComplete;
    expect(article.getAttribute('data-state')).to.equal('answer');
    expect(article.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('[part="loading"]') === null).to.be
      .true;
  });

  it('detects a sources slot added after the initial render', async () => {
    const el = (await fixture(
      html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .false;

    const source = document.createElement('div');
    source.slot = 'sources';
    source.textContent = 'Late source';
    el.append(source);
    await aTimeout(0);
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .true;
  });

  it('detects a direct child retargeted into the sources slot', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer answer="Answer"
        ><div data-source>Retargeted source</div></lr-rag-answer
      >
    `);
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.equal(
      false
    );

    (el.querySelector('[data-source]') as HTMLElement).slot = 'sources';
    await Promise.resolve();
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.equal(
      true
    );
  });

  it('settles generated and incremental sources across reconnect without a child change-in-update', async () => {
    const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> })
      .litIssuedWarnings;
    globalWarnings?.forEach((warning) => {
      if (warning.includes('scheduled an update'))
        globalWarnings.delete(warning);
    });
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) =>
      warnings.push(args.map(String).join(' '));
    try {
      const el = (await fixture(html`<lr-rag-answer
        answer="Answer"
        .sources=${[
          { id: 'd1', name: 'guide.md' },
          { id: 'd2', name: 'spec.md' },
        ]}
      ></lr-rag-answer>`)) as LyraRagAnswer;
      const sourceList = el.shadowRoot!.querySelector(
        'lr-source-list'
      ) as HTMLElement & {
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
      expect(
        [...sourceList.children].map((child) => child.getAttribute('role'))
      ).to.deep.equal([null, null, null]);
      fixtureParent.append(el);
      await el.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(3);
      expect(
        [...sourceList.children].map((child) => child.getAttribute('role'))
      ).to.deep.equal(['listitem', 'listitem', 'listitem']);
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.some((warning) => warning.includes('scheduled an update')))
      .to.be.false;
  });
  it('is accessible in loading and populated states', async () => {
    await expect(
      (await fixture(
        html`<lr-rag-answer loading></lr-rag-answer>`
      )) as LyraRagAnswer
    ).to.be.accessible();
    await expect(
      (await fixture(
        html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
      )) as LyraRagAnswer
    ).to.be.accessible();
  });
  it('announces only new errors through an assertive light-DOM sink', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error-text="Initial failure"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const sink = () =>
      document.querySelector('[data-lr-live-region="assertive"]')!;
    const visibleError = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(
      visibleError.getAttribute('role'),
      'the visible error is not a shadow live region'
    ).to.be.null;
    expect(
      sink().children.length,
      'initial content is not replayed as an announcement'
    ).to.equal(0);

    el.errorText = 'A newer failure';
    await el.updateComplete;
    expect(sink().lastElementChild?.textContent).to.equal('A newer failure');

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(
      sink().children.length,
      'reconnect does not replay the current error'
    ).to.equal(0);
  });
  it('announces the error it already carries on mount when announce is set', async () => {
    const el = (await fixture(
      html`<lr-rag-answer announce error-text="Retrieval failed"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await settleInitialAnnouncement(el);
    expect(el.announce, 'announce reflects the authored attribute').to.equal(
      true
    );
    expect(el.getAttribute('announce')).to.equal('');
    expect(
      Array.from(
        assertiveSink().children,
        (child) => child.textContent
      )
    ).to.deep.equal(['Retrieval failed']);
    await expect(el).to.be.accessible();
  });
  it('keeps an announce rag answer with no error silent on mount', async () => {
    const el = (await fixture(
      html`<lr-rag-answer announce answer="All good"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await settleInitialAnnouncement(el);
    expect(
      document.querySelectorAll(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > *`
      ).length,
      'there is no presented error state to announce'
    ).to.equal(0);
  });
  it('keeps mount silent while announce is unset, with later errors still announced', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error-text="Retrieval failed"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await settleInitialAnnouncement(el);
    expect(el.announce, 'announce defaults to false').to.equal(false);
    expect(el.hasAttribute('announce')).to.equal(false);
    expect(
      assertiveSink().children.length,
      'an unannounced rag answer stays silent on mount'
    ).to.equal(0);

    el.errorText = 'A newer failure';
    await el.updateComplete;
    expect(
      Array.from(assertiveSink().children, (child) => child.textContent)
    ).to.deep.equal(['A newer failure']);
  });
  it('does not replay the initial announcement when an announce rag answer reconnects', async () => {
    const el = (await fixture(
      html`<lr-rag-answer announce error-text="Retrieval failed"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await settleInitialAnnouncement(el);
    expect(assertiveSink().children.length).to.equal(1);

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await settleInitialAnnouncement(el);
    expect(
      assertiveSink().children.length,
      'reconnect stages the existing error again rather than replaying it'
    ).to.equal(0);
  });
  // 9.0.0 renamed `error` -> `errorText`/`error-text`, the spelling 25 other components (including
  // this one's own sibling `<lr-retrieval-search>`) already use for exactly this member.
  it('exposes caller-supplied failure text only as errorText; the removed `error` spelling is inert', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error="Legacy failure"></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect('error' in el).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(
      0
    );

    el.errorText = 'Current failure';
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="error"]')?.textContent
    ).to.equal('Current failure');
  });
  it("keeps exactly one article owner while retaining the spinner's purpose name", async () => {
    const el = (await fixture(
      html`<lr-rag-answer loading label="Grounded response"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const spinnerLabel = () =>
      el
        .shadowRoot!.querySelector('lr-spinner')!
        .shadowRoot!.querySelector('[role="progressbar"]')!
        .getAttribute('aria-label');

    expect(spinnerLabel()).to.equal('Loading…');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
    ).to.equal('Grounded response');
    el.setAttribute('aria-label', 'Loading quarterly evidence');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal(
      'Loading quarterly evidence'
    );
    expect(spinnerLabel()).to.equal('Loading…');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
    ).to.equal(null);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
    ).to.equal('presentation');

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('');
    expect(spinnerLabel()).to.equal('Loading…');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
    ).to.equal('');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
    ).to.equal('article');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal(null);
    expect(spinnerLabel()).to.equal('Loading…');
  });
  it('defaults to an unset label', async () => {
    const el = (await fixture(
      html`<lr-rag-answer></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect(el.label).to.be.undefined;
  });
  it('keeps an explicitly empty label genuinely empty instead of falling back to the localized default', async () => {
    const el = (await fixture(
      html`<lr-rag-answer label="" answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.label).to.equal('');
    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')
    ).to.equal('');
  });
  it('forwards claim-level visibility to its grounding summary', async () => {
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [
        {
          id: 'claim-1',
          text: 'Supported',
          status: 'supported' as const,
          citationIds: [],
        },
      ],
    };
    const el = (await fixture(
      html`<lr-rag-answer
        .assessment=${assessment}
        .withoutClaims=${true}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const summary = el.shadowRoot!.querySelector(
      'lr-grounding-summary'
    ) as HTMLElement & { withoutClaims: boolean };
    expect(summary.withoutClaims).to.be.true;
  });
  it('emits lr-retry from the underlying button click contract', async () => {
    const el = (await fixture(
      html`<lr-rag-answer error-text="Retrieval failed"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const pending = oneEvent(el, 'lr-retry');
    (el.shadowRoot!.querySelector('[part="retry"]') as HTMLElement)
      .shadowRoot!.querySelector('button')!
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
      .sources=${[
        { id: 'd1', name: 'guide.md' },
        { id: 'd2', name: 'spec.md' },
      ]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    const badges = [...el.shadowRoot!.querySelectorAll('lr-citation-badge')];
    expect(badges.length).to.equal(2);

    let leaked = 0;
    el.addEventListener('lr-citation-activate', () => leaked++);
    const pending = oneEvent(el, 'lr-citation-select');
    // The badge's own index is 1-based, so index 2 resolves to citations[1].
    badges[1]!.dispatchEvent(
      new CustomEvent('lr-citation-activate', {
        detail: { index: 2 },
        bubbles: true,
        composed: true,
      })
    );
    const event = await pending;
    expect(
      event.detail as { citation: { id: string }; section: string }
    ).to.deep.equal({
      citation: citations[1],
      section: 'answer',
      action: 'activate',
    });
    expect(leaked, "the child's own event does not escape the host").to.equal(
      0
    );
  });

  it('contains and translates citation-open from answer and grounding badges', async () => {
    const citation = { id: 'c1', sourceId: 'd1', label: 'First' };
    const el = (await fixture(html`
      <lr-rag-answer
        answer="Answer"
        .citations=${[citation]}
        .sources=${[{ id: 'd1', name: 'guide.md' }]}
      ></lr-rag-answer>
    `)) as LyraRagAnswer;
    let leaked = 0;
    el.addEventListener('lr-citation-open', () => leaked++);
    const answerPending = oneEvent(el, 'lr-citation-select');
    el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
      new CustomEvent('lr-citation-open', {
        detail: { index: 1, sourceId: 'd1' },
        bubbles: true,
        composed: true,
      })
    );
    expect((await answerPending).detail).to.deep.equal({
      citation,
      section: 'answer',
      action: 'open',
    });
    expect(leaked).to.equal(0);

    el.assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
    };
    await el.updateComplete;
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as
      | (HTMLElement & { updateComplete: Promise<unknown> })
      | null;
    await summary!.updateComplete;
    const groundingPending = oneEvent(el, 'lr-citation-select');
    summary!.dispatchEvent(
      new CustomEvent('lr-citation-open', {
        detail: { citation },
        bubbles: true,
        composed: true,
      })
    );
    expect((await groundingPending).detail).to.deep.equal({
      citation,
      section: 'grounding',
      action: 'open',
    });
    expect(leaked).to.equal(0);
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
      new CustomEvent('lr-citation-activate', {
        detail: { index: 99 },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(selected).to.equal(0);
  });

  it('keeps one article owner across states and correlates grounding citation actions by section', async () => {
    const citation = { id: 'c1', sourceId: 'd1', label: 'First' };
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
    };
    const el = (await fixture(
      html`<lr-rag-answer
        label="Grounded response"
        .citations=${[citation]}
        .assessment=${assessment}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const initialArticle = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(initialArticle.tagName).to.equal('ARTICLE');
    expect(
      el.shadowRoot!.querySelectorAll('[part="citations"]').length
    ).to.equal(0);

    const summary = el.shadowRoot!.querySelector(
      'lr-grounding-summary'
    ) as HTMLElement & {
      updateComplete: Promise<unknown>;
      shadowRoot: ShadowRoot;
    };
    await summary.updateComplete;
    const pending = oneEvent(el, 'lr-citation-select');
    (
      summary.shadowRoot.querySelector('lr-citation-badge') as HTMLElement
    ).dispatchEvent(
      new CustomEvent('lr-citation-activate', {
        detail: { sourceId: 'd1', index: 1 },
        bubbles: true,
        composed: true,
      })
    );
    expect((await pending).detail).to.deep.equal({
      citation,
      section: 'grounding',
      action: 'activate',
    });

    el.loading = true;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]') === initialArticle
    ).to.equal(true);
    expect(initialArticle.getAttribute('data-state')).to.equal('loading');

    el.errorText = 'Failure';
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]') === initialArticle
    ).to.equal(true);
    expect(initialArticle.getAttribute('data-state')).to.equal('error');
    expect(initialArticle.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('[part="loading"]') === null).to.be
      .true;
  });

  it('degrades to no slotted-content tracking instead of throwing in a realm without MutationObserver', () => {
    const el = document.createElement('lr-rag-answer') as LyraRagAnswer;
    const OriginalMutationObserver = window.MutationObserver;
    (
      window as unknown as { MutationObserver?: typeof MutationObserver }
    ).MutationObserver = undefined;
    try {
      expect(() => el.connectedCallback()).to.not.throw();
      const observer = (el as unknown as { slotObserver?: MutationObserver })
        .slotObserver;
      expect(
        observer === undefined,
        'no observer is armed without a constructor to build it from'
      ).to.equal(true);
    } finally {
      el.disconnectedCallback();
      window.MutationObserver = OriginalMutationObserver;
    }
  });

  it('omits blank and later duplicate citation, source, and nested claim ids before composition and actions', async () => {
    const firstCitation = { id: 'citation-1', sourceId: 'source-1' };
    const firstSource = { id: 'source-1', name: 'First source' };
    const firstClaim = {
      id: 'claim-1',
      text: 'First claim',
      status: 'supported' as const,
      citationIds: ['citation-1'],
    };
    const el = (await fixture(
      html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    el.citations = [
      { ...firstCitation, id: ' ' },
      firstCitation,
      { ...firstCitation, sourceId: 'later-source' },
    ];
    el.sources = [
      { ...firstSource, id: '' },
      firstSource,
      { ...firstSource, name: 'Later source' },
    ];
    el.assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [
        { ...firstClaim, id: '' },
        firstClaim,
        { ...firstClaim, text: 'Later claim' },
      ],
    };
    await el.updateComplete;

    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as
      | (HTMLElement & {
          assessment: { claims?: readonly unknown[] };
          citations: readonly unknown[];
          updateComplete: Promise<unknown>;
        })
      | null;
    expect(summary).to.exist;
    expect(summary!.assessment.claims).to.deep.equal([firstClaim]);
    expect(summary!.citations).to.deep.equal([firstCitation]);
    expect(el.shadowRoot!.querySelectorAll('lr-source-card').length).to.equal(
      1
    );

    el.assessment = null;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('lr-citation-badge').length
    ).to.equal(1);
    const selected = oneEvent(el, 'lr-citation-select');
    el.shadowRoot!.querySelector<HTMLElement>(
      'lr-citation-badge'
    )!.dispatchEvent(
      new CustomEvent('lr-citation-activate', {
        bubbles: true,
        composed: true,
        detail: { index: 1 },
      })
    );
    expect((await selected).detail).to.deep.equal({
      citation: firstCitation,
      section: 'answer',
      action: 'activate',
    });
  });
});

describe('lr-rag-answer retired show-sources alias', () => {
  const ALIAS_SOURCES = [{ id: 'd1', name: 'guide.md' }];
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-rag-answer', kind: 'property', name: 'showSources' }];
  const observe = (el: LyraRagAnswer): string => String(el.shadowRoot!.querySelector('[part="sources"]') !== null);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraRagAnswer>(markup);

  it('applies without-sources with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-rag-answer answer="Answer" .sources=${ALIAS_SOURCES} without-sources></lr-rag-answer>`));
      plain = observe(await mount(html`<lr-rag-answer answer="Answer" .sources=${ALIAS_SOURCES}></lr-rag-answer>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

describe('lr-rag-answer retired show-claims alias', () => {
  const ALIAS_ASSESSMENT = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [{ id: 'claim-1', text: 'Claim', status: 'supported' as const, citationIds: [] }],
  };
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-rag-answer', kind: 'property', name: 'showClaims' }];
  const observe = (el: LyraRagAnswer): string => String((el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { withoutClaims: boolean }).withoutClaims);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraRagAnswer>(markup);

  it('applies without-claims with canonical defaults and no deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-rag-answer .assessment=${ALIAS_ASSESSMENT} without-claims></lr-rag-answer>`));
      plain = observe(await mount(html`<lr-rag-answer .assessment=${ALIAS_ASSESSMENT}></lr-rag-answer>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });
});

describe('review fixes', () => {
  const citations = [
    { id: 'a', label: 'Dropped span', span: null },
    { id: 'b', label: 'Second' },
    { id: 'c', label: 'Third' },
  ] as unknown as { id: string }[];
  const assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };

  async function dblclick(badge: HTMLElement): Promise<void> {
    const button = badge.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    button.click();
    button.click();
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
  }

  it('reports a double-click as two activates then one open, so a host can tell them apart', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer answer="x" .citations=${citations}></lr-rag-answer>`);
    const seen: string[] = [];
    el.addEventListener('lr-citation-select', (event) => {
      const detail = (event as CustomEvent<{ citation: { id: string }; action: string }>).detail;
      seen.push(`${detail.citation.id}:${detail.action}`);
    });
    await dblclick(el.shadowRoot!.querySelectorAll<HTMLElement>('lr-citation-badge')[2]!);
    expect(seen).to.deep.equal(['c:activate', 'c:activate', 'c:open']);
  });

  it('opens the citation a grounding badge shows, even when an earlier citation has a malformed span', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer .citations=${citations} .assessment=${assessment}></lr-rag-answer>`);
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { updateComplete: Promise<unknown> };
    await summary.updateComplete;
    const badges = summary.shadowRoot!.querySelectorAll<HTMLElement>('lr-citation-badge');
    expect(badges.length).to.equal(3);
    const seen: string[] = [];
    el.addEventListener('lr-citation-select', (event) => {
      const detail = (event as CustomEvent<{ citation: { id: string }; section: string; action: string }>).detail;
      seen.push(`${detail.citation.id}:${detail.section}:${detail.action}`);
    });
    await dblclick(badges[2]!);
    expect(seen).to.deep.equal(['c:grounding:activate', 'c:grounding:activate', 'c:grounding:open']);
  });

  it('keeps the Markdown, source card and source list housekeeping events inside, and surfaces lr-open', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer answer="x" .sources=${[{ id: 'd1', name: 'guide.md' }]}></lr-rag-answer>`);
    const leaked: string[] = [];
    for (const name of ['lr-content-settled', 'lr-copy', 'lr-copy-error', 'lr-expand', 'lr-toggle'])
      el.addEventListener(name, () => leaked.push(name));
    const opened: unknown[] = [];
    el.addEventListener('lr-open', (event) => opened.push((event as CustomEvent).detail));
    const fire = (target: Element, name: string): void => {
      target.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    };
    fire(el.shadowRoot!.querySelector('lr-markdown')!, 'lr-content-settled');
    fire(el.shadowRoot!.querySelector('lr-markdown')!, 'lr-copy');
    fire(el.shadowRoot!.querySelector('lr-markdown')!, 'lr-copy-error');
    fire(el.shadowRoot!.querySelector('lr-source-card')!, 'lr-expand');
    fire(el.shadowRoot!.querySelector('lr-source-list')!, 'lr-toggle');
    const card = el.shadowRoot!.querySelector('lr-source-card') as LyraSourceCard;
    await card.updateComplete;
    card.shadowRoot!.querySelector<HTMLElement>('[part="title"]')!.click();
    expect(leaked).to.deep.equal([]);
    expect(opened).to.deep.equal([{ sourceId: 'd1', href: '' }]);
  });

  it('does not stop the lr-expand of consumer content slotted into sources', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer answer="x"><lr-source-card slot="sources" source-id="s"></lr-source-card></lr-rag-answer>`);
    let expands = 0;
    el.addEventListener('lr-expand', () => (expands += 1));
    el.querySelector('lr-source-card')!.dispatchEvent(new CustomEvent('lr-expand', { bubbles: true, composed: true }));
    expect(expands).to.equal(1);
  });

  it('hands the grounding summary the same assessment and citations while the answer streams', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer answer="a" .citations=${[citations[1]]} .assessment=${assessment}></lr-rag-answer>`);
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { assessment: unknown; citations: unknown };
    const before = [summary.assessment, summary.citations];
    el.answer = 'a b';
    await el.updateComplete;
    el.answer = 'a b c';
    await el.updateComplete;
    expect(summary.assessment === before[0] && summary.citations === before[1]).to.equal(true);
  });
});

describe('lr-rag-answer heading level', () => {
  it('keeps level 3 by default, takes heading-level, and forwards it to the grounding summary', async () => {
    const el = await fixture<LyraRagAnswer>(html`<lr-rag-answer .citations=${[{ id: 'a' }]} .sources=${[{ id: 'd', name: 'doc' }]}></lr-rag-answer>`);
    const headings = (): (string | null)[] => [...el.shadowRoot!.querySelectorAll('[part="section-heading"]')].map((heading) => heading.getAttribute('aria-level'));
    expect(headings()).to.deep.equal(['3', '3']);
    el.setAttribute('heading-level', '5');
    await el.updateComplete;
    expect(headings()).to.deep.equal(['5', '5']);
    el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('lr-grounding-summary') as HTMLElement & { headingLevel: string }).headingLevel).to.equal('5');
    el.setAttribute('heading-level', 'none');
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll('[part="section-heading"]')].map((heading) => heading.getAttribute('role'))).to.deep.equal([null]);
  });
});
