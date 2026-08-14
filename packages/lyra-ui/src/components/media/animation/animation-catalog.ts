/**
 * Mirror-owned animation names exposed by Web Awesome and Shoelace. The keyframes below are an
 * original, dependency-free implementation; only the public name vocabulary is shared.
 */
export const LYRA_ANIMATION_NAMES = [
  'backInDown',
  'backInLeft',
  'backInRight',
  'backInUp',
  'backOutDown',
  'backOutLeft',
  'backOutRight',
  'backOutUp',
  'bounce',
  'bounceIn',
  'bounceInDown',
  'bounceInLeft',
  'bounceInRight',
  'bounceInUp',
  'bounceOut',
  'bounceOutDown',
  'bounceOutLeft',
  'bounceOutRight',
  'bounceOutUp',
  'fadeIn',
  'fadeInBottomLeft',
  'fadeInBottomRight',
  'fadeInDown',
  'fadeInDownBig',
  'fadeInLeft',
  'fadeInLeftBig',
  'fadeInRight',
  'fadeInRightBig',
  'fadeInTopLeft',
  'fadeInTopRight',
  'fadeInUp',
  'fadeInUpBig',
  'fadeOut',
  'fadeOutBottomLeft',
  'fadeOutBottomRight',
  'fadeOutDown',
  'fadeOutDownBig',
  'fadeOutLeft',
  'fadeOutLeftBig',
  'fadeOutRight',
  'fadeOutRightBig',
  'fadeOutTopLeft',
  'fadeOutTopRight',
  'fadeOutUp',
  'fadeOutUpBig',
  'flash',
  'flip',
  'flipInX',
  'flipInY',
  'flipOutX',
  'flipOutY',
  'headShake',
  'heartBeat',
  'hinge',
  'jackInTheBox',
  'jello',
  'lightSpeedInLeft',
  'lightSpeedInRight',
  'lightSpeedOutLeft',
  'lightSpeedOutRight',
  'pulse',
  'rollIn',
  'rollOut',
  'rotateIn',
  'rotateInDownLeft',
  'rotateInDownRight',
  'rotateInUpLeft',
  'rotateInUpRight',
  'rotateOut',
  'rotateOutDownLeft',
  'rotateOutDownRight',
  'rotateOutUpLeft',
  'rotateOutUpRight',
  'rubberBand',
  'shake',
  'shakeX',
  'shakeY',
  'slideInDown',
  'slideInLeft',
  'slideInRight',
  'slideInUp',
  'slideOutDown',
  'slideOutLeft',
  'slideOutRight',
  'slideOutUp',
  'swing',
  'tada',
  'wobble',
  'zoomIn',
  'zoomInDown',
  'zoomInLeft',
  'zoomInRight',
  'zoomInUp',
  'zoomOut',
  'zoomOutDown',
  'zoomOutLeft',
  'zoomOutRight',
  'zoomOutUp',
] as const;

export type LyraMirrorAnimationName = (typeof LYRA_ANIMATION_NAMES)[number];

export const LYRA_EASINGS = Object.freeze({
  ease: 'ease',
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
  easeInBack: 'cubic-bezier(0.6, -0.25, 0.75, 0.5)',
  easeInCirc: 'cubic-bezier(0.55, 0, 1, 0.45)',
  easeInCubic: 'cubic-bezier(0.55, 0.05, 0.68, 0.19)',
  easeInExpo: 'cubic-bezier(0.95, 0.05, 0.8, 0.04)',
  easeInOut: 'ease-in-out',
  easeInOutBack: 'cubic-bezier(0.65, -0.35, 0.35, 1.35)',
  easeInOutCirc: 'cubic-bezier(0.78, 0.14, 0.15, 0.86)',
  easeInOutCubic: 'cubic-bezier(0.65, 0.05, 0.36, 1)',
  easeInOutExpo: 'cubic-bezier(0.87, 0, 0.13, 1)',
  easeInOutQuad: 'cubic-bezier(0.45, 0.03, 0.52, 0.96)',
  easeInOutQuart: 'cubic-bezier(0.77, 0, 0.18, 1)',
  easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
  easeInOutSine: 'cubic-bezier(0.37, 0, 0.63, 1)',
  easeInQuad: 'cubic-bezier(0.55, 0.09, 0.68, 0.53)',
  easeInQuart: 'cubic-bezier(0.9, 0.03, 0.69, 0.22)',
  easeInQuint: 'cubic-bezier(0.76, 0.05, 0.86, 0.06)',
  easeInSine: 'cubic-bezier(0.47, 0, 0.75, 0.72)',
  easeOut: 'ease-out',
  easeOutBack: 'cubic-bezier(0.25, 0.5, 0.4, 1.25)',
  easeOutCirc: 'cubic-bezier(0, 0.55, 0.45, 1)',
  easeOutCubic: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  easeOutQuart: 'cubic-bezier(0.17, 0.84, 0.44, 1)',
  easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeOutSine: 'cubic-bezier(0.39, 0.58, 0.57, 1)',
  linear: 'linear',
} as const);

export type LyraAnimationEasingName = keyof typeof LYRA_EASINGS;

export type LyraAnimationCatalog = Readonly<
  Record<LyraMirrorAnimationName, readonly Readonly<Keyframe>[]>
> & { readonly easings: typeof LYRA_EASINGS };

/** Returns a fresh catalog snapshot so callers cannot mutate shared registry state. */
export function getAnimationNames(): LyraMirrorAnimationName[] {
  return [...LYRA_ANIMATION_NAMES];
}

/** Returns a fresh catalog snapshot so callers cannot mutate shared registry state. */
export function getEasingNames(): LyraAnimationEasingName[] {
  return Object.keys(LYRA_EASINGS) as LyraAnimationEasingName[];
}

export function resolveNamedEasing(value: string): string {
  return Object.prototype.hasOwnProperty.call(LYRA_EASINGS, value)
    ? LYRA_EASINGS[value as LyraAnimationEasingName]
    : value;
}

type Vector = readonly [x: number, y: number];

const DIRECTION_VECTORS: Readonly<Record<string, Vector>> = {
  Down: [0, -1],
  Up: [0, 1],
  Left: [-1, 0],
  Right: [1, 0],
  BottomLeft: [-1, 1],
  BottomRight: [1, 1],
  TopLeft: [-1, -1],
  TopRight: [1, -1],
};

function vectorFor(suffix: string): Vector {
  return DIRECTION_VECTORS[suffix.replace(/Big$/, '')] ?? [0, 0];
}

function translate([x, y]: Vector, distance = '100%'): string {
  return `translate(${x === 0 ? '0' : `calc(${x} * ${distance})`}, ${y === 0 ? '0' : `calc(${y} * ${distance})`})`;
}

function enterExit(
  entering: boolean,
  offscreen: Keyframe,
  onscreen: Keyframe = { opacity: 1, transform: 'none' },
): Keyframe[] {
  return entering ? [{ opacity: 0, ...offscreen }, onscreen] : [onscreen, { opacity: 0, ...offscreen }];
}

function directionalName(name: string, prefix: string): string {
  return name.slice(prefix.length);
}

/** Resolves one mirrored catalog name into dependency-free original keyframes. */
export function resolveCatalogAnimation(name: string): Keyframe[] | undefined {
  if (!(LYRA_ANIMATION_NAMES as readonly string[]).includes(name)) return undefined;

  if (name.startsWith('fadeIn')) {
    const suffix = directionalName(name, 'fadeIn');
    const distance = suffix.endsWith('Big') ? '200%' : '35%';
    return enterExit(true, suffix ? { transform: translate(vectorFor(suffix), distance) } : {});
  }
  if (name.startsWith('fadeOut')) {
    const suffix = directionalName(name, 'fadeOut');
    const distance = suffix.endsWith('Big') ? '200%' : '35%';
    return enterExit(false, suffix ? { transform: translate(vectorFor(suffix), distance) } : {});
  }
  if (name.startsWith('slideIn')) {
    const suffix = directionalName(name, 'slideIn');
    return enterExit(true, { transform: translate(vectorFor(suffix)) }, { transform: 'none' });
  }
  if (name.startsWith('slideOut')) {
    const suffix = directionalName(name, 'slideOut');
    return enterExit(false, { transform: translate(vectorFor(suffix)) }, { transform: 'none' });
  }
  if (name.startsWith('zoomIn')) {
    const suffix = directionalName(name, 'zoomIn');
    const movement = suffix ? `${translate(vectorFor(suffix), '45%')} ` : '';
    return enterExit(true, { transform: `${movement}scale(0.45)` });
  }
  if (name.startsWith('zoomOut')) {
    const suffix = directionalName(name, 'zoomOut');
    const movement = suffix ? `${translate(vectorFor(suffix), '45%')} ` : '';
    return enterExit(false, { transform: `${movement}scale(0.45)` });
  }
  if (name.startsWith('backIn')) {
    const suffix = directionalName(name, 'backIn');
    return [
      { opacity: 0.3, transform: `${translate(vectorFor(suffix), '100%')} scale(0.7)` },
      { opacity: 0.7, transform: 'translate(0, 0) scale(0.7)', offset: 0.8 },
      { opacity: 1, transform: 'none' },
    ];
  }
  if (name.startsWith('backOut')) {
    const suffix = directionalName(name, 'backOut');
    return [
      { opacity: 1, transform: 'none' },
      { opacity: 0.7, transform: 'translate(0, 0) scale(0.7)', offset: 0.2 },
      { opacity: 0.3, transform: `${translate(vectorFor(suffix), '100%')} scale(0.7)` },
    ];
  }
  if (name.startsWith('bounceIn')) {
    const suffix = directionalName(name, 'bounceIn');
    const movement = suffix ? translate(vectorFor(suffix), '100%') : 'scale(0.25)';
    return [
      { opacity: 0, transform: movement },
      { opacity: 1, transform: 'scale(1.08)', offset: 0.65 },
      { transform: 'scale(0.96)', offset: 0.82 },
      { transform: 'none' },
    ];
  }
  if (name.startsWith('bounceOut')) {
    const suffix = directionalName(name, 'bounceOut');
    const movement = suffix ? translate(vectorFor(suffix), '100%') : 'scale(0.25)';
    return [
      { opacity: 1, transform: 'none' },
      { transform: 'scale(1.08)', offset: 0.25 },
      { opacity: 0, transform: movement },
    ];
  }
  if (name.startsWith('rotateIn') || name.startsWith('rotateOut')) {
    const entering = name.startsWith('rotateIn');
    const prefix = entering ? 'rotateIn' : 'rotateOut';
    const suffix = directionalName(name, prefix);
    const vector = vectorFor(suffix);
    const angle = vector[0] < 0 ? '-45deg' : '45deg';
    return enterExit(entering, {
      transform: `translate(${vector[0] * 20}%, ${vector[1] * 20}%) rotate(${angle})`,
    });
  }
  if (name.startsWith('lightSpeedIn') || name.startsWith('lightSpeedOut')) {
    const entering = name.startsWith('lightSpeedIn');
    const prefix = entering ? 'lightSpeedIn' : 'lightSpeedOut';
    const vector = vectorFor(directionalName(name, prefix));
    return enterExit(entering, {
      transform: `${translate(vector, '100%')} skewX(${vector[0] < 0 ? '18deg' : '-18deg'})`,
    });
  }
  if (name.startsWith('flip')) {
    const entering = name.startsWith('flipIn');
    const exiting = name.startsWith('flipOut');
    const axis = name.endsWith('X') ? 'X' : 'Y';
    if (!entering && !exiting) {
      return [
        { transform: 'perspective(25rem) rotateY(0)' },
        { transform: 'perspective(25rem) rotateY(180deg)', offset: 0.5 },
        { transform: 'perspective(25rem) rotateY(360deg)' },
      ];
    }
    return enterExit(entering, { transform: `perspective(25rem) rotate${axis}(${entering ? '90deg' : '-90deg'})` });
  }

  switch (name) {
    case 'bounce':
      return [
        { transform: 'translateY(0)', offset: 0 },
        { transform: 'translateY(-25%)', offset: 0.4 },
        { transform: 'translateY(0)', offset: 0.7 },
        { transform: 'translateY(-10%)', offset: 0.85 },
        { transform: 'translateY(0)', offset: 1 },
      ];
    case 'flash':
      return [{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 1, offset: 0.5 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }];
    case 'headShake':
    case 'shake':
    case 'shakeX':
      return [{ transform: 'translateX(0)' }, { transform: 'translateX(-6%)' }, { transform: 'translateX(6%)' }, { transform: 'translateX(0)' }];
    case 'shakeY':
      return [{ transform: 'translateY(0)' }, { transform: 'translateY(-6%)' }, { transform: 'translateY(6%)' }, { transform: 'translateY(0)' }];
    case 'heartBeat':
    case 'pulse':
      return [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.45 }, { transform: 'scale(1)' }];
    case 'rubberBand':
      return [{ transform: 'scale(1)' }, { transform: 'scale(1.22, 0.78)' }, { transform: 'scale(0.88, 1.12)' }, { transform: 'scale(1)' }];
    case 'jello':
      return [{ transform: 'skew(0)' }, { transform: 'skew(-10deg, -10deg)' }, { transform: 'skew(6deg, 6deg)' }, { transform: 'skew(0)' }];
    case 'swing':
      return [{ transform: 'rotate(0)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(0)' }];
    case 'tada':
      return [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(0.9) rotate(-4deg)' }, { transform: 'scale(1.08) rotate(4deg)' }, { transform: 'scale(1) rotate(0)' }];
    case 'wobble':
      return [{ transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-16%) rotate(-4deg)' }, { transform: 'translateX(12%) rotate(3deg)' }, { transform: 'translateX(0) rotate(0)' }];
    case 'hinge':
      return [{ transformOrigin: 'top left', transform: 'rotate(0)', opacity: 1 }, { transformOrigin: 'top left', transform: 'rotate(75deg)', opacity: 1, offset: 0.7 }, { transformOrigin: 'top left', transform: 'translateY(100%)', opacity: 0 }];
    case 'jackInTheBox':
      return [{ opacity: 0, transform: 'scale(0.2) rotate(25deg)' }, { opacity: 1, transform: 'none' }];
    case 'rollIn':
      return enterExit(true, { transform: 'translateX(-100%) rotate(-120deg)' });
    case 'rollOut':
      return enterExit(false, { transform: 'translateX(100%) rotate(120deg)' });
    default:
      return undefined;
  }
}

/**
 * Complete mirrored runtime catalog. Each keyframe array and record is frozen so the exported
 * namespace-shaped value cannot become mutable registry state shared by unrelated consumers.
 */
export const animations = Object.freeze({
  ...Object.fromEntries(
    LYRA_ANIMATION_NAMES.map((name) => [
      name,
      Object.freeze(
        (resolveCatalogAnimation(name) ?? []).map((keyframe) => Object.freeze({ ...keyframe })),
      ),
    ]),
  ),
  easings: LYRA_EASINGS,
}) as LyraAnimationCatalog;
