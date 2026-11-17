import { mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const within = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
};

/** Coverage maps resolve against the canonical bundle directory. */
export function assertDefaultCoverageOutput(environment = process.env) {
  if (environment.DOCX_BROWSER_RUN_DIR !== undefined) {
    throw new Error('DOCX_BROWSER_RUN_DIR cannot be used with coverage; unset it before test:coverage.');
  }
}

/** Ordinary runs keep their existing paths unless a new invocation root is requested. */
export function resolveBrowserOutputPaths({ packageRoot, repositoryRoot, environment = process.env }) {
  const value = environment.DOCX_BROWSER_RUN_DIR;
  if (value === undefined) return {
    isolated: false, runDirectory: null,
    outputDirectory: resolve(packageRoot, '.browser-output'),
    evidenceDirectory: resolve(packageRoot, '.browser-evidence'),
  };
  if (environment.DOCX_COVERAGE === '1') assertDefaultCoverageOutput(environment);
  if (typeof value !== 'string' || !value.trim() || !isAbsolute(value)) {
    throw new Error('DOCX_BROWSER_RUN_DIR must name a new absolute directory.');
  }
  const runDirectory = resolve(value);
  if (within(resolve(repositoryRoot), runDirectory)) {
    throw new Error('DOCX_BROWSER_RUN_DIR must be outside the checkout.');
  }
  const evidenceDirectory = join(runDirectory, 'evidence');
  if (environment.DOCX_SCREENSHOTS && resolve(environment.DOCX_SCREENSHOTS) !== evidenceDirectory) {
    throw new Error('DOCX_SCREENSHOTS must name the isolated run evidence directory or be unset.');
  }
  return { isolated: true, runDirectory, outputDirectory: join(runDirectory, 'output'), evidenceDirectory };
}

/** Claim only a previously absent root; never remove a caller's existing directory. */
export async function prepareBrowserOutputPaths(options) {
  const paths = resolveBrowserOutputPaths(options);
  if (!paths.isolated) return paths;
  const parent = await realpath(dirname(paths.runDirectory));
  const repository = await realpath(options.repositoryRoot);
  const runDirectory = join(parent, basename(paths.runDirectory));
  if (within(repository, runDirectory)) throw new Error('DOCX_BROWSER_RUN_DIR must be outside the checkout.');
  if (runDirectory !== paths.runDirectory) {
    throw new Error('DOCX_BROWSER_RUN_DIR must use its canonical parent path.');
  }
  await mkdir(runDirectory, { mode: 0o700 });
  await mkdir(paths.outputDirectory);
  await mkdir(paths.evidenceDirectory);
  return paths;
}
