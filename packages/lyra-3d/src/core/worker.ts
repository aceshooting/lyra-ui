/**
 * Long computations (force layout, file parsing) run as an iterative kernel: `step()` does one
 * bounded unit of work and may return an output. The same kernel runs in a module worker or, when
 * no worker can start, on the main thread in short time slices, so a view never depends on a
 * bundler's worker support to work at all.
 *
 * Outputs crossing from a worker transfer their typed-array buffers instead of copying them, so a
 * kernel must return a fresh array for every output it emits.
 */

/** One unit of kernel work. `output`, when present, replaces the previously delivered output. */
export interface Lyra3dTaskStep<Output> {
  readonly done: boolean;
  readonly output?: Output;
}

export interface Lyra3dTaskKernel<Input, Output> {
  step(): Lyra3dTaskStep<Output>;
  /** Applies new input to the running computation (pinned items, new parameters). */
  update?(input: Input): void;
}

export type Lyra3dKernelFactory<Input, Output> = (input: Input) => Lyra3dTaskKernel<Input, Output>;

export type Lyra3dTaskMode = 'worker' | 'main-thread';

export interface Lyra3dTaskOptions<Input, Output> {
  readonly input: Input;
  readonly kernel: Lyra3dKernelFactory<Input, Output>;
  /**
   * Creates the module worker serving the same kernel, written at the call site so bundlers see
   * it: `() => new Worker(new URL('./layout.worker.js', import.meta.url), { type: 'module' })`.
   * Omitted, throwing, or failing before its first message, the task runs on the main thread.
   */
  readonly worker?: () => Worker;
  /** Receives the latest output; `done` is `true` once the kernel reports completion. */
  readonly onOutput: (output: Output, done: boolean) => void;
  readonly onError?: (error: unknown) => void;
  /** Main-thread work per slice, in milliseconds (default 8). */
  readonly sliceMs?: number;
}

export interface Lyra3dTask<Input> {
  /** Where the kernel currently runs; switches to `'main-thread'` if the worker fails to start. */
  readonly mode: Lyra3dTaskMode;
  update(input: Input): void;
  stop(): void;
}

type TaskMessage<Input> =
  | { readonly type: 'start'; readonly input: Input }
  | { readonly type: 'update'; readonly input: Input }
  | { readonly type: 'ack' }
  | { readonly type: 'stop' };

type ResultMessage<Output> =
  | { readonly type: 'output'; readonly output: Output; readonly done: boolean }
  | { readonly type: 'error'; readonly message: string };

/** The minimal worker-global surface {@link serveLyra3dTask} needs. */
export interface Lyra3dWorkerScope {
  postMessage(message: unknown, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/** Buffers of the typed arrays in an output, transferred instead of copied. */
export function transferablesOf(output: unknown): Transferable[] {
  const buffers = new Set<ArrayBuffer>();
  const visit = (value: unknown) => {
    if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) buffers.add(value.buffer);
    else if (value instanceof ArrayBuffer) buffers.add(value);
  };
  visit(output);
  if (typeof output === 'object' && output !== null && !ArrayBuffer.isView(output) && !(output instanceof ArrayBuffer)) {
    for (const value of Object.values(output)) visit(value);
  }
  return [...buffers];
}

const MAX_OUTPUTS_IN_FLIGHT = 2;

/**
 * Runs a kernel inside a module worker. Call it once at the top level of the worker module:
 * `serveLyra3dTask(createLayoutKernel)`. At most two outputs are in flight; while the main thread
 * is behind, the worker keeps computing and only the newest output is posted next.
 */
export function serveLyra3dTask<Input, Output>(
  factory: Lyra3dKernelFactory<Input, Output>,
  scope: Lyra3dWorkerScope = globalThis as unknown as Lyra3dWorkerScope,
): void {
  let kernel: Lyra3dTaskKernel<Input, Output> | undefined;
  let running = false;
  let finished = false;
  let inFlight = 0;
  let pending: { output: Output; done: boolean } | undefined;
  const channel = new MessageChannel();
  let resume: (() => void) | undefined;
  channel.port1.onmessage = () => {
    const next = resume;
    resume = undefined;
    next?.();
  };
  // Server runtimes keep a process alive for a listening port; the yield port must not.
  for (const port of [channel.port1, channel.port2]) (port as MessagePort & { unref?: () => void }).unref?.();
  const yieldToEvents = () => new Promise<void>((resolve) => {
    resume = resolve;
    channel.port2.postMessage(0);
  });
  const flush = () => {
    if (!pending || inFlight >= MAX_OUTPUTS_IN_FLIGHT) return;
    const { output, done } = pending;
    pending = undefined;
    inFlight += 1;
    const message: ResultMessage<Output> = { type: 'output', output, done };
    scope.postMessage(message, transferablesOf(output));
  };
  const loop = async () => {
    while (running && kernel && !finished) {
      try {
        const result = kernel.step();
        finished = result.done;
        if (result.output !== undefined) pending = { output: result.output, done: result.done };
        else if (result.done && pending) pending = { ...pending, done: true };
        flush();
      } catch (error) {
        running = false;
        const message: ResultMessage<Output> = { type: 'error', message: error instanceof Error ? error.message : String(error) };
        scope.postMessage(message, []);
        return;
      }
      await yieldToEvents();
    }
  };
  scope.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as TaskMessage<Input>;
    if (message.type === 'start') {
      kernel = factory(message.input);
      running = true;
      finished = false;
      void loop();
    } else if (message.type === 'update' && kernel) {
      kernel.update?.(message.input);
      if (finished && running) {
        finished = false;
        void loop();
      }
    } else if (message.type === 'ack') {
      inFlight = Math.max(0, inFlight - 1);
      flush();
    } else if (message.type === 'stop') {
      running = false;
      pending = undefined;
    }
  });
}

/** Runs the kernel on the main thread in slices of at most `sliceMs`, yielding to rendering between them. */
function startMainThreadTask<Input, Output>(
  options: Lyra3dTaskOptions<Input, Output>,
  input: Input,
  pendingUpdates: readonly Input[],
): { update(input: Input): void; stop(): void } {
  const sliceMs = Number.isFinite(options.sliceMs) ? Math.max(1, options.sliceMs as number) : 8;
  let kernel: Lyra3dTaskKernel<Input, Output>;
  let stopped = false;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (!stopped && !finished && timer === undefined) timer = setTimeout(slice, 0);
  };
  const slice = () => {
    timer = undefined;
    const deadline = performance.now() + sliceMs;
    let latest: Lyra3dTaskStep<Output> | undefined;
    try {
      do {
        const result = kernel.step();
        finished = result.done;
        if (result.output !== undefined) latest = result;
        else if (result.done && latest) latest = { ...latest, done: true };
      } while (!finished && performance.now() < deadline);
    } catch (error) {
      stopped = true;
      options.onError?.(error);
      return;
    }
    if (latest?.output !== undefined) options.onOutput(latest.output, finished);
    schedule();
  };
  try {
    kernel = options.kernel(input);
    for (const update of pendingUpdates) kernel.update?.(update);
  } catch (error) {
    options.onError?.(error);
    return { update() {}, stop() {} };
  }
  schedule();
  return {
    update(next) {
      if (stopped) return;
      kernel.update?.(next);
      if (finished) {
        finished = false;
        schedule();
      }
    },
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

/**
 * Starts a kernel in a module worker, falling back to main-thread time slices when the worker
 * cannot be created or fails before delivering its first message (unsupported module workers,
 * a blocked script URL or a strict Content Security Policy).
 */
export function startLyra3dTask<Input, Output>(options: Lyra3dTaskOptions<Input, Output>): Lyra3dTask<Input> {
  let mode: Lyra3dTaskMode = 'worker';
  let stopped = false;
  let worker: Worker | undefined;
  let heard = false;
  const updates: Input[] = [];
  let fallback: { update(input: Input): void; stop(): void } | undefined;
  const useMainThread = () => {
    if (stopped || fallback) return;
    mode = 'main-thread';
    worker?.terminate();
    worker = undefined;
    fallback = startMainThreadTask(options, options.input, updates);
  };
  try {
    worker = typeof Worker === 'function' && options.worker ? options.worker() : undefined;
  } catch {
    worker = undefined;
  }
  if (!worker) {
    useMainThread();
  } else {
    const active = worker;
    active.addEventListener('message', (event: MessageEvent) => {
      if (stopped || worker !== active) return;
      heard = true;
      updates.length = 0;
      const message = event.data as ResultMessage<Output>;
      if (message.type === 'output') {
        active.postMessage({ type: 'ack' } satisfies TaskMessage<Input>);
        options.onOutput(message.output, message.done);
      } else {
        options.onError?.(new Error(message.message));
      }
    });
    active.addEventListener('error', (event) => {
      if (stopped || worker !== active) return;
      if (!heard) {
        event.preventDefault();
        useMainThread();
      } else {
        options.onError?.(event.error ?? new Error(event.message || 'Worker error'));
      }
    });
    active.addEventListener('messageerror', () => {
      if (!stopped && worker === active) options.onError?.(new Error('Worker message could not be deserialized'));
    });
    try {
      active.postMessage({ type: 'start', input: options.input } satisfies TaskMessage<Input>);
    } catch {
      useMainThread();
    }
  }
  return {
    get mode() {
      return mode;
    },
    update(input) {
      if (stopped) return;
      if (fallback) fallback.update(input);
      else if (worker) {
        // Replayed on the main thread if the worker turns out not to start.
        if (!heard) updates.push(input);
        worker.postMessage({ type: 'update', input } satisfies TaskMessage<Input>);
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      fallback?.stop();
      if (worker) {
        const active = worker;
        worker = undefined;
        try {
          active.postMessage({ type: 'stop' } satisfies TaskMessage<Input>);
        } catch {
          // A closed message channel must not prevent worker termination.
        } finally {
          active.terminate();
        }
      }
    },
  };
}
