/** Long JSON scalars retain bounded chunks until their owning field policy consumes them. */
export class ModelJsonString {
  constructor(readonly chunks: readonly string[], readonly offsets: readonly number[], readonly length: number) {}
  charAt(index: number): string {
    if (index < 0 || index >= this.length) return '';
    let low = 0; let high = this.offsets.length - 1;
    while (low < high) { const middle = Math.ceil((low + high) / 2); if (this.offsets[middle]! <= index) low = middle; else high = middle - 1; }
    return this.chunks[low]!.charAt(index - this.offsets[low]!);
  }
  toString(): string { return '[Long JSON string]'; }
}

export class ModelJsonStringBuilder {
  private chunks: string[] = [];
  private offsets: number[] = [];
  private tail = '';
  private length = 0;
  append(value: string): void {
    for (let offset = 0; offset < value.length;) {
      const count = Math.min(1024 - this.tail.length, value.length - offset);
      this.tail += value.slice(offset, offset + count); this.length += count; offset += count;
      if (this.tail.length === 1024) { this.offsets.push(this.length - this.tail.length); this.chunks.push(this.tail); this.tail = ''; }
    }
  }
  finish(): string | ModelJsonString {
    if (this.tail) { this.offsets.push(this.length - this.tail.length); this.chunks.push(this.tail); this.tail = ''; }
    if (this.length <= 4096) return this.chunks.join('');
    return new ModelJsonString(this.chunks, this.offsets, this.length);
  }
}

/** Sequential access avoids searching the chunk offsets for every encoded character. */
export class ModelJsonStringCursor {
  private chunk = 0;
  private offset = 0;
  private location: number;
  constructor(private readonly value: string | ModelJsonString, start = 0) {
    this.location = start;
    if (typeof value !== 'string') {
      let high = value.offsets.length - 1;
      while (this.chunk < high) { const middle = Math.ceil((this.chunk + high) / 2); if (value.offsets[middle]! <= start) this.chunk = middle; else high = middle - 1; }
      this.offset = start - value.offsets[this.chunk]!;
    }
  }
  get position(): number { return this.location; }
  private current(): string | undefined {
    if (typeof this.value === 'string') return this.value;
    while (this.chunk < this.value.chunks.length && this.offset === this.value.chunks[this.chunk]!.length) { this.chunk++; this.offset = 0; }
    return this.value.chunks[this.chunk];
  }
  span(limit: number): string {
    const chunk = this.current(); const offset = typeof this.value === 'string' ? this.location : this.offset;
    return chunk?.slice(offset, offset + Math.min(limit, 1024)) ?? '';
  }
  advance(count: number): void { this.location += count; if (typeof this.value !== 'string') this.offset += count; }
  takeCode(): number {
    const chunk = this.current(); const offset = typeof this.value === 'string' ? this.location : this.offset;
    const result = chunk?.charCodeAt(offset) ?? NaN; this.advance(1); return result;
  }
}
