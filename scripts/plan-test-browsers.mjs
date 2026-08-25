#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SUPPORTED_TEST_BROWSERS = Object.freeze([
  'chromium',
  'firefox',
  'chrome',
  'edge',
  'safari',
]);

const supportedBrowsers = new Set(SUPPORTED_TEST_BROWSERS);

export function normalizeBrowserInput(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > 256) {
    throw new TypeError(
      'Browser input must be a non-empty string of at most 256 characters.'
    );
  }

  const requested = input.split(',').map((browser) => browser.trim());
  if (requested.some((browser) => browser.length === 0)) {
    throw new TypeError('Browser input must not contain empty entries.');
  }

  const normalized = [];
  const seen = new Set();
  for (const browser of requested) {
    if (!supportedBrowsers.has(browser)) {
      throw new TypeError(
        `Unsupported browser '${browser}'. Supported browsers: ${SUPPORTED_TEST_BROWSERS.join(
          ', '
        )}.`
      );
    }
    if (!seen.has(browser)) {
      normalized.push(browser);
      seen.add(browser);
    }
  }

  return Object.freeze(normalized);
}

const invokedPath = process.argv[1];
if (invokedPath && realpathSync(invokedPath) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const browsers = normalizeBrowserInput(process.env.BROWSERS_INPUT);
    process.stdout.write(`browsers=${JSON.stringify(browsers)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
