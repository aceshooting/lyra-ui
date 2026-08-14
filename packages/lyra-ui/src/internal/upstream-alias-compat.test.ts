import { expect, fixture, html } from '@open-wc/testing';
import { setAnimation } from '../utilities/animation-registry.js';
import type { LyraBreadcrumbItem } from '../components/layout/breadcrumb/breadcrumb-item.js';
import type { LyraIcon } from '../components/utility/icon/icon.js';
import type { LyraIconButton } from '../components/forms/icon-button/icon-button.js';
import type { LyraAnimation } from '../components/media/animation/animation.js';
import type { LyraBadge } from '../components/overlays/badge/badge.js';
import type { LyraTag } from '../components/overlays/badge/tag.js';
import type { LyraRating } from '../components/overlays/rating/rating.js';
import type { LyraToastItem } from '../components/overlays/toast/toast-item.js';
import type { LyraToast } from '../components/overlays/toast/toast.js';
import type { LyraSplitPanel } from '../components/layout/split-panel/split-panel.js';
import type { LyraDateInput } from '../components/forms/date-picker/date-input.js';
import type { LyraDateInputValidator } from '../components/forms/date-picker/date-input.js';
import '../components/layout/breadcrumb/breadcrumb-item.js';
import '../components/utility/icon/icon.js';
import '../components/forms/icon-button/icon-button.js';
import '../components/media/animation/animation.js';
import '../components/overlays/badge/badge.js';
import '../components/overlays/badge/tag.js';
import '../components/overlays/rating/rating.js';
import '../components/overlays/toast/toast-item.js';
import '../components/overlays/toast/toast.js';
import '../components/layout/split-panel/split-panel.js';
import '../components/forms/date-picker/date-input.js';

describe('pinned upstream write aliases', () => {
  it('normalizes optional link and icon strings back to canonical empty reads', async () => {
    const breadcrumb = await fixture<LyraBreadcrumbItem>(html`
      <lr-breadcrumb-item href="/guide">Guide</lr-breadcrumb-item>
    `);
    breadcrumb.href = undefined;
    await breadcrumb.updateComplete;
    expect(breadcrumb.href).to.equal('');
    expect(breadcrumb.shadowRoot!.querySelector('[part~="base"]')!.localName).to.equal('button');

    const icon = await fixture<LyraIcon>(html`<lr-icon name="check"></lr-icon>`);
    icon.src = '/unused.svg';
    icon.name = undefined;
    icon.src = undefined;
    await icon.updateComplete;
    expect(icon.name).to.equal('');
    expect(icon.src).to.equal('');

    const iconButton = await fixture<LyraIconButton>(html`
      <lr-icon-button name="check" label="Check"></lr-icon-button>
    `);
    iconButton.name = undefined;
    await iconButton.updateComplete;
    expect(iconButton.name).to.equal('');
    expect(iconButton.icon).to.equal('');
  });

  it('resolves arbitrary animation names through the public registry', async () => {
    const element = await fixture<LyraAnimation>(html`
      <lr-animation><span>Target</span></lr-animation>
    `);
    const cleanup = setAnimation(element, 'animation.consumer-registered', {
      keyframes: [{ opacity: 0.25 }, { opacity: 0.75 }],
      options: { duration: 17 },
    });
    try {
      element.name = 'consumer-registered';
      element.iterations = 2;
      await element.updateComplete;
      const target = element.querySelector('span')!;
      const animation = target.getAnimations()[0];
      expect(animation, 'registered animation is created').to.exist;
      expect(animation!.effect!.getComputedTiming().iterations).to.equal(2);
      const frames = (animation!.effect as KeyframeEffect).getKeyframes();
      expect(frames[0]!.opacity).to.equal('0.25');
      expect(frames.at(-1)!.opacity).to.equal('0.75');
    } finally {
      cleanup();
    }
  });

  it('preserves badge and tag variant spellings while sharing their rendered treatment', async () => {
    const primary = await fixture<LyraBadge>(html`<lr-badge variant="primary">Primary</lr-badge>`);
    const brand = await fixture<LyraBadge>(html`<lr-badge variant="brand">Brand</lr-badge>`);
    expect(primary.variant).to.equal('primary');
    expect(primary.getAttribute('variant')).to.equal('primary');
    expect(primary.getAttribute('data-effective-variant')).to.equal('brand');
    expect(getComputedStyle(primary).getPropertyValue('--lr-color-fill-loud').trim()).to.equal(
      getComputedStyle(brand).getPropertyValue('--lr-color-fill-loud').trim(),
    );

    const tag = await fixture<LyraTag>(html`<lr-tag variant="text">Text</lr-tag>`);
    expect(tag.variant).to.equal('text');
    expect(tag.getAttribute('variant')).to.equal('text');
    expect(tag.getAttribute('data-effective-variant')).to.equal('neutral');
    const surface = tag.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    expect(getComputedStyle(surface).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(surface).borderTopColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('preserves long size aliases while mapping them to the same rendered tiers', async () => {
    const cases = [
      ['small', 's'],
      ['medium', 'm'],
      ['large', 'l'],
    ] as const;

    for (const [alias, canonical] of cases) {
      const tag = await fixture<LyraTag>(html`<lr-tag size=${alias}>Alias</lr-tag>`);
      const canonicalTag = await fixture<LyraTag>(html`<lr-tag size=${canonical}>Canonical</lr-tag>`);
      expect(tag.size, `tag ${alias} read`).to.equal(alias);
      expect(tag.getAttribute('size'), `tag ${alias} reflection`).to.equal(alias);
      expect(tag.getAttribute('data-effective-size'), `tag ${alias} effective size`).to.equal(canonical);
      expect(getComputedStyle(tag.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).minHeight)
        .to.equal(getComputedStyle(canonicalTag.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).minHeight);

      const rating = await fixture<LyraRating>(html`<lr-rating size=${alias}></lr-rating>`);
      const canonicalRating = await fixture<LyraRating>(html`<lr-rating size=${canonical}></lr-rating>`);
      expect(rating.size, `rating ${alias} read`).to.equal(alias);
      expect(rating.getAttribute('size'), `rating ${alias} reflection`).to.equal(alias);
      expect(getComputedStyle(rating).getPropertyValue('--lr-rating-size').trim()).to.equal(
        getComputedStyle(canonicalRating).getPropertyValue('--lr-rating-size').trim(),
      );

      const toast = await fixture<LyraToastItem>(html`<lr-toast-item size=${alias}>Alias</lr-toast-item>`);
      const canonicalToast = await fixture<LyraToastItem>(html`<lr-toast-item size=${canonical}>Canonical</lr-toast-item>`);
      expect(toast.size, `toast ${alias} read`).to.equal(alias);
      expect(toast.getAttribute('size'), `toast ${alias} reflection`).to.equal(alias);
      expect(getComputedStyle(toast.shadowRoot!.querySelector<HTMLElement>('[part~="toast-item"]')!).paddingTop)
        .to.equal(getComputedStyle(canonicalToast.shadowRoot!.querySelector<HTMLElement>('[part~="toast-item"]')!).paddingTop);
    }

    const toastRegion = await fixture<LyraToast>(html`<lr-toast></lr-toast>`);
    const createdToast = await toastRegion.create('Created with an alias', {
      duration: 0,
      size: 'large',
    });
    expect(createdToast.size).to.equal('large');
    expect(createdToast.getAttribute('size')).to.equal('large');
  });

  it('clears split snap with undefined and runs structural date validators', async () => {
    const split = await fixture<LyraSplitPanel>(html`<lr-split-panel snap="25%"></lr-split-panel>`);
    split.snap = undefined;
    expect(split.snap).to.equal('');

    const input = await fixture<LyraDateInput>(html`
      <lr-date-input value="2026-07-15"></lr-date-input>
    `);
    let receivedHost = false;
    input.validators = [{
      checkValidity(host: { value: unknown }) {
        receivedHost = host === input;
        return { message: 'Unavailable', isValid: false, invalidKeys: ['customError'] };
      },
    }];
    await input.updateComplete;
    expect(receivedHost).to.be.true;
    expect(input.validity.customError).to.be.true;
    expect(input.validationMessage).to.equal('Unavailable');
  });

  it('fails closed when a JavaScript object validator returns non-validity keys', async () => {
    const input = await fixture<LyraDateInput>(html`
      <lr-date-input value="2026-07-15"></lr-date-input>
    `);
    for (const invalidKey of ['bogus', 'valid', '__proto__']) {
      input.validators = [{
        checkValidity() {
          return {
            message: `Rejected ${invalidKey}`,
            isValid: false,
            invalidKeys: [invalidKey],
          };
        },
      } as unknown as LyraDateInputValidator];
      await input.updateComplete;
      expect(input.validity.customError, invalidKey).to.be.true;
      expect(input.validity.valid, invalidKey).to.be.false;
      expect(input.validationMessage, invalidKey).to.equal(`Rejected ${invalidKey}`);
    }
  });

  it('revalidates object validators when one of their observed attributes changes', async () => {
    const input = await fixture<LyraDateInput>(html`
      <lr-date-input value="2026-07-15"></lr-date-input>
    `);
    let validityChecks = 0;
    input.validators = [{
      observedAttributes: ['data-blocked'],
      checkValidity(host: { hasAttribute(name: string): boolean }) {
        validityChecks++;
        const blocked = host.hasAttribute('data-blocked');
        return {
          message: blocked ? 'Blocked by policy' : '',
          isValid: !blocked,
          invalidKeys: blocked ? ['customError'] : [],
        };
      },
    }];
    await input.updateComplete;
    expect(input.validity.valid).to.be.true;

    const fixtureParent = input.parentElement!;
    input.remove();
    const checksBeforeDetachedMutation = validityChecks;
    input.setAttribute('data-blocked', '');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(validityChecks).to.equal(checksBeforeDetachedMutation);

    fixtureParent.append(input);
    await input.updateComplete;
    expect(input.validity.customError).to.be.true;
    expect(input.validationMessage).to.equal('Blocked by policy');

    input.removeAttribute('data-blocked');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await input.updateComplete;
    expect(input.validity.valid).to.be.true;

    input.setAttribute('data-blocked', '');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await input.updateComplete;
    expect(input.validity.customError).to.be.true;
    expect(input.validationMessage).to.equal('Blocked by policy');

    input.removeAttribute('data-blocked');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await input.updateComplete;
    expect(input.validity.valid).to.be.true;
  });
});
