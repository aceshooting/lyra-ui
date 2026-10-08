import { readdirSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

/** Every file under a directory, absolute and sorted. */
export async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat().sort();
}

/** Synchronous `filesUnder` for the one-shot package checks. */
export function filesUnderSync(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const file = resolve(directory, entry.name);
      return entry.isDirectory() ? filesUnderSync(file) : [file];
    })
    .sort();
}

/** A no-store static file server confined to `root`; `/` serves `index`. */
export function serveStatic(root, { index, mime }) {
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const file = resolve(root, `.${pathname === '/' ? index : pathname}`);
      if (!file.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
}
