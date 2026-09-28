import type { InputOwner, ShellState } from '@/contracts/input';

export function ownerForShell(state: ShellState): InputOwner {
  return state === 'WORLD' ? 'world' : 'ui';
}

interface Frame {
  token: number;
  owner: InputOwner;
}

/**
 * Nested owners. The base frame follows the shell; push/pop restores text fields and overlays.
 */
export class OwnerStack {
  private frames: Frame[];
  private nextToken = 1;

  constructor(base: InputOwner = 'ui') {
    this.frames = [{ token: 0, owner: base }];
  }

  current(): InputOwner {
    return this.frames[this.frames.length - 1]?.owner ?? 'ui';
  }

  setBase(owner: InputOwner): void {
    const base = this.frames[0];
    if (base) base.owner = owner;
  }

  push(owner: InputOwner): number {
    const token = this.nextToken;
    this.nextToken += 1;
    this.frames.push({ token, owner });
    return token;
  }

  pop(token: number): void {
    const index = this.frames.findIndex((frame) => frame.token === token);
    if (index > 0) this.frames.splice(index, 1);
  }
}
