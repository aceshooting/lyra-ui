#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const qualificationManifest = JSON.parse(
  readFileSync(path.join(repoRoot, '.github', 'release-qualification.json'), 'utf8'),
);
if (
  qualificationManifest?.schemaVersion !== 1 ||
  !qualificationManifest.workflows?.ci ||
  !qualificationManifest.workflows?.fullEngine ||
  !qualificationManifest.workflows?.testAllBrowsers
) {
  throw new Error('.github/release-qualification.json has an unsupported schema');
}
const ciQualification = qualificationManifest.workflows.ci;
const fullEngineQualification = qualificationManifest.workflows.fullEngine;
const testAllBrowsersQualification =
  qualificationManifest.workflows.testAllBrowsers;
for (const [label, workflow] of [
  ['CI', ciQualification],
  ['full-engine', fullEngineQualification],
  ['Test All Browsers', testAllBrowsersQualification],
]) {
  if (
    typeof workflow.name !== 'string' ||
    typeof workflow.path !== 'string' ||
    typeof workflow.event !== 'string' ||
    typeof workflow.headBranch !== 'string' ||
    !Array.isArray(workflow.requiredJobs) ||
    workflow.requiredJobs.length === 0 ||
    workflow.requiredJobs.some((name) => typeof name !== 'string' || name.length === 0) ||
    new Set(workflow.requiredJobs).size !== workflow.requiredJobs.length
  ) {
    throw new Error(`.github/release-qualification.json has an invalid ${label} contract`);
  }
}

export const REQUIRED_CI_JOBS = Object.freeze([...ciQualification.requiredJobs]);
export const REQUIRED_FULL_ENGINE_JOBS = Object.freeze([
  ...fullEngineQualification.requiredJobs,
]);
export const REQUIRED_TEST_ALL_BROWSER_JOBS = Object.freeze([
  ...testAllBrowsersQualification.requiredJobs,
]);

const RELEASE_PACKAGES = Object.freeze({
  'lyra-ui': '@aceshooting/lyra-ui',
  'lyra-flags': '@aceshooting/lyra-flags',
});

// Release automation intentionally accepts only stable core versions. Changesets prerelease
// mode and SemVer build metadata both require an explicit npm dist-tag/versioning policy; silently
// publishing either as `latest` would make the release contract ambiguous.
const STABLE_SEMVER = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)';
const RELEASE_TAG = new RegExp(`^(${Object.keys(RELEASE_PACKAGES).join('|')})@(${STABLE_SEMVER})$`);

function evaluateRequiredWorkflowRun({
  run,
  jobs,
  sha,
  workflowName,
  workflowPath,
  requiredJobs,
  runLabel,
  requiredJobLabel,
  workflowDescription,
  requiredEvent = null,
  requiredHeadBranch = null,
}) {
  const runId = run?.id ?? '(unknown)';
  if (!run || run.head_sha !== sha) {
    return {
      state: 'failed',
      message: `${runLabel} run ${runId} does not target the release commit ${sha}.`,
    };
  }
  if (run.name !== workflowName || run.path !== workflowPath) {
    return {
      state: 'failed',
      message: `Workflow run ${runId} is not the repository ${workflowDescription}.`,
    };
  }
  if (requiredEvent !== null && run.event !== requiredEvent) {
    return {
      state: 'failed',
      message: `${runLabel} run ${runId} has event '${run.event ?? 'unknown'}'; expected '${requiredEvent}'.`,
    };
  }
  if (requiredHeadBranch !== null && run.head_branch !== requiredHeadBranch) {
    return {
      state: 'failed',
      message: `${runLabel} run ${runId} has head branch '${run.head_branch ?? 'unknown'}'; expected '${requiredHeadBranch}'.`,
    };
  }
  if (run.status !== 'completed') {
    return {
      state: 'pending',
      message: `${runLabel} run ${runId} is ${run.status ?? 'pending'} for ${sha}.`,
    };
  }
  if (run.conclusion !== 'success') {
    return {
      state: 'failed',
      message: `${runLabel} run ${runId} concluded ${run.conclusion ?? 'without a conclusion'} for ${sha}.`,
    };
  }

  for (const job of jobs ?? []) {
    if (job.status !== 'completed') {
      return {
        state: 'pending',
        message: `${runLabel} run ${runId} job '${job.name}' is ${job.status ?? 'pending'}/${job.conclusion ?? 'pending'}.`,
      };
    }
    if (job.conclusion !== 'success') {
      return {
        state: 'failed',
        message: `${runLabel} run ${runId} job '${job.name}' is ${job.status}/${job.conclusion ?? 'without a conclusion'}.`,
      };
    }
  }

  for (const requiredName of requiredJobs) {
    const matches = (jobs ?? []).filter((job) => job.name === requiredName);
    if (matches.length === 0) {
      return {
        state: 'failed',
        message: `${runLabel} run ${runId} is missing required job '${requiredName}'.`,
      };
    }
    if (!matches.some((job) => job.status === 'completed' && job.conclusion === 'success')) {
      const state = matches.some((job) => job.status !== 'completed') ? 'pending' : 'failed';
      const conclusions = matches
        .map((job) => `${job.status}/${job.conclusion ?? 'pending'}`)
        .join(', ');
      return {
        state,
        message: `Required ${requiredJobLabel} job '${requiredName}' in run ${runId} is ${conclusions}.`,
      };
    }
  }

  return {
    state: 'success',
    message: `${runLabel} run ${runId} passed all ${requiredJobs.length} required jobs for ${sha}.`,
  };
}

export function evaluateCiRun({ run, jobs, sha }) {
  return evaluateRequiredWorkflowRun({
    run,
    jobs,
    sha,
    workflowName: ciQualification.name,
    workflowPath: ciQualification.path,
    requiredJobs: REQUIRED_CI_JOBS,
    runLabel: 'CI',
    requiredJobLabel: 'CI',
    workflowDescription: 'CI workflow',
    requiredEvent: ciQualification.event,
    requiredHeadBranch: ciQualification.headBranch,
  });
}

export function evaluateFullEngineRun({ run, jobs, sha }) {
  return evaluateRequiredWorkflowRun({
    run,
    jobs,
    sha,
    workflowName: fullEngineQualification.name,
    workflowPath: fullEngineQualification.path,
    requiredJobs: REQUIRED_FULL_ENGINE_JOBS,
    runLabel: 'Full browser-engine suite',
    requiredJobLabel: 'full-engine',
    workflowDescription: 'full-engine workflow',
    requiredEvent: fullEngineQualification.event,
    requiredHeadBranch: fullEngineQualification.headBranch,
  });
}

export function evaluateTestAllBrowsersRun({ run, jobs, sha }) {
  return evaluateRequiredWorkflowRun({
    run,
    jobs,
    sha,
    workflowName: testAllBrowsersQualification.name,
    workflowPath: testAllBrowsersQualification.path,
    requiredJobs: REQUIRED_TEST_ALL_BROWSER_JOBS,
    runLabel: 'Test All Browsers',
    requiredJobLabel: 'browser',
    workflowDescription: 'Test All Browsers workflow',
    requiredEvent: testAllBrowsersQualification.event,
    requiredHeadBranch: testAllBrowsersQualification.headBranch,
  });
}

const defaultDelay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

async function waitForSuccessfulWorkflow({
  sha,
  listRuns,
  listJobs,
  evaluateRun,
  workflowLabel,
  timeoutMs = 60 * 60 * 1000,
  pollMs = 20 * 1000,
  delay = defaultDelay,
  now = Date.now,
  onStatus = () => {},
}) {
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`Invalid release commit SHA: ${sha}.`);
  const startedAt = now();
  let lastStatus = `No ${workflowLabel} workflow run has been recorded for ${sha}.`;

  while (now() - startedAt <= timeoutMs) {
    const runs = (await listRuns(sha))
      .filter((run) => run.head_sha === sha)
      .sort((left, right) => Number(right.id) - Number(left.id));

    for (const run of runs) {
      const jobs = await listJobs(run.id);
      const result = evaluateRun({ run, jobs, sha });
      lastStatus = result.message;
      onStatus(result.message);
      if (result.state === 'success') return { run, jobs, result };
    }

    if (runs.length === 0) onStatus(lastStatus);
    await delay(pollMs);
  }

  throw new Error(
    `Timed out waiting for a successful ${workflowLabel} run for ${sha}. Last status: ${lastStatus}`,
  );
}

export function waitForSuccessfulCi(options) {
  return waitForSuccessfulWorkflow({
    ...options,
    evaluateRun: evaluateCiRun,
    workflowLabel: 'CI',
  });
}

export function waitForSuccessfulFullEngine(options) {
  return waitForSuccessfulWorkflow({
    ...options,
    evaluateRun: evaluateFullEngineRun,
    workflowLabel: 'full-engine',
  });
}

export function waitForSuccessfulTestAllBrowsers(options) {
  return waitForSuccessfulWorkflow({
    ...options,
    evaluateRun: evaluateTestAllBrowsersRun,
    workflowLabel: 'Test All Browsers',
  });
}

export function parseReleaseTag(tag) {
  const match = String(tag ?? '').match(RELEASE_TAG);
  if (!match) {
    throw new Error(
      `Unsupported release tag '${tag}'. Expected a stable lyra-ui@<semver> or lyra-flags@<semver> tag.`,
    );
  }
  const [, packageDirectory, version] = match;
  return {
    tag,
    directory: `packages/${packageDirectory}`,
    packageName: RELEASE_PACKAGES[packageDirectory],
    version,
  };
}

export function validateAnnotatedTag({ tag, objectType, checkoutSha, tagCommitSha }) {
  parseReleaseTag(tag);
  if (objectType !== 'tag') {
    throw new Error(`Release ref '${tag}' must be annotated; git object type is '${objectType}'.`);
  }
  for (const [label, value] of [
    ['checkout SHA', checkoutSha],
    ['tag commit SHA', tagCommitSha],
  ]) {
    if (!/^[0-9a-f]{40}$/i.test(String(value ?? ''))) {
      throw new Error(`${label} is not a full Git commit SHA: ${value}.`);
    }
  }
  if (checkoutSha !== tagCommitSha) {
    throw new Error(
      `Checked-out commit ${checkoutSha} does not match tag '${tag}' commit ${tagCommitSha}.`,
    );
  }
  return { tag, commitSha: checkoutSha };
}

export function validateWorkflowSource({
  tag,
  eventName,
  githubRef,
  githubSha,
  tagCommitSha,
}) {
  parseReleaseTag(tag);
  if (!['release', 'workflow_dispatch'].includes(eventName)) {
    throw new Error(`Release workflow event '${eventName}' is not permitted.`);
  }
  const expectedRef = `refs/tags/${tag}`;
  if (githubRef !== expectedRef) {
    throw new Error(
      `Release workflow ref '${githubRef}' does not match requested tag ref '${expectedRef}'. ` +
        `Dispatch the workflow with --ref '${tag}'.`,
    );
  }
  for (const [label, value] of [
    ['workflow SHA', githubSha],
    ['tag commit SHA', tagCommitSha],
  ]) {
    if (!/^[0-9a-f]{40}$/i.test(String(value ?? ''))) {
      throw new Error(`${label} is not a full Git commit SHA: ${value}.`);
    }
  }
  if (githubSha !== tagCommitSha) {
    throw new Error(
      `Release workflow SHA ${githubSha} does not match tag '${tag}' commit ${tagCommitSha}.`,
    );
  }
  return { tag, commitSha: githubSha, ref: githubRef, eventName };
}

export function selectReleaseTarball(files) {
  const candidates = [...files].filter((file) => String(file).endsWith('.tgz'));
  if (candidates.length !== 1 || candidates.length !== files.length) {
    throw new Error(
      `Expected exactly one .tgz release asset, received ${files.length}: ${files.join(', ') || '(none)'}.`,
    );
  }
  return candidates[0];
}

export function validateTarballIdentity(packageJson, expected) {
  if (!packageJson || typeof packageJson !== 'object') {
    throw new Error('The release tarball package/package.json is not a JSON object.');
  }
  if (packageJson.name !== expected.packageName) {
    throw new Error(
      `Release tarball package name '${packageJson.name}' does not match tag package '${expected.packageName}'.`,
    );
  }
  if (packageJson.version !== expected.version) {
    throw new Error(
      `Release tarball package version '${packageJson.version}' does not match tag version '${expected.version}'.`,
    );
  }
  return { name: packageJson.name, version: packageJson.version };
}

export function validateRebuiltTarballBytes(releaseBytes, rebuiltBytes) {
  if (!Buffer.isBuffer(releaseBytes) || !Buffer.isBuffer(rebuiltBytes)) {
    throw new Error('Tarball byte comparison requires two Buffer values.');
  }
  if (!releaseBytes.equals(rebuiltBytes)) {
    throw new Error(
      `Release tarball does not byte-match the exact tagged-source rebuild ` +
        `(${releaseBytes.byteLength} release bytes, ${rebuiltBytes.byteLength} rebuilt bytes).`,
    );
  }
  return { byteLength: releaseBytes.byteLength };
}

function parseOptions(argv) {
  const [command, ...argumentsList] = argv;
  const options = { command, file: [] };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2).replaceAll('-', '_');
    const value = argumentsList[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
    if (key === 'file') options.file.push(path.resolve(value));
    else options[key] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`--${name.replaceAll('_', '-')} is required.`);
  }
  return value;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'lyra-ui-release-integrity',
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${url}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

export async function collectGitHubPages(
  fetchPage,
  { pageSize = 100, maxPages = 100 } = {},
) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('GitHub pageSize must be a positive integer.');
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error('GitHub maxPages must be a positive integer.');
  }
  const items = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const pageItems = await fetchPage(page);
    if (!Array.isArray(pageItems)) throw new Error(`GitHub page ${page} is not an array.`);
    items.push(...pageItems);
    if (pageItems.length < pageSize) return items;
  }
  throw new Error(`GitHub pagination exceeded ${maxPages} pages; refusing a partial result.`);
}

async function githubArray(url, token, property) {
  return collectGitHubPages(async (page) => {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set('per_page', '100');
    pageUrl.searchParams.set('page', String(page));
    const data = await githubJson(pageUrl, token);
    const items = data?.[property];
    if (!Array.isArray(items)) {
      throw new Error(`GitHub API response for ${pageUrl} has no ${property} array.`);
    }
    return items;
  });
}

async function waitWorkflowCli(options, { defaultWorkflow, waiter, workflowLabel }) {
  const repository = requireOption(options, 'repository');
  const sha = requireOption(options, 'sha');
  const workflow = options.workflow ?? defaultWorkflow;
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(`GH_TOKEN or GITHUB_TOKEN is required to inspect ${workflowLabel} runs.`);
  }
  const encodedWorkflow = encodeURIComponent(workflow);
  const base = `https://api.github.com/repos/${repository}`;
  const timeoutMs = Number(options.timeout_seconds ?? 3600) * 1000;
  const pollMs = Number(options.poll_seconds ?? 20) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-seconds must be positive.');
  }
  if (!Number.isFinite(pollMs) || pollMs <= 0) {
    throw new Error('--poll-seconds must be positive.');
  }

  const result = await waiter({
    sha,
    timeoutMs,
    pollMs,
    listRuns: async () => {
      const query = new URLSearchParams({ head_sha: sha });
      return githubArray(
        `${base}/actions/workflows/${encodedWorkflow}/runs?${query}`,
        token,
        'workflow_runs',
      );
    },
    listJobs: async (runId) =>
      githubArray(`${base}/actions/runs/${runId}/jobs`, token, 'jobs'),
    onStatus: (message) => console.log(message),
  });
  console.log(result.result.message);
}

function waitCiCli(options) {
  return waitWorkflowCli(options, {
    defaultWorkflow: 'ci.yml',
    waiter: waitForSuccessfulCi,
    workflowLabel: 'CI',
  });
}

function waitFullEngineCli(options) {
  return waitWorkflowCli(options, {
    defaultWorkflow: 'full-engine.yml',
    waiter: waitForSuccessfulFullEngine,
    workflowLabel: 'full-engine',
  });
}

function waitTestAllBrowsersCli(options) {
  return waitWorkflowCli(options, {
    defaultWorkflow: 'test-all-browsers.yml',
    waiter: waitForSuccessfulTestAllBrowsers,
    workflowLabel: 'Test All Browsers',
  });
}

function resolveTagCli(options) {
  const expected = parseReleaseTag(requireOption(options, 'tag'));
  const packageFile = path.join(repoRoot, expected.directory, 'package.json');
  if (!existsSync(packageFile)) throw new Error(`Missing package metadata: ${packageFile}.`);
  const packageJson = JSON.parse(readFileSync(packageFile, 'utf8'));
  validateTarballIdentity(packageJson, expected);
  const outputFile = requireOption(options, 'github_output');
  appendFileSync(
    outputFile,
    `dir=${expected.directory}\nname=${expected.packageName}\nversion=${expected.version}\n`,
  );
  console.log(`${expected.tag} resolves to ${expected.packageName} in ${expected.directory}.`);
}

function validateGitTagCli(options) {
  const result = validateAnnotatedTag({
    tag: requireOption(options, 'tag'),
    objectType: requireOption(options, 'object_type'),
    checkoutSha: requireOption(options, 'checkout_sha'),
    tagCommitSha: requireOption(options, 'tag_commit_sha'),
  });
  console.log(`Annotated tag '${result.tag}' resolves to checked-out commit ${result.commitSha}.`);
}

function validateWorkflowSourceCli(options) {
  const result = validateWorkflowSource({
    tag: requireOption(options, 'tag'),
    eventName: requireOption(options, 'event_name'),
    githubRef: requireOption(options, 'github_ref'),
    githubSha: requireOption(options, 'github_sha'),
    tagCommitSha: requireOption(options, 'tag_commit_sha'),
  });
  console.log(
    `Workflow ${result.eventName} context is bound to '${result.ref}' at ${result.commitSha}.`,
  );
}

function validateTarballCli(options) {
  const expected = parseReleaseTag(requireOption(options, 'tag'));
  const tarball = selectReleaseTarball(options.file);
  if (!existsSync(tarball) || !statSync(tarball).isFile()) {
    throw new Error(`Release tarball does not exist as a regular file: ${tarball}.`);
  }
  const packageText = execFileSync('tar', ['-xOf', tarball, 'package/package.json'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  const identity = validateTarballIdentity(JSON.parse(packageText), expected);
  const outputFile = options.github_output;
  if (outputFile) appendFileSync(outputFile, `path=${tarball}\n`);
  console.log(
    `Validated ${tarball} as ${identity.name}@${identity.version}; these exact bytes may be attested and published.`,
  );
}

function compareRebuildCli(options) {
  const releaseFile = path.resolve(requireOption(options, 'release_file'));
  const rebuiltFile = path.resolve(requireOption(options, 'rebuilt_file'));
  for (const [label, file] of [
    ['Release tarball', releaseFile],
    ['Rebuilt tarball', rebuiltFile],
  ]) {
    if (!existsSync(file) || !statSync(file).isFile()) {
      throw new Error(`${label} does not exist as a regular file: ${file}.`);
    }
  }
  const result = validateRebuiltTarballBytes(readFileSync(releaseFile), readFileSync(rebuiltFile));
  console.log(
    `Release tarball byte-matches the exact tagged-source rebuild (${result.byteLength} bytes).`,
  );
}

/**
 * The published site's `changelog.json` is what the documented upgrade workflow tells a consumer
 * (and an upgrading agent) to read: fetch it, and read every release between the installed version
 * and its `latest`. It is built by the SIBLING lyra-ui.com repository from this repo's CHANGELOG.md
 * and deployed separately, AFTER the release -- so between `npm publish` and that deploy the feed
 * advertises the previous version as current.
 *
 * That window is not theoretical and it is not brief. It was reported twice, from two different
 * consumer projects, on two consecutive releases: the site said 11.0.0 while npm had 11.1.0, then
 * said 11.1.0 while npm had 11.2.0. The failure is silent and it inverts the workflow's own
 * advice -- a reader who trusts the feed concludes they are already current and never reads the
 * newest release. Both reporters only caught it by reading the installed tarball's CHANGELOG.md
 * instead, which is precisely what the documented workflow tells them not to have to do.
 *
 * A stale feed is therefore treated here as an incomplete release rather than a docs nit.
 */
export function evaluateSiteFreshness({
  packageName,
  expectedVersion,
  npmDistTagLatest,
  changelog,
  catalogVersion,
}) {
  const problems = [];
  if (npmDistTagLatest !== expectedVersion) {
    problems.push(
      `npm dist-tags.latest for ${packageName} is ${npmDistTagLatest ?? '(none)'}, expected ${expectedVersion}`,
    );
  }
  if (!changelog || typeof changelog !== 'object') {
    problems.push('changelog.json could not be fetched or was not an object');
    return { fresh: false, problems };
  }
  if (changelog.latest !== expectedVersion) {
    problems.push(`changelog.json "latest" is ${changelog.latest ?? '(none)'}, expected ${expectedVersion}`);
  }
  const releases = Array.isArray(changelog.releases) ? changelog.releases : [];
  if (!releases.some((entry) => entry?.version === expectedVersion)) {
    // Reported as its own defect: the newest release was missing from the array ENTIRELY, not just
    // from the `latest` field, so even a reader who ignored `latest` still could not find it.
    problems.push(`changelog.json "releases" contains no entry for ${expectedVersion}`);
  }
  // The same deploy also carries the component catalog the feature-request API matches against and
  // stamps into every response as `catalog_version`. A reporter caught it a release behind npm at
  // the same time as the changelog -- the third instance of one root cause -- so it is checked
  // here rather than waiting to be reported a fourth time. Skipped when not supplied, since the
  // endpoint is optional infrastructure and an unreachable one must not block a valid release.
  if (catalogVersion !== undefined && catalogVersion !== null) {
    const catalogBase = String(catalogVersion).split('+')[0];
    if (catalogBase !== expectedVersion) {
      problems.push(`component catalog_version is ${catalogVersion}, expected ${expectedVersion}`);
    }
  }
  return { fresh: problems.length === 0, problems };
}

async function fetchJsonOrNull(url, timeoutMs = 20000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function npmDistTagLatest(packageName) {
  try {
    const raw = execFileSync('npm', ['view', packageName, 'dist-tags.latest'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return raw.trim() || null;
  } catch {
    return null;
  }
}

async function verifySiteFreshnessCli(options) {
  const packageName = requireOption(options, 'package');
  const expectedVersion = requireOption(options, 'version');
  const changelogUrl = options.changelog_url ?? 'https://www.lyra-ui.com/changelog.json';
  // The per-tag lookup, not a list route: `/api/v1/components` alone is a 404, and a 404 here
  // reads as "catalog unreachable" -- which this check treats as skippable, so a wrong URL would
  // silently disable it forever. That is the same shape of silently-inert safeguard this whole
  // gate exists to prevent, so the skip is announced below rather than passed over.
  const catalogUrl = options.catalog_url ?? 'https://www.lyra-ui.com/api/v1/components/lr-button';
  const timeoutSeconds = Number(options.timeout_seconds ?? 1800);
  const pollSeconds = Number(options.poll_seconds ?? 30);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('--timeout-seconds must be a positive number.');
  }
  if (!Number.isFinite(pollSeconds) || pollSeconds <= 0) {
    throw new Error('--poll-seconds must be a positive number.');
  }

  const deadline = Date.now() + timeoutSeconds * 1000;
  let last = { fresh: false, problems: ['not yet checked'] };
  for (;;) {
    const catalog = catalogUrl ? await fetchJsonOrNull(catalogUrl) : null;
    if (catalogUrl && catalog?.catalog_version === undefined) {
      console.log(
        `Note: component catalog_version could not be read from ${catalogUrl}; skipping that half `
        + 'of the check (npm and changelog.json are still enforced).',
      );
    }
    last = evaluateSiteFreshness({
      packageName,
      expectedVersion,
      npmDistTagLatest: npmDistTagLatest(packageName),
      changelog: await fetchJsonOrNull(changelogUrl),
      catalogVersion: catalog?.catalog_version ?? undefined,
    });
    if (last.fresh) {
      console.log(
        `npm and ${changelogUrl} both report ${packageName}@${expectedVersion} as latest.`,
      );
      return;
    }
    if (Date.now() >= deadline) break;
    console.log(`Waiting for the published feed to catch up (${last.problems.join('; ')})...`);
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }

  throw new Error(
    [
      `The published upgrade feed is stale for ${packageName}@${expectedVersion}:`,
      ...last.problems.map((problem) => `  - ${problem}`),
      '',
      'The documented upgrade workflow tells consumers to read changelog.json and diff from its',
      '"latest", so until this is fixed every upgrading consumer concludes they are already current',
      'and silently skips this release. It has already happened on two consecutive releases.',
      '',
      'Fix it by deploying the sibling site, which regenerates the feed from this repo\'s CHANGELOG.md:',
      '  cd ../lyra-ui.com && <its sync + build + deploy steps> ',
      'then re-run this check.',
    ].join('\n'),
  );
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  if (options.command === 'wait-ci') return waitCiCli(options);
  if (options.command === 'wait-full-engine') return waitFullEngineCli(options);
  if (options.command === 'wait-test-all-browsers') {
    return waitTestAllBrowsersCli(options);
  }
  if (options.command === 'resolve-tag') return resolveTagCli(options);
  if (options.command === 'validate-git-tag') return validateGitTagCli(options);
  if (options.command === 'validate-workflow-source') return validateWorkflowSourceCli(options);
  if (options.command === 'validate-tarball') return validateTarballCli(options);
  if (options.command === 'compare-rebuild') return compareRebuildCli(options);
  if (options.command === 'verify-site-freshness') return verifySiteFreshnessCli(options);
  throw new Error(
    'Usage: release-integrity.mjs wait-ci|wait-full-engine|wait-test-all-browsers|resolve-tag|validate-git-tag|validate-workflow-source|validate-tarball|compare-rebuild|verify-site-freshness [options]',
  );
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    await runCli();
  } catch (error) {
    console.error(`Release integrity check failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
