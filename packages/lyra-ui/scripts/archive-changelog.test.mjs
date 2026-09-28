import assert from 'node:assert/strict';
import { partitionChangelog } from './archive-changelog.mjs';

const source = '# Changelog\n\n## 22.1.0\n\nNewest.\n\n## 22.0.0\n\nMajor.\n\n## 21.2.0\n\nEarlier.\n\n## 20.0.0\n\nOldest.\n';
const result = partitionChangelog(source, 22);
assert.match(result.current, /22\.1\.0[\s\S]*Newest\.[\s\S]*22\.0\.0[\s\S]*Major\./);
assert.doesNotMatch(result.current, /21\.2\.0|20\.0\.0/);
assert.match(result.current, /release history archive/);
assert.equal(result.archives.get(21), '# Version 21 release history\n\n## 21.2.0\n\nEarlier.\n');
assert.equal(result.archives.get(20), '# Version 20 release history\n\n## 20.0.0\n\nOldest.\n');
assert.equal(partitionChangelog(result.current, 22).current, result.current);
assert.throws(() => partitionChangelog(source, 21), /exceeds package major/);
assert.throws(() => partitionChangelog(source, 23), /no release in current major/);
assert.throws(() => partitionChangelog(source, NaN), /Invalid current changelog major/);
console.log('Changelog archive tests passed.');
