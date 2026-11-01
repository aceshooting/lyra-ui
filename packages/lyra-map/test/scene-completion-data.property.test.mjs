import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { readCompletionInput } from '../src/scene/completion-data.mjs';
import { completionInput, member, token } from './fixtures/scene-completion-data.mjs';
import { completionOwnerFixture } from './fixtures/scene-completion-owner.mjs';

const runs = { seed: 0x5eed_c017, numRuns: 200, includeErrorInReport: true };

test('mixed neutral membership owns numeric data and preserves exhaustive exact joins', () => {
  fc.assert(fc.property(fc.array(fc.record({ kind: fc.constantFrom('marker', 'path', 'arc', 'model'),
    longitude: fc.integer({ min: -179, max: 179 }), altitude: fc.integer({ min: -1000, max: 10000 }) }), { minLength: 1, maxLength: 40 }), rows => {
    const members = rows.map((row, index) => {
      const value = member(`row-${index}`, row.kind);
      if (value.target) { value.target.position.lngLat[0] = row.longitude; value.target.position.altitude = row.altitude; }
      return value;
    });
    const input = completionInput({ members }), result = readCompletionInput(input, input.renderInput);
    assert.ok(result); assert.equal(result.members.length, rows.length);
    for (let index = 0; index < rows.length; index++) {
      const before = input.members[index], after = result.members[index];
      assert.equal(after.id, `row-${index}`); assert.equal(after.kind, rows[index].kind); assert.equal(after.rowToken, before.rowToken);
      if (before.target) {
        before.target.position.altitude++;
        assert.equal(after.target.position.altitude, rows[index].altitude); assert.equal(after.target.token, before.target.token);
        assert.ok(Object.isFrozen(after.target.position.lngLat));
      }
    }
    const clean = completionInput({ members: rows.map((row, index) => member(`clean-${index}`, row.kind)) });
    assert.equal(readCompletionInput({ ...clean, source: {} }, clean.renderInput), undefined);
    const markerIndex = clean.members.findIndex(row => row.kind === 'marker');
    if (markerIndex >= 0) {
      const altered = clean.members.map((row, index) => index === markerIndex ? { ...row, target: { ...row.target, acceptedPositionRevision: 2 } } : row);
      assert.equal(readCompletionInput({ ...clean, members: altered }, clean.renderInput), undefined);
    }
  }), runs);
});

test('arrival completion and invalidation order never grants mismatched or decreasing receipt authority', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('issue', 'complete-old', 'complete-new', 'replace', 'invalidate', 'paint'), { minLength: 1, maxLength: 80 }), actions => {
    const h = completionOwnerFixture(); h.start(); h.owner.port.watchTarget('anchor');
    const pending = [], provenance = new Map(); let maximum = 0;
    try {
      for (const action of actions) {
        if (action === 'issue') { const input = h.input, issue = h.issue(); if (issue) pending.push({ issue, input }); }
        if (action === 'replace') h.replace(completionInput({ acceptedSceneRevision: h.input.acceptedSceneRevision + 1 }));
        if (action === 'invalidate') h.owner.invalidate('view');
        if (action === 'paint') h.revoke();
        if (action === 'complete-old' || action === 'complete-new') {
          const selected = action === 'complete-old' ? pending[0] : pending.at(-1);
          if (selected) {
            const count = h.frames.length; h.finish(selected.issue);
            if (h.frames.length > count) provenance.set(h.frames.at(-1), selected.input);
          }
        }
        for (const frame of h.frames) {
          const input = provenance.get(frame); assert.ok(input);
          const current = h.owner.port.current(frame, 'anchor', input.members[0].target.token);
          if (current) assert.equal(input, h.input);
          assert.equal(h.owner.port.current({ ...frame }, 'anchor', input.members[0].target.token), false);
          assert.equal(h.owner.port.current(frame, 'anchor', token()), false);
        }
        for (const frame of h.frames.filter(frame => frame.stamp.paintFrameSerial > maximum)) {
          assert.ok(Number.isSafeInteger(frame.stamp.paintFrameSerial)); assert.ok(frame.stamp.paintFrameSerial > maximum);
          maximum = frame.stamp.paintFrameSerial;
        }
        assert.equal(new Set(h.frames.map(frame => frame.stamp.paintFrameSerial)).size, h.frames.length);
        assert.ok(h.frames.every((frame, index) => index === 0 || frame.stamp.paintFrameSerial > h.frames[index - 1].stamp.paintFrameSerial));
      }
    } finally { h.close(); }
  }), runs);
});
