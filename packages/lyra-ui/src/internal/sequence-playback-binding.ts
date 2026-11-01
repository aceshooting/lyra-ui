/** Component-private attachment authority shared by the control and its public binding helper. */
export interface SequencePlaybackCommands {
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  previous(): void;
  goTo(index: number): void;
}
export interface SequencePlaybackProjection { readonly count: number; readonly index: number; readonly playing: boolean; }
export interface SequencePlaybackOwner {
  project(value: SequencePlaybackProjection, forceStep?: boolean, silent?: boolean): void;
  release(): void;
  current(): boolean;
}
export interface SequencePlaybackAttachment {
  available(): boolean;
  attach(commands: SequencePlaybackCommands, released: () => void): SequencePlaybackOwner;
}
const controls = new WeakMap<HTMLElement, SequencePlaybackAttachment>();
export function registerSequencePlayback(control: HTMLElement, attachment: SequencePlaybackAttachment): void { controls.set(control, attachment); }
export function sequencePlaybackAttachment(control: HTMLElement): SequencePlaybackAttachment | undefined { return controls.get(control); }
