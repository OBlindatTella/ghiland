import type { AppDefinition } from '@/contracts/app';

export const notesApp: AppDefinition = {
  id: 'notes',
  version: 1,
  title: 'Notes',
  icon: 'N',
  category: 'productivity',
  integration: { kind: 'native', load: () => import('./Notes') },
  capabilities: { textInput: true, storage: 'local' },
  window: {
    defaultSize: { w: 440, h: 560 },
    minSize: { w: 320, h: 200 },
    resizable: true,
    singleton: true,
    allowedModes: ['overlay', 'detached', 'worldPinned'],
  },
};
