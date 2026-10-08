import { expect } from '@open-wc/testing';
import './agent-workspace-register.js';

describe('lean registration entry', () => {
  it('defines the host without eagerly registering its optional children', () => {
    expect(typeof customElements.get('lr-agent-workspace')).to.equal('function');
    for (const name of ['agent-run', 'context-inspector', 'grounding-summary', 'retrieval-results', 'tool-timeline']) {
      expect(customElements.get(`lr-${name}`) === undefined, name).to.equal(true);
    }
  });
});
