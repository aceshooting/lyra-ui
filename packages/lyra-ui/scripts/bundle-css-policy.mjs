import {
  budgetKilobytesToBytes,
  bundleBudgetSlackFinding,
  createBundleBudgetReview,
} from './bundle-budget-policy.mjs';

const CONFIG_KEYS = [
  '$comment',
  '$maximumHeadroomPercent',
  '$reviewedGzipBytes',
  '$maximumAllowedGzipKb',
  'measurements',
];
const MEASUREMENT_KEYS = ['id', 'kind', 'imports'];
const SAFE_DIST_CSS_PATH = /^dist\/[A-Za-z0-9_./-]+\.css$/u;

function sameKeys(actual, expected, label) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = [...expected].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} identity set must exactly match configured CSS measurements`);
  }
}

function cssExportPaths(packageExports) {
  return Object.entries(packageExports)
    .filter(([subpath]) =>
      subpath === './theme.css' ||
      subpath === './native.css' ||
      subpath === './density.css' ||
      subpath === './accents.css' ||
      subpath.startsWith('./looks/') && subpath.endsWith('.css') ||
      subpath.startsWith('./surfaces/') && subpath.endsWith('.css'),
    )
    .map(([subpath, target]) => {
      if (typeof target !== 'string' || !target.startsWith('./dist/')) {
        throw new Error(`${subpath}: supported CSS export must target a dist file`);
      }
      return target.slice(2);
    })
    .sort();
}

export function validateCssBundleConfig(config, packageExports, { allowUnreviewed = false } = {}) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new TypeError('CSS bundle config must be an object');
  }
  sameKeys(config, CONFIG_KEYS, 'CSS bundle config fields');
  if (typeof config.$comment !== 'string' || !config.$comment.trim()) {
    throw new TypeError('CSS bundle config must carry a rationale comment');
  }
  if (config.$maximumHeadroomPercent !== 4) {
    throw new Error('CSS bundle headroom must remain exactly 4%');
  }
  if (!Array.isArray(config.measurements) || config.measurements.length === 0) {
    throw new TypeError('CSS bundle config must define CSS measurements');
  }

  const byId = new Map();
  const standalonePaths = [];
  for (const measurement of config.measurements) {
    if (typeof measurement !== 'object' || measurement === null || Array.isArray(measurement)) {
      throw new TypeError('CSS measurements must be objects');
    }
    sameKeys(measurement, MEASUREMENT_KEYS, 'CSS measurement fields');
    if (typeof measurement.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(measurement.id)) {
      throw new TypeError('CSS measurement ids must be stable lowercase kebab-case names');
    }
    if (byId.has(measurement.id)) throw new Error(`duplicate CSS measurement id ${measurement.id}`);
    if (!['standalone', 'composition'].includes(measurement.kind)) {
      throw new TypeError(`${measurement.id}: unsupported CSS measurement kind`);
    }
    if (!Array.isArray(measurement.imports) || measurement.imports.length === 0) {
      throw new TypeError(`${measurement.id}: CSS measurement imports must be non-empty`);
    }
    if ((measurement.kind === 'standalone') !== (measurement.imports.length === 1)) {
      throw new Error(`${measurement.id}: standalone uses one import; composition uses multiple imports`);
    }
    const distinctImports = new Set(measurement.imports);
    if (distinctImports.size !== measurement.imports.length) {
      throw new Error(`${measurement.id}: CSS import list contains duplicates`);
    }
    for (const entry of measurement.imports) {
      if (typeof entry !== 'string' || !SAFE_DIST_CSS_PATH.test(entry) || entry.includes('..')) {
        throw new TypeError(`${measurement.id}: unsafe CSS dist path ${JSON.stringify(entry)}`);
      }
    }
    if (measurement.kind === 'standalone') standalonePaths.push(measurement.imports[0]);
    byId.set(measurement.id, measurement);
  }

  if (new Set(standalonePaths).size !== standalonePaths.length) {
    throw new Error('standalone CSS measurements must cover each supported asset exactly once');
  }
  const expectedStandalonePaths = cssExportPaths(packageExports);
  sameKeys(
    Object.fromEntries(standalonePaths.map((entry) => [entry, true])),
    expectedStandalonePaths,
    'standalone CSS import paths',
  );
  for (const measurement of config.measurements) {
    for (const entry of measurement.imports) {
      if (!expectedStandalonePaths.includes(entry)) {
        throw new Error(`${measurement.id}: ${entry} is not a supported theme/native/look/surface CSS export`);
      }
    }
  }

  const reviewed = config.$reviewedGzipBytes;
  const ceilings = config.$maximumAllowedGzipKb;
  if (typeof reviewed !== 'object' || reviewed === null || Array.isArray(reviewed)) {
    throw new TypeError('CSS bundle config must define reviewed gzip measurements');
  }
  if (typeof ceilings !== 'object' || ceilings === null || Array.isArray(ceilings)) {
    throw new TypeError('CSS bundle config must define hard gzip ceilings');
  }
  if (
    allowUnreviewed &&
    Object.keys(reviewed).length === 0 &&
    Object.keys(ceilings).length === 0
  ) {
    return byId;
  }
  sameKeys(reviewed, byId.keys(), 'reviewed CSS measurements');
  sameKeys(ceilings, byId.keys(), 'CSS budget ceilings');
  const derivedReview = createBundleBudgetReview(reviewed);
  if (JSON.stringify(Object.entries(ceilings).sort(([a], [b]) => a.localeCompare(b))) !==
      JSON.stringify(Object.entries(derivedReview.$maximumAllowedGzipKb).sort(([a], [b]) => a.localeCompare(b)))) {
    throw new Error('CSS budget ceilings must be derived from reviewed bytes with the shared headroom policy');
  }
  for (const [id, bytes] of Object.entries(reviewed)) {
    budgetKilobytesToBytes(ceilings[id], `css/${id}`);
    const finding = bundleBudgetSlackFinding(`css/${id}`, bytes, ceilings[id]);
    if (finding) throw new Error(finding);
  }
  return byId;
}

export function cssBudgetFinding(measurementId, liveGzipBytes, ceilings) {
  const ceilingBytes = budgetKilobytesToBytes(ceilings[measurementId], `css/${measurementId}`);
  return liveGzipBytes > ceilingBytes
    ? `css/${measurementId}: gzip ${liveGzipBytes} bytes exceeds budget ${ceilingBytes} bytes by ${liveGzipBytes - ceilingBytes} bytes`
    : null;
}
