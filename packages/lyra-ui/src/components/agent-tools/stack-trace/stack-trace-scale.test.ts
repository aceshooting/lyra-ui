import { expect } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { STACK_TRACE_LIMITS } from './stack-trace-parse.js';
import './stack-trace.js';

it('bounds rendered frames for a ten-thousand-frame trace', async () => {
  const el = document.createElement('lr-stack-trace');
  el.trace = 'Error: failed\n' + '    at app (/app/main.js:1:1)\n'.repeat(10_000);
  document.body.append(el);
  try {
    await el.updateComplete;
    const frames = el.shadowRoot!.querySelectorAll('[part="frame"]').length;
    expect(frames).equal(STACK_TRACE_LIMITS.frames);
    expect(Boolean(el.shadowRoot!.querySelector('[part="limit"]'))).equal(true);
    recordScaleMeasurement('lr-stack-trace', 'n=10000 frames admission', { frames });
  } finally { el.remove(); }
});
