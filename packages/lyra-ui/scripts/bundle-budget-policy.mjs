const HARD_AGGREGATE_BUDGET_KEYS = new Set([
  '$componentP95GzipKb',
  '$componentMaxGzipKb',
]);

const MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT = 4;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hardBudgetKeys(budgets) {
  return Object.keys(budgets)
    .filter((key) => key.startsWith('dist/') || HARD_AGGREGATE_BUDGET_KEYS.has(key))
    .sort();
}

export function maximumReviewedBudgetBytes(
  reviewedGzipBytes,
  headroomPercent = MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT,
) {
  if (!Number.isSafeInteger(reviewedGzipBytes) || reviewedGzipBytes <= 0) {
    throw new TypeError('reviewed gzip measurement must be a positive safe integer byte count');
  }
  if (!Number.isFinite(headroomPercent) || headroomPercent < 0) {
    throw new TypeError('bundle-budget headroom percent must be a non-negative finite number');
  }
  return Math.floor(reviewedGzipBytes * (100 + headroomPercent) / 100);
}

export function budgetKilobytesToBytes(ceilingKilobytes, label = 'bundle budget') {
  if (!Number.isFinite(ceilingKilobytes) || ceilingKilobytes <= 0) {
    throw new TypeError(`${label}: hard gzip ceiling must be a positive finite KiB value`);
  }
  const ceilingBytes = ceilingKilobytes * 1024;
  if (!Number.isSafeInteger(ceilingBytes)) {
    throw new TypeError(`${label}: hard gzip ceiling must resolve to a whole-byte limit`);
  }
  return ceilingBytes;
}

export function createBundleBudgetReview(reviewedGzipBytes) {
  if (!isRecord(reviewedGzipBytes)) {
    throw new TypeError('reviewed bundle measurements must be an object');
  }
  const reviewed = Object.fromEntries(Object.entries(reviewedGzipBytes).sort(([a], [b]) =>
    a.localeCompare(b)));
  const maximumAllowedGzipKb = Object.fromEntries(
    Object.entries(reviewed).map(([key, bytes]) => [
      key,
      maximumReviewedBudgetBytes(bytes) / 1024,
    ]),
  );
  return {
    $maximumHeadroomPercent: MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT,
    $reviewedGzipBytes: reviewed,
    $maximumAllowedGzipKb: maximumAllowedGzipKb,
  };
}

export function bundleBudgetSlackFinding(
  key,
  liveGzipBytes,
  ceilingKilobytes,
  headroomPercent = MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT,
) {
  if (!Number.isSafeInteger(liveGzipBytes) || liveGzipBytes <= 0) {
    throw new TypeError(`${key}: live gzip measurement must be a positive safe integer`);
  }
  const ceilingBytes = budgetKilobytesToBytes(ceilingKilobytes, key);
  if (ceilingBytes < liveGzipBytes) return null;
  const maximumBytes = maximumReviewedBudgetBytes(liveGzipBytes, headroomPercent);
  if (ceilingBytes <= maximumBytes) return null;
  return (
    `${key}: hard ceiling ${ceilingBytes} bytes exceeds ${headroomPercent}% above the live ` +
    `gzip measurement ${liveGzipBytes} bytes (maximum ${maximumBytes}); remeasure and tighten it`
  );
}

export function validateBundleBudgetPolicy(budgets) {
  if (!isRecord(budgets)) throw new TypeError('bundle budgets must be a JSON object');
  if (budgets.$maximumHeadroomPercent !== MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT) {
    throw new Error(
      `bundle budget $maximumHeadroomPercent must remain exactly ` +
        `${MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT}%`,
    );
  }
  if (!isRecord(budgets.$reviewedGzipBytes)) {
    throw new TypeError('bundle budgets must define a $reviewedGzipBytes object');
  }

  const ceilingKeys = hardBudgetKeys(budgets);
  const measurementKeys = Object.keys(budgets.$reviewedGzipBytes).sort();
  for (const key of measurementKeys) {
    if (!ceilingKeys.includes(key)) {
      throw new Error(`${key}: reviewed measurement has no matching hard ceiling`);
    }
  }
  for (const key of ceilingKeys) {
    if (!Object.hasOwn(budgets.$reviewedGzipBytes, key)) {
      throw new Error(`${key}: hard ceiling has no reviewed gzip measurement`);
    }

    const reviewedBytes = budgets.$reviewedGzipBytes[key];
    if (!Number.isSafeInteger(reviewedBytes) || reviewedBytes <= 0) {
      throw new TypeError(`${key}: reviewed gzip measurement must be a positive safe integer`);
    }
    const ceilingBytes = budgetKilobytesToBytes(budgets[key], key);
    if (ceilingBytes < reviewedBytes) {
      throw new Error(
        `${key}: hard ceiling ${ceilingBytes} bytes is below its reviewed measurement ` +
          `${reviewedBytes} bytes`,
      );
    }
    const maximumBytes = maximumReviewedBudgetBytes(
      reviewedBytes,
      budgets.$maximumHeadroomPercent,
    );
    if (ceilingBytes > maximumBytes) {
      throw new Error(
        `${key}: hard ceiling ${ceilingBytes} bytes exceeds the reviewed ` +
          `${MAXIMUM_BUNDLE_BUDGET_HEADROOM_PERCENT}% headroom policy maximum ` +
          `${maximumBytes} bytes for measurement ${reviewedBytes}`,
      );
    }
  }

  return budgets;
}
