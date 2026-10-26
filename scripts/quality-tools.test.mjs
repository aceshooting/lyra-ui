import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { linkInputs, lycheeArgs } from './check-links.mjs';
import { SHELL_SHEBANG, shellScripts } from './check-shell.mjs';
import { trackedFindings } from './check-spelling.mjs';
import { ZIZMOR_ARGS } from './check-workflow-security.mjs';
import { PINNED_TOOLS, capturePinnedTool, extractMember, pinnedToolPath, tarEntries } from './lib/pinned-tool.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function tarEntry(name, body = Buffer.alloc(0), type = '0') {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000755\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
  header.write('00000000000\0', 136);
  header.write('        ', 148);
  header.write(type, 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}

const tarGz = (...entries) => gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

test('every pinned release is an https GitHub release asset with a SHA-256 and a version in its URL', () => {
  assert.deepEqual(Object.keys(PINNED_TOOLS).sort(), ['lychee', 'shellcheck', 'typos', 'zizmor']);
  for (const [name, pin] of Object.entries(PINNED_TOOLS)) {
    assert.match(pin.version, /^\d+\.\d+\.\d+$/u, `${name} version`);
    assert.match(pin.sha256, /^[0-9a-f]{64}$/u, `${name} SHA-256`);
    assert.match(pin.url, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/download\//u, `${name} URL`);
    assert.ok(pin.url.includes(pin.version), `${name}: the URL names the pinned version`);
    assert.match(pin.url, /\.tar\.gz$/u, `${name} archive`);
    assert.ok(pin.member && !pin.member.startsWith('/') && !pin.member.includes('..'), `${name} member`);
  }
});

test('the tar reader finds a regular file by name, with or without a leading ./', () => {
  const archive = tarGz(
    tarEntry('./', Buffer.alloc(0), '5'),
    tarEntry('./doc.md', Buffer.from('docs')),
    tarEntry('./typos', Buffer.from('binary-bytes')),
  );
  assert.equal(extractMember(archive, 'typos').toString(), 'binary-bytes');
  assert.equal(extractMember(archive, './doc.md').toString(), 'docs');
  assert.throws(() => extractMember(archive, 'missing'), /does not contain missing/u);
  assert.throws(() => extractMember(archive, 'doc'), /does not contain doc/u, 'partial names never match');
});

test('the tar reader honors GNU long names and pax paths, and skips global headers', () => {
  const longName = `${'directory/'.repeat(14)}tool`;
  const archive = tarGz(
    tarEntry('pax_global_header', Buffer.from('52 comment=abcdef\n'), 'g'),
    tarEntry('././@LongLink', Buffer.from(`${longName}\0`), 'L'),
    tarEntry('truncated', Buffer.from('gnu')),
    tarEntry('PaxHeaders/x', Buffer.from('21 path=pax/dir/tool\n'), 'x'),
    tarEntry('short', Buffer.from('pax')),
  );
  const names = [];
  for (const entry of tarEntries(gunzipSync(archive))) names.push(entry.name);
  assert.deepEqual(names, [longName, 'pax/dir/tool']);
  assert.equal(extractMember(archive, longName).toString(), 'gnu');
  assert.equal(extractMember(archive, 'pax/dir/tool').toString(), 'pax');
});

function fakeDownload(archive, calls) {
  return async (url) => {
    calls.push(url);
    return new Response(archive, { status: 200 });
  };
}

test('a pinned tool is downloaded once, verified, unpacked executable and then served from the cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pinned-tool-'));
  try {
    const archive = tarGz(tarEntry('tool-1.2.3/tool', Buffer.from('#!/bin/sh\necho 1.2.3\n')));
    const pins = { tool: { version: '1.2.3', url: 'https://example.test/tool.tar.gz', sha256: digest(archive), member: 'tool-1.2.3/tool' } };
    const calls = [];
    const options = { pins, cacheDir: dir, platform: 'linux', arch: 'x64', fetchImpl: fakeDownload(archive, calls), probe: () => null };
    const first = await pinnedToolPath('tool', options);
    assert.equal(first, join(dir, 'tool-1.2.3', 'tool'));
    assert.equal(readFileSync(first, 'utf8'), '#!/bin/sh\necho 1.2.3\n');
    assert.ok((statSync(first).mode & 0o111) !== 0, 'the unpacked binary is executable');
    assert.equal(await pinnedToolPath('tool', options), first);
    assert.deepEqual(calls, ['https://example.test/tool.tar.gz'], 'the second call reuses the cache');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('an installed copy with the pinned version is used without any download', async () => {
  const calls = [];
  const pins = { tool: { version: '1.2.3', url: 'https://example.test/tool.tar.gz', sha256: '0'.repeat(64), member: 'tool' } };
  const path = await pinnedToolPath('tool', {
    pins, cacheDir: join(tmpdir(), 'unused-cache'), platform: 'darwin', arch: 'arm64',
    fetchImpl: fakeDownload(Buffer.alloc(0), calls), probe: () => 'tool 1.2.3\n',
  });
  assert.equal(path, 'tool');
  assert.deepEqual(calls, []);
  for (const other of ['tool 9.9.9\n', 'tool 1.2.30\n', 'tool 11.2.3\n', 'tool 1.2.3.4\n']) {
    await assert.rejects(
      pinnedToolPath('tool', {
        pins, cacheDir: join(tmpdir(), 'unused-cache'), platform: 'darwin', arch: 'arm64',
        fetchImpl: fakeDownload(Buffer.alloc(0), calls), probe: () => other,
      }),
      /only downloaded on Linux x86_64/u,
      `an installed ${JSON.stringify(other.trim())} is never accepted for 1.2.3`,
    );
  }
});

test('a checksum mismatch or unknown tool fails closed and unpacks nothing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pinned-tool-'));
  try {
    const archive = tarGz(tarEntry('tool', Buffer.from('payload')));
    const pins = { tool: { version: '1.0.0', url: 'https://example.test/tool.tar.gz', sha256: 'f'.repeat(64), member: 'tool' } };
    await assert.rejects(
      pinnedToolPath('tool', { pins, cacheDir: dir, platform: 'linux', arch: 'x64', fetchImpl: fakeDownload(archive, []), probe: () => null }),
      /Checksum mismatch.*Nothing was unpacked/u,
    );
    assert.equal(existsSync(join(dir, 'tool-1.0.0')), false);
    await assert.rejects(pinnedToolPath('absent', { pins, cacheDir: dir }), /No pinned release is defined for absent/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shell script discovery finds named scripts and shebang scripts, not other interpreters', () => {
  for (const line of ['#!/bin/bash', '#!/bin/sh', '#!/usr/bin/env bash', '#!/usr/bin/env -S bash -e', '#! /bin/zsh', '#!/bin/dash']) {
    assert.match(line, SHELL_SHEBANG, line);
  }
  for (const line of ['#!/usr/bin/env node', '#!/usr/bin/env python3', '#!/bin/shell', '# bash', 'const sh = 1;']) {
    assert.doesNotMatch(line, SHELL_SHEBANG, line);
  }
  const scripts = shellScripts();
  for (const expected of ['scripts/ci.sh', 'scripts/check-workflows.sh', 'package.sh', '.githooks/pre-commit', 'scripts/ci-bin/pnpm']) {
    assert.ok(scripts.includes(expected), `${expected} is checked`);
  }
  assert.ok(!scripts.some((file) => file.endsWith('.mjs')), 'JavaScript files are not shell scripts');
});

test('spelling findings count only for tracked files, in a stable one-line form', () => {
  const stream = [
    '{"type":"typo","path":"./docs/a.md","line_num":3,"byte_offset":8,"typo":"recieve","corrections":["receive"]}',
    '{"type":"typo","path":"scratch/notes.md","line_num":1,"byte_offset":0,"typo":"datta","corrections":["data"]}',
    '{"type":"typo","path":"docs/recieve.md","byte_offset":0,"typo":"recieve","corrections":["receive","relieve"]}',
    '{"type":"binary_file","path":"./skills/x.skill"}',
    '',
  ].join('\n');
  assert.deepEqual(trackedFindings(stream, new Set(['docs/a.md', 'docs/recieve.md'])), [
    'docs/a.md:3: error: `recieve` should be `receive`',
    'docs/recieve.md: error: `recieve` should be `receive`, `relieve`',
  ]);
  assert.deepEqual(trackedFindings(stream, new Set()), [], 'untracked scratch files never fail the check');
  assert.deepEqual(trackedFindings('', new Set(['docs/a.md'])), []);
  assert.throws(() => trackedFindings('not json', new Set()), /JSON/u);
});

test('guided demo French copy leaves surrounding English and other files spell-checked', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'guided-spelling-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = [
    "const english = { title: 'avance' };",
    'const copies = {',
    '  fr: {',
    "    title: 'Réponse écrite à l’avance', total: 'Le contenu reste disponible',",
    '  },',
    "  ar: { title: 'avance' },",
    '};',
    "const status = 'avance';",
  ].join('\n');
  const example = 'packages/lyra-gen/examples/guided-demo.ts';
  const other = 'packages/lyra-gen/examples/other-demo.ts';
  await mkdir(join(directory, 'packages/lyra-gen/examples'), { recursive: true });
  await Promise.all([writeFile(join(directory, example), source), writeFile(join(directory, other), source)]);
  const { status, stdout } = await capturePinnedTool('typos', [
    '--isolated', '--config', fileURLToPath(new URL('../_typos.toml', import.meta.url)),
    '--format', 'json', example, other,
  ], { cwd: directory });
  assert.equal(status, 2, 'surrounding and unrelated prose still fails');
  const findings = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(item => item.type === 'typo');
  assert.deepEqual(findings.filter(item => item.path === example).map(item => item.line_num), [1, 6, 8]);
  assert.ok(findings.some(item => item.path === other && item.line_num === 4), 'the locale exception is scoped to the example');
});

test('link inputs omit only the fragment already excluded for its package-root links', () => {
  const files = [
    'README.md',
    'packages/lyra-ui/llms/00-llms-txt-intro.md',
    'packages/lyra-ui/llms/00-llms-full-intro.md',
    'docs/00-llms-txt-intro.md',
  ];
  assert.deepEqual(linkInputs(files), [files[0], files[2], files[3]]);
  assert.equal(files.length, 4, 'selection does not change the tracked input inventory');
  assert.ok(read('lychee.toml').includes("'^packages/lyra-ui/llms/00-llms-txt-intro\\.md$'"));
});

test('the tool wrappers pass the arguments the checks depend on', () => {
  assert.ok(ZIZMOR_ARGS.includes('--offline'), 'the per-push audit never needs the network or a token');
  assert.ok(ZIZMOR_ARGS.includes('.github/workflows'));
  const offline = lycheeArgs({ root: '/repo' });
  assert.deepEqual(offline, ['--config', 'lychee.toml', '--root-dir', '/repo', '--files-from', '-']);
  assert.ok(lycheeArgs({ external: true, root: '/repo' }).includes('--offline=false'));
  assert.match(read('lychee.toml'), /^offline = true$/mu, 'the default link check stays offline');
});

test('each check has a package script, runs in static-checks and in the local CI aggregate', () => {
  const { scripts } = JSON.parse(read('package.json'));
  const checks = {
    'check:workflow-security': 'node scripts/check-workflow-security.mjs',
    'check:spelling': 'node scripts/check-spelling.mjs',
    'check:links': 'node scripts/check-links.mjs',
    'check:shell': 'node scripts/check-shell.mjs',
    'check:workspace-deps': 'sherif',
    'check:lockfile': 'pnpm dedupe --check && pnpm peers check',
    'check:sbom': 'node scripts/check-sbom.mjs',
  };
  const workflow = read('.github/workflows/ci.yml');
  const aggregate = read('scripts/ci.sh');
  for (const [name, command] of Object.entries(checks)) {
    assert.equal(scripts[name], command, `${name} script`);
    assert.match(workflow, new RegExp(`- run: pnpm( run)? ${name}$`, 'mu'), `${name} runs in ci.yml`);
    assert.match(aggregate, new RegExp(`^pnpm( run)? ${name}$`, 'mu'), `${name} runs in scripts/ci.sh`);
  }
});
