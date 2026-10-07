import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Visit files recursively in filesystem enumeration order; callers apply their own filters. */
export function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
