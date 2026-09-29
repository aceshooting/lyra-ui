import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(scriptsDir, 'fixtures', 'public-api');
const readFixture = (name) => JSON.parse(readFileSync(path.join(fixtureDir, `${name}.json`), 'utf8'));

export const baseline = readFixture('baseline');
export const additive = readFixture('additive');
export const breaking = readFixture('breaking');
