import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-eval-run.js';
import { LyraEvalRun, type EvalExampleResult } from './evaluation-run.class.js';
import type { Citation } from '../../../ai/types.js';

const examples: EvalExampleResult[] = [{
  id: 'ex-1',
  label: 'Refund policy question',
  status: { kind: 'done' },
  input: { text: 'What is the refund policy?' },
  output: { text: 'Refunds are available within 30 days.' },
  grounding: { supportedClaims: 3, unsupportedClaims: 1, coverage: 0.85, confidence: 0.9 },
}];

function toggle(el: LyraEvalRun, expanded: boolean): void {
  el.shadowRoot!.querySelector('[part="example"]')!.dispatchEvent(
    new CustomEvent('lr-toggle', { bubbles: true, composed: true, detail: { expanded } }),
  );
}

describe('lr-eval-run remediation', () => {
  it('shows and announces a localized notice when the expanded views fail to load, and retries on the next expand', async () => {
    const loader = LyraEvalRun.expandedContentLoader;
    const registration = LyraEvalRun.expandedContentRegistration;
    let calls = 0;
    LyraEvalRun.expandedContentLoader = () => {
      calls++;
      return Promise.reject(new Error('chunk failed'));
    };
    LyraEvalRun.expandedContentRegistration = undefined;
    try {
      const el = await fixture<LyraEvalRun>(html`<lr-eval-run .examples=${examples}></lr-eval-run>`);
      toggle(el, true);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="load-error"]') !== null, 'load error never rendered');
      expect(el.shadowRoot!.querySelector('[part="load-error"]')!.textContent!.trim())
        .to.equal('Could not load the example details. Collapse and expand it to try again.');
      // Painted as an error notice, not as UA body text with 1em margins.
      const notice = getComputedStyle(el.shadowRoot!.querySelector('[part="load-error"]')!);
      const probe = document.createElement('span');
      probe.style.cssText = 'color: var(--lr-color-danger); margin-block-start: var(--lr-space-xs)';
      el.shadowRoot!.append(probe);
      expect(notice.color).to.equal(getComputedStyle(probe).color);
      expect(notice.marginBlockStart).to.equal(getComputedStyle(probe).marginBlockStart);
      probe.remove();
      const region = () => el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
      await waitUntil(() => region().includes('Could not load the example details'), 'failure never announced');
      el.requestUpdate();
      await el.updateComplete;
      expect(calls).to.equal(1);
      toggle(el, false);
      await el.updateComplete;
      LyraEvalRun.expandedContentLoader = loader;
      toggle(el, true);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="load-error"]') === null).to.equal(true);
    } finally {
      LyraEvalRun.expandedContentLoader = loader;
      LyraEvalRun.expandedContentRegistration = registration;
    }
  });

  it('correlates a nested citation preview request with its example and contains nested content events', async () => {
    const el = await fixture<LyraEvalRun>(html`<lr-eval-run .examples=${examples}></lr-eval-run>`);
    const leaked: string[] = [];
    for (const type of ['lr-citation-open', 'lr-content-settled', 'lr-copy', 'lr-tool-approval-open']) {
      el.addEventListener(type, () => leaked.push(type));
    }
    toggle(el, true);
    await el.updateComplete;
    await customElements.whenDefined('lr-grounding-summary');
    await customElements.whenDefined('lr-markdown');
    const output = el.shadowRoot!.querySelector('[part="output"]') as HTMLElement & { updateComplete?: Promise<unknown> };
    await output.updateComplete;
    output.dispatchEvent(new CustomEvent('lr-copy', { bubbles: true, composed: true, detail: { ok: true, text: 'x' } }));
    const citation: Citation = { id: 'cite-1', sourceId: 'doc-1', label: 'Refund policy doc' };
    const firing = oneEvent(el, 'lr-example-citation-open');
    el.shadowRoot!.querySelector('[part="grounding-summary"]')!.dispatchEvent(
      new CustomEvent('lr-citation-open', { detail: { citation }, bubbles: true, composed: true }),
    );
    expect((await firing).detail).to.deep.equal({ exampleId: 'ex-1', citation });
    expect(leaked).to.deep.equal([]);
  });

  it('marks the example render-limit notice as a note and announces it when it first appears', async function () {
    // Rendering the full 500-row ceiling takes about 5 s in WebKit, close to the 6 s default.
    this.timeout(30_000);
    const many: EvalExampleResult[] = Array.from({ length: 501 }, (_, i) => ({
      id: `e${i}`, input: { text: 'Question' }, output: { text: 'Answer' }, status: { kind: 'done' },
    }));
    const el = await fixture<LyraEvalRun>(html`<lr-eval-run .examples=${many.slice(0, 2)}></lr-eval-run>`);
    const region = () => el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
    el.examples = many;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')!.getAttribute('role')).to.equal('note');
    const text = el.shadowRoot!.querySelector('[part="limit"]')!.textContent!.trim();
    await waitUntil(() => region().includes(text), 'render limit never announced');
  });
});
