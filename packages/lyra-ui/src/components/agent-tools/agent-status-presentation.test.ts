import { expect } from '@open-wc/testing';
import {
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  isAgentStatusActive,
  isAgentStatusTerminal,
} from './agent-status-presentation.js';

it('derives lifecycle presentation while honoring explicit caller overrides', () => {
  expect(agentStatusKind('running')).to.equal('running');
  expect(agentStatusKind({ kind: 'collecting' })).to.equal('collecting');
  expect(agentStatusLabel({ kind: 'running', label: '' })).to.equal('');
  expect(agentStatusLabel('running')).to.equal(undefined);
  expect(agentStatusMessage({ kind: 'error', message: 'failed' })).to.equal('failed');
  expect(agentStatusMessage({ kind: 'error' })).to.equal(undefined);
  expect(agentStatusVariant({ kind: 'running', variant: 'brand' }, 'neutral')).to.equal('brand');
  expect(agentStatusVariant({ kind: 'running', variant: 'invalid' as 'brand' }, 'warning')).to.equal('warning');

  expect(isAgentStatusActive('running')).to.equal(true);
  expect(isAgentStatusActive('collecting')).to.equal(true);
  expect(isAgentStatusActive('done')).to.equal(false);
  expect(isAgentStatusActive({ kind: 'done', active: true })).to.equal(true);
  expect(isAgentStatusActive({ kind: 'running', active: false })).to.equal(false);

  expect(isAgentStatusTerminal('done')).to.equal(true);
  expect(isAgentStatusTerminal('error')).to.equal(true);
  expect(isAgentStatusTerminal('cancelled')).to.equal(true);
  expect(isAgentStatusTerminal('running')).to.equal(false);
  expect(isAgentStatusTerminal({ kind: 'running', terminal: true })).to.equal(true);
  expect(isAgentStatusTerminal({ kind: 'done', terminal: false })).to.equal(false);
});
