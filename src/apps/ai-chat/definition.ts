import type { AppDefinition } from '@/contracts/app';

export const chatApp: AppDefinition = {
  id: 'chat',
  version: 1,
  title: 'Chat',
  icon: 'C',
  category: 'social',
  integration: { kind: 'native', load: () => import('./Chat') },
  capabilities: { textInput: true, network: false, storage: 'none' },
  window: {
    defaultSize: { w: 440, h: 620 },
    minSize: { w: 320, h: 200 },
    resizable: true,
    singleton: true,
    allowedModes: ['overlay', 'detached', 'worldPinned'],
  },
};
