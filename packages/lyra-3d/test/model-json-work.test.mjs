import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelJsonWork } from './model-json-fixture.mjs';
import { drainModelWork } from '../dist/model/model-work.js';
import { ModelAdmissionError } from '../dist/model/admission.js';

const utf8 = value => new TextEncoder().encode(value);
const parse = (source, quota = 7) => drainModelWork(createModelJsonWork(utf8(source)), { bytes: quota, scalars: quota, records: quota });
test('sliced JSON preserves native JSON values and own properties across byte and token boundaries', () => {
  const sources = ['{}', '{"text":"é 😀 \\uD800 \\u0000 \\b\\f\\n\\r\\t\\\\\\/\\\"","rows":[true,false,null,-0,1.5e-20]}', '{"__proto__":{"safe":true},"constructor":4,"duplicate":1,"duplicate":2}', '{"a":1e999,"b":-1e-999,"c":0e999}'];
  for (const source of sources) for (const quota of [1, 2, 7, 1024]) assert.deepEqual(parse(source, quota), JSON.parse(source));
});
test('bounded decimal conversion retains binary64 rounding at long-token and subnormal boundaries', () => {
  const numbers = ['1' + '0'.repeat(10000) + 'e-10000', '0.' + '0'.repeat(10000) + '1e10001', '1.' + '0'.repeat(10000) + '1', '2.2250738585072012e-308', '4.9406564584124654e-324', '2.4703282292062327e-324', '1.7976931348623157e308', '1.00000000000000011102230246251565404236316680908203125', '1.00000000000000011102230246251565404236316680908203125' + '0'.repeat(1000) + '1'];
  for (const numeric of numbers) { const source = `{"n":${numeric}}`; assert.deepEqual(parse(source), JSON.parse(source), numeric.slice(0, 80)); }
});
test('invalid JSON fails with stable invalid code and disposal stops parsing', () => {
  for (const source of ['[]', 'null', '{', '{"a":01}', '{"a":1.}', '{"a":+1}', '{"a":1e}', '{"a":true,}', '{"a":[1,]}', '{"a":"\\x"}', '{"a":"\n"}', '{} extra']) {
    assert.throws(() => parse(source), error => error instanceof ModelAdmissionError && error.code === 'invalid', source);
  }
  const work = createModelJsonWork(utf8('{"a":[1,2,3]}'));
  assert.equal(work.step({ bytes: 1, scalars: 1, records: 1 }).done, false);
  work.dispose(); work.dispose(); assert.throws(() => work.step({ bytes: 1, scalars: 1, records: 1 }), /no longer active/);
});

test('a failed incremental parser cannot later publish an undefined success', () => {
  const work = createModelJsonWork(utf8('{"a":01}'));
  assert.throws(() => work.step({ bytes: 100, scalars: 100, records: 100 }), ModelAdmissionError);
  assert.throws(() => work.step({ bytes: 100, scalars: 100, records: 100 }), /no longer active/);
});
