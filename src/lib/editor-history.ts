/** Immutable snapshots share unchanged blocks and image strings. */
export class EditorHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  private group: string | undefined;
  private lastChange = 0;

  constructor(
    private readonly limit = 100,
    private readonly typingDelay = 700,
  ) {}

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }

  record(previous: T, group?: string, now = Date.now()) {
    if (
      !group ||
      group !== this.group ||
      now - this.lastChange > this.typingDelay ||
      this.future.length
    ) {
      this.past.push(previous);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
    this.group = group;
    this.lastChange = now;
  }

  closeGroup() {
    this.group = undefined;
  }

  undo(current: T): T | undefined {
    if (!this.canUndo) return undefined;
    this.future.push(current);
    this.closeGroup();
    return this.past.pop();
  }

  redo(current: T): T | undefined {
    if (!this.canRedo) return undefined;
    this.past.push(current);
    this.closeGroup();
    return this.future.pop();
  }
}
