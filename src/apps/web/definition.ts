import type { AppDefinition } from '@/contracts/app';

/** Google refuses to be framed, so the tile opens a tab and the window shows the external card. */
export const webApp: AppDefinition = {
  id: 'web',
  version: 1,
  title: 'Web',
  icon: 'W',
  category: 'media',
  integration: { kind: 'external', url: 'https://www.google.com/' },
  capabilities: { textInput: false, network: true, storage: 'none' },
  window: {
    defaultSize: { w: 420, h: 260 },
    minSize: { w: 320, h: 200 },
    resizable: true,
    singleton: true,
    allowedModes: ['overlay'],
  },
};
