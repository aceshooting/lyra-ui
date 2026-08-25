#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageName = '@aceshooting/lyra-ui';
const pluginName = 'lyra-ui';
const stableVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const documentPaths = {
  packageJson: 'packages/lyra-ui/package.json',
  claudePluginJson: 'plugins/lyra-ui/.claude-plugin/plugin.json',
  codexPluginJson: 'plugins/lyra-ui/.codex-plugin/plugin.json',
  claudeMarketplaceJson: '.claude-plugin/marketplace.json',
};

const versionArtifactKeys = [
  'claudePluginJson',
  'codexPluginJson',
  'claudeMarketplaceJson',
];

export function synchronizePluginVersionDocuments({
  packageJson,
  claudePluginJson,
  codexPluginJson,
  claudeMarketplaceJson,
}) {
  if (packageJson?.name !== packageName) {
    throw new Error(
      `expected package name "${packageName}", found "${packageJson?.name ?? 'missing'}"`,
    );
  }
  if (!stableVersion.test(String(packageJson.version ?? ''))) {
    throw new Error(
      `${packageName} version "${packageJson.version ?? 'missing'}" is not a stable semantic version`,
    );
  }

  for (const [label, manifest] of [
    ['Claude plugin manifest', claudePluginJson],
    ['Codex plugin manifest', codexPluginJson],
  ]) {
    if (manifest?.name !== pluginName) {
      throw new Error(
        `${label} has name "${manifest?.name ?? 'missing'}"; expected "${pluginName}"`,
      );
    }
  }

  if (!Array.isArray(claudeMarketplaceJson?.plugins)) {
    throw new Error('Claude marketplace must contain a plugins array');
  }
  const marketplaceIndexes = claudeMarketplaceJson.plugins
    .map((entry, index) => (entry?.name === pluginName ? index : -1))
    .filter((index) => index !== -1);
  if (marketplaceIndexes.length !== 1) {
    throw new Error(
      `Claude marketplace must contain exactly one "${pluginName}" entry, found ${marketplaceIndexes.length}`,
    );
  }

  const version = packageJson.version;
  const marketplaceIndex = marketplaceIndexes[0];
  return {
    claudePluginJson: { ...claudePluginJson, version },
    codexPluginJson: { ...codexPluginJson, version },
    claudeMarketplaceJson: {
      ...claudeMarketplaceJson,
      plugins: claudeMarketplaceJson.plugins.map((entry, index) =>
        index === marketplaceIndex ? { ...entry, version } : entry,
      ),
    },
  };
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function synchronizePluginVersionsAtRoot(root, { check = false } = {}) {
  const sourceEntries = await Promise.all(
    Object.entries(documentPaths).map(async ([key, relativePath]) => {
      const text = await readFile(path.join(root, relativePath), 'utf8');
      return [key, { value: JSON.parse(text), text }];
    }),
  );
  const sources = Object.fromEntries(sourceEntries);
  const synchronized = synchronizePluginVersionDocuments({
    packageJson: sources.packageJson.value,
    claudePluginJson: sources.claudePluginJson.value,
    codexPluginJson: sources.codexPluginJson.value,
    claudeMarketplaceJson: sources.claudeMarketplaceJson.value,
  });

  const changedPaths = versionArtifactKeys
    .filter((key) => sources[key].text !== serializeJson(synchronized[key]))
    .map((key) => documentPaths[key]);

  if (check && changedPaths.length > 0) {
    throw new Error(`plugin version artifacts are stale: ${changedPaths.join(', ')}`);
  }
  if (!check) {
    await Promise.all(
      versionArtifactKeys.map(async (key) => {
        const updated = serializeJson(synchronized[key]);
        if (sources[key].text !== updated) {
          await writeFile(path.join(root, documentPaths[key]), updated);
        }
      }),
    );
  }

  return changedPaths;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--check') || args.length > 1) {
    throw new Error('usage: node scripts/sync-plugin-version.mjs [--check]');
  }
  const check = args[0] === '--check';
  const changedPaths = await synchronizePluginVersionsAtRoot(repoRoot, { check });
  const version = JSON.parse(
    await readFile(path.join(repoRoot, documentPaths.packageJson), 'utf8'),
  ).version;
  if (check) {
    console.log(`Plugin version artifacts are current at ${version}.`);
  } else if (changedPaths.length === 0) {
    console.log(`Plugin version artifacts already record ${version}.`);
  } else {
    console.log(`Plugin version artifacts now record ${version}: ${changedPaths.join(', ')}`);
  }
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(`Plugin version synchronization failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
