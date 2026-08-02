import {
  getAnimation,
  setAnimation,
  setDefaultAnimation,
  type AnimationCleanup,
  type ElementAnimation,
  type GetAnimationOptions,
  type ResolvedElementAnimation,
} from '../src/utilities/animation-registry.js';
import {
  getAnimation as getRootAnimation,
  setAnimation as setRootAnimation,
  setDefaultAnimation as setRootDefaultAnimation,
  type ElementAnimation as RootElementAnimation,
} from '../src/lyra.js';

declare const element: HTMLElement;

const animation: ElementAnimation = {
  keyframes: [{ transform: 'translateX(-1rem)' }, { transform: 'translateX(0)' }],
  rtlKeyframes: [{ transform: 'translateX(1rem)' }, { transform: 'translateX(0)' }],
  options: { duration: 180, easing: 'ease-out' },
};
const options: GetAnimationOptions = { dir: 'rtl', fallback: animation };
const resolved: ResolvedElementAnimation = getAnimation(element, 'example.show', options);
const releaseElement: AnimationCleanup = setAnimation(element, 'example.show', animation);
const releaseDefault: AnimationCleanup = setDefaultAnimation('example.show', null);

const rootAnimation: RootElementAnimation = animation;
const rootResolved: ResolvedElementAnimation = getRootAnimation(element, 'example.show', options);
const releaseRootElement: AnimationCleanup = setRootAnimation(element, 'example.show', rootAnimation);
const releaseRootDefault: AnimationCleanup = setRootDefaultAnimation('example.show', rootAnimation);

void [resolved, rootResolved];
releaseElement();
releaseDefault();
releaseRootElement();
releaseRootDefault();
