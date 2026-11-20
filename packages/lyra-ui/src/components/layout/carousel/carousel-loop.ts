/** The side of the real slides a looping clone set sits on. */
type CarouselLoopSide = 'before' | 'after';

/** Elements whose copy would duplicate a resource, a form control or live media. */
const LOOP_SNAPSHOT_UNSAFE_TAGS = new Set([
  'audio',
  'canvas',
  'embed',
  'form',
  'iframe',
  'img',
  'input',
  'link',
  'object',
  'picture',
  'script',
  'select',
  'source',
  'style',
  'textarea',
  'track',
  'video',
]);

/** Attributes whose copy would duplicate an id or a reference from inside the clone. */
const LOOP_CLONE_STRIPPED_ATTRIBUTES = [
  'id',
  'name',
  'form',
  'for',
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
] as const;

/**
 * Returns an inert, hidden presentation copy of `original` for a loop edge, or `undefined` when
 * the slide holds content that cannot be copied safely (custom elements, foreign namespaces,
 * media, embedded documents or form controls).
 */
function prepareLoopClone(
  original: HTMLElement,
  index: number,
  side: CarouselLoopSide
): HTMLElement | undefined {
  const sourceElements = [
    original,
    ...Array.from(original.querySelectorAll<HTMLElement>('*')),
  ];
  if (
    sourceElements.some(
      (element) =>
        element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
        element.localName.includes('-') ||
        LOOP_SNAPSHOT_UNSAFE_TAGS.has(element.localName)
    )
  ) {
    return undefined;
  }
  const clone = original.cloneNode(true) as HTMLElement;
  const descendants = [
    clone,
    ...Array.from(clone.querySelectorAll<HTMLElement>('*')),
  ];
  for (const descendant of descendants) {
    for (const attribute of LOOP_CLONE_STRIPPED_ATTRIBUTES) descendant.removeAttribute(attribute);
  }
  clone.removeAttribute('slot');
  clone.dataset['carouselClone'] = side;
  clone.dataset['carouselIndex'] = String(index);
  clone.inert = true;
  clone.setAttribute('aria-hidden', 'true');
  return clone;
}

/**
 * Appends copies of the last `count` slides to `before` and of the first `count` slides to
 * `after`, in slide order, skipping any slide {@link prepareLoopClone} declines.
 */
export function appendLoopClones(
  before: HTMLElement,
  after: HTMLElement,
  slides: readonly HTMLElement[],
  count: number
): void {
  for (let index = slides.length - count; index < slides.length; index += 1) {
    const clone = prepareLoopClone(slides[index]!, index, 'before');
    if (clone) before.append(clone);
  }
  for (let index = 0; index < count; index += 1) {
    const clone = prepareLoopClone(slides[index]!, index, 'after');
    if (clone) after.append(clone);
  }
}

/** The clone of slide `index` in one clone set, when that slide could be copied. */
export function loopCloneFor(
  container: HTMLElement | undefined,
  index: number
): HTMLElement | undefined {
  return (
    container?.querySelector(`[data-carousel-index="${index}"]`) ??
    undefined
  ) as HTMLElement | undefined;
}
