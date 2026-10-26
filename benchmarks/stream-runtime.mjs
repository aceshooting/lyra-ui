import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { aggregate } from './lib/results.mjs';
import { buildContext } from '../packages/lyra-gen/scripts/measure-bundles.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const encoder = new TextEncoder();
const chunks = ['a'.repeat(64), 'é'.repeat(64), '\ud83d', '\ude00'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function runtimeOptions(args) {
  const options = { candidate: join(root, 'packages/lyra-ui/dist/ai/runtime.js'), baseline: undefined, samples: 5, profile: 'full', output: undefined };
  let positional = false;
  for (const argument of args) {
    if (!argument.startsWith('--')) {
      if (positional) throw new Error('Only one positional runtime is accepted.');
      positional = true; options.candidate = resolve(argument); continue;
    }
    const [key, ...rest] = argument.split('='); const value = rest.join('=');
    if (key === '--candidate' && value) options.candidate = resolve(value);
    else if (key === '--baseline' && value) options.baseline = resolve(value);
    else if (key === '--samples' && /^\d+$/.test(value)) options.samples = Number(value);
    else if (key === '--profile' && ['quick', 'full'].includes(value)) options.profile = value;
    else if (key === '--output' && value) options.output = value;
    else throw new Error('Invalid runtime benchmark option.');
  }
  if (options.samples < 1 || options.samples > 30) throw new Error('Use 1–30 samples.');
  return options;
}
export function pairedOrder(sampleIndex, hasBaseline) {
  return hasBaseline ? sampleIndex % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'] : ['candidate'];
}

/** Setup, Unicode/value assertions and identity observations stay outside the timed delta loop. */
export function runWorkload(runtime, operations, retainedCharacters, observeIdentity) {
  const { createAgentStreamState, reduceAgentStream } = runtime;
  const metadata = 'm'.repeat(retainedCharacters), payload = 'd'.repeat(retainedCharacters);
  let state = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start', generation: 0, sequence: 1,
    message: { id: 'message', role: 'assistant', metadata: { retained: metadata }, parts: [
      { id: 'text', type: 'text', text: '', state: 'streaming' }, { id: 'data', type: 'data', data: { retained: payload } },
    ] },
  });
  assert.equal(state.error, undefined);
  const first = state.messages[0];
  let sharedPartCount = 0, sharedMetadataCount = 0;
  const started = performance.now();
  for (let index = 0; index < operations; index++) {
    state = reduceAgentStream(state, { type: 'message-part-delta', generation: 0, sequence: index + 2,
      messageId: 'message', partId: 'text', partType: 'text', delta: chunks[index % chunks.length] });
    if (observeIdentity) {
      sharedPartCount += Number(state.messages[0].parts[1] === first.parts[1]);
      sharedMetadataCount += Number(state.messages[0].metadata === first.metadata);
    }
  }
  const elapsedMs = performance.now() - started;
  const text = state.messages[0].parts[0].text;
  const expected = chunks.join('').repeat(Math.floor(operations / chunks.length)) + chunks.slice(0, operations % chunks.length).join('');
  assert.equal(state.error, undefined); assert.equal(text, expected); assert.equal(first.parts[0].text, '');
  assert.equal(state.messages[0].metadata.retained, metadata); assert.equal(state.messages[0].parts[1].data.retained, payload);
  return { elapsedMs, unchangedPartIdentityRatio: sharedPartCount / operations, unchangedMetadataIdentityRatio: sharedMetadataCount / operations,
    utf16Units: text.length, utf8Bytes: encoder.encode(text).byteLength };
}

export function semanticProbe(runtime) {
  const { createAgentStreamState, reduceAgentStream } = runtime;
  const delta = (state, text) => reduceAgentStream(state, { type: 'message-part-delta', generation: state.generation, sequence: state.cursor + 1,
    messageId: 'message', partId: 'text', partType: 'text', delta: text });
  let limited = reduceAgentStream(createAgentStreamState({ maxTextCharactersPerPart: 2 }), { type: 'message-start', generation: 0, sequence: 1,
    message: { id: 'message', role: 'assistant', parts: [{ id: 'text', type: 'text', text: '', state: 'streaming' }] } });
  limited = delta(delta(limited, '\ud83d'), '\ude00'); assert.equal(limited.error, undefined);
  assert.equal(limited.messages[0].parts[0].text, '😀');
  const rejected = delta(limited, 'x'); assert.ok(rejected.error); assert.equal(rejected.messages, limited.messages);
  const oversized = delta(createAgentStreamState({ maxRetainedBytes: 512 }), 'x'.repeat(1024)); assert.ok(oversized.error); assert.equal(oversized.messages.length, 0);
  const started = reduceAgentStream(createAgentStreamState(), { type: 'run-start', generation: 1, sequence: 1, runId: 'first' });
  const newer = reduceAgentStream(started, { type: 'run-start', generation: 2, sequence: 1, runId: 'second' });
  const stale = reduceAgentStream(newer, { type: 'message-part-delta', generation: 1, sequence: 100, messageId: 'message', partId: 'text', partType: 'text', delta: 'stale' });
  assert.equal(stale, newer);
  return { unicode: limited.messages[0].parts[0].text, utf16LimitCode: rejected.error.code, retainedLimitCode: oversized.error.code, retiredGenerationIgnored: true };
}

async function loadArtifact(file, label, directory, esbuild) {
  const output = join(directory, `${label}.mjs`);
  const built = await esbuild.build({ absWorkingDir: root, entryPoints: [file], bundle: true, format: 'esm', platform: 'node', target: 'node22', minify: true, sourcemap: false, write: false, metafile: true, outfile: output, logLevel: 'silent' });
  const bytes = built.outputFiles[0].contents;
  await writeFile(output, bytes, { flag: 'wx' });
  return { runtime: await import(pathToFileURL(output).href), evidence: {
    kind: 'provided-built-runtime', entrySha256: hash(await readFile(file)), bundleSha256: hash(bytes),
    inputSha256: (await Promise.all(Object.keys(built.metafile.inputs).map(async input => hash(await readFile(resolve(root, input)))))).sort(),
  } };
}

export async function runRuntime(options) {
  assert.equal(process.versions.node, (await readFile(join(root, '.nvmrc'), 'utf8')).trim(), 'Use the pinned Node version.');
  const { esbuild } = await buildContext();
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-stream-scaling-'));
  try {
    const loaded = { candidate: await loadArtifact(options.candidate, 'candidate', scratch, esbuild) };
    if (options.baseline) loaded.baseline = await loadArtifact(options.baseline, 'baseline', scratch, esbuild);
    const probes = Object.fromEntries(Object.entries(loaded).map(([name, artifact]) => [name, semanticProbe(artifact.runtime)]));
    if (loaded.baseline) assert.deepEqual(probes.candidate, probes.baseline, 'Baseline and candidate must agree on semantic probes before timing.');
    const configuration = { operations: options.profile === 'quick' ? [250, 500, 1000] : [1000, 2000, 4000], retainedCharactersPerField: options.profile === 'quick' ? [0, 65536] : [0, 65536, 262144], samples: options.samples, warmups: 1, order: 'alternating baseline/candidate within each workload/sample', identityObservedSeparately: true };
    const report = { schemaVersion: 2, workload: 'agent-stream-text-deltas', status: 'passed',
      environment: { node: process.versions.node, esbuild: esbuild.version, os: process.platform, arch: process.arch, cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
      harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))), fixtureSha256: hash(JSON.stringify({ chunks, configuration })),
      artifacts: Object.fromEntries(Object.entries(loaded).map(([name, artifact]) => [name, artifact.evidence])), semanticProbes: probes, configuration,
      note: 'Reducer-only delta loop. Array/map copying, validation and engine string concatenation remain included; input setup/assertions are excluded. No browser rendering, heap ceiling or provider metrics. Artifact labels do not establish published version provenance.',
      uncertainty: 'Raw paired samples and descriptive n/min/median/nearest-rank-p95/max. Small samples do not establish confidence intervals, causal attribution or an approved regression budget.',
      results: [],
    };
    for (const retained of configuration.retainedCharactersPerField) for (const operations of configuration.operations) {
      const samples = Object.fromEntries(Object.keys(loaded).map(name => [name, []]));
      const pairs = [];
      for (let index = -1; index < options.samples; index++) {
        const pair = {};
        for (const name of pairedOrder(index, Boolean(loaded.baseline))) {
          const result = runWorkload(loaded[name].runtime, operations, retained, false);
          if (index >= 0) { samples[name].push(result.elapsedMs); pair[name] = result.elapsedMs; }
        }
        if (index >= 0 && loaded.baseline) pairs.push({ sampleIndex: index, baselineMs: pair.baseline, candidateMs: pair.candidate, differenceMs: pair.candidate - pair.baseline });
      }
      const variants = Object.fromEntries(Object.entries(loaded).map(([name, artifact]) => {
        const identity = runWorkload(artifact.runtime, operations, retained, true);
        const { elapsedMs: _elapsed, ...semantics } = identity;
        return [name, { samplesMs: samples[name], ...aggregate(samples[name]), ...semantics }];
      }));
      report.results.push({ operations, retainedCharactersPerField: retained, variants, pairedSamples: pairs });
    }
    if (options.output) await writeFile(resolve(options.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runRuntime(runtimeOptions(process.argv.slice(2))).then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)).catch(() => {
    console.error('Stream runtime benchmark failed admission, semantic checks or measurement; no passing report was written.'); process.exitCode = 1;
  });
}
