import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelAdmissionError } from '../dist/model/admission.js';
import { ModelLineCursor } from '../dist/model/model-text-work.js';
import { createModelGeneratorWork } from '../dist/model/model-work-generator.js';
import { drainModelWork } from '../dist/model/model-work.js';

const budgets = [{ bytes: 4096, scalars: 4096, records: 4096 }, { bytes: 1, scalars: 7, records: 2 }, { bytes: 7, scalars: 2, records: 1 }, { bytes: 1, scalars: 1, records: 1 }];
test('queued lines preserve semantic, count, canonical and length refusal order in one scan batch', () => {
  const cases = [
    ['bad\n123456789\n', 10, false, 'invalid', ['bad']],
    ['ok\n123456789\n', 10, false, 'limit', ['ok']],
    ['bad\nok\n', 1, false, 'invalid', ['bad']],
    ['ok\n bad\n', 1, true, 'limit', ['ok']],
    [' bad\n123456789\n', 10, true, 'unsupported', []],
  ];
  for (const [source, countLimit, canonical, expected, visited] of cases) for (const budget of budgets) {
    const seen = [];
    const work = createModelGeneratorWork(function* () {
      yield* new ModelLineCursor([source], 8, countLimit).forEach(line => {
        seen.push(line); if (line === 'bad') throw new ModelAdmissionError('invalid');
      }, canonical);
    });
    assert.throws(() => drainModelWork(work, budget), error => error.code === expected);
    assert.deepEqual(seen, visited);
    assert.throws(() => work.step(budget), /no longer active/);
  }
});
