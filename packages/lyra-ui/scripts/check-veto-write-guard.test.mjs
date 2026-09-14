import assert from 'node:assert/strict';
import test from 'node:test';

import { findHandRolledVetoGuards } from './check-veto-write-guard.mjs';

// Every fixture below opens with a newline, so `class` sits on line 2 and the reported line
// numbers read off the fixture directly.

test('accepts a component that shares one VetoWriteGuard across both veto-capable setters', () => {
  const source = `
    class Clean extends LyraElement {
      private readonly dispatchGuard = new VetoWriteGuard();
      private _decision: Decision = null;
      private _pending: Pending = null;

      get decision(): Decision { return this._decision; }
      set decision(value: Decision) {
        this._decision = value;
        markVetoGuardWrite(this.dispatchGuard);
      }

      get pending(): Pending { return this._pending; }
      set pending(value: Pending) {
        this._pending = value;
        markVetoGuardWrite(this.dispatchGuard);
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(source), []);
});

test('flags a hand-rolled dispatch-write boolean written from two property setters', () => {
  const source = `
    class HandRolled extends LyraElement {
      private dispatchWriteTouched = false;
      private _decision: Decision = null;
      private _pending: Pending = null;

      get decision(): Decision { return this._decision; }
      set decision(value: Decision) {
        this._decision = value;
        this.dispatchWriteTouched = true;
        this.requestUpdate('decision', value);
      }

      get pending(): Pending { return this._pending; }
      set pending(value: Pending) {
        this._pending = value;
        this.dispatchWriteTouched = true;
        this.requestUpdate('pending', value);
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(source), [
    {
      kind: 'hand-rolled',
      field: 'dispatchWriteTouched',
      line: 3,
      setters: ['decision', 'pending'],
    },
  ]);
});

test('flags a hash-private guard boolean under its printed #name', () => {
  const source = `
    class HashPrivate extends LyraElement {
      #writeGuardTouched = false;

      set first(value: string) {
        this._first = value;
        this.#writeGuardTouched = true;
      }

      set second(value: string) {
        this._second = value;
        this.#writeGuardTouched = true;
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(source), [
    {
      kind: 'hand-rolled',
      field: '#writeGuardTouched',
      line: 3,
      setters: ['first', 'second'],
    },
  ]);
});

test('honours a veto-write-guard-allow comment above the field, and a trailing one on its own line', () => {
  const blockComment = `
    class Excused extends LyraElement {
      /** Tracks a paint-time write, not a dispatch-time one.
       *  veto-write-guard-allow: the two setters run outside any emit(), so there is no
       *  synchronous listener whose write this could be confused with. */
      private paintWriteGuard = false;

      set width(value: number) {
        this._width = value;
        this.paintWriteGuard = true;
      }

      set height(value: number) {
        this._height = value;
        this.paintWriteGuard = true;
      }
    }
  `;
  const trailingComment = `
    class ExcusedInline extends LyraElement {
      private paintWriteGuard = false; // veto-write-guard-allow: measured, never dispatched

      set width(value: number) {
        this._width = value;
        this.paintWriteGuard = true;
      }

      set height(value: number) {
        this._height = value;
        this.paintWriteGuard = true;
      }
    }
  `;

  const trailingBlockComment = `
    class ExcusedInlineBlock extends LyraElement {
      private paintWriteGuard = false; /* veto-write-guard-allow: measured, never dispatched */

      set width(value: number) {
        this._width = value;
        this.paintWriteGuard = true;
      }

      set height(value: number) {
        this._height = value;
        this.paintWriteGuard = true;
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(blockComment), []);
  assert.deepEqual(findHandRolledVetoGuards(trailingComment), []);
  assert.deepEqual(findHandRolledVetoGuards(trailingBlockComment), []);
});

test('still fails an escape comment that states no reason, in either comment form', () => {
  const lineComment = `
    class EmptyReason extends LyraElement {
      // veto-write-guard-allow:
      private dispatchWriteTouched = false;

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        this.dispatchWriteTouched = true;
      }
    }
  `;
  // The block form closes with `*/`, which a raw-text reader would hand back AS the reason: the
  // marker must be read off the parsed comment, whose value stops before the delimiter.
  const inlineBlockComment = `
    class EmptyReasonInline extends LyraElement {
      private dispatchWriteTouched = false; /* veto-write-guard-allow: */

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        this.dispatchWriteTouched = true;
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(lineComment), [
    {
      kind: 'empty-allow-reason',
      field: 'dispatchWriteTouched',
      line: 4,
      setters: ['first', 'second'],
    },
  ]);
  assert.deepEqual(findHandRolledVetoGuards(inlineBlockComment), [
    {
      kind: 'empty-allow-reason',
      field: 'dispatchWriteTouched',
      line: 3,
      setters: ['first', 'second'],
    },
  ]);
});

test('ignores a flag only one setter writes, and one the second setter writes conditionally', () => {
  const singleSetter = `
    class SingleSetter extends LyraElement {
      private valueTouched = false;

      set value(next: string) {
        this._value = next;
        this.valueTouched = true;
      }

      markDirty(): void {
        this.valueTouched = true;
      }
    }
  `;
  const conditionalSecondSetter = `
    class Conditional extends LyraElement {
      private dispatchWriteTouched = false;

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        if (this.watching) this.dispatchWriteTouched = true;
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(singleSetter), []);
  assert.deepEqual(findHandRolledVetoGuards(conditionalSecondSetter), []);
});

test('ignores a markTouched() method and a touched-key collection, which are not guard booleans', () => {
  const source = `
    class NotAGuard extends LyraElement {
      private touchedKeys = new Set<string>();

      private markTouched(key: string): void {
        this.touchedKeys.add(key);
      }

      set first(value: string) {
        this._first = value;
        this.markTouched('first');
      }

      set second(value: string) {
        this._second = value;
        this.markTouched('second');
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(source), []);
});

test('does not let a comment, a string, or a template literal impersonate the guard', () => {
  // Nothing here declares a guard field. The only `dispatchWriteTouched` text sits in a comment, a
  // string and a template literal, while BOTH setters do write a real field -- so a reader that
  // counts `this.<name> =` text inside setter bodies reports this class, and the AST does not.
  const impersonatedField = `
    class Impersonator extends LyraElement {
      // private dispatchWriteTouched = false;
      private notes = ['private dispatchWriteTouched = false;'];

      set first(value: string) {
        this._first = value;
        this.log('this.dispatchWriteTouched = true;');
      }

      set second(value: string) {
        this._second = value;
        this.log(\`this.dispatchWriteTouched = true;\`);
      }
    }
  `;
  // The mirror direction, which matters more: a REAL hand-rolled guard whose own declaration line
  // carries the escape marker inside a string rather than a comment. Reading the marker off the
  // raw line would excuse the very shape this check exists to catch.
  const stringEscapeMarker = `
    class StringMarker extends LyraElement {
      private dispatchWriteTouched = false; private hint = 'veto-write-guard-allow: nothing';

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        this.dispatchWriteTouched = true;
      }
    }
  `;
  const templateEscapeMarker = `
    class TemplateMarker extends LyraElement {
      private dispatchWriteTouched = false; private hint = \`veto-write-guard-allow: nothing\`;

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        this.dispatchWriteTouched = true;
      }
    }
  `;
  const flagged = (field) => [{ kind: 'hand-rolled', field, line: 3, setters: ['first', 'second'] }];

  assert.deepEqual(findHandRolledVetoGuards(impersonatedField), []);
  assert.deepEqual(findHandRolledVetoGuards(stringEscapeMarker), flagged('dispatchWriteTouched'));
  assert.deepEqual(findHandRolledVetoGuards(templateEscapeMarker), flagged('dispatchWriteTouched'));
});

test('reads the same reachability rule as check-lifecycle-super: a terminating try ends the body', () => {
  // `statementAlwaysStopsFollowingStatements` is check-lifecycle-super.mjs's rule, TryStatement
  // branch included: an abrupt try with no catch stops the statements after it, so the write below
  // is unreachable and this is not the "every write marks itself" shape.
  const source = `
    class TryTerminated extends LyraElement {
      private dispatchWriteTouched = false;

      set first(value: string) {
        this._first = value;
        this.dispatchWriteTouched = true;
      }

      set second(value: string) {
        this._second = value;
        try { return; } finally { this.log(); }
        this.dispatchWriteTouched = true;
      }
    }
  `;

  assert.deepEqual(findHandRolledVetoGuards(source), []);
});
