import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keeps the Claude and Codex plugin manifests, their marketplace entries, and Codex's repo-local
// skill-discovery links internally consistent. The freshness of the generated references/*.md
// copies is enforced separately in CI via `./package.sh` + `git diff --exit-code`, the same pattern
// already used for packages/lyra-ui/custom-elements.json.

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const pluginName = 'lyra-ui';
const pluginSource = './plugins/lyra-ui';

const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

const packageJson = readJson('packages/lyra-ui/package.json');
const claudePluginJson = readJson('plugins/lyra-ui/.claude-plugin/plugin.json');
const codexPluginJson = readJson('plugins/lyra-ui/.codex-plugin/plugin.json');

for (const [path, manifest] of [
  ['plugins/lyra-ui/.claude-plugin/plugin.json', claudePluginJson],
  ['plugins/lyra-ui/.codex-plugin/plugin.json', codexPluginJson],
]) {
  if (manifest.name !== pluginName) {
    errors.push(
      `${path}'s "name" is "${manifest.name}", expected "${pluginName}" to match its containing directory plugins/lyra-ui/.`,
    );
  }
  if (manifest.version !== packageJson.version) {
    errors.push(
      `${path}'s version is "${manifest.version}", but packages/lyra-ui/package.json is at "${packageJson.version}" -- keep them in sync.`,
    );
  }
  if (manifest.skills !== './skills/') {
    errors.push(`${path}'s "skills" must be "./skills/".`);
  }
}

if (claudePluginJson.description !== codexPluginJson.description) {
  errors.push('The Claude and Codex plugin descriptions must match.');
}

const claudeMarketplaceJson = readJson('.claude-plugin/marketplace.json');
const claudeEntry = (claudeMarketplaceJson.plugins ?? []).find(
  (plugin) => plugin.name === pluginName,
);
if (!claudeEntry) {
  errors.push('.claude-plugin/marketplace.json has no "lyra-ui" entry in its "plugins" array.');
} else {
  if (claudeEntry.version !== claudePluginJson.version) {
    errors.push(
      `.claude-plugin/marketplace.json's lyra-ui plugin entry is at version "${claudeEntry.version}", but plugins/lyra-ui/.claude-plugin/plugin.json is at "${claudePluginJson.version}" -- keep them in sync.`,
    );
  }
  if (claudeEntry.source !== pluginSource) {
    errors.push(
      `.claude-plugin/marketplace.json's lyra-ui plugin entry has "source": "${claudeEntry.source}", expected "${pluginSource}".`,
    );
  }
  if (claudeEntry.description !== claudePluginJson.description) {
    errors.push(
      '.claude-plugin/marketplace.json\'s lyra-ui description must match the shared plugin description.',
    );
  }
}

const codexMarketplaceJson = readJson('.agents/plugins/marketplace.json');
const codexEntry = (codexMarketplaceJson.plugins ?? []).find(
  (plugin) => plugin.name === pluginName,
);
if (codexMarketplaceJson.name !== 'aceshooting') {
  errors.push('.agents/plugins/marketplace.json must use marketplace name "aceshooting".');
}
if (codexMarketplaceJson.interface?.displayName !== 'Aceshooting') {
  errors.push('.agents/plugins/marketplace.json must use interface.displayName "Aceshooting".');
}
if (!codexEntry) {
  errors.push('.agents/plugins/marketplace.json has no "lyra-ui" entry in its "plugins" array.');
} else {
  if (codexEntry.source?.source !== 'local' || codexEntry.source?.path !== pluginSource) {
    errors.push(
      `.agents/plugins/marketplace.json's lyra-ui source must be { "source": "local", "path": "${pluginSource}" }.`,
    );
  }
  if (
    codexEntry.policy?.installation !== 'AVAILABLE' ||
    codexEntry.policy?.authentication !== 'ON_INSTALL'
  ) {
    errors.push(
      '.agents/plugins/marketplace.json\'s lyra-ui policy must use installation "AVAILABLE" and authentication "ON_INSTALL".',
    );
  }
  if (codexEntry.category !== 'Developer Tools') {
    errors.push('.agents/plugins/marketplace.json\'s lyra-ui category must be "Developer Tools".');
  }
}

for (const [name, expectedTarget] of [
  ['lyra-ui', '../../plugins/lyra-ui/skills/lyra-ui'],
  ['compose-lyra-interfaces', '../../plugins/lyra-ui/skills/compose-lyra-interfaces'],
]) {
  const path = join(root, '.agents/skills', name);
  try {
    if (!lstatSync(path).isSymbolicLink()) {
      errors.push(`.agents/skills/${name} must be a symlink to ${expectedTarget}.`);
    } else if (readlinkSync(path) !== expectedTarget) {
      errors.push(
        `.agents/skills/${name} points to "${readlinkSync(path)}", expected "${expectedTarget}".`,
      );
    }
  } catch {
    errors.push(`.agents/skills/${name} is missing; link it to ${expectedTarget}.`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('lyra-ui Claude/Codex plugin and marketplace manifest check passed.');
}
