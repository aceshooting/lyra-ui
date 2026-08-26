import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  isCurrentlyAssociatedLabel,
  observeExternalLabelAssociations,
  resolveExternalLabels,
} from '../../../internal/form-control-labels.js';

interface ButtonLabelHost extends HTMLElement, ReactiveControllerHost {
  readonly accessibleLabel: string | null;
  readonly effectiveDisabled: boolean;
  readonly loading: boolean;
  readonly renderRoot: HTMLElement | DocumentFragment;
  click(): void;
  focus(options?: FocusOptions): void;
}

function labelText(node: Node, host: Node): string {
  if (node === host) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  let text = '';
  for (const child of node.childNodes) text += labelText(child, host);
  return text;
}

function resolvedLabel(labels: readonly HTMLLabelElement[], host: Node): string {
  return labels.map((label) => labelText(label, host).trim()).filter(Boolean).join(' ');
}

class ButtonExternalLabelController implements ReactiveController {
  private labels: HTMLLabelElement[] = [];
  private associationSubscription?: ReturnType<typeof observeExternalLabelAssociations>;
  private applied?: { target: HTMLElement; name: string };
  private activating = false;

  constructor(private readonly host: ButtonLabelHost) {}

  hostConnected(): void {
    this.associationSubscription?.disconnect();
    this.associationSubscription = observeExternalLabelAssociations(this.host, () => this.refresh());
    this.refresh();
  }

  hostUpdated(): void {
    this.refresh();
  }

  hostDisconnected(): void {
    this.associationSubscription?.disconnect();
    this.associationSubscription = undefined;
    this.release();
    for (const label of this.labels) label.removeEventListener('click', this.onLabelClick);
    this.labels = [];
  }

  private refresh(): void {
    const next = resolveExternalLabels(this.host);
    if (next.length !== this.labels.length || next.some((label, index) => label !== this.labels[index])) {
      for (const label of this.labels) label.removeEventListener('click', this.onLabelClick);
      this.labels = next;
      for (const label of this.labels) label.addEventListener('click', this.onLabelClick);
    }
    this.associationSubscription?.update(next);
    if (this.host.accessibleLabel !== null) {
      this.release();
      return;
    }
    const name = resolvedLabel(this.labels, this.host);
    const target = this.host.renderRoot.querySelector<HTMLElement>('[part~="base"]');
    if (!target || !name) {
      this.release();
      return;
    }
    if (this.applied?.target !== target) this.release();
    this.applied ??= {
      target,
      name,
    };
    if (target.getAttribute('aria-label') !== name) target.setAttribute('aria-label', name);
    this.applied.name = name;
  }

  private release(): void {
    const applied = this.applied;
    this.applied = undefined;
    if (!applied || applied.target.getAttribute('aria-label') !== applied.name) return;
    applied.target.removeAttribute('aria-label');
  }

  private get barred(): boolean {
    return this.host.effectiveDisabled || this.host.loading || this.host.matches(':disabled');
  }

  private readonly onLabelClick = (event: Event): void => {
    if (this.activating || this.barred || event.composedPath().includes(this.host)) return;
    const label = event.currentTarget as HTMLLabelElement;
    if (!isCurrentlyAssociatedLabel(label, this.host)) {
      this.refresh();
      return;
    }
    queueMicrotask(() => {
      if (
        event.defaultPrevented ||
        !this.host.isConnected ||
        this.barred ||
        !isCurrentlyAssociatedLabel(label, this.host)
      ) {
        return;
      }
      this.activating = true;
      try {
        this.host.focus();
        this.host.click();
      } finally {
        this.activating = false;
      }
    });
  };
}

export function createButtonExternalLabelController(host: HTMLElement): ReactiveController {
  return new ButtonExternalLabelController(host as ButtonLabelHost);
}
