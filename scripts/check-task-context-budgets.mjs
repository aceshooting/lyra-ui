import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const packageRoot = path.join(root, 'packages', 'lyra-ui');
const configPath = path.join(root, 'scripts', 'task-context-budgets.json');

// These are task reads, not a component/API inventory. Keep their wrappers identical to the
// reviewed v23/v24 receipt so a later optional tokenizer run can count the saved transcripts.
export const ROUTES = [
  {
    id: 'known-table',
    steps: [{ path: 'llms/components/lr-table.md', kind: 'full', label: 'table API' }],
  },
  {
    id: 'component-discovery',
    steps: [
      { path: 'llms.txt', kind: 'full', label: 'entry index' },
      { path: 'llms/index.md', kind: 'search', pattern: /\b(?:table|grid|tabular)\b/iu, label: 'catalog search' },
      { path: 'llms/components/lr-table.md', kind: 'full', label: 'table API' },
      { path: 'llms/components/lr-data-grid.md', kind: 'full', label: 'data-grid API' },
    ],
  },
  {
    id: 'imports-ssr',
    steps: [
      { path: 'llms.txt', kind: 'full', label: 'entry index' },
      { path: 'llms/shared/imports-and-registration.md', kind: 'full', label: 'imports and registration' },
      { path: 'llms/shared/frameworks-and-ssr.md', kind: 'full', label: 'frameworks and SSR' },
    ],
  },
  {
    id: 'look-composition',
    steps: [
      { path: 'llms.txt', kind: 'full', label: 'entry index' },
      {
        path: 'llms/shared/styles-and-tokens.md', kind: 'section',
        heading: '### Composing looks, surfaces and density', label: 'style composition',
      },
    ],
  },
  {
    id: 'v23-v24-upgrade',
    steps: [
      { path: 'llms.txt', kind: 'full', label: 'entry index' },
      { path: 'llms/shared/v23-to-v24-migration.md', kind: 'full', label: 'upgrade guide' },
    ],
  },
];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function linesWithEndings(text) {
  const lines = text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  assert.equal(lines.join(''), text, 'route text must split without loss');
  return lines;
}

export function extractStep(text, step) {
  if (step.kind === 'full') return text;
  const lines = linesWithEndings(text);
  if (step.kind === 'search') {
    const matches = lines.flatMap((line, index) =>
      step.pattern.test(line) ? [`${index + 1}:${line}`] : []);
    if (!matches.length) throw new Error(`${step.path}: search returned no matches`);
    return matches.join('');
  }
  if (step.kind === 'section') {
    const starts = lines.flatMap((line, index) =>
      line.replace(/[\r\n]+$/u, '') === step.heading ? [index] : []);
    if (starts.length !== 1) {
      throw new Error(`${step.path}: expected one heading ${step.heading}, found ${starts.length}`);
    }
    const level = step.heading.match(/^#{1,6}(?=\s)/u)?.[0].length;
    if (!level) throw new Error(`${step.path}: invalid section heading ${step.heading}`);
    const start = starts[0];
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index++) {
      const nextLevel = lines[index].match(/^(#{1,6})\s/u)?.[1].length;
      if (nextLevel && nextLevel <= level) {
        end = index;
        break;
      }
    }
    return lines.slice(start, end).join('');
  }
  throw new Error(`${step.path}: unknown route extraction kind ${step.kind}`);
}

export function measureRoutes(candidateRoot, routes, config) {
  assert.equal(config.schemaVersion, 1, 'task-context budget schema must be 1');
  assert.deepEqual(Object.keys(config.routes).sort(), routes.map((route) => route.id).sort(),
    'budget configuration must cover exactly the reviewed task routes');
  // Python's strict UTF-8 decoder preserves a leading BOM in the reviewed route transcripts.
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const transcripts = new Map();
  const receipt = {
    schemaVersion: 1,
    scope: 'package documentation payloads in the reviewed task routes; no skill, prompt or tool overhead',
    modelTokenClaim: 'none; UTF-8 bytes are a guard, and o200k_base is only a named proxy',
    reviewedBasis: config.reviewedBasis,
    routes: {},
  };
  for (const route of routes) {
    const budget = config.routes[route.id];
    assert.ok(Number.isSafeInteger(budget.ceilingUtf8Bytes) && budget.ceilingUtf8Bytes > 0,
      `${route.id}: invalid byte ceiling`);
    const chunks = [];
    const steps = [];
    for (const step of route.steps) {
      if (!/^llms(?:\.txt|\/[a-z0-9./-]+)$/u.test(step.path) ||
        step.path.split('/').includes('..')) {
        throw new Error(`${route.id}: invalid package route ${step.path}`);
      }
      const source = readFileSync(path.join(candidateRoot, step.path));
      const excerpt = extractStep(decoder.decode(source), step);
      const delivered = `[[${step.path} :: ${step.label}]]\n${excerpt}\n`;
      const deliveredBytes = Buffer.from(delivered, 'utf8');
      steps.push({ path: step.path, kind: step.kind, label: step.label,
        sourceFileSha256: sha256(source), deliveredUtf8Bytes: deliveredBytes.length,
        deliveredSha256: sha256(deliveredBytes) });
      chunks.push(delivered);
    }
    const transcript = chunks.join('');
    const bytes = Buffer.from(transcript, 'utf8');
    transcripts.set(route.id, transcript);
    receipt.routes[route.id] = {
      transcriptFile: `${route.id}.txt`, utf8Bytes: bytes.length, sha256: sha256(bytes),
      ceilingUtf8Bytes: budget.ceilingUtf8Bytes, steps,
    };
    if (bytes.length > budget.ceilingUtf8Bytes) {
      throw new Error(`${route.id}: ${bytes.length} UTF-8 bytes exceed reviewed ceiling ${budget.ceilingUtf8Bytes}`);
    }
  }
  return { receipt, transcripts };
}

function main(args) {
  let emitDirectory;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--emit-transcripts') {
      throw new Error('usage: node scripts/check-task-context-budgets.mjs [--emit-transcripts DIRECTORY]');
    }
    emitDirectory = args[1];
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const { receipt, transcripts } = measureRoutes(packageRoot, ROUTES, config);
  for (const [id, entry] of Object.entries(receipt.routes)) {
    process.stdout.write(`${id}: ${entry.utf8Bytes}/${entry.ceilingUtf8Bytes} UTF-8 bytes\n`);
  }
  if (emitDirectory) {
    mkdirSync(emitDirectory, { recursive: true });
    for (const [id, transcript] of transcripts) {
      writeFileSync(path.join(emitDirectory, `${id}.txt`), transcript, 'utf8');
    }
    receipt.scriptSha256 = sha256(readFileSync(scriptPath));
    receipt.configSha256 = sha256(readFileSync(configPath));
    writeFileSync(path.join(emitDirectory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main(process.argv.slice(2));
