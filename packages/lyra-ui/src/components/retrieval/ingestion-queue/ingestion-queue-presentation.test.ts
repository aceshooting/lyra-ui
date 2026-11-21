import { expect } from '@open-wc/testing';
import { ingestionActionKey, INGESTION_ITEM_ACTION_LIMIT, projectIngestionPresentation } from './ingestion-queue-presentation.js';

describe('ingestion presentation projection', () => {
  it('returns an empty projection without actions', () => {
    expect(projectIngestionPresentation({}, 'queued')).to.deep.equal({});
  });

  it('keeps one retry and one cancel and unique custom actions', () => {
    const raw = { actions: [
      { type: 'retry' }, { type: 'retry' }, { type: 'cancel', disabled: true },
      { type: 'custom', id: 'a', label: 'A' }, { type: 'custom', id: 'a', label: 'again' },
      { type: 'custom', id: '', label: 'blank' }, { type: 'custom', id: 'b' },
      { type: 'retry', disabled: 'yes' }, { type: 'other' }, 'text', null,
    ] };
    const result = projectIngestionPresentation(raw, 'failed');
    expect(result.actions!.map(ingestionActionKey)).to.deep.equal(['retry', 'cancel', 'custom:a']);
    expect(result.actions![1]).to.deep.equal({ type: 'cancel', disabled: true });
    expect(result.actionLimit).to.equal(undefined);
  });

  it('reports the retained count when the list exceeds the limit', () => {
    const actions = Array.from({ length: INGESTION_ITEM_ACTION_LIMIT + 5 }, (_, i) => ({ type: 'custom', id: String(i), label: 'L' }));
    const result = projectIngestionPresentation({ actions }, 'failed');
    expect(result.actions).to.have.length(INGESTION_ITEM_ACTION_LIMIT);
    expect(result.actionLimit).to.deep.equal({ source: INGESTION_ITEM_ACTION_LIMIT + 5, retained: INGESTION_ITEM_ACTION_LIMIT });
  });

  it('treats unreadable or non-list actions as actionless', () => {
    expect(projectIngestionPresentation({ actions: 'retry' }, 'failed').actions).to.have.length(0);
    expect(projectIngestionPresentation({ actions: new Proxy([], { getPrototypeOf() { throw new Error('x'); } }) }, 'failed').actions).to.have.length(0);
    expect(projectIngestionPresentation({ actions: [] }, 'failed').actions).to.have.length(0);
  });

  it('projects a custom stage with a bounded variant and text budget', () => {
    const raw = { customStage: { id: 'scan', label: 'Scanning', variant: 'warning', showProgress: true }, actions: [{ type: 'cancel' }] };
    const result = projectIngestionPresentation(raw, 'custom');
    expect(result.customStage).to.deep.equal({ id: 'scan', label: 'Scanning', variant: 'warning', showProgress: true });
    expect(result.actions).to.have.length(1);
    expect(projectIngestionPresentation({ customStage: { id: 'x', label: 'X', variant: 'nope' } }, 'custom').customStage).to.deep.equal({ id: 'x', label: 'X', variant: 'neutral', showProgress: false });
    expect(projectIngestionPresentation({ customStage: { id: 'x', label: '  ' } }, 'custom')).to.deep.equal({});
    expect(projectIngestionPresentation({ customStage: 5 }, 'custom')).to.deep.equal({});
    expect(projectIngestionPresentation({ customStage: { id: 'x', label: 'Longer label' } }, 'custom', undefined, 3)).to.deep.equal({});
  });

  it('keeps the stage alone when actions are absent, and rejects obsolete reads', () => {
    const raw = { customStage: { id: 'x', label: 'X' } };
    expect(projectIngestionPresentation(raw, 'custom').actions).to.equal(undefined);
    expect(() => projectIngestionPresentation({ actions: [] }, 'failed', () => false)).to.throw('Obsolete');
    let calls = 0;
    expect(() => projectIngestionPresentation({ actions: [] }, 'failed', () => ++calls < 2)).to.throw('Obsolete');
  });

  it('ignores accessor-backed fields', () => {
    const raw = { get actions() { return [{ type: 'retry' }]; } };
    expect(projectIngestionPresentation(raw, 'failed').actions).to.have.length(0);
  });
});
