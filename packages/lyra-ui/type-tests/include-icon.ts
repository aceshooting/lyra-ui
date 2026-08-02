import type {
  LyraIconAnimation,
  LyraIconCanvas,
  LyraIconEventMap,
  LyraIconFlip,
  LyraIconLibraryResolver,
  LyraIncludeErrorReason,
  LyraIncludeEventMap,
  LyraIncludeMode,
} from '../src/lyra.js';
import { LyraIcon, LyraInclude, registerIconLibrary } from '../src/lyra.js';

declare const icon: LyraIcon;
icon.family = 'sharp';
icon.variant = 'solid';
icon.canvas = 'roomy';
icon.flip = 'x';
icon.animation = 'spin-snap-8';
icon.autoWidth = false;
icon.swapOpacity = true;

const canvas: LyraIconCanvas | undefined = icon.canvas;
const flip: LyraIconFlip | undefined = icon.flip;
const animation: LyraIconAnimation | undefined = icon.animation;
void [canvas, flip, animation];

const asyncResolver: LyraIconLibraryResolver = async (name, family, variant) =>
  `https://icons.example/${family}/${variant}/${name}.svg`;
registerIconLibrary('typed', { resolver: asyncResolver });

icon.addEventListener('lr-load', (event) => {
  const source: string = event.detail.src;
  void source;
});
const iconLoadEvent: LyraIconEventMap['lr-load'] | undefined = undefined;
void iconLoadEvent;

declare const include: LyraInclude;
include.src = '/partial.html#summary';
include.mode = 'same-origin';
include.cache = false;
const reload: Promise<void> = include.reload();
const mode: LyraIncludeMode = include.mode;
void [reload, mode];

include.addEventListener('lr-include-error', (event) => {
  const reason: LyraIncludeErrorReason = event.detail.reason;
  void reason;
});
const includeErrorEvent: LyraIncludeEventMap['lr-include-error'] | undefined = undefined;
void includeErrorEvent;
