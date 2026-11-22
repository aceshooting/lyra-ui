#!/usr/bin/env node
// Compares packaged .skill archives by CONTENT instead of by bytes. A deflated zip's bytes depend on
// the zlib build that wrote it (Python linked against zlib-ng and stock zlib emit different streams
// at the same level), so `git diff` on the archive fails on a machine whose zlib differs from the
// committer's even when every packaged file is identical. The archive is fresh when its sorted
// entry names and the sha256 of every decompressed entry match the committed one.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Returns [{ name, sha256 }] sorted by name for every file entry of a zip buffer. */
export function zipEntryDigests(buffer) {
  let eocd = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 22 - 0xffff); at -= 1) {
    if (buffer.readUInt32LE(at) === EOCD) { eocd = at; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive: end of central directory not found');
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL) throw new Error('corrupt zip central directory');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (buffer.readUInt32LE(localOffset) !== LOCAL) throw new Error(`corrupt zip local header for ${name}`);
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method !== 0 && method !== 8) throw new Error(`unsupported zip compression method ${method} for ${name}`);
    const data = method === 0 ? raw : inflateRawSync(raw);
    entries.push({ name, sha256: createHash('sha256').update(data).digest('hex') });
  }
  return entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

/** Returns human-readable differences between two archives' contents; empty when equivalent. */
export function compareSkillArchives(expected, actual) {
  const before = new Map(zipEntryDigests(expected).map((entry) => [entry.name, entry.sha256]));
  const after = new Map(zipEntryDigests(actual).map((entry) => [entry.name, entry.sha256]));
  const problems = [];
  for (const [name, digest] of before) {
    if (!after.has(name)) problems.push(`missing from the rebuilt archive: ${name}`);
    else if (after.get(name) !== digest) problems.push(`content differs: ${name}`);
  }
  for (const name of after.keys()) if (!before.has(name)) problems.push(`not in the committed archive: ${name}`);
  return problems;
}

function main(paths, ref = 'HEAD') {
  if (paths.length === 0) throw new Error('usage: check-skill-bundles.mjs <skills/x.skill>...');
  let failed = false;
  for (const path of paths) {
    const committed = execFileSync('git', ['show', `${ref}:${path}`], { maxBuffer: 1 << 28 });
    const problems = compareSkillArchives(committed, readFileSync(path));
    if (problems.length > 0) {
      failed = true;
      console.error(`${path} is stale against ${ref} (compared by content):`);
      for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
    } else {
      console.log(`${path}: ${zipEntryDigests(committed).length} entries match ${ref} by content.`);
    }
  }
  if (failed) process.exit(1);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
