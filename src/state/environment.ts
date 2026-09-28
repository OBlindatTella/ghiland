import { create } from 'zustand';

interface EnvironmentStore {
  audioZone: string;
  exterior: boolean;
  setAudioZone: (audioZone: string, exterior: boolean) => void;
}

export const useEnvironment = create<EnvironmentStore>((set) => ({
  audioZone: '',
  exterior: true,
  setAudioZone: (audioZone, exterior) => set({ audioZone, exterior }),
}));
