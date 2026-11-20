import { expect, fixture, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import '../../lr-result-card.js';
import '../../lr-result-field.js';
import '../../lr-eval-run.js';
import '../../lr-test-results.js';
import '../../lr-eval-result.js';

const LONG = 'x'.repeat(400);

const cases: [string, TemplateResult][] = [
  ['lr-result-card', html`<lr-result-card heading=${LONG}><span>${LONG}</span></lr-result-card>`],
  ['lr-result-field', html`<lr-result-field label=${LONG}>${LONG}</lr-result-field>`],
  ['lr-eval-run', html`<lr-eval-run label=${LONG}></lr-eval-run>`],
  ['lr-test-results', html`<lr-test-results .suites=${[{ id: 's', name: LONG, tests: [{ id: 't', name: LONG, status: 'passed' }] }]}></lr-test-results>`],
  ['lr-eval-result', html`<lr-eval-result .runs=${[{ id: 'r', label: LONG, output: LONG }]}></lr-eval-result>`],
];

describe('agent-tools wrap guard', () => {
  for (const [name, template] of cases) {
    it(`${name} shrinks inside a narrow flex allocation and wraps long tokens`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div style="display: flex; inline-size: 200px">${template}</div>`);
      const host = wrapper.firstElementChild as HTMLElement & { updateComplete?: Promise<unknown> };
      await host.updateComplete;
      const style = getComputedStyle(host);
      expect(style.minInlineSize, name).to.equal('0px');
      expect(style.overflowWrap, name).to.equal('break-word');
      expect(host.getBoundingClientRect().width, name).to.be.at.most(201);
    });
  }
});
