import { expect } from '@open-wc/testing';
import { approvalAction, approvalDecision } from './approval-state.js';

it('maps approval actions and decisions in both directions', () => {
  expect(approvalDecision('approve')).to.equal('approved');
  expect(approvalDecision('deny')).to.equal('denied');
  expect(approvalAction('approved')).to.equal('approve');
  expect(approvalAction('denied')).to.equal('deny');
});
