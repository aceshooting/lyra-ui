#!/usr/bin/env node
// The `lyra-ui` executable: `init-agents` installs the bundled agent skills, `migrate-wa` forwards to
// the migration CLI (also published on its own as `lyra-ui-migrate`).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runInitAgents } from './init-agents.mjs';
import { isMainModule } from './is-main-module.mjs';

const USAGE = `Usage: lyra-ui <command> [options]

Commands:
  init-agents   set up AI coding agents (Claude Code, Codex, OpenCode, ...) with the Lyra UI skills
  migrate-wa    rename Web Awesome / Shoelace usage to lr-* (same as lyra-ui-migrate)

Run \`lyra-ui <command> --help\` for a command's options.
`;

export async function runLyraUi(argv) {
  const [command, ...rest] = argv;
  if (command === 'init-agents') return await runInitAgents(rest);
  if (command === 'migrate-wa') {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('./migrate-wa.mjs', import.meta.url)), ...rest],
      { stdio: 'inherit' },
    );
    return child.status ?? 1;
  }
  if (command === undefined || command === '--help' || command === '-h') {
    console.log(USAGE);
    return command === undefined ? 2 : 0;
  }
  console.error(`lyra-ui: unknown command "${command}"\n\n${USAGE}`);
  return 2;
}

if (isMainModule(import.meta.url)) process.exitCode = await runLyraUi(process.argv.slice(2));
