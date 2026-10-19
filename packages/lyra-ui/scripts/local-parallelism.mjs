import { availableParallelism, freemem } from 'node:os';
import { isMainModule } from './is-main-module.mjs';

/** Cores left for the operating system, the editor and the orchestrating process itself. */
export const RESERVED_CORES = 2;

/**
 * Sizes contributor-host parallelism from the machine it runs on: every core but two, capped by
 * currently available memory. CI passes explicit worker counts instead, so its qualification
 * stays reproducible.
 */
export function localWorkerCount({
  coresPerWorker = 1,
  memoryPerWorkerMb = 0,
  cores = availableParallelism(),
  freeMemoryBytes = freemem(),
} = {}) {
  if (!(coresPerWorker > 0)) throw new Error('coresPerWorker must be positive.');
  if (!(memoryPerWorkerMb >= 0)) throw new Error('memoryPerWorkerMb must be non-negative.');
  const byCores = Math.floor(Math.max(0, cores - RESERVED_CORES) / coresPerWorker);
  const byMemory = memoryPerWorkerMb === 0
    ? Infinity
    : Math.floor(freeMemoryBytes / (memoryPerWorkerMb * 1024 * 1024));
  return Math.max(1, Math.min(byCores, byMemory));
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const [flag, value] = [argv[index], Number(argv[index + 1])];
    if (flag === '--cores-per-worker') options.coresPerWorker = value;
    else if (flag === '--memory-per-worker-mb') options.memoryPerWorkerMb = value;
    else throw new Error('Usage: local-parallelism.mjs [--cores-per-worker N] [--memory-per-worker-mb N]');
  }
  return options;
}

if (isMainModule(import.meta.url)) {
  console.log(localWorkerCount(parseArguments(process.argv.slice(2))));
}
