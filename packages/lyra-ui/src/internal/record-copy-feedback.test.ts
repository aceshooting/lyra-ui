import { expect, fixture, html } from '@open-wc/testing';
import { KeyedCopyFeedback, copyOutcome, reportCopyOutcome } from './record-copy-feedback.js';

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('copyOutcome', () => {
  it('builds frozen success and failure outcomes', () => {
    const ok = copyOutcome('success', { text: 'a' });
    expect(ok).to.deep.equal({ ok: true, text: 'a' });
    expect(Object.isFrozen(ok)).to.equal(true);
    const failed = copyOutcome('failure', { text: 'a', reason: 'denied', error: 'x' });
    expect(failed.ok).to.equal(false);
    if (!failed.ok) {
      expect(failed.reason).to.equal('denied');
      expect(failed.error).to.equal('x');
    }
    const defaulted = copyOutcome('failure', { text: 'a' });
    if (!defaulted.ok) expect(defaulted.reason).to.equal('failed');
  });
});

describe('reportCopyOutcome', () => {
  function recorder() {
    const log: string[] = [];
    return {
      log,
      host: {
        emit: (name: string, detail?: unknown) => log.push(`${name}:${detail === undefined ? 'none' : 'detail'}`),
        announce: (ok: boolean) => log.push(`announce:${ok}`),
      },
    };
  }

  it('announces then emits lr-copy with the outcome on success', () => {
    const { log, host } = recorder();
    reportCopyOutcome(host, copyOutcome('success', { text: 't' }));
    expect(log).to.deep.equal(['announce:true', 'lr-copy:detail']);
  });

  it('emits a detail-less lr-error before lr-copy-error on failure', () => {
    const { log, host } = recorder();
    reportCopyOutcome(host, copyOutcome('failure', { text: 't' }));
    expect(log).to.deep.equal(['announce:false', 'lr-error:none', 'lr-copy-error:detail']);
  });

  it('stops when the host stops being current mid-report', () => {
    const { log, host } = recorder();
    let calls = 0;
    reportCopyOutcome(host, copyOutcome('failure', { text: 't' }), () => ++calls < 3);
    expect(log).to.deep.equal(['announce:false', 'lr-error:none']);
    const stale = recorder();
    reportCopyOutcome(stale.host, copyOutcome('success', { text: 't' }), () => false);
    expect(stale.log).to.deep.equal([]);
  });
});

describe('KeyedCopyFeedback', () => {
  it('shows feedback for one key, replaces it, and resets after the duration', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const feedback = new KeyedCopyFeedback(host, 40);
    feedback.show('a', true);
    expect(feedback.for('a')).to.deep.include({ ok: true });
    expect(feedback.for('b')).to.equal(null);
    feedback.show('b', false);
    expect(feedback.for('a')).to.equal(null);
    expect(feedback.for('b')).to.deep.include({ ok: false });
    await wait(120);
    expect(feedback.state).to.equal(null);
  });

  it('a replaced key does not clear its successor early', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const feedback = new KeyedCopyFeedback(host, 80);
    feedback.show('a', true);
    await wait(50);
    feedback.show('b', true);
    await wait(50);
    expect(feedback.for('b')).not.to.equal(null);
    await wait(100);
    expect(feedback.state).to.equal(null);
  });

  it('clears on disconnect and ignores a disconnected host', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const feedback = new KeyedCopyFeedback(host, 1000);
    feedback.show('a', true);
    feedback.hostDisconnected();
    expect(feedback.state).to.equal(null);
    host.remove();
    feedback.show('a', true);
    expect(feedback.state).to.equal(null);
  });
});
