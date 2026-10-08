// Which AI coding agents `lyra-ui init-agents` knows, and where each loads SKILL.md skills from in a
// project. Only agents whose current official documentation describes project-level SKILL.md
// skills are listed (sources in each `docs` field, last verified 2026-10-08); an agent not listed
// here still gets the AGENTS.md pointer block. Keep this the single source: init-agents and the
// provenance gate both read it.

/** The cross-agent project skill directory; the canonical install lives here. */
export const UNIVERSAL_SKILL_DIR = '.agents/skills';

/**
 * @typedef {object} AgentEntry
 * @property {string} id               value accepted by `--agents`
 * @property {string} name             display name
 * @property {string | null} ownSkillDir  project directory this agent needs besides the universal one,
 *                                     or null when it already reads UNIVERSAL_SKILL_DIR
 * @property {string[]} detect         project paths whose presence means the agent is used here
 * @property {string[]} reads          every project skill directory its docs list (informational)
 * @property {string} docs             official documentation page
 * @property {{ name: string, value: string }[]} [callerEnv]  environment the agent's own documentation says
 *                                     it sets in the shell tool it runs commands with (omitted unless verified)
 * @property {string} reload           what the agent must do after installing so the skill loads (from its docs)
 */

/** @type {readonly AgentEntry[]} */
export const AGENTS = Object.freeze([
  {
    id: 'claude',
    name: 'Claude Code',
    ownSkillDir: '.claude/skills',
    detect: ['.claude', 'CLAUDE.md'],
    reads: ['.claude/skills'],
    docs: 'https://code.claude.com/docs/en/skills',
    callerEnv: [{ name: 'CLAUDECODE', value: '1' }], // https://code.claude.com/docs/en/env-vars
    reload: 'run /reload-skills (a skills directory created mid-session is not watched yet; later edits load live)',
  },
  {
    id: 'codex',
    name: 'Codex',
    ownSkillDir: null,
    detect: ['.codex'],
    reads: ['.agents/skills'],
    docs: 'https://learn.chatgpt.com/docs/build-skills',
    reload: 'nothing; Codex detects skill changes automatically (restart Codex if the skill does not appear)',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    ownSkillDir: null,
    detect: ['.opencode', 'opencode.json', 'opencode.jsonc'],
    reads: ['.opencode/skills', '.claude/skills', '.agents/skills'],
    docs: 'https://opencode.ai/docs/skills/',
    reload: 'start a new session (the docs do not describe live reload)',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    ownSkillDir: null,
    detect: ['.cursor'],
    reads: ['.agents/skills', '.cursor/skills', '.claude/skills', '.codex/skills'],
    docs: 'https://cursor.com/docs/context/skills',
    reload: 'restart Cursor (skills are discovered at startup)',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    ownSkillDir: null,
    detect: ['.gemini', 'GEMINI.md'],
    reads: ['.gemini/skills', '.agents/skills'],
    docs: 'https://geminicli.com/docs/cli/skills/',
    callerEnv: [{ name: 'GEMINI_CLI', value: '1' }], // https://geminicli.com/docs/tools/shell/
    reload: 'run /skills reload (skills are scanned at session start)',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    ownSkillDir: null,
    detect: ['.github/copilot-instructions.md'],
    reads: ['.github/skills', '.claude/skills', '.agents/skills'],
    docs: 'https://docs.github.com/en/copilot/concepts/agents/about-agent-skills',
    reload: 'start a new session (the docs do not describe live reload)',
  },
  {
    id: 'amp',
    name: 'Amp',
    ownSkillDir: null,
    detect: [],
    reads: ['.agents/skills', '.claude/skills'],
    docs: 'https://ampcode.com/manual/agent-skills.md',
    reload: 'start a new thread (the docs do not describe live reload)',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    ownSkillDir: null,
    detect: ['.windsurf', '.devin'],
    reads: ['.devin/skills', '.windsurf/skills', '.agents/skills', '.claude/skills'],
    docs: 'https://docs.devin.ai/desktop/cascade/skills',
    reload: 'start a new session (the docs do not describe live reload)',
  },
]);

export const AGENT_IDS = Object.freeze(AGENTS.map((agent) => agent.id));

/** Every directory `init-agents` can write a skill into (the only agent-tooling paths docs may name). */
export function skillInstallDirectories() {
  return [...new Set([UNIVERSAL_SKILL_DIR, ...AGENTS.map((agent) => agent.ownSkillDir).filter(Boolean)])];
}

/**
 * The agent that is running this process, from the environment its own docs say it sets (only
 * agents with a verified variable appear in the registry; others pass `--agent <name>`).
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined} agent id
 */
export function detectCaller(env) {
  return AGENTS.find((agent) => (agent.callerEnv ?? []).some(({ name, value }) => env[name] === value))?.id;
}
