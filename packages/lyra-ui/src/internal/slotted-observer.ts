import { html, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';

export interface DisconnectableObserver {
  disconnect(): void;
}

/** Resolves the element targets assigned to an observer wrapper's default slot. */
export function slottedElementTargets(renderRoot: ParentNode): Element[] {
  const slot = renderRoot.querySelector('slot');
  return slot?.assignedElements({ flatten: true }) ?? [];
}

/** Tears down an observer and returns `undefined` for atomic field reassignment. */
export function disconnectObserver<T extends DisconnectableObserver>(observer: T | undefined): undefined {
  observer?.disconnect();
  return undefined;
}

type ObserverConstructorName = 'IntersectionObserver' | 'MutationObserver' | 'ResizeObserver';

/** Reads an observer constructor from the owner window; a missing window or throwing getter reads as
 *  unsupported. */
export function ownerObserverConstructor<K extends ObserverConstructorName>(
  ownerDocument: Document,
  name: K,
): (typeof globalThis)[K] | undefined {
  try {
    return ownerDocument.defaultView?.[name];
  } catch {
    return undefined;
  }
}

/** One rebuild's observer authority. */
export interface SlottedObserverSession {
  readonly ownerDocument: Document;
  /** Whether the rebuild's observer is still current: same generation and owner document, connected. */
  current(): boolean;
}

/** What one rebuild observes, read from the host while it is configured. */
export interface SlottedObserverBuild<O extends DisconnectableObserver> {
  /** Runs once connected, before targets are read; `false` keeps the wrapper idle (e.g. a pending root). */
  ready?(): boolean;
  /** Keeps only the slotted targets this rebuild observes. */
  accept?(target: Element): boolean;
  /** Creates the observer; callbacks check `session.current()` before emitting. A throw stays idle. */
  create(session: SlottedObserverSession): O;
  /** Observes one target; a throw rejects only that target. */
  observe(observer: O, target: Element): void;
}

export interface SlottedObserverOptions<O extends DisconnectableObserver> {
  /** Defers a rebuild until after the current update (the host's `scheduleAfterUpdate`). */
  schedule(rebuild: () => void): void;
  /** This rebuild's configuration, or `undefined` while disabled, unsupported or requesting nothing. */
  configure(ownerDocument: Document): SlottedObserverBuild<O> | undefined;
  /** Drains work queued under the retiring observer before a rebuild; the result runs after teardown. */
  flush?(observer: O): (() => void) | undefined;
  /** Extra teardown run on every retirement. */
  retired?(): void;
}

type SlottedObserverHost = ReactiveControllerHost & HTMLElement & {
  readonly renderRoot: ParentNode;
  readonly hasUpdated: boolean;
};

/**
 * Owns the lifecycle shared by slotted observer wrappers: the generation and owner-document guard,
 * reconnect re-arming, disconnect teardown, the per-target observe loop and the slot template.
 * Hosts supply only the observer construction and options through `configure`, and call
 * `retire()` from `adoptedCallback`.
 */
export class SlottedObserverController<O extends DisconnectableObserver> implements ReactiveController {
  private observer?: O;
  private observerDocument?: Document;
  private generation = 0;

  constructor(
    private readonly host: SlottedObserverHost,
    private readonly options: SlottedObserverOptions<O>,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    // A pure reparent fires no update and no slotchange, so re-arm after every reconnect; the
    // first connect is covered by the first render's own slotchange.
    if (this.host.hasUpdated) this.schedule();
  }

  hostDisconnected(): void {
    this.retire();
  }

  /** Rebuilds once the current update has rendered (property and reconnect changes). */
  schedule(): void {
    this.options.schedule(this.rebuild);
  }

  /** Retires the current observer and observes the current slotted targets again. */
  readonly rebuild = (): void => {
    this.retire(true);
    const host = this.host;
    const ownerDocument = host.ownerDocument;
    const build = this.options.configure(ownerDocument);
    if (!build || !host.isConnected || build.ready?.() === false) return;
    let targets: Element[];
    try {
      targets = slottedElementTargets(host.renderRoot);
      if (build.accept) targets = targets.filter((target) => build.accept!(target));
    } catch {
      return;
    }
    if (targets.length === 0) return;
    const generation = this.generation;
    let created: O | undefined;
    const session: SlottedObserverSession = {
      ownerDocument,
      current: () => created !== undefined && this.observer === created &&
        this.observerDocument === ownerDocument && this.generation === generation &&
        host.isConnected && host.ownerDocument === ownerDocument,
    };
    try {
      created = build.create(session);
    } catch {
      return;
    }
    const observer = created;
    this.observer = observer;
    this.observerDocument = ownerDocument;
    let observed = false;
    for (const target of targets) {
      try {
        build.observe(observer, target);
        observed = true;
      } catch {
        // A rejected target cannot prevent a valid later slotted sibling from observing.
      }
    }
    if (!observed && this.observer === observer) this.retire();
  };

  /** Ends the current observer. `flush` (a rebuild) first drains its queued work while connected. */
  retire(flush = false): void {
    this.generation += 1;
    const observer = this.observer;
    let deliver: (() => void) | undefined;
    if (flush && observer && this.host.isConnected && this.options.flush) {
      try {
        deliver = this.options.flush(observer);
      } catch {
        deliver = undefined;
      }
    }
    // Ownership is cleared before crossing the observer boundary: a malformed implementation that
    // throws from disconnect() must not stay current through a later rebuild or reconnect.
    this.observer = undefined;
    this.observerDocument = undefined;
    try {
      observer?.disconnect();
    } catch {
      // Observer implementations are optional capabilities; teardown failures fail closed.
    }
    this.options.retired?.();
    deliver?.();
  }

  /** The non-layout wrapper around the observed default slot. */
  renderSlot(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.rebuild}></slot></span>`;
  }
}
