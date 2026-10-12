export const SCHEMA_VERSION = 1;
export const BROWSERS = ['chromium', 'firefox', 'webkit', 'chrome', 'edge'];
export const HARNESS_CODES = ['browser-unavailable', 'browser-crashed', 'scenario-timeout', 'fixture-not-ready', 'fixture-contract', 'sample-schema', 'assertion-failed', 'page-error', 'network-blocked', 'not-run', 'setup-failed', 'cleanup-failed', 'cancelled', 'build-failed', 'package-invalid', 'node-version', 'internal-error'];
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/;
function fail() { throw new Error('result-schema'); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail();
}
function required(value, keys) { object(value, keys); if (keys.some(key => !(key in value))) fail(); }
function finite(value, minimum = 0) { if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) fail(); }
function integer(value, minimum = 0) { finite(value, minimum); if (!Number.isSafeInteger(value)) fail(); }
function enumValue(value, choices) { if (!choices.includes(value)) fail(); }
function unique(values) { if (!Array.isArray(values) || new Set(values).size !== values.length) fail(); }
export function aggregate(values) {
  if (!Array.isArray(values) || values.length === 0) fail();
  values.forEach(value => finite(value));
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { count: sorted.length, min: sorted[0], median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1) };
}
export function failureSample(code = 'internal-error', status = 'failed') {
  return { status, code, metrics: {}, assertions: [], counts: {} };
}
export function validateSample(sample, catalog, scenario) {
  required(sample, ['status', 'code', 'metrics', 'assertions', 'counts']);
  enumValue(sample.status, ['passed', 'failed', 'unsupported']);
  enumValue(sample.code, [null, ...HARNESS_CODES, ...catalog.ERROR_CODES]);
  object(sample.metrics, Object.keys(catalog.METRICS));
  Object.values(sample.metrics).forEach(value => finite(value));
  object(sample.counts, catalog.COUNT_KEYS);
  Object.values(sample.counts).forEach(value => integer(value));
  if (!Array.isArray(sample.assertions)) fail();
  unique(sample.assertions.map(assertion => assertion.id));
  for (const assertion of sample.assertions) {
    required(assertion, ['id', 'passed']); enumValue(assertion.id, catalog.CHECK_IDS);
    if (typeof assertion.passed !== 'boolean') fail();
  }
  if (sample.status === 'passed') {
    if (sample.code !== null || Object.keys(catalog.METRICS).some(key => !(key in sample.metrics)) || sample.assertions.some(assertion => !assertion.passed)) fail();
    if (!scenario.assertionIds?.length || scenario.assertionIds.some(id => !sample.assertions.some(assertion => assertion.id === id && assertion.passed))) fail();
  } else if (sample.code === null) fail();
  return sample;
}
export function validateResult(result, catalog) {
  required(result, ['schemaVersion', 'recordedAt', 'harness', 'library', 'environment', 'configuration', 'browsers', 'status']);
  if (result.schemaVersion !== SCHEMA_VERSION || typeof result.recordedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result.recordedAt) || !Number.isFinite(Date.parse(result.recordedAt))) fail();
  required(result.harness, ['hash', 'fixturesHash']);
  if (!HASH.test(result.harness.hash) || !HASH.test(result.harness.fixturesHash)) fail();
  required(result.library, ['version', 'distHash', 'publicCommit']);
  if (!VERSION.test(result.library.version) || !HASH.test(result.library.distHash) || (result.library.publicCommit !== null && !/^[a-f0-9]{40}$/.test(result.library.publicCommit))) fail();
  const environment = result.environment;
  required(environment, ['node', 'playwright', 'vite', 'chartJs', 'os', 'osVersion', 'arch', 'cpuModel', 'logicalCpus', 'memoryBytes', 'dpr', 'viewport', 'headless', 'softwareRendering']);
  for (const key of ['node', 'playwright', 'vite', 'chartJs']) if (!VERSION.test(environment[key])) fail();
  enumValue(environment.os, ['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'aix', 'sunos']);
  enumValue(environment.arch, ['x64', 'arm64', 'arm', 'ia32', 'ppc64', 's390x', 'riscv64', 'loong64']);
  if (!/^\d+(?:\.\d+){0,2}$/.test(environment.osVersion) || typeof environment.cpuModel !== 'string' || !/^[a-zA-Z0-9 ()@.+-]{1,120}$/.test(environment.cpuModel)) fail();
  integer(environment.logicalCpus, 1); integer(environment.memoryBytes, 1); finite(environment.dpr, 0.1);
  required(environment.viewport, ['width', 'height']); integer(environment.viewport.width, 1); integer(environment.viewport.height, 1);
  if (typeof environment.headless !== 'boolean' || typeof environment.softwareRendering !== 'boolean') fail();
  const configuration = result.configuration;
  required(configuration, ['profile', 'samples', 'warmups', 'timeoutMs', 'browsers', 'scenarioIds']);
  enumValue(configuration.profile, ['quick', 'stress']); integer(configuration.samples, 3); integer(configuration.warmups, 0); integer(configuration.timeoutMs, 1000);
  if (configuration.samples > 50 || configuration.warmups > 10 || configuration.timeoutMs > 120000) fail();
  unique(configuration.browsers); unique(configuration.scenarioIds);
  if (!configuration.browsers.length || !configuration.scenarioIds.length) fail();
  configuration.browsers.forEach(id => enumValue(id, BROWSERS));
  const scenarios = catalog.SCENARIOS.filter(scenario => scenario.profiles.includes(configuration.profile));
  if (configuration.scenarioIds.some(id => !scenarios.some(scenario => scenario.id === id))) fail();
  if (!Array.isArray(result.browsers)) fail();
  unique(result.browsers.map(browser => browser.id));
  if (result.browsers.length !== configuration.browsers.length || configuration.browsers.some(id => !result.browsers.some(browser => browser.id === id))) fail();
  for (const browser of result.browsers) {
    required(browser, ['id', 'version', 'status', 'code', 'scenarios']); enumValue(browser.id, configuration.browsers);
    enumValue(browser.status, ['passed', 'failed', 'unavailable', 'incomplete']); enumValue(browser.code, [null, ...HARNESS_CODES]);
    if (browser.version !== null && (typeof browser.version !== 'string' || !/^\d+(?:\.\d+){0,4}$/.test(browser.version))) fail();
    if (!Array.isArray(browser.scenarios)) fail(); unique(browser.scenarios.map(scenario => scenario.id));
    if (browser.status === 'unavailable') { if (browser.scenarios.length || browser.version !== null || browser.code === null) fail(); continue; }
    if (browser.scenarios.length !== configuration.scenarioIds.length || configuration.scenarioIds.some(id => !browser.scenarios.some(scenario => scenario.id === id))) fail();
    for (const measured of browser.scenarios) {
      required(measured, ['id', 'parameters', 'status', 'code', 'samples', 'warmupStatus']);
      const scenario = scenarios.find(item => item.id === measured.id); if (!scenario) fail();
      if (JSON.stringify(measured.parameters) !== JSON.stringify(scenario.parameters)) fail();
      enumValue(measured.status, ['passed', 'failed', 'unsupported', 'not-run']); enumValue(measured.code, [null, ...HARNESS_CODES, ...catalog.ERROR_CODES]);
      enumValue(measured.warmupStatus, ['passed', 'failed', 'unsupported', 'not-run']);
      if (!Array.isArray(measured.samples) || measured.samples.length > configuration.samples) fail();
      for (const sample of measured.samples) validateSample(sample, catalog, scenario);
      if (measured.status === 'passed' && (measured.samples.length !== configuration.samples || measured.samples.some(sample => sample.status !== 'passed') || measured.warmupStatus !== 'passed' || measured.code !== null)) fail();
      if (measured.status !== 'passed' && measured.code === null) fail();
    }
    if (browser.status === 'passed' && (!browser.version || browser.code !== null || browser.scenarios.some(scenario => scenario.status !== 'passed'))) fail();
  }
  enumValue(result.status, ['passed', 'failed', 'incomplete']);
  if (result.status === 'passed' && result.browsers.some(browser => browser.status !== 'passed')) fail();
  return result;
}

export function makeSchema(catalog) {
  const closed = (properties, requiredKeys = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required: requiredKeys });
  const number = { type: 'number', minimum: 0 }, integer = { type: 'integer', minimum: 0 };
  const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
  const version = { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+(?:[-+][a-zA-Z0-9.-]+)?$' };
  const code = { enum: [null, ...new Set([...HARNESS_CODES, ...catalog.ERROR_CODES])] };
  const sample = closed({ status: { enum: ['passed', 'failed', 'unsupported'] }, code, metrics: closed(Object.fromEntries(Object.keys(catalog.METRICS).map(key => [key, number])), []), assertions: { type: 'array', items: closed({ id: { enum: catalog.CHECK_IDS }, passed: { type: 'boolean' } }) }, counts: closed(Object.fromEntries(catalog.COUNT_KEYS.map(key => [key, integer])), []) });
  const scenario = { ...closed({ id: { enum: catalog.SCENARIOS.map(item => item.id) }, parameters: { type: 'object' }, status: { enum: ['passed', 'failed', 'unsupported', 'not-run'] }, code, samples: { type: 'array', maxItems: 50, items: { $ref: '#/$defs/sample' } }, warmupStatus: { enum: ['passed', 'failed', 'unsupported', 'not-run'] } }), oneOf: catalog.SCENARIOS.map(item => ({ properties: { id: { const: item.id }, parameters: { const: item.parameters } } })) };
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: { sample }, title: 'Lyra UI synthetic benchmark result', ...closed({ schemaVersion: { const: SCHEMA_VERSION }, recordedAt: { type: 'string', format: 'date-time' }, harness: closed({ hash: digest, fixturesHash: digest }), library: closed({ version, distHash: digest, publicCommit: { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^[a-f0-9]{40}$' }] } }), environment: closed({ node: version, playwright: version, vite: version, chartJs: version, os: { enum: ['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'aix', 'sunos'] }, osVersion: { type: 'string', pattern: '^\\d+(?:\\.\\d+){0,2}$' }, arch: { enum: ['x64', 'arm64', 'arm', 'ia32', 'ppc64', 's390x', 'riscv64', 'loong64'] }, cpuModel: { type: 'string', pattern: '^[a-zA-Z0-9 ()@.+-]{1,120}$' }, logicalCpus: { type: 'integer', minimum: 1 }, memoryBytes: { type: 'integer', minimum: 1 }, dpr: { type: 'number', minimum: 0.1 }, viewport: closed({ width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 } }), headless: { type: 'boolean' }, softwareRendering: { type: 'boolean' } }), configuration: closed({ profile: { enum: ['quick', 'stress'] }, samples: { type: 'integer', minimum: 3, maximum: 50 }, warmups: { type: 'integer', minimum: 0, maximum: 10 }, timeoutMs: { type: 'integer', minimum: 1000, maximum: 120000 }, browsers: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: BROWSERS } }, scenarioIds: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: catalog.SCENARIOS.map(item => item.id) } } }), browsers: { type: 'array', minItems: 1, items: closed({ id: { enum: BROWSERS }, version: { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^\\d+(?:\\.\\d+){0,4}$' }] }, status: { enum: ['passed', 'failed', 'unavailable', 'incomplete'] }, code: { enum: [null, ...HARNESS_CODES] }, scenarios: { type: 'array', items: scenario } }) }, status: { enum: ['passed', 'failed', 'incomplete'] } }) };
}
