import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Announces each rendered transition into a truncated input (an assigned collection over its
 * limit), never the state the host mounted with and never a render that stays truncated.
 */
export class InputLimitAnnouncement implements ReactiveController {
  private mounted = false;
  private wasLimited = false;

  constructor(
    host: ReactiveControllerHost,
    private readonly options: { limited(): boolean; announce(): void },
  ) {
    host.addController(this);
  }

  hostUpdated(): void {
    const limited = this.options.limited();
    if (this.mounted && limited && !this.wasLimited) this.options.announce();
    this.wasLimited = limited;
    this.mounted = true;
  }
}
