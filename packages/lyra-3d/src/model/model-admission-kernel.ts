import { createModelGeneratorWork } from './model-work-generator.js';
import { readModelFormatPolicy } from './model-format-policy.js';
import { decodeModelText, ModelLineCursor } from './model-text-work.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import { chargeModelGeometry, createModelResourceBudget, modelAdmissionCheck, modelAdmissionInteger, modelAdmissionNumeric } from './model-admission-policy.js';
import type { ModelIncrementalWork } from './model-work.js';
import type { AdmittedModelInput, OwnedModelInput } from './model-prepared-types.js';

/** Complete fatal UTF-8 validation before line admission, retaining the synchronous refusal order. */
function createXyzAdmissionWork(input: OwnedModelInput): ModelIncrementalWork<AdmittedModelInput> {
  modelAdmissionCheck(input.format === 'xyz', 'unsupported');
  return createModelGeneratorWork(function* () {
    let rows = 0;
    const cursor = new ModelLineCursor(yield* decodeModelText(input.bytes), LIMIT.lineBytes, LIMIT.indices + LIMIT.vertices);
    yield* cursor.forEach(line => {
      if (!line || line.startsWith('#')) return;
      const row = line.split(/\s+/); modelAdmissionCheck(row.length === 3 || row.length === 6, 'unsupported');
      row.forEach(modelAdmissionNumeric);
      if (row.length === 6) row.slice(3).forEach(value => modelAdmissionInteger(Number(value), 255));
      modelAdmissionCheck(++rows <= LIMIT.vertices, 'limit');
    });
    const budget = createModelResourceBudget(); chargeModelGeometry(budget, rows, 0);
    return { input, counts: Object.freeze({ encodedBytes: input.bytes.length, decodedBytes: budget.decoded, vertices: rows, indices: 0, imagePixels: 0, resources: 0 }), resources: [], plan: { format: 'xyz', rows } };
  });
}

export function createModelAdmissionWork(input: OwnedModelInput): ModelIncrementalWork<AdmittedModelInput> {
  if (input.format === 'xyz') return createXyzAdmissionWork(input);
  return createModelGeneratorWork(function* () {
    const budget = createModelResourceBudget();
    const plan = yield* readModelFormatPolicy(input, budget);
    return { input, counts: { encodedBytes: input.bytes.length, decodedBytes: budget.decoded, vertices: budget.vertices, indices: budget.indices, imagePixels: budget.pixels, resources: budget.resources.length }, resources: budget.resources, plan };
  });
}
