/** Memoizes capability answers for one published snapshot; transient (busy/composing) answers are never kept. */
export class AvailabilityMemo<Availability extends { reason?: string }> {
  private owner: unknown = null;
  private readonly answers = new Map<string, Availability>();

  get(owner: unknown, key: string, compute: () => Availability): Availability {
    if (this.owner !== owner) { this.owner = owner; this.answers.clear(); }
    const known = this.answers.get(key);
    if (known) return known;
    const answer = compute();
    if (answer.reason !== 'busy' && answer.reason !== 'composing') this.answers.set(key, answer);
    return answer;
  }
}
