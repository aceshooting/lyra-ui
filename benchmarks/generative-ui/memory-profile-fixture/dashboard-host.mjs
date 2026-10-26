import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHostServices as createDashboardServices } from '../profile-fixture/workloads/dashboards-host.mjs';

const require = (condition, message) => { if (!condition) throw new TypeError(message); };

/** One seeded store per independent browser process; cycles only overwrite instance state. */
export async function createHostServices(options) {
  const service = await createDashboardServices(options), route = service.routes[0];
  try {
    const seeded = await route.handle({ method: 'POST', body: new TextEncoder().encode('{"operation":"reset"}'), headers: { 'x-fixture-session': 'author' } });
    require(seeded.status === 200, 'Memory host initialization failed.');
    const directories = (await readdir(options.scratchDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory() && entry.name.startsWith('dashboard-'));
    require(directories.length === 1, 'Memory host must own exactly one store.');
    const file = join(options.scratchDirectory, directories[0].name, 'dashboards.json');
    let closed = false;
    return { ...service,
      routes: [{ ...route, async handle(request) {
        let input; try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(request.body)); } catch { input = undefined; }
        if (!['resolve', 'read', 'load-state', 'save-state', 'data'].includes(input?.operation)) return { status: 403, contentType: 'application/json', body: '{"error":"denied","server":[]}' };
        return route.handle(request);
      } }],
      async counts() {
        require(!closed, 'Memory host is closed.');
        const bytes = await readFile(file); require(bytes.length <= 1024 * 1024, 'Memory host file exceeds its fixed diagnostic read bound.');
        const state = JSON.parse(bytes), records = Object.values(state.records), instances = Object.values(state.instances);
        const historyEntries = records.reduce((sum, record) => sum + record.history.length, 0);
        require(records.length === 1 && historyEntries <= 5 && instances.length === 1, 'Memory host ownership/history grew outside the frozen scope.');
        return { documents: records.length, historyEntries, publications: records.reduce((sum, record) => sum + record.publications.length, 0),
          instances: instances.length, instanceRevision: instances[0].revision, bytes: bytes.length };
      },
      async dispose() { if (closed) return; closed = true; await service.dispose(); },
    };
  } catch (error) { await service.dispose(); throw error; }
}
