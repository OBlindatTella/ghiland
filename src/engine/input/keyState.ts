/** Physical key set. Suppressed codes stay down but do not count until keyup. */
export class KeyState {
  private down = new Set<string>();
  private suppress = new Set<string>();

  keyDown(code: string): void {
    this.down.add(code);
  }

  keyUp(code: string): void {
    this.down.delete(code);
    this.suppress.delete(code);
  }

  clear(): void {
    this.down.clear();
    this.suppress.clear();
  }

  /** Keys already held when the world takes the keyboard must not move the player. */
  suppressHeld(): void {
    for (const code of this.down) this.suppress.add(code);
  }

  isDown(code: string): boolean {
    return this.down.has(code) && !this.suppress.has(code);
  }
}
