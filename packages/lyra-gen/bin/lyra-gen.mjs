#!/usr/bin/env node
import { open, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { initialCatalog, selectCatalogPreset } from '../dist/catalog.js';
import { buildCatalogPrompt, exportCatalogArtifact, exportCatalogJsonSchema } from '../dist/prompts.js';
import { validateView } from '../dist/runtime.js';
import { parseJson } from '../dist/schema.js';
import { createReplayRecord, parseGeneratedSource, replayRecord } from '../dist/replay.js';
import { evaluateSemantics, summarizeMeasurements } from '../dist/evaluation.js';

const MAX_FILE_BYTES = 1_048_576;
const emit = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const failure = (code, message) => { emit({ ok: false, diagnostics: [{ code, severity: 'error', path: '', message }] }); process.exitCode = 1; };
class JsonInputError extends Error {
  constructor(result) { super('Invalid JSON input.'); this.result = result; }
}
function readJson(text) {
  const result = parseJson(text, { maxBytes: MAX_FILE_BYTES, maxStringLength: 262144 });
  if (!result.ok) throw new JsonInputError(result);
  return result.value;
}
async function readBounded(path) {
  if (path === '-') {
    const chunks = []; let length = 0;
    for await (const chunk of process.stdin) {
      length += chunk.length;
      if (length > MAX_FILE_BYTES) throw new Error('file-size');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  const handle = await open(path, 'r');
  try {
    if (!(await handle.stat()).isFile()) throw new Error('not-file');
    const bytes = Buffer.alloc(MAX_FILE_BYTES + 1);
    let total = 0;
    while (total < bytes.length) {
      const result = await handle.read(bytes, total, bytes.length - total, null);
      if (!result.bytesRead) break;
      total += result.bytesRead;
    }
    if (total > MAX_FILE_BYTES) throw new Error('file-size');
    return bytes.subarray(0, total).toString('utf8');
  } finally { await handle.close(); }
}
function argumentsFor(args) {
  const flags = {}; const positional = [];
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      if (!['format', 'iterations', 'fixtures', 'model', 'provider', 'source', 'surface', 'revision', 'preset'].includes(key) || Object.hasOwn(flags, key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('arguments');
      flags[key] = args[++i];
    } else positional.push(value);
  }
  return { flags, positional };
}
function formatFor(value, fallback = 'json') {
  const format = value ?? fallback;
  if (!['json', 'markup'].includes(format)) throw new Error('format');
  return format;
}
function sourceFor(text, flags) {
  const format = formatFor(flags.format, text.trimStart().startsWith('<') ? 'markup' : 'json');
  let surfaceId = flags.surface ?? 'generated-view';
  let revision = Number(flags.revision ?? 0);
  let source = text;
  if (format === 'json') {
    const parsed = readJson(text);
    const view = parsed && typeof parsed === 'object' && parsed.view && parsed.oracle && typeof parsed.id === 'string'
      ? parsed.view : parsed;
    if (view !== parsed) source = JSON.stringify(view);
    surfaceId = flags.surface ?? view?.surfaceId ?? surfaceId;
    revision = Number(flags.revision ?? view?.revision ?? revision);
  }
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('revision');
  return { text: source, format, surfaceId, revision };
}
async function benchmark(flags) {
  const iterations = Number(flags.iterations ?? 100);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10000) throw new Error('iterations');
  const formats = flags.format === 'both' || !flags.format ? ['json', 'markup'] : [formatFor(flags.format)];
  const directory = flags.fixtures ? resolve(flags.fixtures) : fileURLToPath(new URL('../examples/fixtures/', import.meta.url));
  const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  if (!files.length || files.length > 100) throw new Error('fixtures');
  const results = [];
  for (const name of files) {
    const scenario = readJson(await readBounded(resolve(directory, name)));
    if (!scenario.id || !scenario.view || !scenario.markup || !scenario.oracle) throw new Error('fixture-shape');
    for (const format of formats) {
      const text = format === 'json' ? JSON.stringify(scenario.view) : scenario.markup;
      const parsing = [], validation = [];
      let validCount = 0, semanticPass = true;
      let diagnostics = [];
      for (let index = 0; index < iterations; index++) {
        const start = performance.now();
        const parsed = parseGeneratedSource(text, format, initialCatalog, { surfaceId: scenario.view.surfaceId, revision: scenario.view.revision });
        const parsedAt = performance.now();
        const validated = parsed.ok ? validateView(parsed.value, initialCatalog) : parsed;
        const validatedAt = performance.now();
        parsing.push(parsedAt - start); validation.push(validatedAt - parsedAt);
        if (validated.ok) {
          validCount++;
          semanticPass &&= evaluateSemantics(validated.value, scenario.oracle).ok;
        } else { semanticPass = false; diagnostics = validated.diagnostics; }
      }
      results.push({ scenario: scenario.id, format, bytes: Buffer.byteLength(text), iterations, validCount, semanticPass, diagnostics, parseMs: summarizeMeasurements(parsing), validateMs: summarizeMeasurements(validation) });
    }
  }
  const ok = results.every(result => result.validCount === iterations && result.semanticPass);
  emit({ version: '1', kind: 'offline', ok, catalog: { id: initialCatalog.id, version: initialCatalog.version }, providerLatencyMs: null, renderMs: null, tokenUsage: null, costUsd: null, results });
  if (!ok) process.exitCode = 1;
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write('lyra-gen prompt [--preset name] [--format json|markup]\nlyra-gen schema [--preset name]\nlyra-gen validate <file|-> [--preset name] [--format json|markup]\nlyra-gen record <file|-> [--preset name] [--format json|markup] [--source id] [--model exact-id --provider id]\nlyra-gen replay <file|-> [--preset name]\nlyra-gen benchmark [--iterations 100] [--format json|markup|both] [--fixtures directory]\n');
    return;
  }
  const { flags, positional } = argumentsFor(args);
  const allowed = { prompt: ['format', 'preset'], schema: ['preset'], validate: ['format', 'surface', 'revision', 'preset'], record: ['format', 'surface', 'revision', 'source', 'model', 'provider', 'preset'], replay: ['preset'], benchmark: ['iterations', 'fixtures', 'format'] };
  if (!Object.hasOwn(allowed, command) || Object.keys(flags).some(key => !allowed[command].includes(key))) throw new Error('arguments');
  if (['validate', 'record', 'replay'].includes(command) ? positional.length !== 1 : positional.length !== 0) throw new Error('arguments');
  const selected = flags.preset ? selectCatalogPreset(flags.preset) : { ok: true, value: initialCatalog };
  if (!selected.ok) { emit(selected); process.exitCode = 1; return; }
  const catalog = selected.value;
  if (command === 'prompt') {
    const format = formatFor(flags.format);
    const prompt = format === 'json' ? buildCatalogPrompt(catalog) : [
      'Return one restricted Lyra Markup root. Tag names are catalog roles, never arbitrary HTML.',
      'Every node needs id="stable-id". String properties use quoted attributes; typed properties use ={JSON}.',
      'Use bindings={{"value":"/localStateKey"}} only on declared binding properties. Plain text uses XML entities; no comments, scripts, CSS, URLs or declarations.',
      'Close every tag. Do not invent properties or roles. Runtime validation is required.',
      JSON.stringify(exportCatalogArtifact(catalog))
    ].join('\n');
    process.stdout.write(`${prompt}\n`); return;
  }
  if (command === 'schema') { emit(exportCatalogJsonSchema(catalog)); return; }
  if (command === 'benchmark') { await benchmark(flags); return; }
  const text = await readBounded(positional[0]);
  if (command === 'replay') {
    const result = replayRecord(readJson(text), catalog);
    emit(result); if (!result.ok) process.exitCode = 1; return;
  }
  const source = sourceFor(text, flags);
  const parsed = parseGeneratedSource(source.text, source.format, catalog, source);
  const result = parsed.ok ? validateView(parsed.value, catalog) : parsed;
  if (command === 'validate') { emit(result); if (!result.ok) process.exitCode = 1; return; }
  if (!result.ok) { emit(result); process.exitCode = 1; return; }
  if (Boolean(flags.model) !== Boolean(flags.provider)) throw new Error('model-provider');
  const metadata = readJson(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  emit(createReplayRecord({ ...source, source: { kind: flags.model ? 'provider' : 'file', id: flags.source ?? 'local-input' }, model: flags.model ? { id: flags.model, provider: flags.provider } : null, package: { name: metadata.name, version: metadata.version }, catalog }));
}
main().catch(error => {
  if (error instanceof JsonInputError) { emit(error.result); process.exitCode = 1; }
  else failure('cli.input', 'Command failed. Check arguments, bounded input, and file format. Run lyra-gen help for usage.');
});
