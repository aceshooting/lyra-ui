#!/usr/bin/env node
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProfileDriver, validateSmokeAuthorization } from './profile-driver.mjs';
import { writeProfileRecord } from './profile.mjs';

export function smokeOptions(args) {
  const names = ['manifest', 'archive', 'build-manifest', 'output'], result = {};
  for (const argument of args) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || !names.includes(match[1]) || Object.hasOwn(result, match[1])) throw new TypeError('Unknown, duplicate or empty functional smoke option.');
    result[match[1]] = match[2];
  }
  if (!names.every(name => result[name])) throw new TypeError('Functional smoke requires manifest, archive, build-manifest and output.');
  return result;
}

/** One functional traversal per explicitly authorized workload. No performance summaries. */
export async function runSmokeCli(args) {
  const options = smokeOptions(args), authorization = JSON.parse(await readFile(options.manifest, 'utf8'));
  validateSmokeAuthorization(authorization);
  await mkdir(options.output, { recursive: false });
  const driver = createProfileDriver(options), controller = new AbortController();
  const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let sequence = 0;
  const retain = record => writeProfileRecord(join(options.output, `${String(++sequence).padStart(3, '0')}-${record.kind}.json`), record);
  try { return await driver.smoke(authorization, { signal: controller.signal, retain }); }
  catch (error) {
    await retain({ kind: 'functional-setup-failure', value: { kind: 'functional-smoke', status: 'failed', qualification: 'not-assessed', timings: 'discarded', message: String(error.message ?? error) } });
    throw error;
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); await driver.close(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runSmokeCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify({ kind: result.kind, status: result.status, qualification: result.qualification, workloads: result.outcomes.map(row => ({ workload: row.workload, status: row.status, failure: row.failure })) })}\n`);
    if (result.status !== 'completed') process.exitCode = 1;
  } catch { process.stderr.write('Functional smoke failed; inspect its retained diagnostic receipt. No performance qualification was produced.\n'); process.exitCode = 1; }
}
