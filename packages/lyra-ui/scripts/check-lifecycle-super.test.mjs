import assert from 'node:assert/strict';
import test from 'node:test';

import { findLifecycleSuperOmissions } from './check-lifecycle-super.mjs';

test('finds an override that skips its callable lifecycle superclass hook', () => {
  const source = `
    class Example extends Base {
      protected override willUpdate(changed: PropertyValues): void {
        this.prepare(changed);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'willUpdate', line: 3 },
  ]);
});

test('accepts a matching superclass call and rejects a different lifecycle call', () => {
  const source = `
    class Good extends Base {
      protected override updated(changed: PropertyValues): void {
        super.updated(changed);
      }
    }
    class Bad extends Base {
      protected override firstUpdated(changed: PropertyValues): void {
        super.updated(changed);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'firstUpdated', line: 8 },
  ]);
});

test('does not let comments, strings, or templates impersonate code', () => {
  const source = `
    // protected override updated() { super.updated(changed); }
    class Example extends Base {
      protected override updated(changed: PropertyValues): void {
        const examples = [
          'super.updated(changed)',
          \`super.updated(\${changed})\`,
        ];
        /* super.updated(changed); */
        this.consume(examples);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'updated', line: 4 },
  ]);
});

test('does not let deferred, nested, or conditional calls impersonate the synchronous chain', () => {
  const source = `
    class Deferred extends Base {
      protected override updated(changed: PropertyValues): void {
        queueMicrotask(() => super.updated(changed));
      }
    }
    class Nested extends Base {
      protected override firstUpdated(changed: PropertyValues): void {
        const neverCalled = () => super.firstUpdated(changed);
      }
    }
    class Conditional extends Base {
      protected override willUpdate(changed: PropertyValues): void {
        if (false) super.willUpdate(changed);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'updated', line: 3 },
    { hook: 'firstUpdated', line: 8 },
    { hook: 'willUpdate', line: 13 },
  ]);
});

test('does not let unreachable calls after abrupt completion impersonate the chain', () => {
  const source = `
    class AfterReturn extends Base {
      override updated(changed: PropertyValues): void {
        return;
        super.updated(changed);
      }
    }
    class AfterThrow extends Base {
      override firstUpdated(changed: PropertyValues): void {
        throw new Error('stop');
        super.firstUpdated(changed);
      }
    }
    class ThrowInsideTry extends Base {
      override willUpdate(changed: PropertyValues): void {
        try { throw new Error('stop'); super.willUpdate(changed); } catch {}
      }
    }
    class AfterLabeledBreak extends Base {
      override disconnectedCallback(): void {
        lifecycle: { break lifecycle; super.disconnectedCallback(); }
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'updated', line: 3 },
    { hook: 'firstUpdated', line: 9 },
    { hook: 'willUpdate', line: 15 },
    { hook: 'disconnectedCallback', line: 20 },
  ]);
});

test('checks computed literal lifecycle names and super calls after abrupt try completion', () => {
  const source = `
    class Computed extends Base {
      override ['connectedCallback'](): void {}
    }
    class AfterReturningTry extends Base {
      override updated(changed: PropertyValues): void {
        try { return; } finally { this.cleanup(); }
        super.updated(changed);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'connectedCallback', line: 3 },
    { hook: 'updated', line: 6 },
  ]);
});

test('accepts direct expression, variable-initializer, and return superclass calls', () => {
  const source = `
    class Example extends Base {
      override connectedCallback(): void { super.connectedCallback(); }
      protected override createRenderRoot(): HTMLElement {
        const root = super.createRenderRoot();
        return root;
      }
      protected override shouldUpdate(changed: PropertyValues): boolean {
        return super.shouldUpdate(changed);
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), []);
});

test('accepts an unconditional call in try or finally but not one confined to catch', () => {
  const source = `
    class TryBody extends Base {
      override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
        try { super.attributeChangedCallback(name, oldValue, value); } finally { this.release(); }
      }
    }
    class FinallyBody extends Base {
      override updated(changed: PropertyValues): void {
        try { this.prepare(); } finally { super.updated(changed); }
      }
    }
    class CatchOnly extends Base {
      override firstUpdated(changed: PropertyValues): void {
        try { this.prepare(); } catch { super.firstUpdated(changed); }
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), [
    { hook: 'firstUpdated', line: 13 },
  ]);
});

test('tracks nested blocks and ignores callbacks with no callable matching super hook', () => {
  const source = `
    class Example extends Base {
      protected override shouldUpdate(changed: PropertyValues): boolean {
        if (changed.has('value')) {
          return false;
        }
        return super.shouldUpdate(changed);
      }

      adoptedCallback(): void {
        this.resetOwnerRealmWork();
      }
    }
  `;

  assert.deepEqual(findLifecycleSuperOmissions(source), []);
});

test('covers every ReactiveElement lifecycle hook with a callable superclass implementation', () => {
  const source = `
    class Example extends Base {
      override connectedCallback(): void {}
      override disconnectedCallback(): void {}
      override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {}
      protected override createRenderRoot(): HTMLElement { return document.body; }
      override requestUpdate(): void {}
      protected override performUpdate(): void {}
      protected override scheduleUpdate(): Promise<unknown> { return Promise.resolve(); }
      protected override shouldUpdate(changed: PropertyValues): boolean { return true; }
      protected override willUpdate(changed: PropertyValues): void {}
      protected override update(changed: PropertyValues): void {}
      protected override updated(changed: PropertyValues): void {}
      protected override firstUpdated(changed: PropertyValues): void {}
    }
  `;

  assert.deepEqual(
    findLifecycleSuperOmissions(source).map(({ hook }) => hook),
    [
      'connectedCallback',
      'disconnectedCallback',
      'attributeChangedCallback',
      'createRenderRoot',
      'requestUpdate',
      'performUpdate',
      'scheduleUpdate',
      'shouldUpdate',
      'willUpdate',
      'update',
      'updated',
      'firstUpdated',
    ],
  );
});
