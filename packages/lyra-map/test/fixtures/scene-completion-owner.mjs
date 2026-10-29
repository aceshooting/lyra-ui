import { createSceneCompletionOwner } from '../../src/scene/completion.mjs';
import { cameraFacts, completionInput, frameData, freeze, token } from './scene-completion-data.mjs';

// These CPU authority ports authenticate fixture records only; they do not prove native rendering.
export function completionOwnerFixture(options = {}) {
  let input = freeze(options.input ?? completionInput()), live = true, generation = token(), serial = 0, owner;
  const listeners = new Set(), installed = new WeakMap(), observations = new WeakMap(), results = new WeakMap();
  const hooks = {}, calls = { order: [], requests: 0, claims: [], demand: [], retired: [], releases: 0, camera: 0 };
  const frames = [];
  const host = {
    captureInput() { calls.order.push('capture'); hooks.capture?.(); return input; },
    subscribeInput(listener) { calls.order.push('subscribe'); listeners.add(listener); hooks.subscribe?.();
      let active = true; return () => { if (active) { active = false; listeners.delete(listener); calls.releases++; hooks.release?.(); } }; },
    claimPaintSerial(expected) { calls.claims.push(expected); if (hooks.claim) return hooks.claim(expected); return expected === input ? ++serial : undefined; },
    captureCameraFacts(expected) { calls.camera++; if (hooks.camera) return hooks.camera(expected); return expected === input ? cameraFacts() : undefined; }
  };
  const services = {
    isCurrent() { hooks.current?.(); return live; },
    isInstalled(record, expected) { hooks.installed?.(); return installed.get(record) === generation && record.input === expected; },
    isObservationCurrent(observation, expected) { hooks.observation?.(); return observations.get(observation) === generation && observation.input === expected; },
    isResultCurrent(issue, result) { hooks.result?.(); return results.get(result) === issue; },
    requestFrame() { calls.requests++; hooks.request?.(); },
    setDemand(value) { calls.demand.push(value); hooks.demand?.(value); },
    retireIssue(issue) { calls.retired.push(issue); hooks.retire?.(issue); }
  };
  const item = { host, services, hooks, calls, frames,
    get owner() { return owner; }, get input() { return input; }, get subscriptions() { return listeners.size; },
    start() { owner = createSceneCompletionOwner(host, services); owner.port.subscribeCompletedFrames(frame => frames.push(frame)); return owner; },
    replace(next, notify = true) { input = freeze(next); if (notify) for (const listener of [...listeners]) listener(); },
    replaceRaw(next) { input = next; },
    notify() { for (const listener of [...listeners]) listener(); },
    revoke() { generation = token(); }, expire() { live = false; },
    install(selected = input.members, expected = input) {
      const record = freeze({ input: expected, members: selected.map(row => ({ id: row.id, kind: row.kind, rowToken: row.rowToken, targetToken: row.target?.token })) });
      installed.set(record, generation); owner.acceptInstalled(record); return record;
    },
    observation(record, change = {}) {
      const observation = freeze({ input, installed: record, phase: token(), scope: token(), frame: frameData(input),
        targets: input.members.filter(row => row.target).map(row => ({ id: row.id, targetToken: row.target.token,
          acceptedPositionRevision: row.target.acceptedPositionRevision, status: 'resolved', point: [120, 180] })), ...change });
      observations.set(observation, generation); return observation;
    },
    issue(change = {}) { const record = item.install(); return owner.issue(item.observation(record, change)); },
    result(issue, change = {}) {
      const result = freeze({ targets: input.members.filter(row => row.target).map(row => ({ id: row.id, anchor: true, object: true })), ...change });
      results.set(result, issue); return result;
    },
    finish(issue, change = {}) { return owner.complete(issue, item.result(issue, change)); },
    paint(change = {}) { const issue = item.issue(change); if (issue) item.finish(issue); return frames.at(-1); },
    close() { owner?.dispose(); }
  };
  return item;
}
