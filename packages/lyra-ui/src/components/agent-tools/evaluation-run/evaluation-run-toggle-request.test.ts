import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-eval-run.js';
import type { EvalExampleResult, LyraEvalRun } from '../../lr-eval-run.js';
import type { LyraDetails } from '../../layout/details/details.class.js';

const examples: EvalExampleResult[] = [
  { id: 'ex-1', label: 'First', status: { kind: 'done' }, input: { text: 'in' }, output: { text: 'out' } },
];

describe('eval run example toggle request', () => {
  it('lets a listener veto an example expand or collapse before it commits', async () => {
    const el = await fixture<LyraEvalRun>(html`<lr-eval-run .examples=${examples}></lr-eval-run>`);
    const row = el.shadowRoot!.querySelector<LyraDetails>('[part="example"]')!;
    const summary = (): HTMLElement => row.shadowRoot!.querySelector('summary')!;
    const log: string[] = [];
    let veto = true;
    el.addEventListener('lr-toggle-request', (event) => {
      log.push(`request:${JSON.stringify(event.detail)}:${String(event.cancelable)}`);
      if (veto) event.preventDefault();
    });
    for (const name of ['lr-example-toggle', 'lr-show', 'lr-hide', 'lr-toggle']) el.addEventListener(name, () => log.push(name));

    summary().click();
    await el.updateComplete;
    await row.updateComplete;
    expect(row.open).to.equal(false);
    expect(row.querySelector('[part="input-section"]') === null).to.equal(true);
    expect(log).to.deep.equal(['request:{"exampleId":"ex-1","expanded":true}:true']);

    log.length = 0;
    veto = false;
    summary().click();
    await el.updateComplete;
    await row.updateComplete;
    expect(row.open).to.equal(true);
    await waitUntil(() => row.querySelector('[part="input-section"]') !== null, 'the expanded example renders its content');
    expect(log).to.deep.equal(['request:{"exampleId":"ex-1","expanded":true}:true', 'lr-example-toggle']);

    log.length = 0;
    veto = true;
    summary().click();
    await el.updateComplete;
    await row.updateComplete;
    expect(row.open).to.equal(true);
    expect(log).to.deep.equal(['request:{"exampleId":"ex-1","expanded":false}:true']);
  });

  it('ignores show or hide from a disclosure nested in an example', async () => {
    const el = await fixture<LyraEvalRun>(html`<lr-eval-run .examples=${examples}></lr-eval-run>`);
    const row = el.shadowRoot!.querySelector<LyraDetails>('[part="example"]')!;
    row.shadowRoot!.querySelector<HTMLElement>('summary')!.click();
    await waitUntil(() => row.querySelector('[part="input-section"]') !== null, 'the expanded example renders its content');
    const log: string[] = [];
    el.addEventListener('lr-toggle-request', () => log.push('request'));
    const nested = new CustomEvent('lr-hide', { bubbles: true, composed: true, cancelable: true });
    row.querySelector('[part="input-section"]')!.dispatchEvent(nested);
    await el.updateComplete;
    expect(log).to.deep.equal([]);
    expect(nested.defaultPrevented).to.equal(false);
    expect(row.open).to.equal(true);
  });
});
