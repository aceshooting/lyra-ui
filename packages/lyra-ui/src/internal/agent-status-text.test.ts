import { expect } from '@open-wc/testing';
import { agentStatusText } from './agent-status-text.js';

const localize = (key: string): string => `<${key}>`;

describe('agentStatusText', () => {
  it('localizes the built-in kinds', () => {
    expect(agentStatusText(localize, 'running')).to.equal('<statusRunning>');
    expect(agentStatusText(localize, 'waiting-input')).to.equal('<agentRunStatusWaitingInput>');
  });

  it('title-cases an application-defined kind', () => {
    expect(agentStatusText(localize, 'needs_review')).to.equal('Needs Review');
  });

  it('never resolves a kind through Object.prototype', () => {
    for (const name of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(agentStatusText(localize, name).startsWith('<')).to.equal(false);
    }
    expect(agentStatusText(localize, 'constructor')).to.equal('Constructor');
  });

  it('reads a record status and treats an unusable status as idle', () => {
    expect(agentStatusText(localize, { kind: 'running' })).to.equal('<statusRunning>');
    for (const status of [undefined, null, 42, {}, { kind: 7 }, '']) {
      expect(agentStatusText(localize, status)).to.equal('<agentRunStatusIdle>');
    }
    const throwing = { get kind(): string { throw new Error('boom'); } };
    expect(agentStatusText(localize, throwing)).to.equal('<agentRunStatusIdle>');
  });
});
