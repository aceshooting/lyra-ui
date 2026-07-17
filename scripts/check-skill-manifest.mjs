import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keeps plugins/lyra-ui/.claude-plugin/plugin.json and .claude-plugin/marketplace.json
// internally consistent (name matches directory, versions match, source path is correct). The
// freshness of the generated references/*.txt copies themselves is enforced separately in CI via
// `./package.sh` + `git diff --exit-code`, the same pattern already used for
// packages/lyra-ui/custom-elements.json -- a plain byte-diff doesn't need a dedicated script.

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

const pluginJson = JSON.parse(
  readFileSync(join(root, 'plugins/lyra-ui/.claude-plugin/plugin.json'), 'utf8'),
);
if (pluginJson.name !== 'lyra-ui') {
  errors.push(
    `plugins/lyra-ui/.claude-plugin/plugin.json's "name" is "${pluginJson.name}", expected "lyra-ui" to match its containing directory plugins/lyra-ui/.`,
  );
}

const marketplaceJson = JSON.parse(
  readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'),
);
const entry = (marketplaceJson.plugins ?? []).find((p) => p.name === 'lyra-ui');
if (!entry) {
  errors.push('.claude-plugin/marketplace.json has no "lyra-ui" entry in its "plugins" array.');
} else {
  if (entry.version !== pluginJson.version) {
    errors.push(
      `.claude-plugin/marketplace.json's lyra-ui plugin entry is at version "${entry.version}", but plugins/lyra-ui/.claude-plugin/plugin.json is at "${pluginJson.version}" -- keep them in sync.`,
    );
  }
  if (entry.source !== './plugins/lyra-ui') {
    errors.push(
      `.claude-plugin/marketplace.json's lyra-ui plugin entry has "source": "${entry.source}", expected "./plugins/lyra-ui".`,
    );
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('lyra-ui plugin/marketplace manifest check passed.');
}
