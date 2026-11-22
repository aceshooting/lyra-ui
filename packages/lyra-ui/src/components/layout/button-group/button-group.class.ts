import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { labeledGroupDescription, renderLabeledGroup } from '../../../internal/labeled-group.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './button-group.styles.js';

/**
 * `<lr-button-group>` — a responsive grouping primitive for related actions.
 * It preserves the consumer's button elements and exposes the group semantics
 * on the element that owns the label. A host `aria-label` wins by attribute
 * presence, including an explicitly empty value. The group sizes to its content at every
 * allocation; an explicit host width remains respected. Set `::part(base) { inline-size: 100% }`
 * when its internal row should fill that allocation.
 *
 * @customElement lr-button-group
 * @slot - Buttons or other action controls.
 * @csspart base - The group wrapper.
 * @csspart button-group - Web Awesome-named alias on the same wrapper as `base`.
 * @cssprop [--lr-button-group-gap=var(--lr-space-2xs)] - Gap between grouped controls.
 * @status stable
 * @since 4.0.0
 */
export class LyraButtonGroup extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  private readonly hostDescription = labeledGroupDescription(this);

  /** Logical control axis, using the shared `LyraOrientation` vocabulary. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<LyraOrientation>('horizontal'),
  }) orientation: LyraOrientation = 'horizontal';
  /** Accessible group-name fallback when the host `aria-label` is absent. */
  @property() label = '';

  /** Accessible name taking precedence over the label fallback. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.hostDescription.adopted();
  }

  override render(): TemplateResult {
    return renderLabeledGroup(this, 'button-group');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-button-group': LyraButtonGroup;
  }
}
