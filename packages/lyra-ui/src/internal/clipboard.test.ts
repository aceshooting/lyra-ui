import { expect } from '@open-wc/testing';
import {
  clipboardFailureReason,
  clipboardWriteFailure,
  clipboardWriteSuccess,
  writeAcceptedClipboardText,
  writeClipboardText,
} from './clipboard.js';

function ownerWith(writeText?: (text: string) => Promise<void>): Window {
  return {
    navigator: {
      clipboard: writeText ? { writeText } : undefined,
    },
  } as unknown as Window;
}

describe('clipboard outcome', () => {
  it('returns an immutable success only after the owner write fulfills', async () => {
    let resolveWrite!: () => void;
    const pending = new Promise<void>((resolve) => { resolveWrite = resolve; });
    const resultPromise = writeClipboardText(ownerWith(() => pending), 'value');
    let settled = false;
    void resultPromise.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).to.equal(false);

    resolveWrite();
    const result = await resultPromise;
    expect(result).to.deep.equal({ ok: true, text: 'value' });
    expect(Object.isFrozen(result)).to.equal(true);
  });

  it('returns an unsupported failure for a missing owner or Clipboard API', async () => {
    for (const owner of [null, ownerWith()]) {
      const result = await writeClipboardText(owner, 'value');
      expect(result.ok).to.equal(false);
      if (result.ok) throw new Error('Expected a clipboard failure.');
      expect(result.reason).to.equal('unsupported');
      expect(result.text).to.equal('value');
      expect(Object.isFrozen(result)).to.equal(true);
    }
  });

  it('normalizes synchronous and asynchronous owner-realm failures', async () => {
    const denied = Object.freeze({ name: 'NotAllowedError' });
    const deniedResult = await writeClipboardText(ownerWith(() => Promise.reject(denied)), 'a');
    expect(deniedResult).to.deep.equal({ ok: false, text: 'a', reason: 'denied', error: denied });

    const failed = new Error('write failed');
    const failedResult = await writeClipboardText(ownerWith(() => { throw failed; }), 'b');
    expect(failedResult).to.deep.equal({ ok: false, text: 'b', reason: 'failed', error: failed });
  });

  it('classifies foreign-shaped permission errors without instanceof', () => {
    expect(clipboardFailureReason(Object.freeze({ name: 'SecurityError' }))).to.equal('denied');
    expect(clipboardFailureReason(Object.freeze({ name: 'UnknownError' }))).to.equal('failed');
  });
});

describe('accepted clipboard write', () => {
  it('does not write once the request is superseded after the capability read', async () => {
    let writes = 0;
    let accepted = true;
    const owner = {
      navigator: {
        get clipboard() {
          accepted = false;
          return { writeText: async () => { writes += 1; } };
        },
      },
    } as unknown as Window;
    expect(await writeAcceptedClipboardText(owner, 'value', () => accepted)).to.equal(undefined);
    expect(writes).to.equal(0);
  });

  it('settles like writeClipboardText while the request stays accepted', async () => {
    const written: string[] = [];
    const outcome = await writeAcceptedClipboardText(ownerWith(async (text) => { written.push(text); }), 'kept', () => true);
    expect(outcome).to.deep.equal({ ok: true, text: 'kept' });
    expect(written).to.deep.equal(['kept']);
    const missing = await writeAcceptedClipboardText(ownerWith(), 'kept', () => true);
    expect(missing?.ok === false && missing.reason).to.equal('unsupported');
  });

  it('builds frozen outcomes with a classified default reason', () => {
    const denied = clipboardWriteFailure('x', Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    expect(Object.isFrozen(denied) && denied.reason).to.equal('denied');
    expect(clipboardWriteFailure('x', new Error('no'), 'unsupported').reason).to.equal('unsupported');
    const success = clipboardWriteSuccess('y');
    expect(Object.isFrozen(success) && success.ok && success.text).to.equal('y');
  });
});
