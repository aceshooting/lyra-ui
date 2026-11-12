import { expect } from '@open-wc/testing';
import { admitGraphNodeRenderer } from './graph-node-renderer.js';

describe('graph renderer scheduler cancellation', () => {
  for (const timing of ['immediate', 'late'] as const) {
    it(`observes a ${timing} scheduler rejection after synchronous cancellation`, async () => {
      const controller = new AbortController();
      const unhandled: unknown[] = [];
      const onUnhandled = (event: PromiseRejectionEvent) => {
        unhandled.push(event.reason);
        event.preventDefault();
      };
      window.addEventListener('unhandledrejection', onUnhandled);
      let rejectTask: (reason: Error) => void = () => {};
      let callbacks = 0;
      const failure = new Error('obsolete scheduler failure');
      try {
        let caught: unknown;
        try {
          await admitGraphNodeRenderer(() => { callbacks++; return null; }, 129,
            index => ({ id: String(index), index }), () => true, () => {
              controller.abort();
              if (timing === 'immediate') return Promise.reject(failure);
              return new Promise<void>((_resolve, reject) => { rejectTask = reject; });
            }, controller.signal);
        } catch (error) { caught = error; }
        expect((caught as Error)?.name).to.equal('AbortError');
        expect(callbacks).to.equal(128);
        if (timing === 'late') rejectTask(failure);
        await new Promise<void>(resolve => setTimeout(resolve, 30));
        expect(unhandled.length).to.equal(0);
      } finally {
        window.removeEventListener('unhandledrejection', onUnhandled);
      }
    });
  }
});
