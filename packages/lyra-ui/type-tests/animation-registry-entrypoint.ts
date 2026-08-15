import {
  getAnimation,
  setAnimation,
  setDefaultAnimation,
  type LyraAnimationCleanup,
  type LyraElementAnimation,
  type LyraGetAnimationOptions,
  type LyraResolvedElementAnimation,
} from '../src/utilities/animation-registry.js';
import {
  getAnimation as getRootAnimation,
  setAnimation as setRootAnimation,
  setDefaultAnimation as setRootDefaultAnimation,
  type LyraElementAnimation as RootLyraElementAnimation,
} from '../src/lyra.js';

declare const element: HTMLElement;

const animation: LyraElementAnimation = {
  keyframes: [{ transform: 'translateX(-1rem)' }, { transform: 'translateX(0)' }],
  rtlKeyframes: [{ transform: 'translateX(1rem)' }, { transform: 'translateX(0)' }],
  options: { duration: 180, easing: 'ease-out' },
};
const options: LyraGetAnimationOptions = { dir: 'rtl', fallback: animation };
// @ts-expect-error Resolution options are caller-authored readonly input.
options.dir = 'ltr';
// @ts-expect-error Replacing the fallback requires a new options record.
options.fallback = null;
// @ts-expect-error Reduced-motion policy is readonly after construction.
options.respectReducedMotion = false;
const resolved: LyraResolvedElementAnimation = getAnimation(element, 'example.show', options);
const releaseElement: LyraAnimationCleanup = setAnimation(element, 'example.show', animation);
const releaseDefault: LyraAnimationCleanup = setDefaultAnimation('example.show', null);

const rootAnimation: RootLyraElementAnimation = animation;
const rootResolved: LyraResolvedElementAnimation = getRootAnimation(element, 'example.show', options);
const releaseRootElement: LyraAnimationCleanup = setRootAnimation(element, 'example.show', rootAnimation);
const releaseRootDefault: LyraAnimationCleanup = setRootDefaultAnimation('example.show', rootAnimation);

void [resolved, rootResolved];
releaseElement();
releaseDefault();
releaseRootElement();
releaseRootDefault();
