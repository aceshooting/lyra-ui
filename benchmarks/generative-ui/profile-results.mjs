/** Offline measurement contracts. A scoped numeric summary is never release qualification. */
export const PROFILE_WORKLOADS = Object.freeze(['T', 'C', 'L', 'V', 'X', 'D', 'S', 'R', 'A', 'K']);
export const PROFILE_ENGINES = Object.freeze(['chromium', 'firefox', 'webkit']);
export const PROFILE_METHOD = 'semantic-commit-two-frame-opportunities-v1';
export const PROFILE_SEED = 20261026;
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const nonempty = value => typeof value === 'string' && value.length > 0;

export function profileCells() {
  const cells = [];
  for (const workload of PROFILE_WORKLOADS) for (const engine of PROFILE_ENGINES) {
    for (const temperature of ['cold', 'warm']) cells.push({ id: `${workload}/${engine}/${temperature}/1280x900`, workload, engine, temperature, width: 1280, height: 900 });
    if (['L', 'D', 'R'].includes(workload)) cells.push({ id: `${workload}/${engine}/warm/320x800`, workload, engine, temperature: 'warm', width: 320, height: 800 });
  }
  return Object.freeze(cells.map(Object.freeze));
}
export function validateCell(cell) {
  const known = profileCells().find(item => item.id === cell?.id);
  require(known && Object.keys(known).every(key => known[key] === cell[key]), 'Unknown or altered profile cell.');
}
export function cellSchedule(cell) {
  validateCell(cell);
  return Object.freeze(Array.from({ length: 2 }, (_, batchIndex) => Array.from({ length: 33 }, (_, index) => Object.freeze({
    cellId: cell.id, batchIndex, sampleIndex: index < 3 ? index - 3 : batchIndex * 30 + index - 3, warmup: index < 3,
  }))).flat());
}
export function validateCapabilities(capabilities) {
  require(capabilities && Object.keys(capabilities).length === 2 && Object.keys(capabilities).every(key => ['longtask', 'layoutShift'].includes(key)), 'Unknown or missing instrumentation capability.');
  for (const name of ['longtask', 'layoutShift']) {
    const value = capabilities?.[name];
    require(value && typeof value.supported === 'boolean' && typeof value.positiveControl === 'boolean', `Missing capability ${name}.`);
    if (value.supported) require(value.positiveControl && nonempty(value.receipt), `Capability ${name} requires a successful positive-control receipt.`);
    else require(value.positiveControl === false && nonempty(value.reason), `Unsupported ${name} needs an explicit reason.`);
  }
}
export function validateDescriptor(operation) {
  require(nonempty(operation?.id) && ['ready', 'interaction', 'delayed'].includes(operation.kind)
    && ['host', 'event'].includes(operation.trigger) && nonempty(operation.expectedFingerprint), 'Invalid operation descriptor.');
}
export function validateOperation(value, descriptor, generation) {
  validateDescriptor(descriptor);
  require(value && nonempty(generation) && value.generation === generation, 'Operation generation mismatch.');
  for (const key of ['id', 'kind', 'trigger', 'expectedFingerprint']) require(value[key] === descriptor[key], `Operation ${key} mismatch.`);
  require(value.censored === false && value.fingerprint === descriptor.expectedFingerprint, 'Missing, censored or incorrect result.');
  require([value.start, value.semanticCommit, value.renderOpportunity].every(finite), 'Missing or invalid operation timestamp.');
  require(value.start <= value.semanticCommit && value.semanticCommit <= value.renderOpportunity, 'Operation timestamp order is invalid.');
  if (descriptor.trigger === 'event') require(finite(value.listenerReceipt) && value.start <= value.listenerReceipt && value.listenerReceipt <= value.semanticCommit, 'Native listener timing is invalid.');
  else require(value.listenerReceipt === null, 'Host operations must not invent native event timing.');
  if (value.firstMount !== undefined) {
    const first = value.firstMount;
    require(first?.scope === 'first-operation-lifecycle' && first.operationId === descriptor.id && first.generation === generation
      && finite(first.start) && first.start <= value.start && first.semanticCommit === value.semanticCommit && first.renderOpportunity === value.renderOpportunity,
    'Invalid supplemental first-mount lifecycle.');
  }
}
export function maximumCls(entries) {
  require(Array.isArray(entries), 'CLS entries are required.');
  let previous = -Infinity, first = -Infinity, last = -Infinity, sum = 0, maximum = 0;
  for (const item of entries) {
    require(finite(item.startTime) && finite(item.value) && typeof item.hadRecentInput === 'boolean' && item.startTime >= previous, 'Invalid or unordered layout-shift observation.');
    previous = item.startTime;
    if (item.hadRecentInput) continue;
    if (item.startTime - last > 1000 || item.startTime - first > 5000) { first = item.startTime; sum = 0; }
    sum += item.value; last = item.startTime; maximum = Math.max(maximum, sum);
  }
  return maximum;
}
export function validateSample(sample, cell, descriptors, { warmup = false } = {}) {
  validateCell(cell); validateCapabilities(sample?.capabilities);
  require(sample.schemaVersion === 1 && sample.cellId === cell.id && sample.warmup === warmup && sample.contaminated === false, 'Wrong sample identity, warmup or contamination.');
  require(Number.isInteger(sample.batchIndex) && [0, 1].includes(sample.batchIndex), 'Invalid sample batch.');
  require(Number.isInteger(sample.sampleIndex) && (warmup ? sample.sampleIndex >= -3 && sample.sampleIndex < 0 : sample.sampleIndex >= sample.batchIndex * 30 && sample.sampleIndex < (sample.batchIndex + 1) * 30), 'Invalid sample index.');
  require(Array.isArray(descriptors) && descriptors.length > 0 && new Set(descriptors.map(item => item.id)).size === descriptors.length, 'Operation inventory is missing or duplicated.');
  require(Array.isArray(sample.operations) && sample.operations.length === descriptors.length, 'Sample operation inventory is incomplete.');
  require(finite(sample.window?.start) && finite(sample.window?.end) && sample.window.start <= sample.window.end, 'Missing observer window.');
  for (let index = 0; index < descriptors.length; index++) {
    const operation = sample.operations[index];
    validateOperation(operation, descriptors[index], sample.operations[0].generation);
    require(operation.start >= sample.window.start && operation.renderOpportunity <= sample.window.end, 'Operation falls outside observation window.');
    if (operation.firstMount) require(index === 0 && operation.firstMount.start >= sample.window.start, 'Supplemental first mount must belong to the first observed operation.');
  }
  const longTasks = sample.observers?.longTasks, shifts = sample.observers?.layoutShifts;
  if (sample.capabilities.longtask.supported) {
    require(Array.isArray(longTasks), 'Supported longtask observations are missing.');
    for (const entry of longTasks) require(finite(entry.startTime) && finite(entry.duration) && entry.duration >= 50 && nonempty(entry.phase)
      && entry.startTime <= sample.window.end && entry.startTime + entry.duration >= sample.window.start, 'Invalid long-task observation.');
  } else require(longTasks === null, 'Unsupported longtask metric must be null.');
  if (sample.capabilities.layoutShift.supported) {
    maximumCls(shifts);
    require(shifts.every(item => nonempty(item.phase) && item.startTime >= sample.window.start && item.startTime <= sample.window.end), 'Layout shift falls outside observation window.');
  } else require(shifts === null, 'Unsupported layout-shift metric must be null.');
  const renderer = sample.renderer;
  require(typeof renderer?.supported === 'boolean', 'Renderer counter capability must be explicit.');
  if (!renderer.supported) require(nonempty(renderer.reason), 'Unsupported renderer counters need a reason.');
  for (const name of ['taskMs', 'scriptMs', 'layoutMs', 'styleMs']) require(renderer.supported ? finite(renderer[name]) : renderer[name] === null, 'Missing or fabricated renderer counter.');
  for (const name of ['connectedNodes', 'connectedElements', 'retainedSources', 'pendingOperations']) require(sample.disposal?.[name] === 0, `Disposal retained ${name}.`);
}
function numbers(values) { require(Array.isArray(values) && values.length > 0 && values.length <= 10000 && values.every(finite), 'Expected bounded finite observations.'); }
export function percentile(values, probability) {
  numbers(values); require(typeof probability === 'number' && probability > 0 && probability <= 1, 'Invalid percentile.');
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * probability) - 1];
}
function random(seed) {
  require(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid bootstrap seed.');
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 0x100000000; };
}
function settings(options) {
  const replicates = options.replicates ?? 10000, seed = options.seed ?? PROFILE_SEED;
  require(Number.isSafeInteger(replicates) && replicates >= 1 && replicates <= 10000, 'Invalid bootstrap replicate count.');
  return { replicates, seed, next: random(seed) };
}
export function bootstrapP95(values, options = {}) {
  numbers(values); const { replicates, seed, next } = settings(options);
  const resampled = Array.from({ length: replicates }, () => percentile(Array.from({ length: values.length }, () => values[Math.floor(next() * values.length)]), .95));
  return { p95: percentile(values, .95), upper95: percentile(resampled, .95), replicates, seed };
}
function summary(values, options) {
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return { count: values.length, min: ordered[0], median: ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2, max: ordered.at(-1), ...bootstrapP95(values, options) };
}
export function operationBudget(cell, descriptor) {
  validateCell(cell); validateDescriptor(descriptor);
  const large = ['L', 'X'].includes(cell.workload);
  return descriptor.kind === 'ready' ? (cell.temperature === 'cold' ? (large ? 2000 : 1000) : (large ? 500 : 250))
    : descriptor.kind === 'delayed' ? 250 : (large ? 200 : 100);
}
export function sampleBudgetViolations(sample, cell, descriptors) {
  validateSample(sample, cell, descriptors, { warmup: sample.warmup });
  const violations = sample.operations.flatMap((operation, index) => operation.renderOpportunity - operation.start > operationBudget(cell, descriptors[index]) ? [`operation:${operation.id}`] : []);
  if (sample.observers.layoutShifts !== null && maximumCls(sample.observers.layoutShifts) > .1) violations.push('cls');
  if (sample.observers.longTasks?.some(entry => entry.duration > (['L', 'X'].includes(cell.workload) ? 400 : 200))) violations.push('longtask');
  return violations;
}
export function summarizeCell(cell, samples, descriptors, options = {}) {
  require(Array.isArray(samples) && samples.length === 60, 'A cell requires exactly sixty measured samples.');
  const indices = new Set();
  for (const sample of samples) { validateSample(sample, cell, descriptors); require(!indices.has(sample.sampleIndex), 'Duplicate sample.'); indices.add(sample.sampleIndex); }
  for (const name of ['longtask', 'layoutShift']) require(samples.every(sample => sample.capabilities[name].supported === samples[0].capabilities[name].supported), 'Instrument capability changed inside a cell.');
  let within = true;
  const operations = Object.fromEntries(descriptors.map((descriptor, index) => {
    const endToEnd = summary(samples.map(sample => sample.operations[index].renderOpportunity - sample.operations[index].start), options);
    const semantic = summary(samples.map(sample => sample.operations[index].semanticCommit - sample.operations[index].start), options);
    const opportunity = summary(samples.map(sample => sample.operations[index].renderOpportunity - sample.operations[index].semanticCommit), options);
    const ceilingMs = operationBudget(cell, descriptor), withinBudget = endToEnd.max <= ceilingMs && endToEnd.upper95 <= ceilingMs;
    within &&= withinBudget;
    return [descriptor.id, { ceilingMs, withinBudget, endToEnd, semantic, opportunity }];
  }));
  const cls = samples[0].capabilities.layoutShift.supported ? samples.map(sample => maximumCls(sample.observers.layoutShifts)) : null;
  const longTasks = samples[0].capabilities.longtask.supported ? samples.flatMap(sample => sample.observers.longTasks) : null;
  const longTaskCeilingMs = ['L', 'X'].includes(cell.workload) ? 400 : 200;
  if (cls) within &&= cls.every(value => value <= .1);
  if (longTasks) within &&= longTasks.every(entry => entry.duration <= longTaskCeilingMs);
  return { cellId: cell.id, status: within ? 'within-scoped-budgets' : 'budget-exceeded', operations, cls,
    longTasks: longTasks === null ? null : { count: longTasks.length, maxMs: Math.max(0, ...longTasks.map(entry => entry.duration)), ceilingMs: longTaskCeilingMs },
    uncertainty: 'Empirical maximum and seeded bootstrap upper p95; no independent-sample population or physical-paint claim.' };
}
function fit(values) {
  const center = (values.length - 1) / 2, mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0, denominator = 0;
  values.forEach((value, index) => { numerator += (index - center) * (value - mean); denominator += (index - center) ** 2; });
  const slope = numerator / denominator;
  return { slope, intercept: mean - slope * center };
}
export function summarizeRetainedHeap(values, options = {}) {
  numbers(values); require(values.length === 40, 'Retained heap requires forty measured final-dispose observations.');
  const { replicates, seed, next } = settings(options), block = options.block ?? 5;
  require([4, 5, 8].includes(block), 'Unsupported residual bootstrap block length.');
  const fitted = fit(values), residuals = values.map((value, index) => value - fitted.intercept - fitted.slope * index);
  const slopes = [];
  for (let run = 0; run < replicates; run++) {
    const sampled = [];
    while (sampled.length < values.length) {
      const start = Math.floor(next() * (values.length - block + 1));
      for (let i = 0; i < block && sampled.length < values.length; i++) sampled.push(fitted.intercept + fitted.slope * sampled.length + residuals[start + i]);
    }
    slopes.push(fit(sampled).slope);
  }
  slopes.sort((a, b) => a - b);
  const mean = items => items.reduce((sum, value) => sum + value, 0) / items.length;
  const firstMean = mean(values.slice(0, 5)), lastMean = mean(values.slice(-5));
  const deltaBytes = lastMean - firstMean, deltaCeilingBytes = Math.max(1048576, firstMean * .1), slopeUpper95 = slopes[Math.ceil(replicates * .95) - 1];
  return { firstMean, lastMean, deltaBytes, deltaCeilingBytes, slope: fitted.slope, slopeUpper95, block, replicates, seed,
    withinBudget: deltaBytes <= deltaCeilingBytes && slopeUpper95 <= 16384,
    scope: 'One correlated forty-cycle main-isolate series; not total process memory or an unlimited leak bound.' };
}
