import { fileURLToPath } from 'node:url';

/** Package root shared by inventory source analysis and generation. */
export const packageDir = fileURLToPath(new URL('../..', import.meta.url));
