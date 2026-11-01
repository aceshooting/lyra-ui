import type { MapSceneSessionBacking, MapSceneSessionState, SceneCompletedFrame, SceneTargetFact } from '../../../internal/map-scene-contract.js';
import type { createMapSceneOwner } from './map-scene-owner.js';
import type { SceneCompletionCameraFacts, SceneCompletionHost, SceneCompletionInput, SceneCompletionPort,
  SceneCompletionTarget, SceneRenderPublication } from './map-scene-render-contract.js';

type SceneOwner = ReturnType<typeof createMapSceneOwner>;
interface HostBinding {
  readonly owner: SceneOwner;
  current(input: SceneCompletionInput): boolean;
}
const hostBindings = new WeakMap<SceneCompletionHost, HostBinding>();
const noop = () => {};

/** Projects the current accepted publication into detached completion metadata. */
export function createMapSceneCompletionHost(options: {
  readonly owner: SceneOwner;
  readonly isCurrent: () => boolean;
  readonly captureCameraFacts: (expected: SceneRenderPublication) => SceneCompletionCameraFacts | undefined;
}): SceneCompletionHost {
  const { owner } = options;
  const tokens = new WeakMap<object, object>();
  let input: SceneCompletionInput | undefined;
  function token(value: object): object {
    let result = tokens.get(value);
    if (!result) { result = Object.freeze({}); tokens.set(value, result); }
    return result;
  }
  function captureInput(): SceneCompletionInput {
    const next = owner.captureRenderPublication();
    const publicationToken = token(next);
    if (input?.publicationToken === publicationToken) return input;
    const targets = new Map(next.state.targets.map(target => [target.id, target]));
    const members = next.accepted.objects.map(row => {
      const fact = targets.get(row.id);
      let target: SceneCompletionTarget | undefined;
      if (fact && (fact.kind === 'marker' || fact.kind === 'model')) {
        const position = Object.freeze({ lngLat: Object.freeze([fact.position.lngLat[0], fact.position.lngLat[1]] as const),
          altitude: fact.position.altitude, altitudeReference: fact.position.altitudeReference });
        target = Object.freeze({ token: token(fact), acceptedPositionRevision: fact.acceptedPositionRevision, position });
      }
      return Object.freeze({ id: row.id, kind: row.kind, rowToken: token(row), target });
    });
    const result = Object.freeze({ publicationToken, stateToken: token(next.state), phase: next.phase,
      acceptedSceneRevision: next.accepted.acceptedSceneRevision, renderInput: next.input, members: Object.freeze(members) });
    input = result;
    return result;
  }
  function current(expected: SceneCompletionInput): boolean {
    if (captureInput() !== expected || expected.phase !== 'resolved') return false;
    try { return options.isCurrent() && captureInput() === expected; } catch { return false; }
  }
  const host: SceneCompletionHost = Object.freeze({ captureInput,
    subscribeInput: (listener: () => void) => owner.subscribeRenderPublication(listener),
    claimPaintSerial(expected: SceneCompletionInput): number | undefined {
      if (!current(expected)) return undefined;
      return owner.claimPaintFrameSerial(owner.captureRenderPublication());
    },
    captureCameraFacts(expected: SceneCompletionInput): SceneCompletionCameraFacts | undefined {
      if (!current(expected)) return undefined;
      try {
        const facts = options.captureCameraFacts(owner.captureRenderPublication());
        return current(expected) ? facts : undefined;
      } catch { return undefined; }
    },
  });
  hostBindings.set(host, { owner, current });
  return host;
}

/** Adapts a completion port without replacing the connection's geographic authority. */
export function createMapSceneCompletionAdapter(options: {
  readonly connection: object;
  readonly state: MapSceneSessionState;
  readonly owner: SceneOwner;
  readonly host: SceneCompletionHost;
  readonly port: SceneCompletionPort;
}): { readonly backing: MapSceneSessionBacking; dispose(): void } {
  const { connection, state, owner, host, port } = options;
  const binding = hostBindings.get(host);
  if (!binding || binding.owner !== owner || state !== owner.state || state.connection !== connection) {
    throw new TypeError('Invalid map scene completion adapter');
  }
  let disposed = false;
  const releases = new Set<() => void>();
  const frames = new WeakMap<SceneCompletedFrame, SceneCompletionInput>();
  function live(input: SceneCompletionInput): boolean {
    return !disposed && binding!.current(input) && !disposed && host.captureInput() === input &&
      state.capture() === owner.captureRenderPublication().state;
  }
  function retain(acquire: () => () => void): () => void {
    if (disposed) return noop;
    const release = acquire();
    let active = true;
    const retire = () => {
      if (!active) return;
      active = false; releases.delete(retire);
      try { release(); } catch { /* Other handles must still retire. */ }
    };
    if (disposed) retire(); else releases.add(retire);
    return retire;
  }
  function targetFor(input: SceneCompletionInput, id: string): SceneTargetFact | undefined {
    if (!live(input)) return undefined;
    const fact = state.capture().targets.find(target => target.id === id);
    return fact && (fact.kind === 'marker' || fact.kind === 'model') ? fact : undefined;
  }
  function current(frame: SceneCompletedFrame, target: SceneTargetFact): boolean {
    const input = frames.get(frame);
    if (!input || targetFor(input, target.id) !== target) return false;
    const member = input.members.find(row => row.id === target.id);
    if (!member?.target) return false;
    try {
      return port.current(frame, target.id, member.target.token) && live(input) && targetFor(input, target.id) === target;
    } catch { return false; }
  }
  const backing: MapSceneSessionBacking = Object.freeze({ connection, state,
    watchTarget(id: string) { return retain(() => port.watchTarget(id)); },
    subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void) {
      let active = true;
      return retain(() => {
        const release = port.subscribeCompletedFrames(frame => {
          if (disposed || !active) return;
          const input = host.captureInput();
          if (!live(input) || !active) return;
          const previous = frames.get(frame);
          if (previous && previous !== input) return;
          frames.set(frame, input);
          listener(frame);
        });
        return () => { active = false; release(); };
      });
    },
    current,
    projectTarget(frame: SceneCompletedFrame, id: string) {
      const input = frames.get(frame);
      const target = input && targetFor(input, id);
      if (!target || !current(frame, target)) return undefined;
      try {
        const projection = port.projectTarget(frame, id);
        return current(frame, target) ? projection : undefined;
      } catch { return undefined; }
    },
    requestFrame() {
      if (!disposed && live(host.captureInput())) port.requestFrame();
    },
  });
  return Object.freeze({ backing, dispose() {
    if (disposed) return;
    disposed = true;
    for (const release of [...releases]) release();
  } });
}
