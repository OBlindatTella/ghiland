import type { InputOwner, ShellState } from '@/contracts/input';
import type { ShellModel } from '@/engine/input/shellMachine';
import { create } from 'zustand';

interface InputStore {
  shellState: ShellState;
  pointerLocked: boolean;
  relockBlocked: boolean;
  showClickToWalk: boolean;
  owner: InputOwner;
  applyModel: (model: ShellModel, owner: InputOwner) => void;
  setPointerLocked: (locked: boolean) => void;
  reset: () => void;
}

const released = {
  shellState: 'RELEASED' as const,
  relockBlocked: false,
  showClickToWalk: true,
  pointerLocked: false,
  owner: 'ui' as const,
};

export const useInputStore = create<InputStore>((set) => ({
  ...released,
  applyModel: (model, owner) =>
    set({
      shellState: model.state,
      relockBlocked: model.relockBlocked,
      showClickToWalk: model.showClickToWalk,
      owner,
    }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  reset: () => set(released),
}));

export type { ShellState };
